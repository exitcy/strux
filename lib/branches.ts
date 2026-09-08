import type { JSONContent } from '@tiptap/core';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { isMissingColumnError } from '@/lib/supabase/errors';
import { fetchDocumentBootstrap, saveDocumentSnapshot } from '@/lib/realtime';
import { emptyDoc } from '@/lib/document-content';

export type ParentDocumentRow = {
  id: string;
  title: string | null;
  content: JSONContent | null;
  owner_id: string;
  project_name?: string | null;
};

export async function fetchParentDocumentRow(documentId: string): Promise<ParentDocumentRow | null> {
  const supabase = createSupabaseBrowserClient();

  let { data, error } = await supabase
    .from('documents')
    .select('id, title, content, owner_id, project_name')
    .eq('id', documentId)
    .single();

  if (error && isMissingColumnError(error.message, error.code ?? undefined)) {
    const fb = await supabase
      .from('documents')
      .select('id, title, content, owner_id')
      .eq('id', documentId)
      .single();
    data = fb.data;
    error = fb.error;
  }

  if (error || !data) return null;

  return {
    id: data.id as string,
    title: (data.title as string | null) ?? 'Untitled',
    content: (data.content as JSONContent | null) ?? null,
    owner_id: data.owner_id as string,
    project_name: (data as { project_name?: string | null }).project_name ?? 'General',
  };
}

export type CreateBranchInput = {
  parentId: string;
  ownerId: string;
  branchContent: JSONContent;
  branchTitle: string;
  sourceCommentId?: string;
};

/**
 * Insert a branch row pointing at `parentId`, inheriting parent JSON content
 * (already mutated by caller when AI has run).
 */
export async function createDocumentBranch(input: CreateBranchInput): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const branchId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const parent = await fetchParentDocumentRow(input.parentId);
  if (!parent) return null;

  const payload: Record<string, unknown> = {
    id: branchId,
    title: input.branchTitle,
    content: input.branchContent,
    owner_id: input.ownerId,
    parent_id: input.parentId,
    doc_status: 'branch',
    project_name: parent.project_name ?? 'General',
    starred: false,
  };

  let { error } = await supabase.from('documents').insert(payload);

  if (error && isMissingColumnError(error.message, error.code ?? undefined)) {
    const { error: baseErr } = await supabase.from('documents').insert({
      id: branchId,
      title: input.branchTitle,
      content: input.branchContent,
      owner_id: input.ownerId,
    });
    error = baseErr;
  }

  if (error) {
    console.error('[branches] create branch failed:', error);
    return null;
  }

  return branchId;
}

/** Clone parent JSON (or empty doc) for branch bootstrap before AI edits. */
export function cloneParentContent(parent: ParentDocumentRow | null): JSONContent {
  if (parent?.content) {
    return JSON.parse(JSON.stringify(parent.content)) as JSONContent;
  }
  return emptyDoc();
}

/** Persist branch JSON (+ optional Yjs) after AI implementation. */
export async function persistBranchContent(
  branchId: string,
  content: JSONContent,
  title: string
): Promise<boolean> {
  const boot = await fetchDocumentBootstrap(branchId);
  const result = await saveDocumentSnapshot({
    documentId: branchId,
    yjsState: boot?.yjsState ?? null,
    content,
    title,
  });
  return result.ok;
}
