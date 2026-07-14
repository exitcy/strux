# Strux

Version-controlled collaborative document editor (Next.js, Supabase, TipTap, Yjs).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Set in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (for AI sidebar routes)

## Database

Apply migrations in `supabase/migrations/` via the Supabase SQL editor or CLI. The dashboard command center expects these columns on `documents`:

- `parent_id` — branch documents point to a trunk doc
- `project_name` — groups docs in the dashboard (default `General`)
- `starred`, `doc_status`, `last_merged_at`

If columns are missing, the app falls back to legacy selects (no branch counts or project grouping metadata).

## Project structure

- `app/dashboard/` — project-centric command center (Shadcn sidebar + data tables)
- `app/doc/[id]/` — collaborative editor
- `components/dashboard/` — dashboard shell, tables, project sections
- `lib/dashboard-queries.ts` — Supabase fetch helpers for the command center
- `lib/yjs-supabase-provider.ts` — realtime CRDT sync
