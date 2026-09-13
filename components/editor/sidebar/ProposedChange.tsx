'use client';

import { computeWordDiff, type DiffSegment } from '@/lib/diff';

interface ProposedChangeProps {
  id: string;
  originalText: string;
  proposedText: string;
  status: 'pending' | 'accepted' | 'rejected';
  onAccept: (id: string, proposedText: string) => void;
  onReject: (id: string) => void;
}

function DiffDisplay({ segments }: { segments: DiffSegment[] }) {
  return (
    <p className="text-sm leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.type === 'removed') {
          return (
            <span key={i} className="rounded bg-red-500/15 px-0.5 text-red-700 line-through decoration-red-500/60 dark:text-red-300">
              {seg.value}
            </span>
          );
        }
        if (seg.type === 'added') {
          return (
            <span key={i} className="rounded bg-emerald-500/15 px-0.5 text-emerald-700 dark:text-emerald-300">
              {seg.value}
            </span>
          );
        }
        return <span key={i} className="text-foreground/80">{seg.value}</span>;
      })}
    </p>
  );
}

export default function ProposedChange({
  id,
  originalText,
  proposedText,
  status,
  onAccept,
  onReject,
}: ProposedChangeProps) {
  const segments = computeWordDiff(originalText, proposedText);

  if (status === 'accepted') {
    return (
      <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <svg className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Change accepted</span>
        </div>
        <p className="text-sm text-emerald-950 dark:text-emerald-100">{proposedText}</p>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="mt-2 rounded-lg border border-purple-200 bg-white p-3 opacity-70 dark:border-border dark:bg-muted/40">
        <div className="flex items-center gap-1.5 mb-1">
          <svg className="h-3.5 w-3.5 text-purple-600 dark:text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-xs font-medium text-muted-foreground">Change rejected</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-primary/15 bg-card p-3 shadow-sm">
      <div className="flex items-center gap-1.5 mb-2">
        <svg className="h-3.5 w-3.5 text-primary" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L14.4 7.2L20 9L14.4 10.8L12 16L9.6 10.8L4 9L9.6 7.2L12 2Z" />
        </svg>
        <span className="text-xs font-medium text-primary">Proposed change</span>
      </div>

      <div className="mb-3 rounded-md border bg-muted/40 p-2.5">
        <DiffDisplay segments={segments} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAccept(id, proposedText)}
          className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Accept
        </button>
        <button
          onClick={() => onReject(id)}
          className="flex-1 rounded-lg bg-muted py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
