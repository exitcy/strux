-- Strux base schema: documents, collaborators, comments, versions, chat sessions.
-- Apply before other migrations if setting up a fresh Supabase project.

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- Documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled',
  content jsonb,
  owner_id uuid not null references auth.users (id) on delete cascade,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_owner_id_idx on public.documents (owner_id);
create index if not exists documents_updated_at_idx on public.documents (updated_at desc);

-- Document collaborators (sharing)
create table if not exists public.document_collaborators (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (document_id, email)
);

create index if not exists document_collaborators_document_id_idx
  on public.document_collaborators (document_id);
create index if not exists document_collaborators_user_id_idx
  on public.document_collaborators (user_id);

-- Comments
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text not null,
  content text not null,
  highlighted_text text,
  block_id text,
  is_resolved boolean not null default false,
  parent_id uuid references public.comments (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists comments_document_id_idx on public.comments (document_id);

-- Proposed changes (AI/human edit proposals)
create table if not exists public.proposed_changes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid references public.comments (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  node_index integer not null default 0,
  original_text text not null,
  proposed_text text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists proposed_changes_document_id_idx
  on public.proposed_changes (document_id);

-- Document versions (snapshots)
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  content jsonb not null,
  title text,
  label text,
  message text,
  is_auto boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists document_versions_document_id_idx
  on public.document_versions (document_id);

-- AI chat sessions
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_document_user_idx
  on public.chat_sessions (document_id, user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS (basic owner + collaborator access)
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_collaborators enable row level security;
alter table public.comments enable row level security;
alter table public.proposed_changes enable row level security;
alter table public.document_versions enable row level security;
alter table public.chat_sessions enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "documents_select" on public.documents for select using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.document_collaborators c
    where c.document_id = documents.id and c.user_id = auth.uid()
  )
);

create policy "documents_insert" on public.documents for insert with check (owner_id = auth.uid());
create policy "documents_update" on public.documents for update using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.document_collaborators c
    where c.document_id = documents.id and c.user_id = auth.uid() and c.role = 'editor'
  )
);
create policy "documents_delete" on public.documents for delete using (owner_id = auth.uid());

create policy "collaborators_select" on public.document_collaborators for select using (
  exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid())
  or user_id = auth.uid()
);
create policy "collaborators_insert" on public.document_collaborators for insert with check (
  exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid())
);
create policy "collaborators_update" on public.document_collaborators for update using (
  exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid())
);
create policy "collaborators_delete" on public.document_collaborators for delete using (
  exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid())
);

create policy "comments_all" on public.comments for all using (
  exists (
    select 1 from public.documents d
    where d.id = document_id
    and (
      d.owner_id = auth.uid()
      or exists (select 1 from public.document_collaborators c where c.document_id = d.id and c.user_id = auth.uid())
    )
  )
);

create policy "proposed_changes_all" on public.proposed_changes for all using (
  exists (
    select 1 from public.documents d
    where d.id = document_id
    and (
      d.owner_id = auth.uid()
      or exists (select 1 from public.document_collaborators c where c.document_id = d.id and c.user_id = auth.uid())
    )
  )
);

create policy "versions_select" on public.document_versions for select using (
  exists (
    select 1 from public.documents d
    where d.id = document_id
    and (
      d.owner_id = auth.uid()
      or exists (select 1 from public.document_collaborators c where c.document_id = d.id and c.user_id = auth.uid())
    )
  )
);
create policy "versions_insert" on public.document_versions for insert with check (
  exists (
    select 1 from public.documents d
    where d.id = document_id
    and (
      d.owner_id = auth.uid()
      or exists (select 1 from public.document_collaborators c where c.document_id = d.id and c.user_id = auth.uid() and c.role = 'editor')
    )
  )
);

create policy "chat_sessions_all" on public.chat_sessions for all using (
  user_id = auth.uid()
  and exists (
    select 1 from public.documents d
    where d.id = document_id
    and (
      d.owner_id = auth.uid()
      or exists (select 1 from public.document_collaborators c where c.document_id = d.id and c.user_id = auth.uid())
    )
  )
);
