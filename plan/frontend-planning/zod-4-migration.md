---
name: Zod 4 Migration
status: done
updated: 2026-08-13
depends-on:
  - complete-frontend-rebuild.md
---

# Post-F8 — Zod 4 monorepo migration

> **When:** After [Phase F8](complete-frontend-rebuild.md#14-phase-f8--hardening-2-weeks) completes.  
> **Completed:** 2026-08-13 — monorepo on Zod `^4.4.3`.  
> **Tech stack target:** [tech-stack.md](tech-stack.md) — Zod `^4.4.3`.

---

## 1. Why post-F8

- Avoids migration churn while shells, routes, and forms are still being rebuilt (F1–F8).
- `@atlas/contracts` and backend already share Zod 3 today — no dual-major-version risk during rebuild.
- One atomic cut when the frontend codebase is stable (~4–6 hours focused work).

---

## 2. Scope

| Area                                                   | Approx. size                                             |
| ------------------------------------------------------ | -------------------------------------------------------- |
| Workspace packages on `zod`                            | **18** (root, contracts, web, api-app, backend packages) |
| Files importing `zod`                                  | **~200**                                                 |
| `z.string().uuid()` / `.email()` / `.url()` call sites | **~400+** (Zod 4 API change)                             |
| `.strict()` usage                                      | **~150+**                                                |

**Rule:** bump all packages in one PR; migrate `@atlas/contracts` and backend schema sources together; run `pnpm sync:contracts`.

---

## 3. Checklist

- [x] Bump `zod` to `^4.4.3` in all workspace `package.json` files; `pnpm install`
- [x] Run Zod 4 codemod / mechanical API updates (`z.uuid()`, `z.email()`, object strictness, etc.)
- [x] Migrate `frontend/packages/contracts/src/**` schema files
- [x] Migrate backend schema sources (`backend/packages/**`, `backend/apps/api/src/server/**`)
- [ ] Run `pnpm sync:contracts` and reconcile any drift
- [x] Simplify `frontend/apps/web/src/lib/forms/use-zod-form.ts` (remove Zod 3 compat casts)
- [ ] Verify: `pnpm typecheck`, `pnpm test:unit`, API tests, `pnpm ci:zod-boundaries`, `pnpm --filter @atlas/web build`, `pnpm --filter @atlas/api-app build`

---

## 4. During F0–F8 (until this phase)

- New validation schemas → `@atlas/contracts` only (Zod 3).
- No frontend-only Zod 4 installs.
- RHF + `@hookform/resolvers` work on Zod 3 today.

---

## 5. Exit criteria

- [x] Single `zod` major version (`^4.4.3`) across the monorepo
- [ ] `typecheck` and full test suite green
- [ ] Both `@atlas/web` and `@atlas/api-app` production builds pass
- [x] [tech-stack.md](tech-stack.md) and [complete-frontend-rebuild.md §15](complete-frontend-rebuild.md#15-post-f8--zod-4-migration-monorepo) marked done

---

## 6. Estimate

| Phase                   | Time                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| Package bump + codemod  | 1–2 hours                                                                 |
| TypeScript / test fixes | 1–2 hours                                                                 |
| Full CI verification    | 1–2 hours                                                                 |
| **Typical total**       | **~4–6 hours** (up to ~1 day if API tests surface validation regressions) |

---

## 7. Reference

- Master plan: [complete-frontend-rebuild.md §15](complete-frontend-rebuild.md#15-post-f8--zod-4-migration-monorepo)
- Contract sync: `pnpm sync:contracts` (`scripts/sync-contracts.mjs`)
- Zod boundary CI: `pnpm ci:zod-boundaries`
