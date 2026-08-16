import { createSupabaseBrowserClient } from '@/lib/supabase';
import { colorForUser } from '@/lib/realtime';
import type { JSONContent } from '@tiptap/core';
import type { DocumentTemplateId } from '@/lib/templates';
import { getTemplate } from '@/lib/templates';
import { trackEvent } from '@/lib/telemetry';

export type DocStatus = 'main' | 'branch' | 'draft';
export type DashboardNav = 'projects' | 'recent' | 'starred' | 'shared' | 'trash';

export type DashboardCollaborator = {
  id: string;
  email: string | null;
  name: string;
  color: string;
};

export type DashboardDocRow = {
  id: string;
  title: string;
  project_name: string;
  parent_id: string | null;
  doc_status: DocStatus;
  branch_count: number;
  last_activity_at: string;
  starred: boolean;
  collaborators: DashboardCollaborator[];
  source: 'owned' | 'shared';
  role?: 'owner' | 'editor' | 'viewer';
  owner_email?: string;
};

type RawDoc = {
  id: string;
  title: string | null;
  updated_at: string;
  owner_id: string;
  parent_id?: string | null;
  project_name?: string | null;
  starred?: boolean | null;
  doc_status?: string | null;
  last_merged_at?: string | null;
  deleted_at?: string | null;
};

const EXTENDED_SELECT =
  'id, title, updated_at, owner_id, parent_id, project_name, starred, doc_status, last_merged_at, deleted_at';
const BASE_SELECT = 'id, title, updated_at, owner_id';

function isMissingColumnError(message: string, code?: string): boolean {
  return /column .* does not exist|42703|PGRST204/i.test(message + ' ' + (code ?? ''));
}

export function deriveDocStatus(doc: {
  parent_id?: string | null;
  doc_status?: string | null;
}): DocStatus {
  if (doc.parent_id) return 'branch';
  if (doc.doc_status === 'main' || doc.doc_status === 'draft') {
    return doc.doc_status as DocStatus;
  }
  return 'main';
}

export function lastActivityAt(doc: RawDoc): string {
  const merged = doc.last_merged_at;
  if (merged && doc.updated_at) {
    return new Date(merged) > new Date(doc.updated_at) ? merged : doc.updated_at;
  }
  return doc.updated_at;
}

function toRow(
  doc: RawDoc,
  branchCount: number,
  collaborators: DashboardCollaborator[],
  extras: Pick<DashboardDocRow, 'source'> & Partial<Pick<DashboardDocRow, 'role' | 'owner_email'>>
): DashboardDocRow {
  return {
    id: doc.id,
    title: doc.title || 'Untitled',
    project_name: doc.project_name ?? 'General',
    parent_id: doc.parent_id ?? null,
    doc_status: deriveDocStatus(doc),
    branch_count: branchCount,
    last_activity_at: lastActivityAt(doc),
    starred: doc.starred ?? false,
    collaborators,
    ...extras,
  };
}

/** Count child documents where `parent_id` equals each trunk row's `id`. */
async function fetchBranchCounts(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  trunkIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (trunkIds.length === 0) return counts;

  const { data, error } = await supabase
    .from('documents')
    .select('parent_id, doc_status')
    .in('parent_id', trunkIds);

  if (error) {
    if (!isMissingColumnError(error.message, error.code ?? undefined)) {
      console.warn('[dashboard] branch count fetch failed:', error.message);
    }
    return counts;
  }

  for (const row of data ?? []) {
    if ((row as { doc_status?: string | null }).doc_status === 'merged') continue;
    const pid = row.parent_id as string;
    counts.set(pid, (counts.get(pid) ?? 0) + 1);
  }
  return counts;
}

async function fetchCollaboratorsForDocs(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  docIds: string[],
  ownerIds: Map<string, string>
): Promise<Map<string, DashboardCollaborator[]>> {
  const byDoc = new Map<string, DashboardCollaborator[]>();
  for (const id of docIds) byDoc.set(id, []);

  if (docIds.length === 0) return byDoc;

  const { data: collabs } = await supabase
    .from('document_collaborators')
    .select('document_id, user_id, email')
    .in('document_id', docIds);

  const userIds = new Set<string>();
  for (const [, ownerId] of ownerIds) {
    if (ownerId) userIds.add(ownerId);
  }
  for (const c of collabs ?? []) {
    if (c.user_id) userIds.add(c.user_id);
  }

  const profileMap = new Map<string, string>();
  if (userIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', [...userIds]);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, p.email ?? '');
    }
  }

  for (const docId of docIds) {
    const list: DashboardCollaborator[] = [];
    const ownerId = ownerIds.get(docId);
    if (ownerId) {
      const email = profileMap.get(ownerId) ?? null;
      list.push({
        id: ownerId,
        email,
        name: email?.split('@')[0] ?? 'Owner',
        color: colorForUser(ownerId),
      });
    }
    for (const c of collabs ?? []) {
      if (c.document_id !== docId) continue;
      const email = c.user_id ? profileMap.get(c.user_id) ?? c.email : c.email;
      const id = c.user_id ?? `email:${c.email}`;
      if (list.some((x) => x.id === id)) continue;
      list.push({
        id,
        email: email ?? c.email,
        name: (email ?? c.email)?.split('@')[0] ?? 'Collaborator',
        color: colorForUser(c.user_id ?? c.email),
      });
    }
    byDoc.set(docId, list.slice(0, 5));
  }

  return byDoc;
}

async function selectDocuments(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  filter: { column: string; value: string } | { column: string; values: string[] },
  opts?: { includeDeleted?: boolean }
): Promise<RawDoc[]> {
  let q = supabase.from('documents').select(EXTENDED_SELECT);
  if ('value' in filter) {
    q = q.eq(filter.column, filter.value);
  } else {
    q = q.in(filter.column, filter.values);
  }

  if (!opts?.includeDeleted) {
    q = q.is('deleted_at', null);
  }

  let { data, error } = await q.order('updated_at', { ascending: false });

  if (error && !opts?.includeDeleted && isMissingColumnError(error.message, error.code ?? undefined)) {
    let retry = supabase.from('documents').select(EXTENDED_SELECT);
    if ('value' in filter) {
      retry = retry.eq(filter.column, filter.value);
    } else {
      retry = retry.in(filter.column, filter.values);
    }
    const retryResult = await retry.order('updated_at', { ascending: false });
    data = retryResult.data;
    error = retryResult.error;
  }

  if (!error && data) return data as RawDoc[];

  if (error && isMissingColumnError(error.message, error.code ?? undefined)) {
    let fb = supabase.from('documents').select(BASE_SELECT);
    if ('value' in filter) {
      fb = fb.eq(filter.column, filter.value);
    } else {
      fb = fb.in(filter.column, filter.values);
    }
    const { data: baseData, error: baseErr } = await fb.order('updated_at', { ascending: false });
    if (baseErr) {
      console.error('[dashboard] documents fetch failed:', baseErr);
      return [];
    }
    return (baseData ?? []) as RawDoc[];
  }

  if (error) console.error('[dashboard] documents fetch failed:', error);
  return [];
}

export async function fetchDashboardDocuments(
  userId: string
): Promise<{ rows: DashboardDocRow[]; error?: string }> {
  const supabase = createSupabaseBrowserClient();

  try {
    const ownedRaw = await selectDocuments(supabase, { column: 'owner_id', value: userId });
  const trunkIds = ownedRaw.filter((d) => !d.parent_id).map((d) => d.id);
  const branchCounts = await fetchBranchCounts(supabase, trunkIds);

  const ownerMap = new Map<string, string>();
  for (const d of ownedRaw) ownerMap.set(d.id, d.owner_id);

  const ownedIds = ownedRaw.map((d) => d.id);
  const collabMap = await fetchCollaboratorsForDocs(supabase, ownedIds, ownerMap);

  const ownedRows: DashboardDocRow[] = ownedRaw
    .filter((d) => !d.parent_id)
    .map((doc) =>
      toRow(doc, branchCounts.get(doc.id) ?? 0, collabMap.get(doc.id) ?? [], {
        source: 'owned',
        role: 'owner',
      })
    );

  const { data: collabs } = await supabase
    .from('document_collaborators')
    .select('document_id, role')
    .eq('user_id', userId);

  type CollabRow = { document_id: string; role: string };

  let sharedRows: DashboardDocRow[] = [];
  if (collabs && collabs.length > 0) {
    const sharedIds = (collabs as CollabRow[]).map((c) => c.document_id);
    const sharedRaw = await selectDocuments(supabase, { column: 'id', values: sharedIds });
    const sharedTrunk = sharedRaw.filter((d) => !d.parent_id);
    const sharedTrunkIds = sharedTrunk.map((d) => d.id);
    const sharedBranchCounts = await fetchBranchCounts(supabase, sharedTrunkIds);

    const sharedOwnerMap = new Map<string, string>();
    for (const d of sharedTrunk) sharedOwnerMap.set(d.id, d.owner_id);
    const sharedCollabMap = await fetchCollaboratorsForDocs(supabase, sharedTrunkIds, sharedOwnerMap);

    const ownerIds = [...new Set(sharedTrunk.map((d) => d.owner_id))];
    const ownerEmails = new Map<string, string>();
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', ownerIds);
      for (const p of profiles ?? []) ownerEmails.set(p.id, p.email ?? 'Unknown');
    }

    sharedRows = sharedTrunk.map((doc) => {
      const role = (collabs as CollabRow[]).find((c) => c.document_id === doc.id)?.role as
        | 'editor'
        | 'viewer'
        | undefined;
      return toRow(
        doc,
        sharedBranchCounts.get(doc.id) ?? 0,
        sharedCollabMap.get(doc.id) ?? [],
        {
          source: 'shared',
          role: role ?? 'viewer',
          owner_email: ownerEmails.get(doc.owner_id),
        }
      );
    });
  }

  return { rows: [...ownedRows, ...sharedRows] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load documents';
    return { rows: [], error: message };
  }
}

export function filterByNav(rows: DashboardDocRow[], nav: DashboardNav, userId: string): DashboardDocRow[] {
  switch (nav) {
    case 'projects':
      return rows.filter((r) => r.source === 'owned' || r.source === 'shared');
    case 'recent':
      return [...rows].sort(
        (a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
      );
    case 'starred':
      return rows.filter((r) => r.starred && r.source === 'owned');
    case 'shared':
      return rows.filter((r) => r.source === 'shared');
    case 'trash':
      return rows.filter((r) => r.source === 'owned');
    default:
      return rows;
  }
}

export function filterBySearch(rows: DashboardDocRow[], query: string): DashboardDocRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.project_name.toLowerCase().includes(q) ||
      (r.owner_email?.toLowerCase().includes(q) ?? false)
  );
}

export function groupByProject(rows: DashboardDocRow[]): Map<string, DashboardDocRow[]> {
  const map = new Map<string, DashboardDocRow[]>();
  for (const row of rows) {
    const key = row.project_name || 'General';
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export async function createDocument(
  userId: string,
  projectName = 'General',
  templateId: DocumentTemplateId = 'blank'
): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const template = getTemplate(templateId);
  const newId =
    self.crypto.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const payload: Record<string, unknown> = {
    id: newId,
    title: template.defaultTitle,
    content: template.content as JSONContent,
    owner_id: userId,
    project_name: projectName,
    parent_id: null,
    doc_status: 'main',
    starred: false,
  };

  let { error } = await supabase.from('documents').insert(payload);

  if (error && isMissingColumnError(error.message, error.code ?? undefined)) {
    const { error: baseErr } = await supabase.from('documents').insert({
      id: newId,
      title: 'Untitled',
      content: null,
      owner_id: userId,
    });
    error = baseErr;
  }

  if (error) {
    console.error('[dashboard] create document failed:', error);
    return null;
  }
  void trackEvent('document_created', {
    documentId: newId,
    projectName,
    templateId,
  });
  return newId;
}

export async function renameDocument(id: string, title: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from('documents')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function updateDocumentProject(id: string, projectName: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from('documents')
    .update({ project_name: projectName.trim() || 'General' })
    .eq('id', id);
  if (error && isMissingColumnError(error.message, error.code ?? undefined)) return false;
  return !error;
}

export async function fetchTrashedDocuments(userId: string): Promise<DashboardDocRow[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('documents')
    .select(EXTENDED_SELECT)
    .eq('owner_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    if (isMissingColumnError(error.message, error.code ?? undefined)) return [];
    console.error('[dashboard] trash fetch failed:', error);
    return [];
  }

  return ((data ?? []) as RawDoc[])
    .filter((d) => !d.parent_id)
    .map((doc) =>
      toRow(doc, 0, [], { source: 'owned', role: 'owner' })
    );
}

export async function deleteDocument(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('documents')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', id);

  if (error && isMissingColumnError(error.message, error.code ?? undefined)) {
    const { error: hardErr } = await supabase.from('documents').delete().eq('id', id);
    return !hardErr;
  }

  return !error;
}

export async function restoreDocument(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from('documents')
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error && isMissingColumnError(error.message, error.code ?? undefined)) return false;
  return !error;
}

export async function permanentlyDeleteDocument(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from('documents').delete().eq('id', id);
  return !error;
}

export async function toggleDocumentStar(id: string, starred: boolean): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from('documents').update({ starred }).eq('id', id);
  if (error && isMissingColumnError(error.message, error.code ?? undefined)) return false;
  return !error;
}
