'use client';

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { computeWordDiff, type DiffSegment } from '@/lib/diff';

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

function InlineDiff({ original, proposed }: { original: string; proposed: string }) {
  const segments = computeWordDiff(original, proposed);
  return (
    <p className="text-xs leading-relaxed">
      {segments.map((seg: DiffSegment, i: number) => {
        if (seg.type === 'removed') {
          return (
            <span key={i} className="bg-red-100 text-red-700 line-through decoration-red-400/60">
              {seg.value}
            </span>
          );
        }
        if (seg.type === 'added') {
          return (
            <span key={i} className="bg-green-100 text-green-700">
              {seg.value}
            </span>
          );
        }
        return <span key={i} className="text-gray-500">{seg.value}</span>;
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
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-gray-600 rounded-full" />
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">No changes yet</h3>
        <p className="text-xs text-gray-500 leading-relaxed max-w-[220px]">
          When AI proposes changes and you accept or reject them, they&apos;ll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {changes.map((change) => {
        const isExpanded = expandedId === change.id;

        return (
          <div
            key={change.id}
            onClick={() => setExpandedId(isExpanded ? null : change.id)}
            className={`rounded-lg border p-3 transition-all cursor-pointer ${
              change.status === 'accepted'
                ? 'border-green-200 bg-green-50/50 hover:border-green-300'
                : change.status === 'rejected'
                ? 'border-gray-200 bg-gray-50 opacity-60 hover:opacity-80'
                : 'border-purple-200 bg-purple-50/50 hover:border-purple-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                {change.status === 'accepted' ? (
                  <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : change.status === 'rejected' ? (
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L14.4 7.2L20 9L14.4 10.8L12 16L9.6 10.8L4 9L9.6 7.2L12 2Z" />
                  </svg>
                )}
                <span className={`text-xs font-medium ${
                  change.status === 'accepted'
                    ? 'text-green-700'
                    : change.status === 'rejected'
                    ? 'text-gray-500'
                    : 'text-purple-700'
                }`}>
                  {change.status === 'accepted' ? 'Accepted' : change.status === 'rejected' ? 'Rejected' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">{timeAgo(change.created_at)}</span>
                <svg
                  className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {isExpanded ? (
              <div className="mt-2 p-2.5 bg-white rounded-md border border-gray-100">
                <InlineDiff original={change.original_text} proposed={change.proposed_text} />
              </div>
            ) : (
              <p className="text-xs text-gray-600 line-clamp-2">
                {change.status === 'accepted' ? change.proposed_text : change.original_text}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
