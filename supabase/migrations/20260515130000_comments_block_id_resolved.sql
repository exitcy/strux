-- Comments: stable block anchors + canonical is_resolved flag.
-- Run after dashboard/branches migration (parent_id on documents).

alter table public.comments
  add column if not exists block_id text null;

alter table public.comments
  add column if not exists is_resolved boolean not null default false;

-- Legacy installs may have used `resolved` instead of `is_resolved`.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comments' and column_name = 'resolved'
  ) then
    execute $sql$
      update public.comments
      set is_resolved = coalesce(resolved, false)
      where is_resolved = false and resolved = true
    $sql$;
  end if;
end $$;

create index if not exists comments_document_id_idx on public.comments (document_id);
create index if not exists comments_block_id_idx on public.comments (block_id) where block_id is not null;

comment on column public.comments.block_id is 'TipTap data-block-id; stable anchor across Yjs edits.';
comment on column public.comments.is_resolved is 'Thread resolved; hide from active review by default.';
