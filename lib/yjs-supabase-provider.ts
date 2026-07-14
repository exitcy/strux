import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

// =====================================================================
// SupabaseYjsProvider — dual-channel Yjs transport
// ---------------------------------------------------------------------
// **Bottleneck analysis (what used to go wrong):**
//   Packing awareness + CRDT updates into one broadcast stream means
//   high-frequency cursor updates can contend with tiny Yjs ops on the
//   same channel queue. Under load, browsers also coalesce timers — so
//   we split the wire into two Realtime channels:
//     `yjs:c:<docId>` — content only (Yjs sync + incremental updates)
//     `yjs:a:<docId>` — awareness only (cursors / presence)
//
// **Provider–consumer pattern:**
//   TipTap + Collaboration extension is the consumer; this class is the
//   provider. Local PM edits become Y.Doc updates (CRDT merge happens in
//   Yjs *before* any network send). Remote bytes are applied with a
//   tagged origin so we never echo them back as outbound broadcasts.
//
// **Optimistic UX:** Text and caret render from local Y.Doc + PM state
//   immediately; these channels are eventual-consistency transport only.
//
// **Connection / "Offline" fixes:**
//   - Stale `CLOSED` callbacks from a replaced channel are ignored via
//     identity checks (React strict mode + rapid reconnect).
//   - Exponential backoff reconnect on TIMED_OUT / CHANNEL_ERROR / CLOSED.
//   - `window.online` + `visibilitychange` → immediate reconnect attempt.
//   - Lightweight doc-channel `ping` / `pong` heartbeat so quiet tabs
//     still exercise the broadcast path periodically (NAT / proxies).
// =====================================================================

type MsgSyncStep1 = { t: 'sync-step1'; sv: string };
type MsgSyncStep2 = { t: 'sync-step2'; u: string };
type MsgUpdate = { t: 'update'; u: string };
type MsgPing = { t: 'ping'; ts: number };
type MsgPong = { t: 'pong'; ts: number };
type DocMsg = MsgSyncStep1 | MsgSyncStep2 | MsgUpdate | MsgPing | MsgPong;

type AwareMsg = { t: 'awareness'; u: string };

export type ProviderStatus = 'connecting' | 'connected' | 'disconnected';

export interface SupabaseYjsProviderOptions {
  supabase: SupabaseClient;
  documentId: string;
  doc: Y.Doc;
  awareness?: Awareness;
}

const DOC_EVENT = 'd';
const AWARE_EVENT = 'a';

/** Cursor / presence is high-frequency; debounce outbound awareness. */
const AWARENESS_DEBOUNCE_MS = 80;

const HEARTBEAT_INTERVAL_MS = 25_000;

const BASE_RECONNECT_MS = 500;
const MAX_RECONNECT_MS = 30_000;

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  if (typeof btoa !== 'undefined') return btoa(bin);
  return Buffer.from(bytes).toString('base64');
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

export class SupabaseYjsProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly documentId: string;

  private supabase: SupabaseClient;
  private docChannel: RealtimeChannel | null = null;
  private awareChannel: RealtimeChannel | null = null;
  private status: ProviderStatus = 'connecting';
  private statusListeners = new Set<(s: ProviderStatus) => void>();
  private syncedListeners = new Set<(synced: boolean) => void>();
  private synced = false;

  private readonly remoteOrigin = Symbol('SupabaseYjsProvider.remote');
  private listenersAttached = false;

  private awarenessFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingAwarenessClients = new Set<number>();

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private intentionalDisconnect = false;

  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPongAt = 0;

  private subscriptionsReady = 0;
  private readonly expectedSubscriptions = 2;

  constructor(opts: SupabaseYjsProviderOptions) {
    this.doc = opts.doc;
    this.documentId = opts.documentId;
    this.supabase = opts.supabase;
    this.awareness = opts.awareness ?? new Awareness(opts.doc);
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleUnload);
      window.addEventListener('online', this.handleOnline);
      document.addEventListener('visibilitychange', this.handleVisibility);
    }
  }

  connect(): void {
    if (this.docChannel || this.awareChannel) return;

    this.intentionalDisconnect = false;
    this.attachLocalListeners();
    this.setStatus('connecting');
    this.subscriptionsReady = 0;

    const docCh = this.supabase.channel(`yjs:c:${this.documentId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    const awareCh = this.supabase.channel(`yjs:a:${this.documentId}`, {
      config: { broadcast: { self: false, ack: false } },
    });

    docCh.on('broadcast', { event: DOC_EVENT }, ({ payload }: { payload: DocMsg }) => {
      if (this.docChannel !== docCh) return;
      this.handleDocMessage(payload);
    });

    awareCh.on('broadcast', { event: AWARE_EVENT }, ({ payload }: { payload: AwareMsg }) => {
      if (this.awareChannel !== awareCh) return;
      if (payload?.t === 'awareness') {
        applyAwarenessUpdate(this.awareness, base64ToUint8(payload.u), this.remoteOrigin);
      }
    });

    const onDocStatus = (status: string, err?: Error) => {
      if (this.docChannel !== docCh) return;
      this.onChannelStatus('doc', status, err, docCh, awareCh);
    };
    const onAwareStatus = (status: string, err?: Error) => {
      if (this.awareChannel !== awareCh) return;
      this.onChannelStatus('aware', status, err, docCh, awareCh);
    };

    // Assign before subscribe: some runtimes invoke SUBSCRIBED synchronously,
    // and the handler compares against `this.docChannel` / `this.awareChannel`.
    this.docChannel = docCh;
    this.awareChannel = awareCh;

    docCh.subscribe(onDocStatus);
    awareCh.subscribe(onAwareStatus);
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.clearReconnectTimer();
    this.clearHeartbeat();
    this.flushAwarenessNow();

    try {
      removeAwarenessStates(this.awareness, [this.doc.clientID], 'provider-disconnect');
    } catch {
      /* noop */
    }
    this.detachLocalListeners();
    this.removeTransportChannels();
    this.setStatus('disconnected');
  }

  destroy(): void {
    this.disconnect();
    this.statusListeners.clear();
    this.syncedListeners.clear();
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleUnload);
      window.removeEventListener('online', this.handleOnline);
      document.removeEventListener('visibilitychange', this.handleVisibility);
    }
  }

  onStatus(cb: (s: ProviderStatus) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  onSynced(cb: (synced: boolean) => void): () => void {
    this.syncedListeners.add(cb);
    cb(this.synced);
    return () => this.syncedListeners.delete(cb);
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private attachLocalListeners(): void {
    if (this.listenersAttached) return;
    this.doc.on('update', this.handleLocalUpdate);
    this.awareness.on('update', this.handleAwarenessUpdate);
    this.listenersAttached = true;
  }

  private detachLocalListeners(): void {
    if (!this.listenersAttached) return;
    this.doc.off('update', this.handleLocalUpdate);
    this.awareness.off('update', this.handleAwarenessUpdate);
    this.listenersAttached = false;
  }

  private setStatus(s: ProviderStatus): void {
    if (s === this.status) return;
    this.status = s;
    for (const l of this.statusListeners) l(s);
  }

  private setSynced(v: boolean): void {
    if (v === this.synced) return;
    this.synced = v;
    for (const l of this.syncedListeners) l(v);
  }

  private onChannelStatus(
    _which: 'doc' | 'aware',
    status: string,
    err: Error | undefined,
    docCh: RealtimeChannel,
    awareCh: RealtimeChannel
  ): void {
    if (this.docChannel !== docCh || this.awareChannel !== awareCh) return;

    console.debug('[Strux yjs]', _which, '->', status, this.documentId, err?.message ?? '');

    if (status === 'SUBSCRIBED') {
      this.subscriptionsReady += 1;
      if (this.subscriptionsReady >= this.expectedSubscriptions) {
        this.reconnectAttempt = 0;
        this.setStatus('connected');
        this.broadcastDoc({
          t: 'sync-step1',
          sv: uint8ToBase64(Y.encodeStateVector(this.doc)),
        });
        this.broadcastAwarenessNow([this.doc.clientID]);
        this.startHeartbeat();
      }
      return;
    }

    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      this.clearHeartbeat();
      this.setStatus('disconnected');
      // One failed subscription leaves the other half-open; always tear
      // down both so the next `connect()` starts from a clean slate.
      this.removeTransportChannels();
      if (!this.intentionalDisconnect) {
        this.scheduleReconnect();
      }
    }
  }

  /** Remove Realtime channels only; keep Y.Doc listeners for reconnect. */
  private removeTransportChannels(): void {
    const docCh = this.docChannel;
    const awareCh = this.awareChannel;
    this.docChannel = null;
    this.awareChannel = null;
    this.subscriptionsReady = 0;
    if (awareCh) this.supabase.removeChannel(awareCh);
    if (docCh) this.supabase.removeChannel(docCh);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const exp = Math.min(MAX_RECONNECT_MS, BASE_RECONNECT_MS * Math.pow(2, this.reconnectAttempt));
    const jitter = Math.floor(Math.random() * 400);
    const delay = exp + jitter;
    this.reconnectAttempt += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.docChannel || this.awareChannel) return;
      this.intentionalDisconnect = false;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handleOnline = (): void => {
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    if (!this.docChannel && !this.awareChannel && !this.intentionalDisconnect) {
      this.connect();
    }
  };

  private handleVisibility = (): void => {
    if (document.visibilityState === 'visible' && this.status === 'disconnected' && !this.intentionalDisconnect) {
      this.reconnectAttempt = 0;
      this.clearReconnectTimer();
      this.connect();
    }
  };

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.docChannel) return;
      // Keeps the broadcast path warm on quiet docs; peers reply with
      // `pong` (no-op). Solo editors never receive pongs — that is OK.
      this.broadcastDoc({ t: 'ping', ts: Date.now() });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private broadcastDoc(msg: DocMsg): void {
    if (!this.docChannel) return;
    void this.docChannel.send({ type: 'broadcast', event: DOC_EVENT, payload: msg });
  }

  private broadcastAwareNow(payload: AwareMsg): void {
    if (!this.awareChannel) return;
    void this.awareChannel.send({ type: 'broadcast', event: AWARE_EVENT, payload });
  }

  private broadcastAwarenessNow(clientIds: number[]): void {
    if (clientIds.length === 0) return;
    const update = encodeAwarenessUpdate(this.awareness, clientIds);
    this.broadcastAwareNow({ t: 'awareness', u: uint8ToBase64(update) });
  }

  private flushAwarenessNow(): void {
    if (this.awarenessFlushTimer) {
      clearTimeout(this.awarenessFlushTimer);
      this.awarenessFlushTimer = null;
    }
    const ids = [...this.pendingAwarenessClients];
    this.pendingAwarenessClients.clear();
    if (ids.length > 0) this.broadcastAwarenessNow(ids);
  }

  private scheduleAwarenessBroadcast(clientIds: number[]): void {
    for (const id of clientIds) this.pendingAwarenessClients.add(id);
    if (this.awarenessFlushTimer) return;
    this.awarenessFlushTimer = setTimeout(() => {
      this.awarenessFlushTimer = null;
      const ids = [...this.pendingAwarenessClients];
      this.pendingAwarenessClients.clear();
      if (ids.length > 0) this.broadcastAwarenessNow(ids);
    }, AWARENESS_DEBOUNCE_MS);
  }

  private handleLocalUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === this.remoteOrigin) return;
    this.broadcastDoc({ t: 'update', u: uint8ToBase64(update) });
  };

  private handleAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ): void => {
    if (origin === this.remoteOrigin) return;
    this.scheduleAwarenessBroadcast([...added, ...updated, ...removed]);
  };

  private handleUnload = (): void => {
    this.disconnect();
  };

  private handleDocMessage(msg: DocMsg): void {
    switch (msg.t) {
      case 'sync-step1': {
        const remoteSv = base64ToUint8(msg.sv);
        const diff = Y.encodeStateAsUpdate(this.doc, remoteSv);
        this.broadcastDoc({ t: 'sync-step2', u: uint8ToBase64(diff) });
        this.broadcastAwarenessNow([this.doc.clientID]);
        break;
      }
      case 'sync-step2': {
        Y.applyUpdate(this.doc, base64ToUint8(msg.u), this.remoteOrigin);
        this.setSynced(true);
        break;
      }
      case 'update': {
        Y.applyUpdate(this.doc, base64ToUint8(msg.u), this.remoteOrigin);
        this.setSynced(true);
        break;
      }
      case 'ping': {
        this.broadcastDoc({ t: 'pong', ts: Date.now() });
        break;
      }
      case 'pong': {
        this.lastPongAt = Date.now();
        break;
      }
    }
  }
}
