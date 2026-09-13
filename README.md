# Strux

**Design specs for software engineers** — write collaboratively, review with AI, branch like Git, and ship to Cursor or Claude for implementation.

Strux is a version-controlled collaborative document editor built for the design-doc workflow that engineering teams use before writing code. Draft a spec, get feedback, iterate on branches, merge into main, then export directly into your AI coding tools.

## Features

- **Rich design-doc editor** — headings, lists, checklists, tables, code blocks, images, slash commands
- **Real-time collaboration** — multi-user editing with live cursors (Yjs CRDT + Supabase)
- **Review workflow** — anchored comments, AI-suggested rewrites, proposed changes
- **Git-style branches** — spin off a branch from review feedback, diff against trunk, merge into main
- **AI assistant** — sidebar chat with document context for brainstorming and refinement
- **Version history** — auto snapshots and named checkpoints with diff view
- **Ship to IDE** — export as:
  - Cursor Rule (`.mdc`)
  - `AGENTS.md` (Claude Code)
  - `CLAUDE.md` (Claude project instructions)
  - AI prompt (clipboard)
  - Markdown or print-to-PDF
- **Open questions in exports** — unresolved review comments are appended automatically
- **Project organization** — group documents by project in the dashboard
- **Sharing** — invite collaborators as editor or viewer

## Demo flow

1. **Create** a design spec and assign it to a project
2. **Write** requirements, API contracts, acceptance criteria
3. **Review** — leave comments, ask AI for rewrites, create branches
4. **Merge** branch changes back into the main document
5. **Ship to IDE** — export to Cursor or Claude and start implementing

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router), React 18, TypeScript |
| Editor | TipTap 3 + Yjs CRDT |
| Backend | Supabase (Postgres, Auth, Realtime, Storage) |
| AI | OpenAI GPT-4o-mini |
| UI | Tailwind CSS, shadcn/ui |

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_key
```

### Database

Apply migrations in `supabase/migrations/` in order via the Supabase SQL editor or CLI:

1. `20260420120000_base_schema.sql` — tables, RLS, profiles
2. `20260423180000_yjs_state.sql` — Yjs CRDT persistence
3. `20260514120000_dashboard_projects_branches.sql` — projects, branches
4. `20260515130000_comments_block_id_resolved.sql` — comment anchors
5. `20260516120000_soft_delete.sql` — trash / restore

Create a Supabase Storage bucket named `document-images` (public) for image uploads.

### Quick verify

After migrations and `.env.local`, run:

```bash
npm run dev
npm test
```

Sign up, create a **Design doc** template, invite a collaborator, export to Cursor, and merge a branch — that is the full demo path.

## Project structure

```
app/
  dashboard/          Command center (projects, recent, starred, shared)
  doc/[id]/           Collaborative editor
  login/              Auth
  api/ai/             AI chat + suggest routes
  api/upload/         Image upload

components/
  dashboard/          Shell, tables, project sections, create dialog
  editor/             DocumentEditor, review sidebar, export modal
  auth/               Sign in / sign up

lib/
  export.ts           JSON → markdown, IDE export formats
  merge.ts            Branch → parent merge
  realtime.ts         Yjs snapshot persistence
  dashboard-queries.ts
  branches.ts
  versions.ts
  comments.ts
```

## Architecture

```
Write (TipTap + Yjs) → Review (comments, AI, branches) → Merge → Ship to IDE (Cursor/Claude)
```

Documents are stored as TipTap JSON in Postgres with a parallel Yjs binary state for real-time sync. Exports convert the JSON spec to markdown and wrap it in IDE-specific formats.

## License

Private — portfolio project.
