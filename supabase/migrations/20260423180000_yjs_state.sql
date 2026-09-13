-- Strux: Yjs CRDT persistence for real-time collaboration.

alter table public.documents
  add column if not exists yjs_state bytea;

alter table public.documents
  add column if not exists last_yjs_save_at timestamptz;

comment on column public.documents.yjs_state is 'Binary Y.Doc state (authoritative for live collab).';
comment on column public.documents.last_yjs_save_at is 'Timestamp of last Yjs snapshot write.';
