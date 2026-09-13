'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import type { JSONContent } from '@tiptap/core';
import { listVersions, deleteVersion, restoreVersion, createVersion, type DocumentVersion } from '@/lib/versions';
import { timeAgo } from '@/lib/utils/time';
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
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-zinc-500 dark:text-zinc-400" />
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Checkpoint creator */}
        {canEdit && (
          <div className="border-b border-zinc-200 bg-gradient-to-b from-purple-50 to-transparent px-4 py-3 dark:border-zinc-800 dark:from-purple-950/20">
            {!showCheckpointInput ? (
              <button
                onClick={() => setShowCheckpointInput(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200
                           bg-white px-3 py-2 text-xs font-semibold text-purple-700 shadow-sm
                           transition-colors hover:bg-zinc-50
                           dark:border-zinc-800 dark:bg-zinc-900 dark:text-purple-300
                           dark:hover:bg-zinc-800"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
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
                  className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm
                             text-zinc-900 placeholder:text-zinc-400
                             focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring
                             dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 placeholder:dark:text-zinc-500"
                />
                <textarea
                  value={checkpointMessage}
                  onChange={(e) => setCheckpointMessage(e.target.value)}
                  placeholder="Optional message"
                  rows={2}
                  className="w-full resize-none rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm
                             text-zinc-900 placeholder:text-zinc-400
                             focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring
                             dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 placeholder:dark:text-zinc-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCheckpoint}
                    disabled={!checkpointLabel.trim() || checkpointing}
                    className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold
                               text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {checkpointing ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCheckpointInput(false);
                      setCheckpointLabel('');
                      setCheckpointMessage('');
                    }}
                    className="rounded-md border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600
                               transition-colors hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
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
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900">
              <svg className="h-6 w-6 text-zinc-500 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">No versions yet</h3>
            <p className="max-w-[220px] text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Automatic snapshots are created as you work. Save a checkpoint above to mark a version.
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
            {versions.map((v) => {
              const isSelected = selectedForCompare?.id === v.id;
              return (
                <div
                  key={v.id}
                  className={`group rounded-lg border border-zinc-200 bg-white p-3 text-zinc-900 shadow-sm transition-all dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-1.5">
                        {v.is_auto ? (
                          <svg className="h-3 w-3 text-zinc-500 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="h-3 w-3 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 3a1 1 0 011-1h5.586a1 1 0 01.707.293l6.414 6.414a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414 0L3.293 9.293A1 1 0 013 8.586V3z" />
                          </svg>
                        )}
                        <p className={`truncate text-xs font-semibold ${
                          v.is_auto
                            ? 'text-zinc-800 dark:text-zinc-200'
                            : 'text-amber-900 dark:text-amber-200'
                        }`}>
                          {v.label ?? 'Auto-snapshot'}
                        </p>
                      </div>
                      {v.message && (
                        <p className="line-clamp-2 text-[11px] text-zinc-500 dark:text-zinc-400">{v.message}</p>
                      )}
                      <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                        {v.created_by_email?.split('@')[0] ?? 'Unknown'} · {timeAgo(v.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-2 flex items-center gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    <button
                      onClick={() => setCompareAgainst('current')}
                      onClickCapture={() => setSelectedForCompare(v)}
                      className="flex-1 rounded px-2 py-1 text-[10px] font-medium text-zinc-600
                                 transition-colors hover:bg-zinc-100 hover:text-zinc-900
                                 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      Compare to current
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => setPendingRestore(v)}
                        className="flex-1 rounded px-2 py-1 text-[10px] font-medium text-purple-600
                                   transition-colors hover:bg-purple-100 hover:text-purple-900
                                   dark:text-purple-300 dark:hover:bg-purple-950/40 dark:hover:text-purple-200"
                      >
                        Restore
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => handleDelete(v)}
                        className="rounded p-1 text-zinc-300 transition-colors
                                   hover:bg-red-50 hover:text-red-600
                                   dark:text-zinc-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        title="Delete snapshot"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
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
          <div className="relative w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Restore this version?</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              The current document will be replaced with&nbsp;
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {pendingRestore.label ?? 'this auto-snapshot'}
              </span>
              . We&apos;ll save a <span className="font-medium">&ldquo;Before restore&rdquo;</span> checkpoint first so you can undo this.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPendingRestore(null)}
                className="flex-1 rounded-lg border border-zinc-200 bg-zinc-100 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestore(pendingRestore)}
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
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
