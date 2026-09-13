'use client';

import { useMemo } from 'react';
import type { JSONContent } from '@tiptap/core';
import { diffBlocks, extractDiffBlocks } from '@/lib/block-diff';
import { computeWordDiff, type DiffSegment } from '@/lib/diff';
import type { DocumentVersion } from '@/lib/versions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface VersionDiffModalProps {
  left: DocumentVersion;              // older version (baseline)
  right: DocumentVersion | 'current'; // newer version (or the live doc)
  currentContent?: JSONContent;
  currentTitle?: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------
// Inline word-diff (reuses lib/diff)
// ---------------------------------------------------------------------

function InlineWordDiff({ before, after }: { before: string; after: string }) {
  const segs = computeWordDiff(before, after);
  return (
    <span className="text-sm leading-relaxed">
      {segs.map((s: DiffSegment, i) => {
        if (s.type === 'added') return <span key={i} className="rounded bg-emerald-500/15 px-0.5 text-emerald-700 dark:text-emerald-300">{s.value}</span>;
        if (s.type === 'removed') return <span key={i} className="rounded bg-red-500/15 px-0.5 text-red-700 line-through decoration-red-500/60 dark:text-red-300">{s.value}</span>;
        return <span key={i} className="text-foreground/80">{s.value}</span>;
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
    const leftBlocks = extractDiffBlocks(left.content ?? undefined);
    const rightBlocks =
      right === 'current'
        ? extractDiffBlocks(currentContent)
        : extractDiffBlocks(right.content ?? undefined);
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
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="flex-none border-b px-6 py-4">
          <DialogTitle>Compare versions</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-destructive">{leftLabel}</span> ({leftTime})
            {' → '}
            <span className="font-medium text-green-600">{rightLabel}</span> ({rightTime})
          </DialogDescription>
        </DialogHeader>

        {left.title !== rightTitle && (
          <div className="flex-none border-b bg-muted/40 px-6 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Title</p>
            <InlineWordDiff before={left.title ?? ''} after={rightTitle ?? ''} />
          </div>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
          {ops.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No differences.</p>
          )}
          {ops.map((op, i) => {
            if (op.op === 'equal') {
              return (
                <div key={i} className="border-l-2 border-transparent px-3 py-1 text-sm text-muted-foreground">
                  {op.left.text || <span className="italic opacity-60">empty {op.left.type}</span>}
                </div>
              );
            }
            if (op.op === 'added') {
              return (
                <div key={i} className="rounded-r border-l-2 border-emerald-500 bg-emerald-500/10 px-3 py-1.5">
                  <span className="mr-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">+</span>
                  <span className="text-sm text-emerald-950 dark:text-emerald-100">
                    {op.right.text || <span className="italic opacity-60">empty {op.right.type}</span>}
                  </span>
                </div>
              );
            }
            if (op.op === 'removed') {
              return (
                <div key={i} className="rounded-r border-l-2 border-red-500 bg-red-500/10 px-3 py-1.5">
                  <span className="mr-2 text-[10px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">−</span>
                  <span className="text-sm text-red-950 line-through decoration-red-500/60 dark:text-red-100">
                    {op.left.text || <span className="italic opacity-60">empty {op.left.type}</span>}
                  </span>
                </div>
              );
            }
            return (
              <div key={i} className="rounded-r border-l-2 border-amber-500 bg-amber-500/10 px-3 py-1.5">
                <span className="mr-2 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">~</span>
                <InlineWordDiff before={op.left.text} after={op.right.text} />
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
