---
name: Cursor Build workflow
status: approved
updated: 2026-06-23
depends-on:
  - complete-frontend-rebuild.md
---

# Cursor Build workflow — phase-select execution

How to start **one phase** of the [complete frontend rebuild](complete-frontend-rebuild.md) from Cursor without running the entire roadmap in one session.

**Master Cursor plan (local):** `~/.cursor/plans/complete_frontend_rebuild_400e63d4.plan.md`  
**Per-phase plans (local):** `~/.cursor/plans/f0-foundation.plan.md`, `f1-theme.plan.md`, … `f8-hardening.plan.md`

Cursor does **not** show a native "pick a phase" dialog on **Build**. Use one of the workflows below.

---

## Option A — Select todos, then Build in New Agent (recommended)

1. Open the master or per-phase plan in **rich preview** (not raw markdown). Toggle with `Ctrl+Shift+V` if needed.
2. In the todo checklist, **check only** the todo(s) for the phase you want.
3. Click **Build in New Agent** (not plain **Build**).

| Phase  | Master plan todos to select               |
| ------ | ----------------------------------------- |
| **F0** | `f0-stack-foundation`, `f0-perf-baseline` |
| **F1** | `f1-theme`                                |
| **F2** | `f2-shells`                               |
| **F3** | `f3-public-auth`                          |
| **F4** | `f4-learner`                              |
| **F5** | `f5-studio-mod` (done)                    |
| **F6** | `f6-admin` (done)                         |
| **F7** | `f7-platform` (done)                      |
| **F8** | `f8-hardening` (done)                     |

Plain **Build** (no selection) loads the **full remaining plan** in the same chat — avoid unless you want one long session.

---

## Option B — Per-phase plan file (one-click scope)

Open a single-phase plan and click **Build**:

| File                     | Phase                               |
| ------------------------ | ----------------------------------- |
| `f0-foundation.plan.md`  | F0 — Foundation                     |
| `f1-theme.plan.md`       | F1 — Theme engine                   |
| `f2-shells.plan.md`      | F2 — Shells                         |
| `f3-public-auth.plan.md` | F3 — Public + auth                  |
| `f4-learner.plan.md`     | F4 — Learner                        |
| `f5-studio-mod.plan.md`  | F5 — Studio + moderation (**done**) |
| `f6-admin.plan.md`       | F6 — Tenant admin (**done**)        |
| `f7-platform.plan.md`    | F7 — Platform (**done**)            |
| `f8-hardening.plan.md`   | F8 — Hardening (**done**)           |

Each file links to the matching section in [complete-frontend-rebuild.md](complete-frontend-rebuild.md).

---

## Option C — New chat without Build

Attach:

- `@complete_frontend_rebuild_400e63d4.plan.md` (or a per-phase plan)
- `@plan/frontend-planning/complete-frontend-rebuild.md`
- `@plan/frontend-planning/tech-stack.md` (F0+)

Example: _"Implement Phase F0 only. Do not start F1+."_

---

## Execution order

`F-1` (done) → `F0` (done) → `F1` (done) → `F2` (done) → `F3` (done) → **F4 (done)** → **F5 (done)** → **F6 (done)** → **F7 (done)** → **F8 (done)** → **Post-F8** ([Zod 4 migration](zod-4-migration.md))

F4 remaining inventory-depth items are tracked in [complete-frontend-rebuild.md §10.1](complete-frontend-rebuild.md#101-phase-f4--completion--remaining-backlog) — optional polish, not blocking F6.

**Canonical checklists:** [complete-frontend-rebuild.md](complete-frontend-rebuild.md) §6–§14 (F0–F8); §15 + [zod-4-migration.md](zod-4-migration.md) (post-F8).
