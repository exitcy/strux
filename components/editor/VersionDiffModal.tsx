'use client';

import { useMemo } from 'react';
import type { JSONContent } from '@tiptap/core';
import { computeWordDiff, type DiffSegment } from '@/lib/diff';
import type { DocumentVersion } from '@/lib/versions';

interface VersionDiffModalProps {
  left: DocumentVersion;              // older version (baseline)
  right: DocumentVersion | 'current'; // newer version (or the live doc)
  currentContent?: JSONContent;
  currentTitle?: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------
// Block extraction
// ---------------------------------------------------------------------
// TipTap stores content as a tree: top-level doc -> blocks -> inline.
// For diffing we flatten to a list of "block summaries" — one per
// top-level node — where each block is a simple {type, text} pair.
// Lists are expanded so each item becomes its own block; that way
// adding one bullet doesn't show up as "the whole list changed".

interface BlockSummary {
  type: string;
  text: string;
}

function extractBlocks(content: JSONContent | null | undefined): BlockSummary[] {
  if (!content || !content.content) return [];
  const out: BlockSummary[] = [];

  const walkInline = (nodes: JSONContent[] | undefined): string => {
    if (!nodes) return '';
    return nodes
      .map((n) => {
        if (n.type === 'text') return n.text ?? '';
        if (n.content) return walkInline(n.content);
        return '';
      })
      .join('');
  };

  for (const node of content.content) {
    if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
      for (const item of node.content ?? []) {
        out.push({ type: node.type, text: walkInline(item.content) });
      }
    } else if (node.type === 'table') {
      out.push({ type: 'table', text: '[table]' });
    } else {
      out.push({ type: node.type ?? 'paragraph', text: walkInline(node.content) });
    }
  }

  return out;
}

// ---------------------------------------------------------------------
// Block-level LCS diff
// ---------------------------------------------------------------------
// Longest-Common-Subsequence of blocks using text-equality as the key.
// This is the same algorithm git uses for line-level diffs. Output is
// a sequence of "ops" the UI can render.

type DiffOp =
  | { op: 'equal';    left: BlockSummary; right: BlockSummary }
  | { op: 'modified'; left: BlockSummary; right: BlockSummary }
  | { op: 'added';    right: BlockSummary }
  | { op: 'removed';  left: BlockSummary };

function diffBlocks(a: BlockSummary[], b: BlockSummary[]): DiffOp[] {
  const n = a.length;
  const m = b.length;

  // Classic DP table for LCS.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i].text === b[j].text && a[i].type === b[j].type) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Walk the table to emit ops. When a block on the left aligns
  // positionally with a block on the right but texts differ, we mark
  // it as `modified` (single entry) instead of remove+add — that's
  // what lets the UI render an inline word-diff for small edits.
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].text === b[j].text && a[i].type === b[j].type) {
      ops.push({ op: 'equal', left: a[i], right: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      // If the next row on the other side is a modification of this
      // block (same type, different text), treat as modified.
      if (j < m && a[i].type === b[j].type && dp[i + 1][j + 1] >= dp[i + 1][j]) {
        ops.push({ op: 'modified', left: a[i], right: b[j] });
        i++;
        j++;
      } else {
        ops.push({ op: 'removed', left: a[i] });
        i++;
      }
    } else {
      ops.push({ op: 'added', right: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ op: 'removed', left: a[i++] });
  while (j < m) ops.push({ op: 'added', right: b[j++] });

  return ops;
}

// ---------------------------------------------------------------------
// Inline word-diff (reuses lib/diff)
// ---------------------------------------------------------------------

function InlineWordDiff({ before, after }: { before: string; after: string }) {
  const segs = computeWordDiff(before, after);
  return (
    <span className="text-sm leading-relaxed">
      {segs.map((s: DiffSegment, i) => {
        if (s.type === 'added') return <span key={i} className="bg-green-100 text-green-800">{s.value}</span>;
        if (s.type === 'removed') return <span key={i} className="bg-red-100 text-red-800 line-through decoration-red-400/60">{s.value}</span>;
        return <span key={i} className="text-zinc-600">{s.value}</span>;
      })}
    </span>
  );
}

// ---------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function VersionDiffModal({
  left,
  right,
  currentContent,
  currentTitle,
  onClose,
}: VersionDiffModalProps) {
  const ops = useMemo(() => {
    const leftBlocks = extractBlocks(left.content ?? undefined);
    const rightBlocks =
      right === 'current'
        ? extractBlocks(currentContent)
        : extractBlocks(right.content ?? undefined);
    return diffBlocks(leftBlocks, rightBlocks);
  }, [left, right, currentContent]);

  const leftLabel  = left.label ?? (left.is_auto ? 'Auto-snapshot' : 'Snapshot');
  const rightLabel = right === 'current'
    ? 'Current'
    : (right.label ?? (right.is_auto ? 'Auto-snapshot' : 'Snapshot'));
  const leftTime   = formatTimestamp(left.created_at);
  const rightTime  = right === 'current' ? 'Live' : formatTimestamp(right.created_at);
  const rightTitle = right === 'current' ? currentTitle : right.title;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-none px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Compare versions</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              <span className="font-medium text-red-600">{leftLabel}</span> ({leftTime})
              {'  →  '}
              <span className="font-medium text-green-600">{rightLabel}</span> ({rightTime})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Title diff (if titles differ) */}
        {left.title !== rightTitle && (
          <div className="flex-none px-6 py-3 bg-zinc-50 border-b border-zinc-100">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Title</p>
            <InlineWordDiff before={left.title ?? ''} after={rightTitle ?? ''} />
          </div>
        )}

        {/* Body: block-by-block diff */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {ops.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-8">No differences.</p>
          )}
          {ops.map((op, i) => {
            if (op.op === 'equal') {
              return (
                <div key={i} className="py-1 px-3 text-sm text-zinc-400 border-l-2 border-transparent">
                  {op.left.text || <span className="italic opacity-60">empty {op.left.type}</span>}
                </div>
              );
            }
            if (op.op === 'added') {
              return (
                <div key={i} className="py-1.5 px-3 bg-green-50 border-l-2 border-green-400 rounded-r">
                  <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wider mr-2">+</span>
                  <span className="text-sm text-green-900">
                    {op.right.text || <span className="italic opacity-60">empty {op.right.type}</span>}
                  </span>
                </div>
              );
            }
            if (op.op === 'removed') {
              return (
                <div key={i} className="py-1.5 px-3 bg-red-50 border-l-2 border-red-400 rounded-r">
                  <span className="text-[10px] font-semibold text-red-700 uppercase tracking-wider mr-2">−</span>
                  <span className="text-sm text-red-900 line-through decoration-red-400/60">
                    {op.left.text || <span className="italic opacity-60">empty {op.left.type}</span>}
                  </span>
                </div>
              );
            }
            // modified
            return (
              <div key={i} className="py-1.5 px-3 bg-amber-50 border-l-2 border-amber-400 rounded-r">
                <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mr-2">~</span>
                <InlineWordDiff before={op.left.text} after={op.right.text} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
