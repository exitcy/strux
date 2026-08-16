'use client';

import { useMemo } from 'react';
import type { JSONContent } from '@tiptap/core';
import { AlertTriangle, GitMerge, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { diffBlocks, extractDiffBlocks, summarizeDiffOps } from '@/lib/block-diff';
import { computeWordDiff, type DiffSegment } from '@/lib/diff';

function InlineWordDiff({ before, after }: { before: string; after: string }) {
  const segments = computeWordDiff(before, after);

  return (
    <span className="text-sm leading-relaxed">
      {segments.map((segment: DiffSegment, index) => {
        if (segment.type === 'added') {
          return (
            <span key={index} className="rounded bg-emerald-500/15 px-0.5 text-emerald-700 dark:text-emerald-300">
              {segment.value}
            </span>
          );
        }
        if (segment.type === 'removed') {
          return (
            <span
              key={index}
              className="rounded bg-red-500/15 px-0.5 text-red-700 line-through decoration-red-500/60 dark:text-red-300"
            >
              {segment.value}
            </span>
          );
        }
        return (
          <span key={index} className="text-foreground/80">
            {segment.value}
          </span>
        );
      })}
    </span>
  );
}

interface MergePreviewModalProps {
  open: boolean;
  parentTitle: string;
  branchTitle: string;
  parentContent: JSONContent;
  branchContent: JSONContent;
  merging: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function MergePreviewModal({
  open,
  parentTitle,
  branchTitle,
  parentContent,
  branchContent,
  merging,
  onClose,
  onConfirm,
}: MergePreviewModalProps) {
  const ops = useMemo(() => {
    return diffBlocks(extractDiffBlocks(parentContent), extractDiffBlocks(branchContent));
  }, [parentContent, branchContent]);

  const summary = useMemo(() => summarizeDiffOps(ops), [ops]);
  const overwriteCount = summary.modified + summary.removed;
  const titleChanged = parentTitle !== branchTitle;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Preview merge into main</DialogTitle>
          <DialogDescription>
            Compare the current branch against trunk before overwriting the parent document.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b bg-muted/30 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-background px-2.5 py-1 text-foreground shadow-sm ring-1 ring-border">
              {summary.added} additions
            </span>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300">
              {summary.modified} potential overwrites
            </span>
            <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-red-700 ring-1 ring-red-500/20 dark:text-red-300">
              {summary.removed} removals from trunk
            </span>
            {titleChanged && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary ring-1 ring-primary/20">
                title will change
              </span>
            )}
          </div>
          {overwriteCount > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                This merge will overwrite {overwriteCount} existing trunk block
                {overwriteCount === 1 ? '' : 's'}.
              </p>
            </div>
          )}
        </div>

        {titleChanged && (
          <div className="border-b bg-muted/20 px-6 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Title
            </p>
            <InlineWordDiff before={parentTitle} after={branchTitle} />
          </div>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
          {ops.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No differences to merge.</p>
          )}
          {ops.map((op, index) => {
            if (op.op === 'equal') {
              return (
                <div key={index} className="border-l-2 border-transparent px-3 py-1 text-sm text-muted-foreground">
                  {op.left.text || <span className="italic opacity-60">empty {op.left.type}</span>}
                </div>
              );
            }

            if (op.op === 'added') {
              return (
                <div key={index} className="rounded-r border-l-2 border-emerald-500 bg-emerald-500/10 px-3 py-1.5">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Added to trunk
                  </div>
                  <span className="text-sm text-emerald-950 dark:text-emerald-100">
                    {op.right.text || <span className="italic opacity-60">empty {op.right.type}</span>}
                  </span>
                </div>
              );
            }

            if (op.op === 'removed') {
              return (
                <div key={index} className="rounded-r border-l-2 border-red-500 bg-red-500/10 px-3 py-1.5">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">
                    Removed from trunk
                  </div>
                  <span className="text-sm text-red-950 line-through decoration-red-500/60 dark:text-red-100">
                    {op.left.text || <span className="italic opacity-60">empty {op.left.type}</span>}
                  </span>
                </div>
              );
            }

            return (
              <div key={index} className="rounded-r border-l-2 border-amber-500 bg-amber-500/10 px-3 py-1.5">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Potential overwrite
                </div>
                <InlineWordDiff before={op.left.text} after={op.right.text} />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t bg-background px-6 py-4">
          <p className="text-xs text-muted-foreground">
            Trunk: <span className="font-medium text-foreground">{parentTitle}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={onConfirm} disabled={merging} className="gap-1.5">
              {merging ? <Loader2 className="size-4 animate-spin" /> : <GitMerge className="size-4" />}
              Merge into main
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
