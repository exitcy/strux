import type { SupabaseClient } from '@supabase/supabase-js';
import type { JSONContent } from '@tiptap/core';
import { blockText, findNodeIndexByBlockId, findNodeIndexByText } from '@/lib/document-content';
import { isMissingColumnError } from '@/lib/supabase/errors';

export type CommentRecord = {
  id: string;
  user_email: string;
  content: string;
  highlighted_text: string | null;
  block_id: string | null;
  is_resolved: boolean;
  created_at: string;
  user_id: string;
  parent_id: string | null;
};

/** Normalize Supabase row (`is_resolved` vs legacy `resolved`). */
export function mapCommentRow(row: Record<string, unknown>): CommentRecord {
  return {
    id: String(row.id),
    user_email: String(row.user_email ?? ''),
    content: String(row.content ?? ''),
    highlighted_text: (row.highlighted_text as string | null) ?? null,
    block_id: (row.block_id as string | null) ?? null,
    is_resolved: Boolean(row.is_resolved ?? row.resolved ?? false),
    created_at: String(row.created_at ?? new Date().toISOString()),
    user_id: String(row.user_id ?? ''),
    parent_id: (row.parent_id as string | null) ?? null,
  };
}

export type CommentAnchor = {
  text: string;
  nodeIndex: number;
  blockId: string | null;
  stale: boolean;
};

/** Resolve which document block a comment refers to (block_id preferred). */
export function resolveCommentAnchor(
  comment: Pick<CommentRecord, 'highlighted_text' | 'block_id'>,
  documentContentJson: JSONContent | null | undefined,
  documentPlainText: string
): CommentAnchor | null {
  const content = documentContentJson ?? { type: 'doc', content: [] };

  if (comment.block_id) {
    const nodeIndex = findNodeIndexByBlockId(content, comment.block_id);
    if (nodeIndex >= 0) {
      const nodes = content.content ?? [];
      const text = blockText(nodes[nodeIndex]);
      return {
        text: text || comment.highlighted_text || '',
        nodeIndex,
        blockId: comment.block_id,
        stale: false,
      };
    }
  }

  const highlight = comment.highlighted_text?.trim() ?? '';
  if (highlight) {
    const inDoc =
      documentPlainText.includes(highlight) ||
      findNodeIndexByText(content, highlight) >= 0;
    if (inDoc) {
      return {
        text: highlight,
        nodeIndex: findNodeIndexByText(content, highlight),
        blockId: comment.block_id,
        stale: false,
      };
    }
    return {
      text: highlight,
      nodeIndex: 0,
      blockId: comment.block_id,
      stale: true,
    };
  }

  return null;
}

export async function setCommentResolved(
  supabase: SupabaseClient,
  commentId: string,
  resolved: boolean
): Promise<{ error: Error | null }> {
  let { error } = await supabase
    .from('comments')
    .update({ is_resolved: resolved })
    .eq('id', commentId);

  if (error && isMissingColumnError(error.message, error.code ?? undefined)) {
    const fallback = await supabase
      .from('comments')
      .update({ resolved })
      .eq('id', commentId);
    error = fallback.error;
  }

  return { error: error ? new Error(error.message) : null };
}
