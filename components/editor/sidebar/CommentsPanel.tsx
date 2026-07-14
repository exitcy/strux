'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { JSONContent } from '@tiptap/core';
import {
  CheckCircle2,
  Eye,
  EyeOff,
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
import { Button } from '@/components/ui/button';
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
  onAcceptChange: (nodeIndex: number, proposedText: string) => void;
  getNodeIndex: (text: string) => number;
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
  onAcceptChange,
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
      setComments(commentsRes.data.map((row) => mapCommentRow(row as Record<string, unknown>)));
    }
    if (changesRes.data) setProposedChanges(changesRes.data);
    setLoading(false);
  };

  useEffect(() => {
    if (!documentId) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

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

  const handleAIImplement = async (comment: CommentRecord) => {
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
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

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
      await supabase.from('proposed_changes').insert({
        id: generateId(),
        comment_id: aiCommentId,
        document_id: documentId,
        node_index: nodeIndex,
        original_text: targetText,
        proposed_text: data.proposedText,
        created_by: user.id,
        status: 'pending',
      });

      await fetchData();
    } catch (err) {
      console.error('AI suggestion failed:', err);
    } finally {
      setAskingAI(null);
    }
  };

  const handleAcceptChange = async (changeId: string, proposedText: string) => {
    const change = proposedChanges.find((pc) => pc.id === changeId);
    if (!change) return;

    const supabase = createSupabaseBrowserClient();
    await supabase.from('proposed_changes').update({ status: 'accepted' }).eq('id', changeId);

    onAcceptChange(change.node_index, proposedText);
    await fetchData();
  };

  const handleRejectChange = async (changeId: string) => {
    const supabase = createSupabaseBrowserClient();
    await supabase.from('proposed_changes').update({ status: 'rejected' }).eq('id', changeId);
    await fetchData();
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
              ? 'bg-purple-50/50 border-purple-100'
              : comment.is_resolved
              ? 'bg-muted/40 border-border opacity-75'
              : 'bg-card border-border hover:border-border/80'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                  isAI ? 'bg-purple-200 text-purple-800' : 'bg-primary/10 text-primary'
                }`}
              >
                {isAI ? <Sparkles className="w-3.5 h-3.5" /> : comment.user_email?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <span className="text-xs font-medium text-foreground truncate">
                {isAI ? 'Strux AI' : comment.user_email?.split('@')[0]}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(comment.created_at)}</span>
              {comment.is_resolved && (
                <span className="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
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
                  className={comment.is_resolved ? 'text-green-600' : 'text-muted-foreground'}
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
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {comment.highlighted_text && (
            anchor && !anchor.stale ? (
              <div className="mb-2 px-2.5 py-1.5 bg-amber-50 border-l-2 border-amber-400 rounded-r-md">
                <p className="text-xs text-amber-900 italic line-clamp-2">&ldquo;{anchor.text}&rdquo;</p>
              </div>
            ) : (
              <div className="mb-2 px-2.5 py-1.5 bg-muted border-l-2 border-muted-foreground/30 rounded-r-md">
                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Anchor missing in document</p>
                <p className="text-xs text-muted-foreground italic line-clamp-2 line-through">
                  &ldquo;{comment.highlighted_text}&rdquo;
                </p>
              </div>
            )
          )}

          <p
            className={`text-sm leading-relaxed ${
              comment.is_resolved ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'text-foreground'
            }`}
          >
            {comment.content}
          </p>

          {changes.map((change) => (
            <div
              key={change.id}
              id={`proposed-change-${change.id}`}
              className={focusChangeId === change.id ? 'ring-2 ring-purple-400 rounded-lg mt-2' : 'mt-2'}
            >
              <ProposedChange
                id={change.id}
                originalText={change.original_text}
                proposedText={change.proposed_text}
                status={change.status as 'pending' | 'accepted' | 'rejected'}
                onAccept={handleAcceptChange}
                onReject={handleRejectChange}
              />
            </div>
          ))}

          {!isReply && !isAI && !comment.is_resolved && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              >
                <MessageSquareReply className="w-3 h-3" />
                Reply
              </Button>
              <Button
                type="button"
                size="xs"
                disabled={isProvisioning || askingAI === comment.id || !canImplement}
                title={
                  canImplement
                    ? 'Create an AI branch and review the diff'
                    : 'Select text in the document or fix the missing anchor'
                }
                onClick={() => handleAIImplement(comment)}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                {isProvisioning ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Provisioning branch…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    AI Implement
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="link"
                size="xs"
                className="text-purple-700 h-auto px-1"
                disabled={askingAI === comment.id || isProvisioning || !canImplement}
                onClick={() => handleAskAI(comment)}
              >
                {askingAI === comment.id ? 'Thinking…' : 'Suggest inline'}
              </Button>
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
              className="flex-1 px-3 py-1.5 text-sm border border-input rounded-lg resize-none bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
            <p className="text-sm text-muted-foreground">No active comments</p>
            <p className="text-xs text-muted-foreground/80 mt-1">Select text in the doc, then add feedback</p>
          </div>
        ) : (
          visibleComments.map((comment) => renderComment(comment))
        )}
      </div>

      <div className="flex-none p-4 border-t border-border bg-background">
        {selectedText && (
          <div className="mb-2 px-3 py-2 bg-primary/5 border border-primary/15 rounded-lg">
            <p className="text-[10px] font-medium text-primary mb-0.5">Commenting on</p>
            <p className="text-xs text-foreground italic line-clamp-2">&ldquo;{selectedText}&rdquo;</p>
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
            className="flex-1 px-3 py-2 text-sm border border-input rounded-lg resize-none bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="button" size="icon" disabled={!newComment.trim() || submitting} onClick={() => handleAddComment(null)}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
