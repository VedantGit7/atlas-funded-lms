---
name: Monorepo Split and API Extraction
status: draft
updated: 2026-06-23
depends-on: []
blocks:
  - ../frontend-planning/complete-frontend-rebuild.md
---

# Monorepo split: `backend/` extraction (Phase F-1)

**Prerequisite** for the [complete frontend rebuild](../frontend-planning/complete-frontend-rebuild.md).  
**Duration:** ~2 weeks

## Goal

Extract all server-side code from the current single Next.js app (`apps/web`) into `backend/`, leaving `frontend/` as a UI-only app that talks to the API over HTTP.

## Target layout

```text
atlas-funded-lms/
├── frontend/
│   ├── apps/web/              # @atlas/web — UI only
│   └── packages/design-system/
├── backend/
│   ├── apps/api/              # @atlas/api-app — Next.js API-only
│   ├── packages/              # all @atlas/* except design-system
│   └── prisma/
├── plan/                      # planning docs (this folder)
├── docs/
├── scripts/
└── tests/
```

## What moves to `backend/`

| Source (today) | Destination |
|----------------|-------------|
| `apps/web/src/app/api/v1/**` | `backend/apps/api/src/app/api/v1/**` |
| `apps/web/src/server/**` | `backend/apps/api/src/server/**` |
| `packages/*` (except design-system) | `backend/packages/*` |
| `prisma/`, `prisma.config.ts` | `backend/prisma/`, `backend/prisma.config.ts` |

## New backend work

### 1. `@atlas/contracts` package

Thin shared package (can live at `backend/packages/contracts` or root `shared/packages/contracts`):

- Zod schemas + TypeScript types for API request/response bodies
- **No Prisma, no DB imports**
- Consumed by frontend for forms and by backend for validation

### 2. `GET /api/v1/public/bootstrap`

New public endpoint returning safe tenant projection for frontend RSC:

- `displayName`, logo URL, favicon
- Published theme tokens + `modeDefault`
- Tenant state (`ACTIVE`, `SUSPENDED`, etc.)

Replaces in-process calls to `tenant-state-gate`, `public-tenant-branding`, `tenant-theme-vars` in the frontend app.

### 3. Auth orchestrators

Move from `apps/web/src/lib/server/public-auth-orchestrator.ts` to `backend/apps/api/src/server/`. Frontend server actions become thin HTTP callers.

## Cross-app networking

| Environment | Frontend | Backend |
|-------------|----------|---------|
| Local dev | `:3000` | `:3001` |
| Wiring | `next.config.ts` rewrites `/api/v1/*` → backend | Standalone API app |

**Env vars**

- Backend: `DATABASE_URL`, Supabase secrets, all sensitive keys
- Frontend: `NEXT_PUBLIC_API_URL`, `API_INTERNAL_URL` (no `DATABASE_URL`)

**Cookies:** prefer same-origin rewrites in dev/prod so session cookies work without cross-domain config.

## Workspace updates

`pnpm-workspace.yaml`:

```yaml
packages:
  - "frontend/apps/*"
  - "frontend/packages/*"
  - "backend/apps/*"
  - "backend/packages/*"
  - "backend/packages/domain/*"
  - "backend/packages/tenant-config"
  - "backend/packages/release-readiness"
```

Root scripts:

```json
"dev": "concurrently \"pnpm --filter @atlas/api-app dev\" \"pnpm --filter @atlas/web dev\"",
"dev:frontend": "pnpm --filter @atlas/web dev",
"dev:backend": "pnpm --filter @atlas/api-app dev"
```

## Guardrails

- ESLint: `frontend/**` cannot import `backend/**` or `@atlas/db`
- Update `check-prisma-boundary`, `check-route-metadata` for new paths
- E2E + `tests/api/*` target backend URL

## Sequencing

1. Create `backend/` folder; move packages + prisma
2. Scaffold `backend/apps/api`; move API routes + server services
3. Slim `frontend/apps/web` to UI-only
4. Add `@atlas/contracts`; fix imports both sides
5. Add `public/bootstrap`; refactor auth actions to HTTP
6. Update CI, README, tests

## Exit criteria

- [ ] `backend/apps/api` serves all existing `/api/v1` routes with identical contracts
- [ ] `frontend/apps/web` builds with zero Prisma / DB package imports
- [ ] `pnpm dev` runs both apps; cookie auth works end-to-end
- [ ] All API and E2E tests pass against two-app layout

## Related: future backend changes

After the frontend ships, you may keep or replace the backend. The split + `@atlas/contracts` keeps the UI on **HTTP `/api/v1` only**. See [future-backend-flexibility.md](future-backend-flexibility.md).

## Todos

- [ ] Move `packages/` (except design-system) and `prisma/` → `backend/`
- [ ] Extract `backend/apps/api` from current `apps/web`
- [ ] Create `@atlas/contracts` package
- [ ] Implement `GET /api/v1/public/bootstrap`
- [ ] Refactor auth orchestrators to backend; frontend actions → HTTP
- [ ] Update pnpm workspace, tsconfig, CI guards, tests
