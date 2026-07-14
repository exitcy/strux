'use client';

import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { getSchema, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Collaboration } from '@tiptap/extension-collaboration';
import { PersistingCollaborationCaret } from './persisting-collaboration-caret';
import type { JSONContent } from '@tiptap/core';
import * as Y from 'yjs';
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from '@tiptap/y-tiptap';
import debounce from 'lodash.debounce';

import { SlashCommand } from './SlashCommand';
import { BlockId } from './extensions/block-id';

const TableDeleteHandler = Extension.create({
  name: 'tableDeleteHandler',
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        const { $anchor } = selection;
        const isInTable = $anchor.parent.type.name === 'tableCell'
          || $anchor.parent.type.name === 'tableHeader';

        if (!isInTable) return false;

        const cellContent = $anchor.parent.textContent;
        if (cellContent === '') {
          const isTableEmpty = (() => {
            let empty = true;
            editor.state.doc.descendants((node) => {
              if (node.type.name === 'table') {
                node.descendants((child) => {
                  if (child.isText && child.textContent.trim() !== '') {
                    empty = false;
                  }
                });
              }
            });
            return empty;
          })();

          if (isTableEmpty) {
            editor.chain().focus().deleteTable().run();
            return true;
          }
        }
        return false;
      },
    };
  },
});

import { createSupabaseBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import ReviewSidebar from './ReviewSidebar';
import VersionDiffModal from './VersionDiffModal';
import { findBlockIdAtSelection, highlightTextInEditor } from '@/lib/editor-selection';
import type { DocumentVersion } from '@/lib/versions';
import ShareModal from './ShareModal';
import ExportModal from './ExportModal';
import FindReplace from './FindReplace';
import ShortcutsModal from './ShortcutsModal';
import PresenceAvatars from './PresenceAvatars';
import { SupabaseYjsProvider, type ProviderStatus } from '@/lib/yjs-supabase-provider';
import {
  fetchDocumentBootstrap,
  saveDocumentSnapshot,
  colorForUser,
  type PresenceUser,
} from '@/lib/realtime';
import {
  createVersion,
  shouldAutoSnapshot,
  markAutoSnapshotTaken,
} from '@/lib/versions';

const Icons = {
  Bold: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14 12a4 4 0 0 0 0-8H6v8"/><path d="M15 20a4 4 0 0 0 0-8H6v8Z"/></svg>
  ),
  Italic: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
  ),
  List: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
  ),
  Link: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
  ),
  CheckCircle: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
  ),
  RefreshCw: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
  ),
  ChevronLeft: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m15 18-6-6 6-6"/></svg>
  ),
};

type ToolbarButtonProps = {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
};

const ToolbarButton = ({ icon, label, active, onClick }: ToolbarButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`group relative p-2.5 rounded-full transition-all duration-200 flex items-center justify-center ${
      active ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
    }`}
    aria-label={label}
  >
    {icon}
    <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-zinc-900 text-white text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-sm transform translate-y-1 group-hover:translate-y-0">
      {label}
    </span>
  </button>
);

// ---------------------------------------------------------------------
// Sync timing.
//
// CONTENT_SAVE_MS is the snapshot debounce for *persistence* — how long
// after the last edit we write the merged Y.Doc state to Postgres. It
// has nothing to do with how fast collaborators see your edits anymore;
// the CRDT broadcasts those at byte-level deltas in the time it takes
// the WebSocket to round-trip (~30-100ms typical).
//
// We tightened it from 1500ms (the old version-check save) to 2000ms
// because writes are heavier now (yjs_state + content + version bump),
// but the user-perceived sync latency is gone either way.
// ---------------------------------------------------------------------
const CONTENT_SAVE_MS = 2000;
const TITLE_SAVE_MS = 1500;

type SyncState = 'saved' | 'syncing' | 'error';

export default function DocumentEditor({ documentId }: { documentId: string }) {
  const [syncState, setSyncState] = useState<SyncState>('saved');
  const [title, setTitle] = useState('Untitled');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'owner' | 'editor' | 'viewer'>('owner');
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [versionsRefreshToken, setVersionsRefreshToken] = useState(0);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>('connecting');
  const [bootstrapped, setBootstrapped] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewMode = searchParams.get('review');
  const parentIdParam = searchParams.get('parentId');
  const changeIdParam = searchParams.get('changeId');
  const highlightParam = searchParams.get('highlight');

  const [branchDiffOpen, setBranchDiffOpen] = useState(false);
  const [parentForDiff, setParentForDiff] = useState<DocumentVersion | null>(null);

  const titleRef = useRef('Untitled');

  // ------------------------------------------------------------------
  // The Y.Doc and the network provider.
  //
  // Lazy useState init guarantees we create exactly one Y.Doc per
  // component instance. Document routes are 1:1 with this component
  // (each /doc/[id] page mounts its own DocumentEditor), so this is
  // safe and avoids the "doc identity changes but state survives" trap.
  // ------------------------------------------------------------------
  const [ydoc] = useState<Y.Doc>(() => new Y.Doc());
  const [provider] = useState<SupabaseYjsProvider>(() =>
    new SupabaseYjsProvider({
      supabase: createSupabaseBrowserClient(),
      documentId,
      doc: ydoc,
    })
  );

  const canEdit = userRole === 'owner' || userRole === 'editor';

  // ------------------------------------------------------------------
  // Snapshot persistence.
  //
  // We no longer save on a per-keystroke optimistic-locking RPC. Instead
  // we debounce a single write that persists:
  //   - the binary Yjs state (authoritative for live collab)
  //   - a JSON view of the same doc (consumed by AI sidebar, exports,
  //     full-text search, version snapshots)
  //
  // The CRDT *is* the merge, so concurrent saves from two clients can
  // never conflict the way the old version-check did. Worst case is
  // last-write-wins on the JSON column, but that's purely a "view"
  // column — the Yjs log on the winner already contains the loser's
  // ops, so the next snapshot reconciles automatically.
  // ------------------------------------------------------------------
  const performSnapshot = useCallback(async () => {
    if (!user || !canEdit) return;
    setSyncState('syncing');

    // Always serialize from the Y.Doc, not `editor.getJSON()`. With
    // Collaboration enabled, the ProseMirror doc and the CRDT can be
    // briefly out of phase during ySyncPlugin reconciliation; the Y.Doc
    // is the source of truth for what we persist. This also avoids a
    // race where `editorRef` is still null on the first ydoc `update`
    // after bootstrap hydration.
    const editorJson = yDocToProsemirrorJSON(ydoc, 'default') as JSONContent;

    const yjsState = Y.encodeStateAsUpdate(ydoc);
    const result = await saveDocumentSnapshot({
      documentId,
      yjsState,
      content: editorJson,
      title: titleRef.current,
    });

    if (result.ok) {
      setSyncState('saved');

      if (shouldAutoSnapshot(documentId)) {
        markAutoSnapshotTaken(documentId);
        const created = await createVersion({
          documentId,
          content: editorJson,
          title: titleRef.current,
          userId: user.id,
          userEmail: user.email ?? null,
          isAuto: true,
        });
        if (created) setVersionsRefreshToken((t) => t + 1);
      }
    } else {
      setSyncState('error');
    }
  }, [documentId, user, canEdit, ydoc]);

  const debouncedSnapshot = useMemo(
    () => debounce(() => performSnapshot(), CONTENT_SAVE_MS),
    [performSnapshot]
  );

  // ------------------------------------------------------------------
  // Editor instance.
  //
  // The crucial bits for collab correctness:
  //   - StarterKit must disable its built-in history. Yjs provides
  //     undo/redo on the CRDT log; running both simultaneously causes
  //     transactions to fight and produces weird position errors.
  //   - The Collaboration extension binds the editor doc to the Y.Doc
  //     in a single direction (PM <-> Y.XmlFragment via y-tiptap's
  //     ySyncPlugin). Local edits flow into ydoc, remote ydoc updates
  //     flow into the editor.
  //   - PersistingCollaborationCaret reads the user's cursor from ProseMirror
  //     and writes it into the Yjs awareness state as a *relative*
  //     position. That's what makes other users' cursors stay glued
  //     to the right text instead of jumping when ops land before them
  //     — the prior hand-rolled CollabCursor used absolute positions
  //     and had to guess on every remote update.
  // ------------------------------------------------------------------
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        undoRedo: false,
      }),
      Placeholder.configure({ placeholder: 'Type / for commands...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'editor-link' } }),
      Image.configure({ allowBase64: true, HTMLAttributes: { class: 'editor-image' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TableDeleteHandler,
      SlashCommand,
      BlockId,
      Collaboration.configure({ document: ydoc }),
      PersistingCollaborationCaret.configure({
        provider,
        user: user
          ? {
              id: user.id,
              name: user.email?.split('@')[0] ?? 'Anonymous',
              color: colorForUser(user.id),
            }
          : { name: 'Anonymous', color: '#888' },
        selectionRender: (u) => ({
          class: 'collab-selection',
          style: `background-color: ${String(u.color ?? '#888')}40`,
        }),
      }),
    ],
    editorProps: {
      attributes: {
        class:
          'tiptap prose prose-zinc max-w-none min-h-[400px] focus:outline-none prose-headings:font-semibold prose-p:my-2 prose-ul:my-2 prose-li:my-0',
      },
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      setSelectedText(from === to ? '' : editor.state.doc.textBetween(from, to, ' '));
      setSelectedBlockId(findBlockIdAtSelection(editor));
    },
  });

  // Editor ref so the snapshot callback can read editor.getJSON without
  // taking `editor` as a dep (which would re-create the debounced fn on
  // every Tiptap re-init and lose pending timers).
  const editorRef = useRef(editor);
  useEffect(() => { editorRef.current = editor; }, [editor]);

  // ------------------------------------------------------------------
  // Snapshot trigger.
  //
  // We hook the Y.Doc's `update` event directly rather than Tiptap's
  // onUpdate callback. With the Collaboration extension in play, every
  // local edit becomes a CRDT op on ydoc, so this is the most reliable
  // "something changed" signal — and it works even if Tiptap's onUpdate
  // is suppressed (which it can be when ySyncPlugin is reconciling).
  //
  // We filter out updates whose origin is our own provider's remoteOrigin
  // by skipping any update that has a non-null origin we don't recognize
  // as local. The simplest local-vs-remote test: locally-typed edits
  // produce updates with origin === null (or the ySyncPlugin's symbol).
  // Remote updates carry the provider's remoteOrigin Symbol. We only
  // need to debounce snapshots for our own edits — but it's harmless to
  // snapshot on remote ones too (last-write-wins on the JSON view col).
  // ------------------------------------------------------------------
  useEffect(() => {
    const handler = () => debouncedSnapshot();
    ydoc.on('update', handler);
    return () => ydoc.off('update', handler);
  }, [ydoc, debouncedSnapshot]);

  // ------------------------------------------------------------------
  // Collected extensions list, memoized once, so we can derive a schema
  // for the legacy-content hydration path WITHOUT pulling it from the
  // live editor (which may not exist yet at hydration time).
  // ------------------------------------------------------------------
  const schema = useMemo(() => {
    return getSchema([
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, undoRedo: false }),
      Placeholder.configure({ placeholder: '' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link,
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TableDeleteHandler,
      SlashCommand,
      BlockId,
      Collaboration.configure({ document: ydoc }),
    ]);
  }, [ydoc]);

  // ------------------------------------------------------------------
  // Provider lifecycle: connect on mount, disconnect on unmount.
  //
  // We use `disconnect`, not `destroy`, in the cleanup. Reason: React
  // 18 strict mode runs effects twice in dev (mount, unmount, mount)
  // on the SAME provider instance. `destroy` is terminal and would
  // permanently break the provider after the first unmount. `disconnect`
  // is reusable — the second mount calls `connect` again and we
  // re-subscribe cleanly. On real component unmount the provider becomes
  // unreachable and is GC'd; we don't need an explicit destroy here.
  // ------------------------------------------------------------------
  useEffect(() => {
    provider.connect();
    const unsubStatus = provider.onStatus(setProviderStatus);
    return () => {
      unsubStatus();
      provider.disconnect();
    };
  }, [provider]);

  // ------------------------------------------------------------------
  // Awareness -> presence avatars.
  //
  // Each connected client writes a `user` field into awareness via the
  // Collaboration caret extension. We map that into the same
  // PresenceUser shape the header avatar UI already understood.
  // ------------------------------------------------------------------
  useEffect(() => {
    const refresh = () => {
      const states = provider.awareness.getStates();
      const next: PresenceUser[] = [];
      const seen = new Set<string>();
      states.forEach((state, clientId) => {
        const u = state.user as { name?: string; color?: string; id?: string } | undefined;
        if (!u || !u.name) return;
        const id = u.id ?? `client-${clientId}`;
        if (seen.has(id)) return;
        seen.add(id);
        next.push({
          user_id: id,
          email: '',
          name: u.name,
          color: u.color ?? '#888',
          online_at: new Date().toISOString(),
        });
      });
      setPresenceUsers(next);
    };
    provider.awareness.on('change', refresh);
    refresh();
    return () => provider.awareness.off('change', refresh);
  }, [provider]);

  // ------------------------------------------------------------------
  // Decorate our local awareness state with the stable user id, so
  // other clients can dedupe presence across our tabs. The caret extension
  // wrote `name` and `color`; we add `id` here.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    const current = provider.awareness.getLocalState() ?? {};
    const currentUser = (current.user as Record<string, unknown> | undefined) ?? {};
    provider.awareness.setLocalStateField('user', {
      ...currentUser,
      id: user.id,
      name: user.email?.split('@')[0] ?? 'Anonymous',
      color: colorForUser(user.id),
    });
  }, [provider, user]);

  // ------------------------------------------------------------------
  // Title save. Stays on a plain debounced UPDATE because a string
  // doesn't benefit from a CRDT — last-write-wins is the right merge
  // strategy for "what is this document called".
  // ------------------------------------------------------------------
  const debouncedTitleSave = useMemo(
    () =>
      debounce((newTitle: string) => {
        if (!user) return;
        const supabase = createSupabaseBrowserClient();
        supabase
          .from('documents')
          .update({ title: newTitle, updated_at: new Date().toISOString() })
          .eq('id', documentId)
          .then();
      }, TITLE_SAVE_MS),
    [documentId, user]
  );

  useEffect(() => {
    return () => {
      debouncedSnapshot.cancel();
      debouncedTitleSave.cancel();
    };
  }, [debouncedSnapshot, debouncedTitleSave]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    titleRef.current = e.target.value;
    debouncedTitleSave(e.target.value);
  };

  const handleAddLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href ?? '';
    const url = window.prompt('Enter URL:', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const href = url.match(/^https?:\/\//) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
  }, [editor]);

  const handleImageUpload = useCallback(async () => {
    if (!editor) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentId', documentId);

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
          editor.chain().focus().setImage({ src: data.url }).run();
        } else {
          console.error('Upload failed:', data.error);
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
    };
    input.click();
  }, [editor, documentId]);

  const handleInsertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  useEffect(() => {
    if (reviewMode !== 'diff' || !parentIdParam) return;

    setIsSidebarOpen(true);

    let cancelled = false;
    void (async () => {
      const boot = await fetchDocumentBootstrap(parentIdParam);
      if (cancelled || !boot) return;

      setParentForDiff({
        id: `parent-${parentIdParam}`,
        document_id: parentIdParam,
        content: boot.content ?? { type: 'doc', content: [] },
        title: boot.title ?? 'Parent document',
        label: 'Trunk',
        message: null,
        is_auto: false,
        created_by: null,
        created_by_email: null,
        created_at: new Date().toISOString(),
      });
      setBranchDiffOpen(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [reviewMode, parentIdParam]);

  const clearBranchReviewParams = useCallback(() => {
    setBranchDiffOpen(false);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('review');
    url.searchParams.delete('parentId');
    url.searchParams.delete('changeId');
    url.searchParams.delete('highlight');
    const qs = url.searchParams.toString();
    router.replace(`${url.pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [router]);

  const getNodeIndex = useCallback((text: string): number => {
    if (!editor || !text) return 0;
    const json = editor.getJSON();
    const nodes = json.content || [];
    for (let i = 0; i < nodes.length; i++) {
      const nodeContent = nodes[i].content;
      const nodeText = Array.isArray(nodeContent)
        ? nodeContent.map((c) => ('text' in c ? (c.text as string) : '')).join('')
        : '';
      if (nodeText.includes(text) || text.includes(nodeText)) {
        return i;
      }
    }
    return 0;
  }, [editor]);

  const handleAcceptChange = useCallback((nodeIndex: number, proposedText: string) => {
    if (!editor) return;
    // We mutate via Tiptap commands so the change flows through the
    // Collaboration extension into ydoc and broadcasts normally.
    const json = JSON.parse(JSON.stringify(editor.getJSON()));
    const nodes = json.content || [];
    if (nodeIndex >= 0 && nodeIndex < nodes.length) {
      const node = nodes[nodeIndex];
      if (node.content) {
        node.content = [{ type: 'text', text: proposedText }];
      }
      editor.commands.setContent(json);
    }
  }, [editor]);

  // ------------------------------------------------------------------
  // Restore from versions panel.
  //
  // Restore is a destructive replacement, not a merge, so we have to
  // wipe the live Y.Doc and rebuild it from the snapshot's JSON. The
  // resulting Y updates broadcast through the provider just like any
  // other edit, so collaborators see the restore happen in real time.
  // ------------------------------------------------------------------
  const handleRestoreVersion = useCallback(
    (content: JSONContent, newTitle: string) => {
      if (!editor) return;

      // Build a fresh Y.Doc from the snapshot JSON, then transplant its
      // state into the live ydoc as a single update transaction. This
      // is the y-prosemirror-recommended pattern for snapshot replace.
      const tmp = prosemirrorJSONToYDoc(schema, content);
      const fullState = Y.encodeStateAsUpdate(tmp);
      tmp.destroy();

      // Clear the existing fragment first so we don't merge old + new.
      // We do this inside a transaction tagged as "restore" so listeners
      // could distinguish it if they ever cared.
      ydoc.transact(() => {
        const fragment = ydoc.get('default', Y.XmlFragment);
        fragment.delete(0, fragment.length);
      }, 'restore');

      Y.applyUpdate(ydoc, fullState, 'restore');

      setTitle(newTitle);
      titleRef.current = newTitle;
      // Trigger a snapshot so the JSON view column matches the new state.
      debouncedSnapshot();
    },
    [editor, ydoc, schema, debouncedSnapshot]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsFindOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '/') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ------------------------------------------------------------------
  // One-shot bootstrap: pull the doc row, hydrate Y.Doc, set role/title.
  //
  // Hydration order matters:
  //   1. If we have yjs_state, apply it. The Y.Doc CRDT log is the
  //      authoritative source for any doc edited after the migration.
  //   2. Otherwise, if there's legacy JSON content, build a Y.Doc from
  //      it via prosemirrorJSONToYDoc and merge. This runs at most once
  //      per legacy doc; the next snapshot writes yjs_state and from
  //      then on path #1 is taken.
  //   3. If the doc is empty, do nothing — the user is starting fresh.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const boot = await fetchDocumentBootstrap(documentId);
      if (cancelled || !boot) {
        if (!cancelled) setBootstrapped(true);
        return;
      }

      if (boot.title) {
        setTitle(boot.title);
        titleRef.current = boot.title;
      }

      // Resolve role.
      if (boot.ownerId === user.id) {
        setUserRole('owner');
      } else {
        const supabase = createSupabaseBrowserClient();
        const { data: collab } = await supabase
          .from('document_collaborators')
          .select('role')
          .eq('document_id', documentId)
          .eq('user_id', user.id)
          .single();
        const role = (collab?.role as 'editor' | 'viewer') ?? 'viewer';
        setUserRole(role);
        if (role === 'viewer' && editorRef.current) {
          editorRef.current.setEditable(false);
        }
      }

      // Hydrate the CRDT.
      if (boot.yjsState && boot.yjsState.length > 0) {
        Y.applyUpdate(ydoc, boot.yjsState);
      } else if (boot.content) {
        const tmp = prosemirrorJSONToYDoc(schema, boot.content);
        Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(tmp));
        tmp.destroy();
      }

      setBootstrapped(true);
    })();

    return () => { cancelled = true; };
  }, [documentId, user, ydoc, schema]);

  useEffect(() => {
    if (!editor || !bootstrapped || !highlightParam) return;
    let text = highlightParam;
    try {
      text = decodeURIComponent(highlightParam);
    } catch {
      // use raw param
    }
    const timer = window.setTimeout(() => highlightTextInEditor(editor, text), 400);
    return () => window.clearTimeout(timer);
  }, [editor, bootstrapped, highlightParam]);

  // Map provider status -> the existing tri-state UI vocab.
  const realtimeStatus: 'connected' | 'connecting' | 'disconnected' = providerStatus;

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-200/80 h-14 px-6 flex items-center justify-between transition-all">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="w-8 h-8 flex items-center justify-center -ml-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            aria-label="Back to dashboard"
          >
            <Icons.ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              readOnly={userRole === 'viewer'}
              className={`bg-transparent text-sm font-semibold text-zinc-900 outline-none placeholder-zinc-400 w-64 rounded px-1 -ml-1 transition-colors truncate ${
                userRole === 'viewer' ? 'cursor-default' : 'hover:bg-zinc-50 focus:bg-zinc-50'
              }`}
            />
            <span className="text-[10px] text-zinc-500 font-medium px-1">
              {syncState === 'saved' && (bootstrapped ? 'Saved' : 'Loading…')}
              {syncState === 'syncing' && 'Saving…'}
              {syncState === 'error' && 'Error saving'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 h-7 px-3 bg-zinc-50 border border-zinc-200/60 rounded-full transition-all">
            {syncState === 'saved' ? (
              <>
                <Icons.CheckCircle className="w-3 h-3 text-emerald-500" />
                <span className="text-[11px] font-medium text-zinc-500">Saved</span>
              </>
            ) : syncState === 'syncing' ? (
              <>
                <Icons.RefreshCw className="w-3 h-3 text-zinc-400 animate-spin-slow" />
                <span className="text-[11px] font-medium text-zinc-400">Syncing...</span>
              </>
            ) : (
              <span className="text-[11px] font-medium text-red-600">Error</span>
            )}
          </div>

          <div className="h-4 w-px bg-zinc-200" />

          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                realtimeStatus === 'connected'
                  ? 'bg-emerald-500'
                  : realtimeStatus === 'connecting'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-[11px] text-zinc-500">
              {realtimeStatus === 'connected'
                ? 'Live'
                : realtimeStatus === 'connecting'
                ? 'Connecting'
                : 'Offline'}
            </span>
          </div>

          <PresenceAvatars users={presenceUsers} currentUserId={user?.id ?? ''} showSelf />

          {userRole === 'viewer' && (
            <span className="text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              View only
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="h-8 px-4 bg-zinc-100 text-zinc-700 text-xs font-medium rounded-md hover:bg-zinc-200 transition-colors"
          >
            Export
          </button>

          <button
            type="button"
            onClick={() => setIsShareOpen(true)}
            className="h-8 px-4 bg-zinc-900 text-white text-xs font-medium rounded-md hover:bg-zinc-800 transition-colors shadow-sm"
          >
            Share
          </button>
        </div>
      </header>

      <main className="relative flex flex-1 pt-24 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 md:px-8 flex justify-center">
          <div className="relative w-full max-w-[800px] bg-white min-h-[1100px] shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-zinc-200/60 rounded-sm p-12 md:p-16 transition-shadow hover:shadow-[0_4px_20px_-3px_rgba(0,0,0,0.1),0_10px_25px_-2px_rgba(0,0,0,0.05)]">
            <EditorContent editor={editor} />
          </div>
        </div>

        <div
          className={`hidden lg:flex fixed top-14 right-0 bottom-0 z-30 transform transition-transform duration-300 ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <aside className="w-[380px] border-l border-zinc-200 bg-white overflow-hidden shadow-xl flex">
            <ReviewSidebar
              onClose={() => setIsSidebarOpen(false)}
              documentId={documentId}
              documentContent={editor?.getText() ?? ''}
              documentContentJson={editor?.getJSON() ?? null}
              documentTitle={title}
              selectedText={selectedText}
              selectedBlockId={selectedBlockId}
              focusChangeId={changeIdParam}
              initialTab="comments"
              onAcceptChange={handleAcceptChange}
              getNodeIndex={getNodeIndex}
              currentJSON={editor?.getJSON() ?? { type: 'doc', content: [] }}
              canEdit={canEdit}
              onRestoreVersion={handleRestoreVersion}
              versionsRefreshToken={versionsRefreshToken}
            />
          </aside>
        </div>
      </main>

      <ShareModal
        documentId={documentId}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title={title}
        getHTML={() => editor?.getHTML() ?? ''}
        userEmail={user?.email ?? undefined}
      />

      <FindReplace
        editor={editor}
        isOpen={isFindOpen}
        onClose={() => setIsFindOpen(false)}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {branchDiffOpen && parentForDiff && editor && bootstrapped && (
        <VersionDiffModal
          left={parentForDiff}
          right="current"
          currentContent={editor.getJSON()}
          currentTitle={title}
          onClose={clearBranchReviewParams}
        />
      )}

      {userRole === 'viewer' ? null : (
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-0.5 p-1.5 bg-white border border-zinc-200/80 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl ring-1 ring-black/5">
          <ToolbarButton
            icon={<Icons.Bold className="w-4 h-4" />}
            label="Bold (Cmd+B)"
            active={editor?.isActive('bold') ?? false}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            icon={<Icons.Italic className="w-4 h-4" />}
            label="Italic (Cmd+I)"
            active={editor?.isActive('italic') ?? false}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
          <div className="w-px h-4 bg-zinc-200 mx-0.5" />

          <ToolbarButton
            icon={<span className="text-xs font-bold">H1</span>}
            label="Heading 1"
            active={editor?.isActive('heading', { level: 1 }) ?? false}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          />
          <ToolbarButton
            icon={<span className="text-xs font-bold">H2</span>}
            label="Heading 2"
            active={editor?.isActive('heading', { level: 2 }) ?? false}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <div className="w-px h-4 bg-zinc-200 mx-0.5" />

          <ToolbarButton
            icon={<Icons.List className="w-4 h-4" />}
            label="Bullet List"
            active={editor?.isActive('bulletList') ?? false}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>}
            label="Numbered List"
            active={editor?.isActive('orderedList') ?? false}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            label="Checklist"
            active={editor?.isActive('taskList') ?? false}
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
          />
          <div className="w-px h-4 bg-zinc-200 mx-0.5" />

          <ToolbarButton
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            label="Code Block"
            active={editor?.isActive('codeBlock') ?? false}
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          />
          <ToolbarButton
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>}
            label="Quote"
            active={editor?.isActive('blockquote') ?? false}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          />
          <div className="w-px h-4 bg-zinc-200 mx-0.5" />

          <ToolbarButton
            icon={<Icons.Link className="w-4 h-4" />}
            label="Link"
            active={editor?.isActive('link') ?? false}
            onClick={handleAddLink}
          />
          <ToolbarButton
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            label="Image"
            active={false}
            onClick={handleImageUpload}
          />
          <ToolbarButton
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" /></svg>}
            label="Table"
            active={editor?.isActive('table') ?? false}
            onClick={handleInsertTable}
          />
          <div className="w-px h-4 bg-zinc-200 mx-0.5" />

          <button
            type="button"
            className="p-2.5 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            aria-label="Open review sidebar"
            onClick={() => setIsSidebarOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M21 11.5a8.38 8.38 0 0 1-1.9 5.4 8.5 8.5 0 0 1-6.6 3.1 8.38 8.38 0 0 1-4.1-1.1L3 21l1.1-4.3A8.38 8.38 0 0 1 3 11.5 8.5 8.5 0 0 1 9.6 4 8.38 8.38 0 0 1 21 11.5Z" />
            </svg>
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
