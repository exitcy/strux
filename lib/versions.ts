import type { JSONContent } from '@tiptap/core';
import { createSupabaseBrowserClient } from './supabase';

// A single row in `document_versions`. We keep this type close to the
// SQL column shape — no re-naming — because every translation layer is
// a place bugs can hide.
export interface DocumentVersion {
  id: string;
  document_id: string;
  content: JSONContent | null;
  title: string | null;
  label: string | null;          // null => auto-snapshot
  message: string | null;
  is_auto: boolean;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------

/**
 * Persist a new snapshot. `label` + `message` are only set for named
 * checkpoints; automatic snapshots leave them NULL.
 *
 * Returns the created row so the caller can optimistically insert it
 * into any open "Versions" UI without a refetch round-trip.
 */
export async function createVersion(params: {
  documentId: string;
  content: JSONContent;
  title: string;
  userId: string;
  userEmail: string | null;
  label?: string;
  message?: string;
  isAuto?: boolean;
}): Promise<DocumentVersion | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('document_versions')
    .insert({
      document_id: params.documentId,
      content: params.content,
      title: params.title,
      label: params.label ?? null,
      message: params.message ?? null,
      is_auto: params.isAuto ?? false,
      created_by: params.userId,
      created_by_email: params.userEmail,
    })
    .select('*')
    .single();

  if (error) {
    console.error('createVersion failed:', error);
    return null;
  }
  return data as DocumentVersion;
}

export async function listVersions(documentId: string): Promise<DocumentVersion[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('listVersions failed:', error);
    return [];
  }
  return (data ?? []) as DocumentVersion[];
}

export async function deleteVersion(versionId: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from('document_versions')
    .delete()
    .eq('id', versionId);
  return !error;
}

// ---------------------------------------------------------------------
// Auto-snapshot throttle
// ---------------------------------------------------------------------
// We don't want to create a snapshot on every keystroke — that would
// generate thousands of rows per session. The rule: an auto-snapshot is
// created at most once per `AUTO_SNAPSHOT_INTERVAL_MS`, and only if the
// content has actually changed since the last snapshot.
//
// The throttle state is scoped per documentId so switching between docs
// in a SPA doesn't accidentally reset the timer.

const AUTO_SNAPSHOT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

const lastAutoSnapshotAt = new Map<string, number>();

export function shouldAutoSnapshot(documentId: string): boolean {
  const last = lastAutoSnapshotAt.get(documentId) ?? 0;
  return Date.now() - last >= AUTO_SNAPSHOT_INTERVAL_MS;
}

export function markAutoSnapshotTaken(documentId: string): void {
  lastAutoSnapshotAt.set(documentId, Date.now());
}

// ---------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------
// Restoring always creates a safety-net snapshot of the *current* state
// first, so "restore" is itself recoverable. This is the same instinct
// as `git revert` creating a new commit rather than rewriting history.

export async function restoreVersion(params: {
  documentId: string;
  versionToRestore: DocumentVersion;
  currentContent: JSONContent;
  currentTitle: string;
  userId: string;
  userEmail: string | null;
}): Promise<{ content: JSONContent | null; title: string | null } | null> {
  // 1. Save the current state as a safety-net checkpoint.
  await createVersion({
    documentId: params.documentId,
    content: params.currentContent,
    title: params.currentTitle,
    userId: params.userId,
    userEmail: params.userEmail,
    label: 'Before restore',
    message: `Auto-saved before restoring "${params.versionToRestore.label ?? 'untitled snapshot'}"`,
    isAuto: false,
  });

  // 2. Push the old content back into the documents row.
  //
  // Why we *clear* yjs_state instead of rebuilding it here: building a
  // Y.Doc from JSON requires a ProseMirror schema, which only exists
  // inside the live editor. Doing it here would mean either duplicating
  // the editor extension list (drift hazard) or shipping ProseMirror
  // into the version helper (bundle bloat). Instead, we let the next
  // client snapshot regenerate yjs_state from the freshly-restored
  // editor state — the caller in DocumentEditor.handleRestoreVersion
  // resets the local Y.Doc immediately, which both fixes the local
  // editor and triggers a snapshot via the normal autosave path.
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from('documents')
    .update({
      content: params.versionToRestore.content,
      title: params.versionToRestore.title,
      yjs_state: null,
      last_yjs_save_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.documentId);

  if (error) {
    console.error('restoreVersion failed:', error);
    return null;
  }

  return {
    content: params.versionToRestore.content,
    title: params.versionToRestore.title,
  };
}
