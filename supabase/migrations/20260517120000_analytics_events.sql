create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_name_idx
  on public.analytics_events (event_name, created_at desc);

create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_insert_authenticated" on public.analytics_events;
create policy "analytics_events_insert_authenticated"
  on public.analytics_events
  for insert
  to authenticated
  with check (true);

drop policy if exists "analytics_events_select_own" on public.analytics_events;
create policy "analytics_events_select_own"
  on public.analytics_events
  for select
  to authenticated
  using (user_id = auth.uid());
