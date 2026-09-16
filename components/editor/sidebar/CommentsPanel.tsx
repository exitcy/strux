'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { JSONContent } from '@tiptap/core';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  GitBranch,
  Loader2,
  MessageSquareReply,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { provisionCommentAIBranch } from '@/lib/comment-ai-branch';
import {
  mapCommentRow,
  resolveCommentAnchor,
  setCommentResolved,
  type CommentRecord,
} from '@/lib/comments';
import { timeAgo } from '@/lib/utils/time';
import { Button } from '@/components/ui/button';
import type { InlineSuggestionProposal } from '@/components/editor/extensions/inline-suggestion';
import ProposedChange from './ProposedChange';

interface ProposedChangeData {
  id: string;
  comment_id: string;
  node_index: number;
  original_text: string;
  proposed_text: string;
  status: string;
}

interface CommentsPanelProps {
  documentId: string;
  selectedText?: string;
  selectedBlockId?: string | null;
  documentContent: string;
  documentContentJson?: JSONContent | null;
  documentTitle?: string;
  focusChangeId?: string | null;
  onSyncInlineSuggestions: (proposals: InlineSuggestionProposal[]) => void;
  onFocusInlineSuggestion: (id: string) => void;
  /** Bumped when an inline Accept/Reject resolves outside this panel. */
  inlineResolveToken?: number;
  getNodeIndex: (text: string) => number;
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function CommentsPanel({
  documentId,
  selectedText,
  selectedBlockId,
  documentContent,
  documentContentJson,
  documentTitle = 'Untitled',
  focusChangeId,
  onSyncInlineSuggestions,
  onFocusInlineSuggestion,
  inlineResolveToken = 0,
  getNodeIndex,
}: CommentsPanelProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [proposedChanges, setProposedChanges] = useState<ProposedChangeData[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [askingAI, setAskingAI] = useState<string | null>(null);
  const [aiSuggestError, setAiSuggestError] = useState<{ commentId: string; message: string } | null>(null);
  const [implementingBranch, setImplementingBranch] = useState<string | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const fetchData = async () => {
    const supabase = createSupabaseBrowserClient();
    const [commentsRes, changesRes] = await Promise.all([
      supabase
        .from('comments')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: true }),
      supabase
        .from('proposed_changes')
        .select('*')
        .eq('document_id', documentId),
    ]);

    if (commentsRes.data) {
      setComments(
        commentsRes.data.map((row: Record<string, unknown>) => mapCommentRow(row))
      );
    }
    if (changesRes.data) setProposedChanges(changesRes.data);
    setLoading(false);
  };

  useEffect(() => {
    if (!documentId) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, inlineResolveToken]);

  useEffect(() => {
    if (!focusChangeId || loading) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`proposed-change-${focusChangeId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [focusChangeId, loading, proposedChanges]);

  useEffect(() => {
    if (replyingTo && replyRef.current) {
      replyRef.current.focus();
    }
  }, [replyingTo]);

  const topLevelComments = comments.filter((c) => !c.parent_id);
  const resolvedCount = topLevelComments.filter((c) => c.is_resolved).length;
  const visibleComments = topLevelComments.filter((c) => showResolved || !c.is_resolved);

  const getReplies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);
  const getChangesForComment = (commentId: string) =>
    proposedChanges.filter((pc) => pc.comment_id === commentId);

  /** Resolve blockId for a proposed_change via its comment thread anchor. */
  const blockIdForChange = (change: ProposedChangeData): string | null => {
    const linked = comments.find((c) => c.id === change.comment_id);
    if (!linked) return null;
    if (linked.block_id) return linked.block_id;
    if (linked.parent_id) {
      const parent = comments.find((c) => c.id === linked.parent_id);
      return parent?.block_id ?? null;
    }
    return null;
  };

  const toInlineProposal = (change: ProposedChangeData): InlineSuggestionProposal => ({
    id: change.id,
    blockId: blockIdForChange(change),
    nodeIndex: change.node_index,
    originalText: change.original_text,
    proposedText: change.proposed_text,
  });

  // Keep TipTap decorations in sync with pending proposed_changes
  useEffect(() => {
    if (loading) return;
    const pending = proposedChanges
      .filter((pc) => pc.status === 'pending')
      .map(toInlineProposal);
    onSyncInlineSuggestions(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, proposedChanges, comments]);

  const handleAddComment = async (parentId: string | null = null) => {
    const text = parentId ? replyText : newComment;
    if (!text.trim() || !user) return;
    setSubmitting(true);

    const supabase = createSupabaseBrowserClient();
    const payload: Record<string, unknown> = {
      id: generateId(),
      document_id: documentId,
      user_id: user.id,
      user_email: user.email,
      content: text.trim(),
      highlighted_text: parentId ? null : selectedText?.trim() || null,
      block_id: parentId ? null : selectedBlockId ?? null,
      parent_id: parentId,
      is_resolved: false,
    };

    let { error } = await supabase.from('comments').insert(payload);
    if (error && /is_resolved|block_id/i.test(error.message)) {
      const { block_id: _b, is_resolved: _r, ...legacy } = payload;
      ({ error } = await supabase.from('comments').insert(legacy));
    }

    if (!error) {
      if (parentId) {
        setReplyText('');
        setReplyingTo(null);
      } else {
        setNewComment('');
      }
      await fetchData();
    }
    setSubmitting(false);
  };

  const handleResolve = async (commentId: string, currentState: boolean) => {
    setResolveError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await setCommentResolved(supabase, commentId, !currentState);
    if (error) {
      setResolveError(error.message);
      return;
    }
    await fetchData();
  };

  const handleDelete = async (commentId: string) => {
    const supabase = createSupabaseBrowserClient();
    await supabase.from('comments').delete().eq('id', commentId);
    await fetchData();
  };

  const handleBranch = async (comment: CommentRecord) => {
    if (!user) return;

    const anchor = resolveCommentAnchor(comment, documentContentJson, documentContent);
    if (!anchor || anchor.stale) {
      setBranchError(
        'This comment no longer anchors to the document. Re-select the text and add a new comment, or delete this thread.'
      );
      return;
    }

    setImplementingBranch(comment.id);
    setBranchError(null);

    try {
      const result = await provisionCommentAIBranch({
        parentDocumentId: documentId,
        comment: {
          id: comment.id,
          content: comment.content,
          highlighted_text: anchor.text,
          block_id: anchor.blockId ?? comment.block_id,
        },
        documentContextText: documentContent,
        documentContentJson: documentContentJson ?? null,
        userId: user.id,
        userEmail: user.email ?? null,
      });

      const params = new URLSearchParams({
        review: 'diff',
        parentId: documentId,
        changeId: result.changeId,
        highlight: anchor.text,
      });

      router.push(`/doc/${result.branchId}?${params.toString()}`);
    } catch (err) {
      console.error('AI branch failed:', err);
      setBranchError(err instanceof Error ? err.message : 'Failed to create AI branch');
    } finally {
      setImplementingBranch(null);
    }
  };

  const handleAskAI = async (comment: CommentRecord) => {
    if (!user) return;
    const anchor = resolveCommentAnchor(comment, documentContentJson, documentContent);
    const targetText = anchor?.text ?? comment.highlighted_text ?? '';
    if (!targetText) return;

    setAskingAI(comment.id);
    setAiSuggestError(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: comment.content,
          highlightedText: targetText,
          surroundingContext: documentContent.slice(0, 1000),
          documentContext: documentContent,
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'AI suggestion failed');

      const supabase = createSupabaseBrowserClient();
      const aiCommentId = generateId();
      await supabase.from('comments').insert({
        id: aiCommentId,
        document_id: documentId,
        user_id: user.id,
        user_email: 'Strux AI',
        content: "Here's a revised version based on the feedback:",
        parent_id: comment.id,
      });

      const nodeIndex = anchor?.nodeIndex ?? getNodeIndex(targetText);
      const changeId = generateId();
      await supabase.from('proposed_changes').insert({
        id: changeId,
        comment_id: aiCommentId,
        document_id: documentId,
        node_index: nodeIndex,
        original_text: targetText,
        proposed_text: data.proposedText,
        created_by: user.id,
        status: 'pending',
      });

      await fetchData();
      // Immediately show inline preview (fetchData also syncs; this focuses the new one)
      onSyncInlineSuggestions([
        ...proposedChanges
          .filter((pc) => pc.status === 'pending')
          .map(toInlineProposal),
        {
          id: changeId,
          blockId: anchor?.blockId ?? comment.block_id ?? null,
          nodeIndex,
          originalText: targetText,
          proposedText: data.proposedText,
        },
      ]);
      onFocusInlineSuggestion(changeId);
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'Request timed out. Please try again.'
          : err instanceof Error
            ? err.message
            : 'AI suggestion failed';
      setAiSuggestError({ commentId: comment.id, message });
    } finally {
      window.clearTimeout(timeoutId);
      setAskingAI(null);
    }
  };

  const renderComment = (comment: CommentRecord, isReply = false) => {
    const replies = getReplies(comment.id);
    const changes = getChangesForComment(comment.id);
    const isAI = comment.user_email === 'Strux AI';
    const isProvisioning = implementingBranch === comment.id;
    const anchor = resolveCommentAnchor(comment, documentContentJson, documentContent);
    const canImplement = Boolean(anchor && !anchor.stale);

    return (
      <div key={comment.id} className={isReply ? 'ml-4 mt-2' : ''}>
        <div
          className={`group rounded-xl p-3 border transition-all ${
            isAI
              ? 'bg-purple-50/70 border-transparent text-zinc-900 dark:bg-purple-950/30 dark:border-purple-800/40 dark:text-purple-200'
              : comment.is_resolved
              ? 'bg-zinc-50 border-zinc-200 opacity-75 dark:bg-zinc-900/60 dark:border-zinc-800'
              : 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-300 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                  isAI
                    ? 'bg-purple-600 text-white dark:bg-purple-900/60 dark:text-purple-200'
                    : 'bg-zinc-800 text-white dark:bg-zinc-800 dark:text-zinc-200'
                }`}
              >
                {isAI ? <Sparkles className="w-3.5 h-3.5" /> : comment.user_email?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <span
                className={`truncate text-xs font-medium ${
                  isAI ? 'text-zinc-900 dark:text-purple-200' : 'text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {isAI ? 'Strux AI' : comment.user_email?.split('@')[0]}
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0">{timeAgo(comment.created_at)}</span>
              {comment.is_resolved && (
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                  Resolved
                </span>
              )}
            </div>

            {!isAI && (
              <div
                className={`flex items-center gap-0.5 shrink-0 ${
                  comment.is_resolved ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                } transition-opacity`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  title={comment.is_resolved ? 'Mark unresolved' : 'Mark resolved'}
                  aria-pressed={comment.is_resolved}
                  onClick={() => handleResolve(comment.id, comment.is_resolved)}
                  className={comment.is_resolved ? 'text-emerald-600 dark:text-emerald-300' : 'text-zinc-500 dark:text-zinc-400'}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 ${comment.is_resolved ? 'fill-current' : ''}`} />
                </Button>
                {comment.user_id === user?.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    title="Delete thread"
                    onClick={() => handleDelete(comment.id)}
                    className="text-zinc-500 hover:text-destructive dark:text-zinc-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {comment.highlighted_text && (
            anchor && !anchor.stale ? (
              <div className="mb-2 rounded-md border-l-4 border-orange-500 bg-amber-50 px-2.5 py-1.5 text-orange-500/80 dark:border dark:border-l dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="line-clamp-2 text-xs italic">&ldquo;{anchor.text}&rdquo;</p>
              </div>
            ) : (
              <div className="mb-2 px-2.5 py-1.5 bg-zinc-100 border-l-2 border-zinc-300 rounded-r-md dark:bg-zinc-800 dark:border-zinc-600">
                <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Anchor missing in document</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 italic line-clamp-2 line-through">
                  &ldquo;{comment.highlighted_text}&rdquo;
                </p>
              </div>
            )
          )}

          <p
            className={`text-sm leading-relaxed ${
              comment.is_resolved
                ? 'text-zinc-500 line-through decoration-zinc-400/40 dark:text-zinc-400'
                : 'text-zinc-900 dark:text-zinc-100'
            }`}
          >
            {comment.content}
          </p>

          {changes.map((change) => (
            <div
              key={change.id}
              id={`proposed-change-${change.id}`}
              className={focusChangeId === change.id ? 'mt-2 rounded-lg ring-2 ring-primary' : 'mt-2'}
            >
              <ProposedChange
                id={change.id}
                originalText={change.original_text}
                proposedText={change.proposed_text}
                status={change.status as 'pending' | 'accepted' | 'rejected'}
                onShowInDocument={onFocusInlineSuggestion}
              />
            </div>
          ))}

          {!isReply && !isAI && !comment.is_resolved && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-zinc-600 dark:text-zinc-100"
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              >
                <MessageSquareReply className="w-3 h-3" />
                Reply
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={isProvisioning || askingAI === comment.id || !canImplement}
                title={
                  canImplement
                    ? 'Create a branch and review the diff'
                    : 'Select text in the document or fix the missing anchor'
                }
                onClick={() => handleBranch(comment)}
                className="text-zinc-600 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
              >
                {isProvisioning ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Branching…
                  </>
                ) : (
                  <>
                    <GitBranch className="w-3 h-3" />
                    Branch
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto px-1 text-primary"
                disabled={askingAI === comment.id || isProvisioning || !canImplement}
                title="Preview the edit in the document"
                onClick={() => handleAskAI(comment)}
              >
                {askingAI === comment.id ? 'Thinking…' : 'Suggest inline'}
              </Button>
              {aiSuggestError?.commentId === comment.id && (
                <div className="mt-2 flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
                  <span>{aiSuggestError.message}</span>
                  <button
                    type="button"
                    className="shrink-0 underline"
                    onClick={() => {
                      setAiSuggestError(null);
                      void handleAskAI(comment);
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {replies.map((reply) => renderComment(reply, true))}

        {replyingTo === comment.id && (
          <div className="ml-4 mt-2 flex gap-2">
            <textarea
              ref={replyRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddComment(comment.id);
                }
                if (e.key === 'Escape') setReplyingTo(null);
              }}
              placeholder="Reply…"
              rows={1}
              className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 rounded-lg resize-none bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ring dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 placeholder:dark:text-zinc-500"
            />
            <Button type="button" size="sm" disabled={!replyText.trim() || submitting} onClick={() => handleAddComment(comment.id)}>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500 dark:text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(branchError || resolveError) && (
          <div className="px-3 py-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg space-y-1">
            {branchError && <p>{branchError}</p>}
            {resolveError && <p>{resolveError}</p>}
          </div>
        )}

        {resolvedCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="w-full"
            onClick={() => setShowResolved((v) => !v)}
          >
            {showResolved ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showResolved ? 'Hide resolved' : `Show resolved (${resolvedCount})`}
          </Button>
        )}

        {visibleComments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No active comments</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Select text in the doc, then add feedback</p>
          </div>
        ) : (
          visibleComments.map((comment) => renderComment(comment))
        )}
      </div>

      <div className="flex-none p-4 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {selectedText && (
          <div className="mb-2 rounded-lg border-l-4 border-orange-500 bg-amber-50 px-3 py-2 dark:border dark:border-l dark:border-amber-800/60 dark:bg-amber-950/40">
            <p className="mb-0.5 text-[10px] font-medium text-orange-500/80 dark:text-amber-200">Commenting on</p>
            <p className="line-clamp-2 text-xs italic text-orange-500/80 dark:text-amber-200">&ldquo;{selectedText}&rdquo;</p>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddComment(null);
              }
            }}
            placeholder="Add a comment…"
            rows={2}
            className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg resize-none bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ring dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 placeholder:dark:text-zinc-500"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!newComment.trim() || submitting}
            onClick={() => handleAddComment(null)}
            className="text-zinc-500 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
