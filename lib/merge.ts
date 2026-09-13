import type { JSONContent } from '@tiptap/core';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { isMissingColumnError } from '@/lib/supabase/errors';
import { saveDocumentSnapshot } from '@/lib/realtime';

export type BranchInfo = {
  id: string;
  parentId: string;
  title: string;
  parentTitle: string;
};

export async function fetchBranchInfo(documentId: string): Promise<BranchInfo | null> {
  const supabase = createSupabaseBrowserClient();

  let { data, error } = await supabase
    .from('documents')
    .select('id, parent_id, title, doc_status')
    .eq('id', documentId)
    .single();

  if (error && isMissingColumnError(error.message, error.code ?? undefined)) {
    const fb = await supabase.from('documents').select('id, title').eq('id', documentId).single();
    if (fb.error || !fb.data) return null;
    return null;
  }

  if (error || !data?.parent_id) return null;

  if (data.doc_status === 'merged') return null;

  const parentId = data.parent_id as string;
  const { data: parent } = await supabase
    .from('documents')
    .select('title')
    .eq('id', parentId)
    .single();

  return {
    id: data.id as string,
    parentId,
    title: (data.title as string | null) ?? 'Untitled',
    parentTitle: (parent?.title as string | null) ?? 'Parent document',
  };
}

export type MergeResult =
  | { ok: true; parentId: string }
  | { ok: false; error: string };

/**
 * Merge a branch document into its parent trunk.
 * Copies branch content + title into parent, marks branch as merged.
 */
export async function mergeBranchIntoParent(
  branchId: string,
  branchContent: JSONContent,
  branchTitle: string,
  yjsState?: Uint8Array | null
): Promise<MergeResult> {
  const supabase = createSupabaseBrowserClient();

  const { data: branch, error: branchErr } = await supabase
    .from('documents')
    .select('parent_id, owner_id')
    .eq('id', branchId)
    .single();

  if (branchErr || !branch?.parent_id) {
    return { ok: false, error: branchErr?.message ?? 'Branch has no parent document' };
  }

  const parentId = branch.parent_id as string;
  const now = new Date().toISOString();

  const parentUpdate: Record<string, unknown> = {
    content: branchContent,
    title: branchTitle,
    updated_at: now,
    last_merged_at: now,
  };

  let { error: parentErr } = await supabase
    .from('documents')
    .update(parentUpdate)
    .eq('id', parentId);

  if (parentErr && isMissingColumnError(parentErr.message, parentErr.code ?? undefined)) {
    const fb = await supabase
      .from('documents')
      .update({ content: branchContent, title: branchTitle, updated_at: now })
      .eq('id', parentId);
    parentErr = fb.error;
  }

  if (parentErr) {
    return { ok: false, error: parentErr.message };
  }

  if (yjsState && yjsState.length > 0) {
    await saveDocumentSnapshot({
      documentId: parentId,
      yjsState,
      content: branchContent,
      title: branchTitle,
    });
  }

  const branchUpdate: Record<string, unknown> = {
    doc_status: 'merged',
    updated_at: now,
  };

  let { error: markErr } = await supabase
    .from('documents')
    .update(branchUpdate)
    .eq('id', branchId);

  if (markErr && isMissingColumnError(markErr.message, markErr.code ?? undefined)) {
    markErr = null;
  }

  if (markErr) {
    return { ok: false, error: markErr.message };
  }

  return { ok: true, parentId };
}
