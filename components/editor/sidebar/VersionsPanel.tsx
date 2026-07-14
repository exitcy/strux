'use client';

import { useEffect, useState, useCallback } from 'react';
import type { JSONContent } from '@tiptap/core';
import { listVersions, deleteVersion, restoreVersion, createVersion, type DocumentVersion } from '@/lib/versions';
import { useAuth } from '@/components/auth/AuthProvider';
import VersionDiffModal from '../VersionDiffModal';

interface VersionsPanelProps {
  documentId: string;
  currentContent: JSONContent;
  currentTitle: string;
  canEdit: boolean;
  onRestore: (content: JSONContent, title: string) => void;
  // Bumped by the parent whenever a new version is created elsewhere
  // (e.g. auto-snapshot after save). We re-fetch on change.
  refreshToken: number;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function VersionsPanel({
  documentId,
  currentContent,
  currentTitle,
  canEdit,
  onRestore,
  refreshToken,
}: VersionsPanelProps) {
  const { user } = useAuth();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkpointing, setCheckpointing] = useState(false);
  const [showCheckpointInput, setShowCheckpointInput] = useState(false);
  const [checkpointLabel, setCheckpointLabel] = useState('');
  const [checkpointMessage, setCheckpointMessage] = useState('');
  const [selectedForCompare, setSelectedForCompare] = useState<DocumentVersion | null>(null);
  const [compareAgainst, setCompareAgainst] = useState<DocumentVersion | 'current' | null>(null);
  // When the user clicks Restore, we show a confirmation step rather
  // than an immediate destructive action. `pendingRestore` holds the
  // candidate until they confirm.
  const [pendingRestore, setPendingRestore] = useState<DocumentVersion | null>(null);

  const refresh = useCallback(async () => {
    const data = await listVersions(documentId);
    setVersions(data);
    setLoading(false);
  }, [documentId]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshToken]);

  const handleCheckpoint = async () => {
    if (!user || !checkpointLabel.trim()) return;
    setCheckpointing(true);
    await createVersion({
      documentId,
      content: currentContent,
      title: currentTitle,
      userId: user.id,
      userEmail: user.email ?? null,
      label: checkpointLabel.trim(),
      message: checkpointMessage.trim() || undefined,
      isAuto: false,
    });
    setCheckpointLabel('');
    setCheckpointMessage('');
    setShowCheckpointInput(false);
    setCheckpointing(false);
    await refresh();
  };

  const handleRestore = async (version: DocumentVersion) => {
    if (!user) return;
    const result = await restoreVersion({
      documentId,
      versionToRestore: version,
      currentContent,
      currentTitle,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    if (result?.content) {
      onRestore(result.content, result.title ?? '');
      setPendingRestore(null);
      await refresh();
    }
  };

  const handleDelete = async (version: DocumentVersion) => {
    await deleteVersion(version.id);
    await refresh();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-gray-600 rounded-full" />
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Checkpoint creator */}
        {canEdit && (
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-b from-purple-50/40 to-transparent">
            {!showCheckpointInput ? (
              <button
                onClick={() => setShowCheckpointInput(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border
                           border-purple-200 text-purple-700 rounded-lg text-xs font-semibold
                           hover:bg-purple-50 hover:border-purple-300 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Save checkpoint
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={checkpointLabel}
                  onChange={(e) => setCheckpointLabel(e.target.value)}
                  placeholder="Checkpoint name (e.g. v1, before-restructure)"
                  className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md
                             focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                />
                <textarea
                  value={checkpointMessage}
                  onChange={(e) => setCheckpointMessage(e.target.value)}
                  placeholder="Optional message"
                  rows={2}
                  className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md resize-none
                             focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCheckpoint}
                    disabled={!checkpointLabel.trim() || checkpointing}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600
                               rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {checkpointing ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCheckpointInput(false);
                      setCheckpointLabel('');
                      setCheckpointMessage('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100
                               rounded-md hover:bg-zinc-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Version list */}
        {versions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">No versions yet</h3>
            <p className="text-xs text-gray-500 leading-relaxed max-w-[220px]">
              Automatic snapshots are created as you work. Save a checkpoint above to mark a version.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {versions.map((v) => {
              const isSelected = selectedForCompare?.id === v.id;
              return (
                <div
                  key={v.id}
                  className={`group rounded-lg border p-3 transition-all ${
                    isSelected
                      ? 'border-purple-400 bg-purple-50/70 shadow-sm'
                      : v.is_auto
                      ? 'border-zinc-100 bg-white hover:border-zinc-200'
                      : 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {v.is_auto ? (
                          <svg className="w-3 h-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 3a1 1 0 011-1h5.586a1 1 0 01.707.293l6.414 6.414a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414 0L3.293 9.293A1 1 0 013 8.586V3z" />
                          </svg>
                        )}
                        <p className={`text-xs font-semibold truncate ${v.is_auto ? 'text-zinc-700' : 'text-amber-900'}`}>
                          {v.label ?? 'Auto-snapshot'}
                        </p>
                      </div>
                      {v.message && (
                        <p className="text-[11px] text-zinc-500 line-clamp-2">{v.message}</p>
                      )}
                      <p className="text-[10px] text-zinc-400 mt-1">
                        {v.created_by_email?.split('@')[0] ?? 'Unknown'} · {timeAgo(v.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-zinc-100">
                    <button
                      onClick={() => setCompareAgainst('current')}
                      onClickCapture={() => setSelectedForCompare(v)}
                      className="flex-1 px-2 py-1 text-[10px] font-medium text-zinc-600
                                 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors"
                    >
                      Compare to current
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => setPendingRestore(v)}
                        className="flex-1 px-2 py-1 text-[10px] font-medium text-purple-600
                                   hover:text-purple-900 hover:bg-purple-100 rounded transition-colors"
                      >
                        Restore
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => handleDelete(v)}
                        className="p-1 text-zinc-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete snapshot"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Diff modal */}
      {selectedForCompare && compareAgainst && (
        <VersionDiffModal
          left={selectedForCompare}
          right={compareAgainst}
          currentContent={currentContent}
          currentTitle={currentTitle}
          onClose={() => {
            setSelectedForCompare(null);
            setCompareAgainst(null);
          }}
        />
      )}

      {/* Restore confirmation */}
      {pendingRestore && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPendingRestore(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-zinc-900">Restore this version?</h3>
            <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
              The current document will be replaced with&nbsp;
              <span className="font-medium text-zinc-800">
                {pendingRestore.label ?? 'this auto-snapshot'}
              </span>
              . We&apos;ll save a <span className="font-medium">&ldquo;Before restore&rdquo;</span> checkpoint first so you can undo this.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setPendingRestore(null)}
                className="flex-1 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 rounded-lg hover:bg-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestore(pendingRestore)}
                className="flex-1 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
