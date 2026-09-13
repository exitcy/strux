import type { JSONContent } from '@tiptap/core';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import {
  applyProposedTextAtNodeIndex,
  findNodeIndexByBlockId,
  findNodeIndexByText,
  getBlockTextById,
} from '@/lib/document-content';
import {
  cloneParentContent,
  createDocumentBranch,
  fetchParentDocumentRow,
  persistBranchContent,
} from '@/lib/branches';
import { trackEvent } from '@/lib/telemetry';

export type CommentForBranch = {
  id: string;
  content: string;
  highlighted_text: string | null;
  block_id?: string | null;
};

export type ProvisionCommentAIBranchResult = {
  branchId: string;
  changeId: string;
  commentId: string;
  nodeIndex: number;
  originalText: string;
  proposedText: string;
  branchTitle: string;
};

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * One-click refactor: branch from parent, AI rewrite on selection, proposed_change on branch.
 */
export async function provisionCommentAIBranch(params: {
  parentDocumentId: string;
  comment: CommentForBranch;
  documentContextText: string;
  documentContentJson?: JSONContent | null;
  userId: string;
  userEmail: string | null;
}): Promise<ProvisionCommentAIBranchResult> {
  const parent = await fetchParentDocumentRow(params.parentDocumentId);
  if (!parent) {
    throw new Error('Could not load parent document');
  }

  const parentContent = params.documentContentJson ?? cloneParentContent(parent);
  const blockId = params.comment.block_id?.trim() ?? '';
  let originalText = params.comment.highlighted_text?.trim() ?? '';
  let nodeIndex = -1;

  if (blockId) {
    nodeIndex = findNodeIndexByBlockId(parentContent, blockId);
    if (nodeIndex >= 0 && !originalText) {
      originalText = getBlockTextById(parentContent, blockId) ?? '';
    }
  }
  if (nodeIndex < 0) {
    nodeIndex = findNodeIndexByText(parentContent, originalText);
  }
  if (!originalText && nodeIndex >= 0) {
    throw new Error('Could not locate the commented text block in this document');
  }

  const res = await fetch('/api/ai/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      comment: params.comment.content,
      highlightedText: originalText,
      surroundingContext: params.documentContextText,
      documentContext: params.documentContextText,
    }),
  });

  const data = (await res.json()) as { proposedText?: string; error?: string };
  if (!res.ok || data.error) {
    throw new Error(data.error ?? 'AI suggestion failed');
  }

  const proposedText = data.proposedText?.trim() ?? '';
  if (!proposedText) {
    throw new Error('AI returned an empty suggestion');
  }

  // Apply onto the same JSON used for indexing (live editor snapshot when
  // available). A second DB clone can be empty/stale while Yjs is authoritative.
  const branchContent = applyProposedTextAtNodeIndex(
    parentContent,
    nodeIndex,
    proposedText
  );

  const branchTitle = `${parent.title ?? 'Untitled'} — AI branch`;
  const branchId = await createDocumentBranch({
    parentId: params.parentDocumentId,
    ownerId: params.userId,
    branchContent,
    branchTitle,
    sourceCommentId: params.comment.id,
  });

  if (!branchId) {
    throw new Error('Failed to create branch document');
  }

  const supabase = createSupabaseBrowserClient();
  const branchCommentId = generateId();

  await supabase.from('comments').insert({
    id: branchCommentId,
    document_id: branchId,
    user_id: params.userId,
    user_email: params.userEmail ?? 'Reviewer',
    content: params.comment.content,
    highlighted_text: originalText || null,
    block_id: blockId || null,
    parent_id: null,
  });

  const changeId = generateId();
  await supabase.from('proposed_changes').insert({
    id: changeId,
    comment_id: branchCommentId,
    document_id: branchId,
    node_index: nodeIndex,
    original_text: originalText,
    proposed_text: proposedText,
    created_by: params.userId,
    status: 'pending',
  });

  await persistBranchContent(branchId, branchContent, branchTitle);

  void trackEvent('branch_created', {
    branchId,
    parentDocumentId: params.parentDocumentId,
    source: 'ai-comment',
    commentId: params.comment.id,
  });

  return {
    branchId,
    changeId,
    commentId: branchCommentId,
    nodeIndex,
    originalText,
    proposedText,
    branchTitle,
  };
}
