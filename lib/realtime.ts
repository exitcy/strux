import type { JSONContent } from '@tiptap/core';
import { createSupabaseBrowserClient } from './supabase';

// =====================================================================
// Doc lifecycle helpers
// ---------------------------------------------------------------------
// What used to live here: a hand-rolled broadcast/presence layer that
// shipped whole JSON documents over Supabase Realtime on every keystroke,
// plus an optimistic-locking RPC that conflicted ~100% of the time when
// two users typed simultaneously.
//
// What lives here now: just the small, stable pieces of that surface
// area — color assignment, a presence-user shape, and the snapshot
// persistence helper. The actual realtime sync moved into
// `yjs-supabase-provider.ts` and runs on a CRDT, so concurrent edits
// merge automatically and we no longer need the version check during
// normal typing.
// =====================================================================

// Presence shape kept (and re-exported) because the editor header still
// renders an avatar list. The list is now derived from Yjs awareness
// rather than from a Supabase presence channel, but the UI shape is the
// same so we don't have to touch every call site.
export interface PresenceUser {
  user_id: string;
  email: string;
  name: string;
  color: string;
  online_at: string;
}

// ---------------------------------------------------------------------
// Deterministic color assignment
// ---------------------------------------------------------------------
// Hash the user id to a stable color bucket. Pure, no DB lookup,
// guarantees the same user shows up in the same color for everyone.

const PRESENCE_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706',
  '#9333ea', '#0891b2', '#db2777', '#65a30d',
  '#ea580c', '#0d9488',
];

export function colorForUser(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return PRESENCE_COLORS[h % PRESENCE_COLORS.length];
}

// ---------------------------------------------------------------------
// Snapshot persistence
// ---------------------------------------------------------------------
// Writes the current Yjs state + a JSON view of the document in a single
// UPDATE. We deliberately do NOT version-check anymore: under Yjs there
// is no such thing as a "stale write" for live edits — the CRDT log is
// monotonic and any client that has applied newer remote ops will simply
// produce a superset state vector on its next snapshot.
//
// The `version` column still exists and still bumps, but only as a
// monotonic counter that the version-snapshot UI can reference. It is
// no longer the basis of conflict detection.

export interface SnapshotInput {
  documentId: string;
  /** Binary Y.Doc state from Y.encodeStateAsUpdate(). Pass null to skip. */
  yjsState: Uint8Array | null;
  /** JSONContent view of the same doc — kept in sync for AI/export/search. */
  content: JSONContent;
  title: string;
}

export async function saveDocumentSnapshot(
  input: SnapshotInput
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const supabase = createSupabaseBrowserClient();

  // PostgREST expects BYTEA in the `\xDEADBEEF…` hex text format over
  // JSON — a raw base64 string is stored as *text bytes*, not decoded
  // binary, which either corrupts the column or makes Postgres reject
  // the whole UPDATE. A Uint8Array is also unreliable here (known
  // supabase-js / PostgREST edge cases). Hex is the stable path.
  const yjsHex = input.yjsState && input.yjsState.length > 0
    ? uint8ToPostgresByteaHex(input.yjsState)
    : null;

  const fullUpdate = {
    yjs_state: yjsHex,
    content: input.content,
    title: input.title,
    last_yjs_save_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // IMPORTANT: do not use `.single()` on the returning clause. If RLS
  // allows UPDATE but not SELECT on the row (a common split policy), or
  // if PostgREST returns zero rows for any reason, `.single()` becomes
  // PGRST116 and the client treats the whole save as failed — even when
  // the row was actually updated. The title-only save path in the editor
  // does not use `.single()`, which is why titles kept working while
  // body content appeared "stuck". `maybeSingle` accepts zero or one
  // row without throwing.
  let { data, error } = await supabase
    .from('documents')
    .update(fullUpdate)
    .eq('id', input.documentId)
    .select('version')
    .maybeSingle();

  // Graceful migration fallback: if `yjs_state` / `last_yjs_save_at`
  // don't exist yet (the SQL migration in supabase/migrations/ hasn't
  // been applied), Postgres returns 42703 "column does not exist".
  // Retry without those columns so editing still functions and we don't
  // silently swallow user keystrokes — but yell about it loud and clear.
  if (error && /column .* does not exist|42703|PGRST204/i.test(error.message + ' ' + (error.code ?? ''))) {
    console.warn(
      '[Strux] yjs_state column missing on documents table. The CRDT ' +
      'migration has not been applied; falling back to JSON-only saves. ' +
      'Run supabase/migrations/20260423180000_yjs_state.sql to enable ' +
      'real-time collaboration persistence.'
    );
    const fallback = await supabase
      .from('documents')
      .update({
        content: input.content,
        title: input.title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.documentId)
      .select('version')
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error('saveDocumentSnapshot failed:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true, version: (data?.version as number | undefined) ?? 1 };
}

// ---------------------------------------------------------------------
// Initial load
// ---------------------------------------------------------------------
// One round-trip on document open. Returns everything the editor needs
// to bootstrap: the binary Yjs state (preferred), the JSON fallback for
// docs created before the CRDT migration, ownership info, and the
// monotonic version counter.

export interface DocumentBootstrap {
  yjsState: Uint8Array | null;
  content: JSONContent | null;
  title: string | null;
  ownerId: string | null;
  version: number;
}

export async function fetchDocumentBootstrap(
  documentId: string
): Promise<DocumentBootstrap | null> {
  const supabase = createSupabaseBrowserClient();
  let { data, error } = await supabase
    .from('documents')
    .select('yjs_state, content, title, owner_id, version, deleted_at')
    .eq('id', documentId)
    .single();

  // Same migration-not-applied fallback as in saveDocumentSnapshot. We
  // re-query without the new columns so a stale DB schema doesn't block
  // the editor from loading at all.
  if (error && /column .* does not exist|42703|PGRST204/i.test(error.message + ' ' + (error.code ?? ''))) {
    console.warn(
      '[Strux] yjs_state column missing — loading without CRDT state. ' +
      'Run supabase/migrations/20260423180000_yjs_state.sql to enable ' +
      'real-time collaboration.'
    );
    const fb = await supabase
      .from('documents')
      .select('content, title, owner_id, version')
      .eq('id', documentId)
      .single();
    data = fb.data;
    error = fb.error;
  }

  if (error || !data) {
    if (error) console.error('fetchDocumentBootstrap failed:', error);
    return null;
  }

  const deletedAt = (data as { deleted_at?: string | null }).deleted_at;
  if (deletedAt) return null;

  // PostgREST returns BYTEA as either a base64 string or a `\x...` hex
  // literal depending on column settings. Handle both, fall back to null.
  let yjsState: Uint8Array | null = null;
  const raw = (data as { yjs_state?: string | null }).yjs_state;
  if (typeof raw === 'string' && raw.length > 0) {
    yjsState = raw.startsWith('\\x') ? hexToUint8(raw.slice(2)) : base64ToUint8(raw);
  }

  return {
    yjsState,
    content: (data.content as JSONContent | null) ?? null,
    title: (data.title as string | null) ?? null,
    ownerId: (data.owner_id as string | null) ?? null,
    version: (data.version as number | null) ?? 1,
  };
}

// ---------------------------------------------------------------------
// Browser-safe binary <-> string helpers
// ---------------------------------------------------------------------
// Duplicated from yjs-supabase-provider.ts deliberately to keep this
// module dependency-free of the provider (no circular imports).

/** PostgREST / Postgres BYTEA literal over JSON (`\x` + hex, no spaces). */
function uint8ToPostgresByteaHex(bytes: Uint8Array): string {
  let out = '\\x';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function base64ToUint8(str: string): Uint8Array {
  if (typeof atob !== 'undefined') {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(str, 'base64'));
}

function hexToUint8(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}
