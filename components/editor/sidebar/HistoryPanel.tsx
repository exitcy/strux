'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { computeWordDiff, type DiffSegment } from '@/lib/diff';
import { timeAgo } from '@/lib/utils/time';

interface ChangeEntry {
  id: string;
  original_text: string;
  proposed_text: string;
  status: string;
  created_at: string;
}

interface HistoryPanelProps {
  documentId: string;
}

function InlineDiff({ original, proposed }: { original: string; proposed: string }) {
  const segments = computeWordDiff(original, proposed);
  return (
    <p className="text-xs leading-relaxed">
      {segments.map((seg: DiffSegment, i: number) => {
        if (seg.type === 'removed') {
          return (
            <span
              key={i}
              className="bg-red-500/15 text-red-700 line-through decoration-red-400/60 dark:text-red-300"
            >
              {seg.value}
            </span>
          );
        }
        if (seg.type === 'added') {
          return (
            <span key={i} className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              {seg.value}
            </span>
          );
        }
        return (
          <span key={i} className="text-zinc-700 dark:text-zinc-300">
            {seg.value}
          </span>
        );
      })}
    </p>
  );
}

export default function HistoryPanel({ documentId }: HistoryPanelProps) {
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;

    const fetchHistory = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from('proposed_changes')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (data) setChanges(data);
      setLoading(false);
    };

    fetchHistory();
  }, [documentId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-zinc-500 dark:text-zinc-400" />
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900">
          <svg
            className="h-6 w-6 text-zinc-500 dark:text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">No changes yet</h3>
        <p className="max-w-[220px] text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          When AI proposes changes and you accept or reject them, they&apos;ll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-4">
      {changes.map((change) => {
        const isExpanded = expandedId === change.id;

        return (
          <div
            key={change.id}
            onClick={() => setExpandedId(isExpanded ? null : change.id)}
            className={`cursor-pointer rounded-lg border border-zinc-200 bg-white p-3 text-zinc-900 shadow-sm transition-all dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 ${
              change.status === 'rejected' ? 'opacity-60 hover:opacity-80' : ''
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {change.status === 'accepted' ? (
                  <svg
                    className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : change.status === 'rejected' ? (
                  <svg
                    className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg
                    className="h-3.5 w-3.5 text-purple-500 dark:text-purple-300"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2L14.4 7.2L20 9L14.4 10.8L12 16L9.6 10.8L4 9L9.6 7.2L12 2Z" />
                  </svg>
                )}
                <span
                  className={`text-xs font-medium ${
                    change.status === 'accepted'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : change.status === 'rejected'
                        ? 'text-zinc-500 dark:text-zinc-400'
                        : 'text-purple-700 dark:text-purple-300'
                  }`}
                >
                  {change.status === 'accepted'
                    ? 'Accepted'
                    : change.status === 'rejected'
                      ? 'Rejected'
                      : 'Pending'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{timeAgo(change.created_at)}</span>
                <svg
                  className={`h-3 w-3 text-zinc-500 transition-transform dark:text-zinc-400 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {isExpanded ? (
              <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2.5 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                <InlineDiff original={change.original_text} proposed={change.proposed_text} />
              </div>
            ) : (
              <p className="mt-2 line-clamp-2 rounded-md border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                {change.status === 'accepted' ? change.proposed_text : change.original_text}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
