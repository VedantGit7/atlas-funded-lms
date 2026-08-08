# Atlas LMS — Planning

All implementation plans for this repository live **here**, not in Cursor-only plan storage.

## Folder structure

```text
plan/
├── README.md                 # this file
├── frontend-planning/        # UI, design system, shells, learner/studio/admin screens
└── backend-planning/         # API app, packages, Prisma, workers, infra
```

## Conventions

1. **One plan per file** — use kebab-case filenames (e.g. `complete-frontend-rebuild.md`).
2. **Frontend work** → `plan/frontend-planning/`
3. **Backend work** → `plan/backend-planning/`
4. **Cross-cutting plans** (e.g. monorepo split) — split into companion docs in both folders, with cross-links at the top of each file.
5. **Status header** — each plan starts with YAML frontmatter: `name`, `status` (`draft` | `approved` | `in-progress` | `done`), `updated`, optional `depends-on` links.
6. **Locked PRD** remains source of truth in `docs/locked/`; plans are execution roadmaps only.

## Active plans

| Plan | Folder | Status |
|------|--------|--------|
| [Complete frontend plan](frontend-planning/complete-frontend-rebuild.md) | frontend-planning | draft |
| [Frontend tech stack](frontend-planning/tech-stack.md) | frontend-planning | draft |
| [Frontend performance strategy](frontend-planning/performance.md) | frontend-planning | draft |
| [Local dev URLs & multi-tenant hosts](frontend-planning/local-dev-urls.md) | frontend-planning | draft |
| [Cursor Build workflow](frontend-planning/cursor-build-workflow.md) | frontend-planning | approved |
| [Monorepo split & API extraction](backend-planning/monorepo-split-and-api-extraction.md) | backend-planning | draft |
| [Future backend flexibility](backend-planning/future-backend-flexibility.md) | backend-planning | draft |
| [Open signup, freemium courses & payments](backend-planning/open-signup-freemium-and-payments.md) | backend-planning | draft |
| [Zod 4 migration (post-F8)](frontend-planning/zod-4-migration.md) | frontend-planning | draft |

## Sprint order (current roadmap)

1. **Backend F-1** — [monorepo split](backend-planning/monorepo-split-and-api-extraction.md) — **done**
2. **Frontend F0–F8** — [complete frontend rebuild](frontend-planning/complete-frontend-rebuild.md) — **F0–F8 done**
3. **Post-F8** — [Zod 4 monorepo migration](frontend-planning/zod-4-migration.md) ([§15](frontend-planning/complete-frontend-rebuild.md#15-post-f8--zod-4-migration-monorepo) of master plan) — **next**
4. **Post-frontend (optional)** — [future backend flexibility](backend-planning/future-backend-flexibility.md) — keep, refactor, or replace backend without rewriting UI

### Frontend phase status

| Phase | Status |
|-------|--------|
| F-1 | done |
| F0 | done |
| F1 | done |
| F2 | done |
| F3 | done |
| **F4** | **done** — [remaining backlog](frontend-planning/complete-frontend-rebuild.md#101-phase-f4--completion--remaining-backlog) |
| **F5** | **done** — [§11 F5 complete](frontend-planning/complete-frontend-rebuild.md#11-phase-f5--studio--moderation--review-2-weeks) |
| **F6** | **done** — [§12.1 backlog](frontend-planning/complete-frontend-rebuild.md#121-phase-f6--backlog) |
| **F7** | **done** — [§13 complete](frontend-planning/complete-frontend-rebuild.md#13-phase-f7--platform-p1p8-1-week) |
| F8 | **done** — [§14 complete](frontend-planning/complete-frontend-rebuild.md#14-phase-f8--hardening-2-weeks) |
| Post-F8 | pending — **next** |
