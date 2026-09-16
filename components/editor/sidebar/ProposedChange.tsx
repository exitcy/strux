'use client';

interface ProposedChangeProps {
  id: string;
  originalText: string;
  proposedText: string;
  status: 'pending' | 'accepted' | 'rejected';
  onShowInDocument?: (id: string) => void;
}

export default function ProposedChange({
  id,
  proposedText,
  status,
  onShowInDocument,
}: ProposedChangeProps) {
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

  // Pending: compact chip — Accept/Reject live on the inline document preview
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-primary/15 bg-card px-3 py-2 shadow-sm">
      <div className="flex min-w-0 items-center gap-1.5">
        <svg className="h-3.5 w-3.5 shrink-0 text-primary" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L14.4 7.2L20 9L14.4 10.8L12 16L9.6 10.8L4 9L9.6 7.2L12 2Z" />
        </svg>
        <span className="truncate text-xs font-medium text-primary">Inline preview active</span>
      </div>
      {onShowInDocument && (
        <button
          type="button"
          onClick={() => onShowInDocument(id)}
          className="shrink-0 text-xs font-semibold text-primary underline-offset-2 hover:underline"
        >
          Show in document
        </button>
      )}
    </div>
  );
}
