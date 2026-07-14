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
        return <span key={i} className="text-gray-600">{seg.value}</span>;
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
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 mt-2">
        <div className="flex items-center gap-1.5 mb-1">
          <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-medium text-green-700">Change accepted</span>
        </div>
        <p className="text-sm text-green-800">{proposedText}</p>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mt-2 opacity-60">
        <div className="flex items-center gap-1.5 mb-1">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-xs font-medium text-gray-500">Change rejected</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-white p-3 mt-2 shadow-sm">
      <div className="flex items-center gap-1.5 mb-2">
        <svg className="w-3.5 h-3.5 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L14.4 7.2L20 9L14.4 10.8L12 16L9.6 10.8L4 9L9.6 7.2L12 2Z" />
        </svg>
        <span className="text-xs font-medium text-purple-700">Proposed change</span>
      </div>

      <div className="bg-gray-50 rounded-md p-2.5 mb-3 border border-gray-100">
        <DiffDisplay segments={segments} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAccept(id, proposedText)}
          className="flex-1 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg
                     hover:bg-green-700 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={() => onReject(id)}
          className="flex-1 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg
                     hover:bg-gray-200 transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
