-- Strux: project-centric dashboard + document branches (Git-style lines).
-- Apply in Supabase SQL editor or via CLI. RLS: if policies are owner-scoped on
-- documents, ensure shared users can read branch rows you grant (same patterns
-- as trunk); branch rows should usually share owner_id with parent trunk.

alter table public.documents
  add column if not exists parent_id uuid references public.documents (id) on delete set null;

alter table public.documents
  add column if not exists project_name text not null default 'General';

alter table public.documents
  add column if not exists starred boolean not null default false;

alter table public.documents
  add column if not exists last_merged_at timestamptz null;

alter table public.documents
  add column if not exists doc_status text not null default 'draft';

alter table public.documents
  drop constraint if exists documents_doc_status_check;

alter table public.documents
  add constraint documents_doc_status_check check (doc_status in ('main', 'branch', 'draft'));

create index if not exists documents_parent_id_idx on public.documents (parent_id);
create index if not exists documents_owner_project_idx on public.documents (owner_id, project_name);
create index if not exists documents_owner_starred_idx on public.documents (owner_id, starred);

comment on column public.documents.parent_id is 'Branch document points to trunk; null = root line.';
comment on column public.documents.project_name is 'Dashboard grouping label until a projects table exists.';
comment on column public.documents.doc_status is 'Badge source: main | branch | draft.';
comment on column public.documents.last_merged_at is 'Optional; last merge time for last activity display.';

-- Existing trunk rows (no parent): treat as published main line for dashboard badges.
update public.documents
set doc_status = 'main'
where parent_id is null and doc_status = 'draft';
