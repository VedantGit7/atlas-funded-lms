# ATLAS LMS — USER FLOWS & JOURNEY MAPS v1
## Phase 0 + Phase 1A + Phase 1B — The Authoritative Traversal Map

**Role:** Principal Product Architect · Principal UX Architect · Principal SaaS Architect · Principal LMS Architect · Principal Security Architect · CTO
**Status:** Implementation-ready journey architecture — built entirely on approved artifacts; no redesign.
**Scope:** Phase 0 + Phase 1A + Phase 1B only. **No Phase 2/3/4 journeys.**

> **Reading contract.** This document sits **entirely on top of** the approved artifacts and adds nothing they do not already support: Atlas LMS Master PRD v3.0, FundedBeyond Academy Master PRD v1.0, Architecture Review Report, Atlas–FundedBeyond Dependency Analysis & Corrected Roadmap, **Atlas LMS Database Design v2 (Phase 0+1)**, **Atlas Permission Matrix v1**, **Atlas API Inventory v1**, and **Atlas LMS Screen Inventory v1**. Every step below names only screens from the Screen Inventory (`A*/L*/I*/M*/T*/S1/P*`), only routes/APIs from the API Inventory (`/api/v1/**`), only permissions from the Permission Matrix §4/§5, only entitlement keys from Matrix §9, and only entity states (enums) from Database Design v2 §ENUMS. **If a journey would require a screen, route, permission, entitlement, role, engine, or table those documents do not define, it is rejected** — rejections are enumerated in §14.1 and inline. This is not a wireframe, visual-design, or user-story document. It is the complete actor-by-actor traversal map that wireframing depends on.

> **What this document deliberately does NOT do** (per the binding rules): it creates no new screens, no new APIs, no new permissions, no new workflows, no new roles, no new engines, and no new database entities; it defines no Phase 2/3/4 functionality. Where a tempting journey would require any of those, it is **rejected with reason** rather than invented.

> **Notation used throughout.**
> `→` = navigation/transition · `⇒` = server emits event/state change · `can(p)` = `can(actor, permission, resourceRef, ctx)` per Matrix §2.1 step 7 · `ENT[key]` = `enforceEntitlement` gate · **bold CAPS** = entity state enum from DB v2. Each journey carries: **Entry · Screen sequence · Route sequence · API sequence · Permission checks · State transitions · Failure paths · Success outcome.**

---

# SECTION 1 — FLOW DESIGN PRINCIPLES

Every journey in this document is a traversal of the one authorization pipeline defined in Permission Matrix §2.1. No flow may shortcut it; no flow may add a stage to it. The seven principles below are the load-bearing rules every later journey instantiates.

## 1.1 Host-based tenant resolution (the journey always starts at the host)

Before any screen renders or any API authorizes, the request resolves a tenant from its **host** (`tenant_domains → tenants`), and **host wins over the JWT tenant claim** (Matrix §2.1, API §1.11). The journey consequence: a principal authenticated in Tenant A who lands on Tenant B's host is a *Tenant B visitor*, not a Tenant B member. There is no "switch tenant" action inside a session; changing tenant means changing host. Every flow in this document is implicitly prefixed by `Host Resolution → Tenant State Gate`, and a non-`ACTIVE` tenant short-circuits to the branded **A10 Tenant Unavailable / Suspended Notice** (`503`/`404`) before the actor-specific journey begins.

## 1.2 Membership gate behavior (the load-bearing gate)

After authentication, every protected journey passes the **membership gate** (Matrix §2.1 step 4, §8): the `memberships` row for `(resolved tenant, principal)` must be **ACTIVE**. The gate is re-evaluated per request — stale tokens are never trusted. Journey-level behavior by `MembershipStatus`:

- **ACTIVE** → proceed to entitlement + permission checks (the happy path of every authenticated journey).
- **INVITED** → blocked from all protected routes; the *only* reachable surface is **A9 Invitation Acceptance**. (`403 MEMBERSHIP_PENDING`.)
- **SUSPENDED** → blocked from all protected routes; may see a suspended notice and public routes only. (`403 MEMBERSHIP_SUSPENDED`.)
- **REMOVED** → treated as no membership; re-invite required to return. (`403 MEMBERSHIP_REMOVED`.)
- **No row** → stranger to this tenant; public routes only. (`403 NO_MEMBERSHIP`.)

Only the §8.4 public allow-list (landing, public diagnostic, certificate verification, login/signup/invite-accept) runs without an ACTIVE membership.

## 1.3 Entitlement enforcement (about the tenant, not the actor)

Entitlement is a **tenant-plan** gate enforced at the single chokepoint `enforceEntitlement(tenantId, key, ctx)` against `entitlements` rows — **plan names are never checked** (Matrix §9). It runs at pipeline **step 6, before permission (step 7)**. Journey consequence: a capability the tenant's plan lacks returns `403 ENTITLEMENT_REQUIRED` *before* the actor's permission is even consulted — so an `owner` sees the same upgrade-prompt path as a `learner` for a disabled feature. The journeys that ride entitlement keys: community (`community.enable`, `community.private_spaces.enable`), certificates (`certification.enable`), gamification (`gamification.enable`), advanced analytics (`analytics.dashboard.view`), custom domain (`branding.custom_domain.enable`), data export (`data.export.enable`, always-on by policy). When a key is absent, the screen is hidden from nav and the route 403s — existing data is preserved read-only for admins/export, never deleted.

## 1.4 The `can()` authorization model (one decision, all predicates inside)

Authorization is a single call `can(actor, permission, resourceRef, tenantContext)` at pipeline step 7. **Ownership and relationship predicates are resolved inside `can()`** (Matrix §1.4/§1.5, §6/§7), never as a layered afterthought, so it is structurally impossible to authorize an owned/related action without passing its predicate. Journey consequence: the same screen (e.g., **I3 Course Builder**) serves an instructor (ownership-bound to `courses.created_by_membership_id`) and an admin (`bypass(admin)` within-tenant, audited on sensitive targets) — the *journey* is identical; the *result set and write authority* differ inside `can()`. The actor is always a **membership**, never the global principal.

## 1.5 Workflow approval gates (the human gate)

Publish and issuance are not plain writes. `course.publish`, `learning_path.publish`, `assessment.publish`, `certificate.issue`, plus trading-plan submissions and moderation escalations route through the **human gate**: `POST /workflows/:id/transition` guarded by `workflow.transition.act`, surfaced on **S1 Review & Approvals** (Screen Inventory §1.6). Journey consequence: an instructor's "Publish" does not flip content to **PUBLISHED**; it advances the artifact to **REVIEW** and creates a `workflow_transition` for an approver to **act** on. Where a tenant configures no review for a target type, the gate is a pass-through, but the transition is still recorded. Admin/owner self-approve within tenant; moderators act only on moderation workflows; instructors act relationship-scoped.

## 1.6 Anonymous vs authenticated paths (the public allow-list is the only door)

Anonymous journeys are bounded to the §8.4 allow-list and the `/api/v1/public/**` surface (API §4): **A1** landing, **A2/A3/A4** public diagnostic + identity gate + anonymous scorecard, **A5** certificate verification, **A6/A7/A8** login/signup/reset, **A9** invitation acceptance. Public routes still resolve `app.tenant_id` from host and run under tenant RLS; none ever uses tenant-admin privilege. The single anonymous→authenticated bridge is the **diagnostic identity gate (A3)** + `POST /public/diagnostic/:anonId/merge`, and the **signup/invite-accept** path that mints an ACTIVE membership. Every other journey requires an account; "public community browsing" is **rejected** (no public community route exists — Screen Inventory §9).

## 1.7 Platform vs tenant boundaries (two physically isolated planes)

Platform journeys (`/platform/*`, P1–P8) run on a **separate shell, a separate DB role (`atlas_platform`), and a separate client (`platformPrisma`)**, and are unreachable from any tenant session (Matrix §1.8, §10). The platform pipeline replaces tenant steps 3–8 with `withPlatformScope(ctx, reason, fn)`: every platform action requires a **reason ≥ 10 chars**, writes `platform.scope.enter` before and `platform.scope.exit` after, and records every tenant touched. Journey consequence: there is no "elevate to admin" link inside a tenant; platform reach is a deliberate, reason-bound, time-boxed, fully-audited crossing — and tenant data is reached only through the scoped `atlas_platform` RLS policy, never by disabling RLS. This boundary is a structural security guarantee, not a UX preference, and no journey in this document crosses it implicitly.

## 1.8 The canonical request spine (every protected journey instantiates this)

```
[1] Host Resolution        host → tenant            (tenant_domains → tenants; host wins over JWT)
[2] Tenant State Gate      tenant must be ACTIVE    (PROVISIONING/SUSPENDED/ARCHIVED/DELETED → A10 / 503 / 404)
[3] Authentication         JWT → auth_principal     (Supabase Auth; else 401 AUTH_REQUIRED)
[4] Membership Gate        (tenant, principal) → ACTIVE   ← LOAD-BEARING (else 403 NO_MEMBERSHIP / PENDING / SUSPENDED / REMOVED)
[5] Tx Context             withTenantTx: set app.tenant_id (tx-local) + actor + request_id
[6] Entitlement Check      enforceEntitlement(tenantId, key)   (else 403 ENTITLEMENT_REQUIRED)
[7] Permission Check       can(actor, permission, resourceRef, ctx)   (else 403 PERMISSION_DENIED)
[8] Ownership/Relationship resolved INSIDE can()   (else 403 OWNERSHIP_DENIED / RELATIONSHIP_DENIED)
[9] Resource Access        Prisma/SQL inside tenant tx; RLS re-checks tenant_id (backstop)
```

Platform variant of [3]–[8]: `authenticate → assert platform.* → withPlatformScope(reason≥10) → set app.platform_scope + app.tenant_id when touching a tenant → scoped RLS`.

---

# SECTION 2 — ACTOR JOURNEY INVENTORY

Six actor planes (Permission Matrix §3, Screen Inventory §0). The five tenant roles are seeded per tenant; the three platform roles never appear in tenant RBAC and live only behind `withPlatformScope()`. A user may hold multiple tenant roles (union of permissions); nav *visibility* is permission-driven, access is `can()`-enforced server-side.

## 2.1 Anonymous Visitor

| Dimension | Detail |
|---|---|
| **Source role** | none (host-resolved tenant, no membership) |
| **Shell / prefix** | Public site shell · `/`, `/public/*` (API) |
| **Goals** | Understand the academy; take the free diagnostic; verify a credential; create/recover an account; accept an invite. |
| **Entry points** | A1 landing (`/`, `/p/:slug`); deep links to A2 `/diagnostic`, A5 `/verify/:credentialId`, A6 `/login`, A7 `/signup`, A9 `/invite/accept`. |
| **Available routes** | A1, A2, A3 (modal), A4, A5, A6, A7, A8, A9 — the §8.4 public allow-list only. |
| **Restricted routes** | Every PROT/ENT/PLAT route → `403 NO_MEMBERSHIP` (or `401` if unauthenticated and auth is attempted). No public community, no public catalog. |
| **Exit conditions** | (a) Converts via A3/A7 → ACTIVE membership → Learner journey; (b) accepts invite A9 → ACTIVE; (c) bounces; (d) tenant non-ACTIVE → A10. |

## 2.2 Learner (`learner` — default new-member role)

| Dimension | Detail |
|---|---|
| **Shell / prefix** | Learner app shell · `/` (authenticated) |
| **Goals** | Find readiness; consume courses/lessons; practice (swipe); take assessments/diagnostics; track competency & progress; earn certs/badges; participate in community; manage profile/settings; act on the readiness CTA. |
| **Entry points** | A6 login → route resolution → L1 Trader Dashboard; deep links to any L* route (membership-gated). |
| **Available routes** | L1–L25 (ownership-scoped writes; ENT-gated: L14 certs, L15/L16 gamification, L17–L20 community, L13 history). Reuses community/search surfaces. |
| **Restricted routes** | All `/studio/*`, `/moderate/*`, `/admin/*`, `/platform/*` → `403 PERMISSION_DENIED`. Others' resources → `403 OWNERSHIP_DENIED`. ENT-off features → `403 ENTITLEMENT_REQUIRED` + hidden nav. |
| **Exit conditions** | Logout (A6/L25); session revoked; membership SUSPENDED/REMOVED → blocked; account-deletion request filed (L25 → T24). |

## 2.3 Instructor (`instructor`; all writes ownership/relationship-scoped in `can()`)

| Dimension | Detail |
|---|---|
| **Shell / prefix** | Studio shell · `/studio/*` (+ `/review` relationship-scoped) |
| **Goals** | Author courses/lessons/items/assessments/paths; grade attempts; oversee learners they teach; submit content to review; act on relationship-scoped approvals; view own-content analytics. |
| **Entry points** | Login → I1 Studio Dashboard; deep links to I2–I13, S1. |
| **Available routes** | I1–I13, S1 (relationship-scoped). Reuses community/search as a member. |
| **Restricted routes** | Member/role/branding/config/moderation/platform screens → denied. Resources they neither own nor teach → `403 OWNERSHIP_DENIED`/`RELATIONSHIP_DENIED`. I13 analytics requires `ENT[analytics.dashboard.view]`. |
| **Exit conditions** | Logout; content reaches PUBLISHED via S1; membership state change blocks access. |

## 2.4 Moderator (`moderator`; admin/owner also hold `community.moderate`)

| Dimension | Detail |
|---|---|
| **Shell / prefix** | Moderation shell (subset of admin chrome) · `/moderate/*` (+ `/review` moderation workflows) |
| **Goals** | Resolve flagged/reported content; decide moderation cases; review appeals; manage community spaces; act on moderation review transitions. |
| **Entry points** | Login → M1 Moderation Queue; deep links to M2–M4, S1 (moderation only). |
| **Available routes** | M1–M4, S1 (moderation workflows only) — all gated by `ENT[community.enable]`. Reuses community/search as a member. |
| **Restricted routes** | No content authoring (I*), no member/role/branding/config, no platform. Non-moderation workflow transitions → `403 RELATIONSHIP_DENIED`. |
| **Exit conditions** | Logout; case CLOSED/ACTIONED/REJECTED; appeal decided; membership state change. |

## 2.5 Tenant Admin (`owner` / `admin`; owner-only deltas gated inline)

| Dimension | Detail |
|---|---|
| **Shell / prefix** | Admin console shell · `/admin/*` (+ reuse of Studio I2–I9, Moderation M1–M4, S1 at tenant scope) |
| **Goals** | Stand up and run the tenant: members/roles/overrides; branding/domains; config/flags; read-only entitlements; competency/scoring; certs; gamification; notifications/automation/workflows/locales/extensions; readiness policy; analytics; audit; data export & deletion. |
| **Entry points** | Login (MFA for admin) → T1 Admin Dashboard; deep links to T2–T24, S1. |
| **Available routes** | T1–T24, S1, and bypass(admin) across I2–I9 / M1–M4 within-tenant (audited). |
| **Restricted routes** | All `/platform/*` → unreachable (separate plane). Cannot grant own entitlements (T10 read-only). Owner-only actions denied to `admin` (assign/revoke `admin`, edit `owner` role, full-tenant export/deletion, full audit) → owner-guard/`rank-guard`. |
| **Exit conditions** | Logout; delegates via roles; tenant lifecycle is platform-controlled (admin cannot self-suspend tenant). |

## 2.6 Platform Super Admin (`atlas.super_admin` / `atlas.operations` / `atlas.support`)

| Dimension | Detail |
|---|---|
| **Shell / prefix** | Platform console (physically isolated) · `/platform/*` · `atlas_platform` DB role · MFA · reason-bound + audited |
| **Goals** | Provision/suspend/resume/archive tenants; drive provisioning saga; grant/modify entitlements; manage global catalogs & flags; read cross-tenant audit; open reason-bound support sessions; replay dead-lettered events. |
| **Entry points** | Platform login (separate shell) → P1 Tenant List. Never reachable from a tenant session. |
| **Available routes** | P1–P8 per platform-role matrix (Matrix §5.2): `super_admin` full; `operations` no catalog-manage; `support` read-biased, reason-bound, tenant-scoped audit only. |
| **Restricted routes** | No tenant product screens. `operations`/`support` denied `platform.catalog.manage`; `support` denied destructive/entitlement/catalog actions. Every action requires reason ≥ 10 chars + enter/exit audit. |
| **Exit conditions** | Scope exit (`platform.scope.exit` audit); support session expiry (time-boxed, per-incident); no standing cross-tenant session persists. |

---

# SECTION 3 — PHASE 0 FOUNDATION FLOWS

These are the correctness flows that must work before any product feature. They use only Phase 0 screens (A6–A10, P1–P8, T1–T3) and Phase 0 APIs.

## 3.1 Tenant Provisioning (Platform Super Admin / Operations)

**Actor:** `atlas.super_admin` or `atlas.operations` (platform plane). **Entry:** P1 Tenant List → "Provision".

| Step | Screen | Route | API | Permission / Scope | State transition |
|---|---|---|---|---|---|
| 1 | P1 Tenant List | `/platform` | `GET /platform/tenants` | `platform.tenant.read` + scope+reason | — |
| 2 | P2 Provision Tenant (wizard: slug/owner/plan/seed) | `/platform/tenants/new` | — | `platform.tenant.manage` | — |
| 3 | **Reason modal (≥10 chars)** → submit | `/platform/tenants/new` | `POST /platform/tenants` *(idempotent, `Idempotency-Key`)* | `platform.tenant.manage` + `withPlatformScope` | `tenants.state = ` **PROVISIONING** ⇒ `tenant.created` |
| 4 | P3 Tenant Detail → Provisioning saga tab | `/platform/tenants/:id` | `GET /platform/tenants/:id/provisioning` | `platform.tenant.read` | `provisioning_jobs.status` **QUEUED→RUNNING→SUCCEEDED** |
| 5 | Domain assignment (atlas-subdomain seeded by saga) | `/platform/tenants/:id` | (saga writes `tenant_domains`) | platform | `DomainStatus` **PENDING→ACTIVE** (subdomain) |
| 6 | Entitlements grant tab | `/platform/tenants/:id` | `PUT /platform/tenants/:id/entitlements` | `platform.entitlement.manage` | writes `entitlements` + `entitlement_grant_history` ⇒ `config.entitlement.changed` |
| 7 | Owner invitation (saga seeds owner membership INVITED + invite) | — | seeds `memberships` (INVITED) + invite token | platform → tenant seed | `MembershipStatus` **INVITED** |
| 8 | Tenant Ready | `/platform/tenants/:id` | `GET /platform/tenants/:id` | `platform.tenant.read` | `tenants.state` **PROVISIONING→ACTIVE** ⇒ `tenant.state_changed` |

**Permission checks:** every step asserts a `platform.*` permission, requires reason ≥ 10 chars, writes `platform.scope.enter`/`exit`. **Audit:** Required on create, entitlement grant, state change (every tenant touched recorded).
**Success:** tenant **ACTIVE**, atlas-subdomain **ACTIVE**, entitlements granted, owner **INVITED** with a valid single-use token → hands off to §3.2.
**Failure paths:** saga step fails → `provisioning_jobs.status` **FAILED** (replayable via P8 dead-letter); idempotency-key replay returns the original tenant (`409 IDEMPOTENCY_REPLAY`), never a duplicate; missing reason → request rejected before any write; `operations` attempting `platform.catalog.manage` → `403 PERMISSION_DENIED`.
**Rejected here:** auto-activating a tenant before the saga reports SUCCEEDED (the state gate would expose a half-provisioned tenant); creating a FundedBeyond-specific provisioning path (FB provisions through the *same* generic saga — no fork).

## 3.2 Invitation Acceptance (Invited principal → ACTIVE member)

**Actor:** invited principal (owner from §3.1, or any invitee from T2). **Entry:** invite email → A9 `/invite/accept?token=`.

| Step | Screen | Route | API | Permission | State transition |
|---|---|---|---|---|---|
| 1 | A9 Invitation Acceptance | `/invite/accept?token=` | (token validation) | pub (invite token) | token must be single-use, unexpired |
| 2 | If no account → A7 Signup (or A6 Login if account exists) | `/signup` / `/login` | `POST /public/auth/signup` / `POST /public/auth/login` | pub | creates/links `auth_principals` (global) |
| 3 | Accept CTA | `/invite/accept` | `POST /public/invitations/accept` | pub (invite token) | `MembershipStatus` **INVITED→ACTIVE** ⇒ `membership.status_changed` (audit `identity.membership.*`) |
| 4 | Role assignment (seeded by invite; default `learner` unless invited higher) | — | (membership row carries seeded role) | role seeded by inviter's `role.assign` | `user_roles` row created |
| 5 | First login → route resolution | `/login` → role-home | `POST /public/auth/login`, `GET /auth/session` | membership gate | session resolved; lands on role home (§3.3) |

**Success:** principal holds an **ACTIVE** membership with the invited role; lands on their role home (L1 / I1 / M1 / T1).
**Failure paths:** expired/already-used token → `403`/`409 CONFLICT`, A9 shows "invitation invalid/expired", offers contact-admin (no enumeration of tenant data); tenant non-ACTIVE → A10; invite into a role the inviter could not grant is impossible (no-grant-up enforced at invite time).
**Rejected here:** self-service role elevation during acceptance (role is fixed by the authorized inviter); accepting an invite for a different tenant's host (host-resolution binds the token's tenant).

## 3.3 Authentication Flow (Anonymous → Dashboard)

**Actor:** any returning member. **Entry:** A6 `/login`.

```
Anonymous ─[1]→ A6 Login ─[2]→ Authentication ─[3]→ Membership Validation ─[4]→ Route Resolution ─[5]→ Role Dashboard
```

| Step | Screen / Route | API | Pipeline stage | Result |
|---|---|---|---|---|
| 1 | A6 `/login` (MFA challenge for admins) | `POST /public/auth/login` | [3] Authentication | JWT issued by Supabase Auth |
| 2 | — | `GET /auth/session` | [1][2][3] host + tenant-state + auth | principal resolved for host tenant |
| 3 | — | (membership gate) | [4] Membership Gate | reads `memberships(tenant, principal)` |
| 4 | route resolver | — | role → home route | union of held roles drives landing |
| 5 | L1 / I1 / M1 / T1 (/ P1 on platform shell) | role home APIs | [5]–[9] | dashboard renders |

**Success path:** ACTIVE membership → lands on highest-privilege role home (admin→T1, instructor→I1, moderator→M1, else learner→L1); MFA satisfied for admin.
**Failure path (bad credentials):** `401 AUTH_REQUIRED`, A6 shows error, lockout/backoff per abuse model; A8 password reset reachable.
**Suspended-member path:** auth succeeds but gate returns `403 MEMBERSHIP_SUSPENDED` → A10-style suspended notice; only public routes + logout reachable; no data writes.
**Removed-member path:** `403 MEMBERSHIP_REMOVED` → treated as no membership; prompted that re-invite is required; public routes only.
**No-membership (stranger on this host):** `403 NO_MEMBERSHIP` → public landing A1.
**INVITED-but-not-accepted:** `403 MEMBERSHIP_PENDING` → routed to A9 acceptance.
**Tenant non-ACTIVE:** `503 TENANT_SUSPENDED` (admin login allowed to settle) or `404 TENANT_NOT_FOUND` → A10.

## 3.4 Authorization Flow (the per-request decision every protected journey runs)

```
Request ─→ [4] Membership Gate ─→ [6] Entitlement Check ─→ [7] can() ─→ [8] Ownership/Relationship (inside can) ─→ [9] Resource Loader/RLS ─→ Allowed
                  │                      │                     │                          │                              │
              403 NO_MEMBERSHIP    403 ENTITLEMENT_       403 PERMISSION_          403 OWNERSHIP_ /            RLS-empty / 404 by host
              /PENDING/SUSPENDED   REQUIRED              DENIED                   RELATIONSHIP_DENIED          (never 404-by-id cross-tenant)
              /REMOVED
```

| Stage | Question | Denial reason | Audit |
|---|---|---|---|
| Membership gate | Is the actor an ACTIVE member of *this* tenant? | `NO_MEMBERSHIP` / `MEMBERSHIP_*` | gate denials sampled |
| Entitlement | Is the *tenant's plan* allowed this capability? | `ENTITLEMENT_REQUIRED` (+ missing key) | sensitive denials sampled (plan-drift detection) |
| Permission `can()` | Does the *actor's* role/override grant it? | `PERMISSION_DENIED` | sensitive allows/denies audited |
| Ownership/Relationship | Does the actor own / relate to the resource (or hold admin bypass)? | `OWNERSHIP_DENIED` / `RELATIONSHIP_DENIED` | bypass on sensitive targets audited |
| Resource access / RLS | Does the row exist in this tenant (RLS backstop)? | RLS-empty (no cross-tenant existence leak) | — |

**Allowed outcome:** handler runs inside `withTenantTx`; any state mutation writes its audit row in the **same transaction**.
**Denied outcomes:** consistent machine reasons (Matrix §8.5); cross-tenant access never returns `404`-by-id (no existence leak); entitlement precedes permission so upgrade prompts are consistent.

---

# SECTION 4 — LEARNER JOURNEYS

All learner writes are own-resource only (ownership-gated). Each journey is implicitly prefixed by the §1.8 spine with membership gate = ACTIVE.

## Journey A — Visitor → Diagnostic → Account Creation → Roadmap

**Entry:** A1 landing (anonymous, host-resolved). **Goal:** convert curiosity into an account and a prescribed path.

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | A1 Public Landing | `/`, `/p/:slug` | `GET /public/landing/:slug` | pub | — |
| 2 | A2 Public Diagnostic (runner) | `/diagnostic` | `POST /public/diagnostic/start` | pub `diagnostic.start` variant | `diagnostic_sessions` created (anon) |
| 3 | A3 Identity Gate (modal, at peak curiosity) | modal on `/diagnostic` | `POST /public/auth/signup` then `POST /public/diagnostic/:anonId/merge` | pub → signup | `auth_principals` created; anon session merged |
| 4 | A4 → app: Anonymous/auth scorecard | `/diagnostic/result` → `/` | `GET /public/diagnostic/:anonId/result` | pub (session token) | competency signals emitted ⇒ `competency_scores` |
| 5 | L1 Trader Dashboard | `/` | `GET /me`, `/me/competency`, `/readiness-policy` | `profile.read`, `competency.score.read` (self) | membership ACTIVE (new = `learner`) |
| 6 | L5 Trader Career Roadmap (prescribed) | `/roadmap` | `GET /learning-paths`, `/learning-paths/:id`, `/learning-paths/:id/progress` | `learning_path.read`, `progress.read` (self) | path_steps lock/unlock by band gate |

**Permission checks:** anonymous steps use the §8.4 allow-list only; post-signup steps require ACTIVE membership + self-ownership.
**State transitions:** anon `diagnostic_session` **started** → merged to membership; competency signals ⇒ scores ⇒ composite band; new membership **ACTIVE** with role `learner`.
**Failure paths:** abandons before A3 → anon scorecard partial only (band teased, full gated); signup fails bot/abuse heuristics → A7 error; tenant non-ACTIVE → A10; rate-limit on public diagnostic → `429 RATE_LIMITED`.
**Success:** account created, anonymous diagnostic merged, learner lands on a roadmap with a clear next gate.

## Journey B — Learner → Course Enrollment → Learning → Assessment → Completion

**Entry:** L1 → L2 Catalog (or roadmap). **Goal:** complete a course and pass its assessment.

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | L2 Course Catalog, L21 Resource Library, or L22 Search Results | `/courses`, `/resources`, `/search` | `GET /courses`, `GET /search` | `course.read`, `search.query` | sees **PUBLISHED**/visible content and resource-tagged items only |
| 2 | L3 Course Detail → Enroll | `/courses/:id` | `GET /courses/:id`, `GET /courses/:id/modules`, `POST /enrollments` | `course.read`, `enrollment.create` (self) | `enrollments` created (self) |
| 3 | L4 Lesson Player → mark complete | `/courses/:id/lessons/:lessonId` | `GET /lessons/:id`, `/lessons/:id/assets`, `POST /lessons/:id/progress` | `course.read`, `progress.read` (write own) | `lesson_progress` ⇒ `lesson.completed` |
| 4 | L7 Assessment Overview → start | `/assessments/:id` | `GET /assessments/:id`, `POST /assessments/:id/attempts` | `assessment.read`, `attempt.start` (self) | `AttemptStatus` **STARTED** ⇒ `assessment.started` |
| 5 | L8 Attempt Runner → answer + submit | `/attempts/:id` | `GET /attempts/:id`, `POST /attempts/:id/answers` *(idempotent)*, `POST /attempts/:id/submit` *(idempotent)* | `attempt.submit` (own) | **STARTED→SUBMITTED** ⇒ `assessment.submitted` |
| 6 | L9 Attempt Result / Review | `/attempts/:id/result` | `GET /attempts/:id` | `attempt.read` (own) | auto-graded → **GRADED**; subjective → awaits grading (Journey via I10/I11) |
| 7 | (event-driven) certificate on completion | — | automation → `certificate.issue` (gated) | `certification.enable` + workflow | `certificates.status = issued` ⇒ `certificate.issued` |

**Permission checks:** all self-ownership (`attempts.membership_id`, `lesson_progress.membership_id`); cert issuance routes through workflow + entitlement.
**State transitions:** enrollment active → lesson progress → attempt **STARTED→SUBMITTED→GRADED** → (optional) certificate issued.
**Failure paths:** unpublished/locked course → not visible (RLS/visibility); enroll without entitlement-bound prereq → blocked by gate copy; submit timeout → server-timed auto-submit; abandoned attempt → **ABANDONED**; integrity violation → **VOIDED**; cert blocked if `certification.enable` absent.
**Success:** course progress 100%, assessment **GRADED** as pass, optional certificate issued.

## Journey C — Learner → Swipe Learning → Competency Update → Progress

**Entry:** L1 "recommended swipe" or L10 Practice. **Goal:** daily binary practice that feeds competency.

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | L10 Swipe Learning (deck by weakest dim / SRS due) | `/swipe` | `GET /me/srs/due`, `POST /practice-sessions` | `practice.start` (self) | `practice_sessions` started |
| 2 | Swipe responses (binary, instant feedback) | `/swipe` | `POST /practice-sessions/:id/responses` *(idempotent)* | `practice.start` (self) | `practice_responses` append; `srs_state` updated |
| 3 | Session complete | `/swipe` | `POST /practice-sessions/:id/complete` | `practice.start` (self) | ⇒ `practice.session_completed` → competency signal via outbox |
| 4 | Competency recomputed (engine, not user) | — | (outbox → scoring) | no user write (`competency.signal.read` admin only) | `competency_scores` ⇒ `competency.score_changed`; band ⇒ `readiness.band_changed` |
| 5 | L13 Progress Dashboard (trend) | `/progress` | `GET /me/competency/history`, `/me/gamification` | `competency.score.read` (self), `gamification.profile.read` (self) | history snapshots reflect change |

**Permission checks:** self-ownership on practice; **no `competency.signal.create` exists** — signals are engine-emitted (Matrix §4.8). Streak/XP surfacing requires `ENT[gamification.enable]`.
**State transitions:** practice session → responses → `practice.session_completed` ⇒ competency signal ⇒ score change ⇒ possible band change.
**Failure paths:** write-heavy bucket exhausted → `429`; offline-batched responses re-validated server-side before touching scoring; gamification off → XP widgets hidden but practice still works.
**Success:** competency scores updated from demonstrated practice; progress trend reflects improvement.

## Journey D — Learner → Diagnostic Retake → Readiness Improvement

**Entry:** L1 / L12 → L11. **Goal:** re-take the diagnostic to refresh the starting band and prescribed path.

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | L11 Diagnostic (authenticated) | `/diagnostic/me` | `POST /diagnostic/start` | `diagnostic.start` (self) | new `diagnostic_session` (auth) |
| 2 | Runner → submit (delivered as assessment attempt) | `/diagnostic/me` | (attempt APIs under the diagnostic assessment) | `attempt.start`/`attempt.submit` (self) | **STARTED→SUBMITTED→GRADED** |
| 3 | Scorecard + band | `/diagnostic/me` | `GET /diagnostic/:id/result` | `diagnostic.start` (own read) / `competency.score.read` (self) | competency signals ⇒ scores |
| 4 | Routed to prescribed path | `/paths/:id` | `GET /learning-paths/:id` | `learning_path.read` | path recommendation refreshed |

**State transitions:** diagnostic is an *assessment of type `diagnostic`* (no separate engine) → attempt lifecycle → competency signal → score/band refresh.
**Failure paths:** retake throttle per config; diagnostic alone never sets "Challenge Ready" (model forbids — readiness needs demonstrated signal, §1 of Dependency Analysis); abandoned → **ABANDONED**.
**Success:** refreshed starting band and a re-prescribed roadmap entry. **Rejected:** a "diagnostic-only readiness unlock" — explicitly disallowed.

## Journey E — Learner → Readiness Screen → Challenge CTA

**Entry:** L1 readiness card → L12. **Goal:** see demonstrated readiness and act on the band-gated outbound CTA.

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | L12 Competency & Readiness | `/readiness` | `GET /me/competency`, `/me/competency/history`, `/readiness-policy` | `competency.score.read` (self), `readiness_policy.read` | reads `composite_readiness_state` |
| 2 | Readiness checklist (gaps → one-tap actions to L6/L10) | `/readiness` | (links to path/practice) | self | — |
| 3 | Outbound attributed CTA (prominence gated by band) | `/readiness` | `POST /cta/attribution-token` | `readiness_policy.read` (system-minted) | `attribution_tokens` minted ⇒ `attribution.token_created` (audit Required) |
| 4 | CTA redirect confirm → external | redirect | (outbound redirect to policy target) | — | token carries attribution; **never checkout** |

**Permission checks:** self-read of competency; CTA token is system-minted as a side effect of an authorized readiness CTA; prominence comes from `readiness_policies` (T20).
**State transitions:** band determines CTA prominence; token minted + audited at click.
**Failure paths:** band below threshold → CTA de-emphasized per policy (not removed unless policy hides it); legal copy/disclaimers enforced from T20 policy; no inbound challenge result is consumed (Phase 2 — rejected here).
**Success:** an attributed, compliant outbound CTA that respects the demonstrated band. **Rejected:** in-app challenge checkout or funded-status verification (Phase 2/3).

## Journey F — Learner → Certificate Earned → Verification

**Entry:** automation on completion (Journey B step 7) → L14. **Goal:** view, share, and publicly verify a credential.

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | L14 Certificates | `/certificates` | `GET /certificates` | `certificate.read` (own) · `ENT[certification.enable]` | lists own `certificates` |
| 2 | Share modal → copy public link | `/certificates` | — | `certificate.read` (own) | share link = `/verify/:credentialId` |
| 3 | A5 Certificate Verification (public, by anyone) | `/verify/:credentialId` | `GET /public/verify/:credentialId` | pub | minimal public projection; logs `credential_verifications` |

**Permission checks:** own-read only in-app; public verify uses **no** tenant-admin privilege and resolves by `credential_id`.
**State transitions:** `certificates.status` issued (or revoked → verification shows revoked).
**Failure paths:** `certification.enable` absent → L14 hidden, issue/verify blocked; revoked credential → verification returns revoked status (still resolvable, no leak).
**Success:** learner shares a verifiable credential; third parties confirm authenticity without an account.

## Journey G — Learner → Community Participation

**Entry:** L1 Community nav → L17. **Goal:** join a space, read/post, react, comment; report bad content. All gated by `ENT[community.enable]`.

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | L17 Community Hub | `/community` | `GET /spaces`, `POST /spaces/:id/join` | `community.space.read`, `community.space.join` · `ENT[community.enable]` | `group_memberships` row |
| 2 | L18 Space / Feed → post/react | `/community/spaces/:id` | `GET/POST /spaces/:id/posts`, `POST /reactions` | `post.read`, `post.create`, `reaction.create` | `post.read` for PRIVATE/UNLISTED requires space-member |
| 3 | L19 Post Detail / Thread → comment | `/community/posts/:id` | `GET /posts/:id/comments`, `POST /posts/:id/comments`, `PUT/DELETE /comments/:id` (own) | `comment.create`, `comment.update/delete` (own) | comments append |
| 4 | Report modal (contextual) → opens case | L18/L19 modal | `POST /moderation/cases` | (member-initiated report) | `ModerationStatus` **OPEN** ⇒ `moderation.case_opened` |
| 5 | Appeal (if actioned) | contextual modal | `POST /appeals` | `appeal.create` (own case) | appeal opened |

**Permission checks:** visibility + space-membership scoped; private spaces also need `ENT[community.private_spaces.enable]`; edits own content (`posts.author_membership_id`, `comments.author_membership_id`).
**State transitions:** join → post/comment/react; report opens a moderation case (→ Moderator Journey §6).
**Failure paths:** `community.enable` off → all community nav hidden, routes `403 ENTITLEMENT_REQUIRED`; posting in a space the learner hasn't joined → `403 RELATIONSHIP_DENIED`; editing another's post → `403 OWNERSHIP_DENIED`.
**Success:** learner participates within visibility scope; abuse is routed to moderation, not silently lost.

## Journey H — Learner → Notification Interaction

**Entry:** L23 topbar bell. **Goal:** read in-app notifications and mark them read. (No preference center in P1 — §14.1.)

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | L23 Notifications Inbox | `/notifications` | `GET /me/notifications` | `notification.read.self` (self) | reads `notification_dispatches` (own) |
| 2 | Mark read | `/notifications` | `POST /me/notifications/:id/read` | `notification.read.self` (self) | dispatch marked read; unread badge decremented |
| 3 | Deep-link to source (e.g., graded attempt, moderation action) | target route | source API | source permission | navigates into the relevant journey |

**Permission checks:** self-only; **no user "send" route** — dispatches are written idempotently by the worker tier as a side effect of automation/workflow.
**State transitions:** `DispatchStatus` (QUEUED→SENT by worker) is engine-side; learner only toggles read.
**Failure paths:** notification target deleted/archived → deep-link resolves to a "no longer available" state (see §10 failure flows), inbox entry remains.
**Success:** learner triages notifications and jumps to the originating context.

## Journey I — Learner → Profile Management

**Entry:** user menu → L24 / L25. **Goal:** view/edit own per-tenant profile and account/locale settings.

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | L24 Profile | `/profile` | `GET /me/profile`, `PUT /me/profile` | `profile.read` (self), `profile.update` (self) | edits `member_profiles` (own) |
| 2 | L25 Settings (account/locale/logout) | `/settings` | `GET /me/profile`, `GET /locales` | `profile.update` (self), `locale.read` | locale preference set |
| 3 | Logout | `/settings` | `POST /auth/logout` | authenticated | session revoked (Redis revocation list); audit `identity.login` family |

**Permission checks:** self-ownership on `member_profiles.membership_id`; profile is **per-tenant** (global principal id never exposed).
**Failure paths:** profile visibility rules apply to others' views (not own edit); session already revoked → re-auth required.
**Success:** profile/settings updated; clean logout.

## Journey J — Learner → Account Deletion Request

**Entry:** L25 Settings → "Request Account Deletion". **Goal:** exercise the data-deletion right; admin processes it.

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | L25 Settings → Deletion-request confirm modal | `/settings` | `POST /deletion-requests` (own) | `data.deletion.request` (own — `O⁸`) | `deletion_requests` created ⇒ `data.deletion.requested` (audit Required) |
| 2 | (admin side) T24 Deletion Requests | `/admin/deletion-requests` | `GET /deletion-requests` | `data.deletion.manage` | request listed |
| 3 | (admin) Process / approve | `/admin/deletion-requests` | `POST /deletion-requests/:id/process` | `data.deletion.manage` | irreversible process ⇒ audit Required |

**Permission checks:** learner files only their **own** request (`O⁸`); processing is admin-only (`data.deletion.manage`).
**State transitions:** request filed → admin processes (irreversible). Memberships use `status`/`removed_at` + audit history (not soft delete) per DB v2 §soft-delete.
**Failure paths:** learner cannot process their own request; learner cannot file for another account.
**Success:** request recorded and routed to the admin GDPR workflow (§7.11). **Rejected:** self-service hard delete by the learner (must route through `data.deletion.manage`).

---

# SECTION 5 — INSTRUCTOR JOURNEYS

Every instructor write is ownership- or relationship-constrained inside `can()`. Publish/issue route through the S1 human gate. Instructors never see member/role/branding/config/moderation/platform screens.

## 5.1 Course Creation (Draft → Author → Review → Publish)

**Entry:** I1 Studio Dashboard → I2. **Goal:** author and publish a course through the human gate.

| Step | Screen | Route | API | Permission (own/rel) | State (`PublishStatus`) |
|---|---|---|---|---|---|
| 1 | I2 Course Manager → Create | `/studio/courses` | `GET /courses` (own), `POST /courses` | `course.create` | **DRAFT** |
| 2 | I3 Course Builder (modules, settings, access/drip/prereq) | `/studio/courses/:id` | `PUT /courses/:id`, `GET/POST /courses/:id/modules`, `PUT/DELETE /modules/:id` | `course.update` (own `courses.created_by_membership_id`) | DRAFT (editing) |
| 3 | I4 Lesson Editor (content + assets) | `/studio/courses/:id/lessons/:lessonId` | `GET/PUT/DELETE /lessons/:id`, `GET/POST/DELETE /lessons/:id/assets` | `course.update` (own) | DRAFT |
| 4 | I3 → Submit for review | `/studio/courses/:id` | `POST /courses/:id/publish` | `course.publish` (rel + workflow gate) | **DRAFT→REVIEW** ⇒ `workflow_transition` created |
| 5 | S1 Review & Approvals (approver acts) | `/review` | `GET /workflows`, `POST /workflows/:id/transition` | `workflow.transition.act` (approver) | **REVIEW→PUBLISHED** (approve) ⇒ `course.published`; or **REVIEW→DRAFT** (return) |

**Approval requirement:** instructor `course.publish` is `R⁵` — only valid through `workflow.transition.act` when the tenant requires review. Admin/owner self-approve within tenant (audited).
**State transitions:** **DRAFT → REVIEW → PUBLISHED**; archive path **PUBLISHED→ARCHIVED** via lifecycle (soft, recoverable).
**Failure paths:** editing a course they don't own → `403 OWNERSHIP_DENIED`; approving their own transition without approver relationship → `403 RELATIONSHIP_DENIED`; return-with-comment sends it back to **DRAFT**.
**Success:** course **PUBLISHED** and visible to entitled/enrolled learners (Journey B).

## 5.2 Lesson Management

**Entry:** I3 → I4. **Goal:** manage lesson content/assets within an owned course.

Screens: I3 Course Builder → I4 Lesson Editor. Routes: `/studio/courses/:id/lessons/:lessonId`. APIs: `GET/PUT/DELETE /lessons/:id`, `GET/POST/DELETE /lessons/:id/assets` (R2 signed / video-provider refs). Permission: `course.update` (own course). State: lesson edits live within the parent course's **DRAFT/REVIEW/PUBLISHED** lifecycle (no independent lesson publish). Approval: inherited from course publish (5.1). Failure: asset delete confirm; ownership-denied on foreign courses. Success: lessons authored and ordered; `lesson.completed` emitted when learners consume.

## 5.3 Assessment Creation

**Entry:** I8 Assessment Builder. **Goal:** create a quiz/exam/diagnostic/readiness_review, compose items, configure, publish via gate.

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | I8 Assessment Builder → Create | `/studio/assessments` | `POST /assessments` | `assessment.create` | **DRAFT** |
| 2 | Compose + config (time/attempts/pass mark/shuffle/secure-mode/L1 proctoring level) | `/studio/assessments/:id` | `PUT /assessments/:id` | `assessment.update` (author) | DRAFT |
| 3 | Submit for review → publish | `/studio/assessments/:id` | `POST /assessments/:id/publish` | `assessment.publish` (author + workflow gate) | **DRAFT→REVIEW→PUBLISHED** via S1 |

**Note (no-fork):** diagnostic and readiness_review are `assessment_type` values, not separate engines — the FundedBeyond diagnostic is authored here (Screen Inventory §5.5). Approval: human gate. Failure: foreign authorship → `403`; delete → soft-delete, audited. Success: assessment **PUBLISHED** and attemptable (Journey B step 4).

## 5.4 Question Bank Management (Items + Collections)

**Entry:** I5 Item Bank / I7 Item Collections. **Goal:** author items (incl. `swipe`) and compose decks/quiz banks/practice sets.

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | I5 Item Bank → Create (any registered item_type) | `/studio/items` | `GET /item-types`, `GET/POST /items` | `item.read`, `item.create` | item **DRAFT** |
| 2 | I6 Item Editor (stem/options/answer key + dimension-weights TA/PSY/RISK/DISC/CR) | `/studio/items/:id` | `PUT /items/:id`, `GET/PUT /items/:id/dimension-weights` | `item.update` (own `items.created_by_membership_id`) | DRAFT |
| 3 | I7 Item Collections / Decks (compose, incl. swipe deck) | `/studio/item-collections` | `GET/POST /item-collections`, `PUT/DELETE /item-collections/:id`, `POST/DELETE /item-collections/:id/items` | `item.read`, `item_collection.manage` | collection **DRAFT** |

**Note (no-fork):** `swipe` is a seeded global `item_type`; authoring a swipe item uses ordinary `item.create` — registering the *renderer* is an extensibility action (T19), not an assessment-core edit. Permission: own-authored items only for edit. Failure: edit foreign item → `403 OWNERSHIP_DENIED`. Success: reusable items + decks that feed assessments (5.3) and swipe practice (Journey C).

## 5.5 Learning Path Creation

**Entry:** I9 Learning Path Builder. **Goal:** sequence roadmap stages + gates (incl. `competency_band` gates).

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | I9 → Create path | `/studio/learning-paths` | `POST /learning-paths` | `learning_path.create` | **DRAFT** |
| 2 | Step sequencer + gate editor (assessment / competency_band) | `/studio/learning-paths/:id` | `PUT /learning-paths/:id` | `learning_path.update` (author/rel) | DRAFT |
| 3 | Publish via gate | `/studio/learning-paths/:id` | `POST /learning-paths/:id/publish` | `learning_path.publish` (rel + workflow) | **DRAFT→REVIEW→PUBLISHED** via S1 |

**Note (no-fork):** the FundedBeyond 7-stage Trader Career Roadmap is a learning path whose band gates read `composite_readiness_state` via the generic `competency_band` gate type. Approval: human gate. Failure: foreign authorship → `403`. Success: path **PUBLISHED**, drives L5/L6 with band-gated unlocks.

## 5.6 Certificate Issuance (instructor path)

**Entry:** I12 Learner Roster → "Issue to qualifying learner". **Goal:** issue a credential to a learner in a course/program they teach.

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | I12 Learner Roster & Progress | `/studio/courses/:id/learners` | `GET /enrollments`, `GET /courses/:id/progress`, `GET /members/:id/competency` | `enrollment.read` (rel), `progress.read` (rel), `competency.score.read` (rel) | identifies qualifying learner |
| 2 | Issue action (routed through gate) | I12 modal → S1 | `POST /certificates/issue` | `certificate.issue` (`R⁵` course/program rel + workflow gate) · `ENT[certification.enable]` | `workflow_transition` then `certificates.status=issued` ⇒ `certificate.issued` (audit Required) |

**Approval requirement:** issuance is relationship + workflow gated; it is **not** a standalone instructor screen — it surfaces inside I12 and routes through S1. Failure: issuing to a learner outside their courses → `403 RELATIONSHIP_DENIED`; entitlement off → `403 ENTITLEMENT_REQUIRED`. Success: credential issued, verifiable (Journey F).

## 5.7 Community Moderation (instructor as community member only)

Instructors hold **no** `community.moderate` (Matrix §5.1). They participate in community as members (Journey G) and may edit/delete only their **own** posts/comments (`post.update/delete` = `O`). **Rejected for instructors:** any moderation queue/case/appeal action — that is the Moderator/Admin journey (§6). This is stated explicitly to prevent an over-scoped "instructor moderates their course discussion" journey that the matrix does not grant.

## 5.8 Learner Progress Review

**Entry:** I3 → I12 (relationship-scoped). **Goal:** oversee learners in courses/paths they teach.

Screens: I12 Learner Roster & Progress. Routes: `/studio/courses/:id/learners`. APIs: `GET /enrollments`, `GET /courses/:id/progress`, `GET /members/:id/competency`, `GET /attempts/:id`. Permissions: `enrollment.read`/`progress.read`/`competency.score.read`/`attempt.read` — all `R` (course-instructor relationship). Optional I13 Studio Analytics (`analytics.dashboard.view`, `ENT`-gated, relationship-scoped). Grading sub-journey: I10 Grading Queue → I11 Grading Detail (`GET /grading-tasks`, `POST /grading-tasks/:id/grade`, `assessment.grade` = grading-assignee relationship; reads attached read-only L1 proctoring timeline) ⇒ attempt **SUBMITTED→GRADED**, `assessment.graded`. Failure: viewing learners outside their courses → `403 RELATIONSHIP_DENIED`; grading an unassigned task → `403`. Success: relationship-bounded oversight and grading.

---

# SECTION 6 — MODERATOR JOURNEYS

All moderator journeys require `ENT[community.enable]`. Admin/owner reach the same screens via their `community.moderate`/`community.space.manage` grants. Escalation to publish/issue workflows is **not** moderator scope; moderators act on S1 for *moderation workflows only* (Matrix §5.1 fn⁹).

## 6.1 Content Review

**Entry:** M1 Moderation Queue. **Goal:** triage the reported/flagged worklist.

Screens: M1 Moderation Queue → M2 Case Detail. Routes: `/moderate/cases` → `/moderate/cases/:id`. APIs: `GET/POST /moderation/cases`, then `POST /moderation/cases/:id/decide`. Permission: `community.moderate`. State: `ModerationStatus` **OPEN→REVIEWING** when opened. Ownership check: none on the content (moderate is tenant-wide within community), but every decision is audited. Audit events: `moderation.case_opened` (POST), `community.moderation.decided` (decide). Failure: entitlement off → `403`. Success: case advanced to a decision.

## 6.2 Content Flag Resolution

**Entry:** M2 Case Detail. **Goal:** decide hide/lock/delete/action on flagged content.

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | M2 Case Detail (reported content + history) | `/moderate/cases/:id` | `GET /moderation/cases` (detail) | `community.moderate` | **REVIEWING** |
| 2 | Decision controls | M2 decision modal | `POST /moderation/cases/:id/decide`; `DELETE /posts/:id` / `PUT/DELETE /comments/:id` (moderate path) | `community.moderate` (bypass-ownership on content action) | **REVIEWING→ACTIONED** / **REJECTED** / **CLOSED** |

**Ownership check:** moderators may *action/delete* any post/comment via `community.moderate`, but **editing the body** of another user's post is not granted (action, not rewrite — Matrix §6). Audit: Required on moderate-path delete + decide. Failure: attempting to edit content body → `403`. Success: content actioned, decision audited, author notified (→ Journey H), appeal path opened.

## 6.3 User Report / Appeal Resolution

**Entry:** M3 Appeals Review. **Goal:** review and decide member appeals against moderation actions.

Screens: M3 Appeals Review. Routes: `/moderate/appeals`. APIs: `POST /appeals/:id/review`. Permission: `appeal.review` (`A` for moderator). Relationship: `community.moderate`. State: appeal **decided** ⇒ `community.moderation.decided`. Escalation path: a member's appeal (filed via `appeal.create` in Journey G) lands here; if upheld, the original case may move **ACTIONED→REJECTED/CLOSED**. Audit: Required. Failure: a moderator deciding their own filed appeal would be an ownership conflict — appeals are filed by members, reviewed by moderators (separation holds). Success: appeal resolved with audit trail.

## 6.4 Moderation Audit Review

**Entry:** moderation decisions + appeals are recorded in the tenant audit trail. Moderators do **not** hold `audit.read` (that is admin/owner — Matrix §5.1). **Rejected for moderators:** a dedicated moderation-audit screen — there is no `audit.read` grant for `moderator`, so reviewing the audit log is a **Tenant Admin** journey (§7.9). Moderators see per-case action history inside M2 (the case's own history), which is the supported surface. This explicit boundary prevents inventing an unsupported moderator audit screen. Space management (M4 Community Spaces Admin, `community.space.manage`) is available to moderators for create/edit/delete spaces.

---

# SECTION 7 — TENANT ADMIN JOURNEYS

Owner = admin + owner-only deltas (assign/revoke `admin`, edit `owner` role, broad overrides, full-tenant export/deletion, full audit), gated inline in `can()`. Admin cannot reach the platform plane or grant its own entitlements.

## 7.1 Tenant Setup (first-run, owner)

**Entry:** owner first login (post §3.2) → T1. **Goal:** orient and reach the setup surfaces. Screens: T1 Admin Dashboard → branches to T6 branding, T7 domains, T8 config, T9 feature flags, T2 members, T11 competency. APIs: `GET /members`, `GET /audit`, `GET /provisioning/jobs`. Permissions: `membership.read`, `audit.read`. State: tenant already **ACTIVE** (from provisioning). Success: owner has a checklist of setup journeys (7.2–7.7). Failure: none beyond standard gate. (No new "setup wizard" screen invented — T1 + existing admin screens.)

## 7.2 Branding Configuration

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | T6 Branding & Theme (edit draft) | `/admin/branding` | `GET/PUT /branding`, `PUT /theme` | `branding.read`, `branding.update` | draft edited |
| 2 | Live preview | `/admin/branding` | `GET /branding` | `branding.read` | — |
| 3 | Publish | `/admin/branding` | `POST /branding/publish` | `branding.publish` | new `tenant_branding_version` ⇒ `config.branding.published` (audit Required) |
| 4 | Version history / restore | `/admin/branding` | `GET /branding/versions` | `branding.read` | restore prior version |

Approval gate: none (branding/theme share one authority boundary, no workflow). Failure: instructor/learner reaching this → `403 PERMISSION_DENIED`. Success: published white-label identity at the resolved host.

## 7.3 Domain Configuration

Screens: T7 Domains. Routes: `/admin/domains`. APIs: `GET/POST /domains`, `DELETE /domains/:id`. Permissions: `tenancy.domain.read`/`tenancy.domain.manage`. Entitlement: **custom domain** requires `ENT[branding.custom_domain.enable]` (atlas-subdomain always works). State: `DomainStatus` **PENDING→ACTIVE** on DNS verification, or **FAILED**; **DISABLED** on delete. Audit: Required on add/delete. Failure: custom domain without entitlement → `403 ENTITLEMENT_REQUIRED`; verification fails → **FAILED** with DNS helper. Success: verified primary domain; host resolution (§1.1) now serves the tenant there.

## 7.4 User Management

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | T2 Members (table) | `/admin/members` | `GET /members` | `membership.read` | — |
| 2 | Invite | T2 invite modal | `POST /members/invite` | `membership.invite` | new membership **INVITED** ⇒ `identity.membership.*` (audit) |
| 3 | Suspend | T2 confirm | `POST /members/:id/suspend` | `membership.suspend` (owner-guard: target ≠ owner) | **ACTIVE→SUSPENDED** (audit Required) |
| 4 | Remove | T2 confirm | `DELETE /members/:id` | `membership.remove` (owner-guard) | **→REMOVED**, `removed_at` set (audit Required) |

Failure: admin suspending/removing the **owner** → blocked (owner-guard). Success: membership lifecycle managed; invitee flows into §3.2.

## 7.5 Membership Management (Member Detail)

Screens: T3 Member Detail (merges profile + roles + overrides on one membership). Routes: `/admin/members/:id`. APIs: `GET /members/:id`, `GET/PUT /members/:id/profile`. Permissions: `membership.read`, `profile.read/update`. State: profile edits (`member_profiles`); membership status via 7.4. Audit: Required on admin profile edit (`bypass(admin)`). Failure: cross-tenant member → RLS-empty. Success: single-screen view of one member's identity in this tenant.

## 7.6 Role Assignment

| Step | Screen | Route | API | Permission | Guard |
|---|---|---|---|---|---|
| 1 | T4 Roles & Permissions | `/admin/roles` | `GET/POST /roles` | `role.read`, `role.create` | — |
| 2 | T5 Role Editor (catalogue picker) | `/admin/roles/:id` | `PUT/DELETE /roles/:id` | `role.update`/`role.delete` | **no-grant-up**, not-owner-role |
| 3 | T3 → assign role to member | `/admin/members/:id` | `POST /members/:id/roles` | `role.assign` | **cannot-assign-owner**; no-grant-up |
| 4 | Revoke role | `/admin/members/:id` | `DELETE /members/:id/roles/:roleId` | `role.revoke` | **rank-guard** (admin ≠ revoke owner) |
| 5 | Permission overrides | T3 override modal | `GET/POST/DELETE /permission-overrides` | `permission_override.manage` | no-grant-up |

Audit: Required on all of `access.role.*`, `access.override.*`. Owner-only delta: only `owner` may assign/revoke `admin` and edit the `owner` role. Failure: admin attempting to assign `owner` or grant a permission it lacks → `403` (no-grant-up). Success: roles/overrides composed within authority bounds.

## 7.7 Entitlement Review (read-only)

Screens: T10 Entitlements. Routes: `/admin/entitlements`. APIs: `GET /entitlements`. Permission: `entitlement.read`. State: read-only — **changes are platform-only** (§8.4). Failure: any write attempt → impossible (no tenant write route exists; this is the structural guard against self-elevation). Success: admin sees plan capabilities + upgrade-prompt copy. **Rejected:** any tenant-side entitlement mutation.

## 7.8 Analytics Review

Screens: T21 Analytics. Routes: `/admin/analytics`. APIs: `GET /analytics/dashboards`, `/analytics/funnel`, `/analytics/item-statistics`. Permissions: `analytics.dashboard.view`, `analytics.funnel.view`. Entitlement: `ENT[analytics.dashboard.view]` (role grant necessary but not sufficient). State: read-only rollups; CSV export. Failure: entitlement off → `403 ENTITLEMENT_REQUIRED` (basic counts may remain on T1). Success: tenant-wide learning/assessment/funnel/community dashboards.

## 7.9 Audit Log Review

Screens: T22 Audit Log. Routes: `/admin/audit`. APIs: `GET /audit`. Permission: `audit.read`. State: append-only, hash-chained, tenant-scoped. Filters by action; entry detail drawer. Owner-only delta: full tenant audit. Failure: non-admin → `403`. Success: tamper-evident trail of every authorization-state mutation in the tenant. (This is the supported home for moderation-audit review — see §6.4.)

## 7.10 Data Export

Screens: T23 Data Exports. Routes: `/admin/exports`. APIs: `GET/POST /exports`, `GET /exports/:id`. Permission: `data.export.run`. Entitlement: `data.export.enable` (always-on by policy — data export is a right). State: `JobStatus` **QUEUED→RUNNING→SUCCEEDED** → signed download. Audit: Required on run (`data.export.requested`). Failure: job fails → **FAILED**, re-runnable. Success: tenant data exported via signed URL.

## 7.11 Deletion Request Processing

Screens: T24 Deletion Requests. Routes: `/admin/deletion-requests`. APIs: `GET/POST /deletion-requests`, `POST /deletion-requests/:id/process`. Permissions: `data.deletion.request` (admin may file for any; learner only own), `data.deletion.manage` (process). State: request filed → processed (irreversible). Audit: Required on file + process. Approval gate: process confirm (irreversible). Failure: processing without `data.deletion.manage` → `403`. Success: GDPR/deletion workflow completed end-to-end (pairs with Journey J).

> **Admin content/community oversight (no duplicate screens):** admins reuse Studio I2–I9 and Moderation M1–M4 at tenant scope with `bypass(admin)` inside `can()` (audited). Competency/scoring (T11), certificate templates (T12), issued certificates (T13), gamification (T14), notification templates (T15), automation (T16), workflows (T17), locales (T18), extensions (T19), readiness policy (T20) are each configured on their existing admin screen with the permissions listed in the Screen Inventory §1.5 — no new screens invented.

---

# SECTION 8 — PLATFORM ADMIN JOURNEYS

Isolated plane: `atlas_platform` DB role, separate shell, MFA, every action reason-bound (≥10 chars) + `platform.scope.enter`/`exit` audited. Unreachable from any tenant session.

## 8.1 Tenant Provisioning
Covered in full in §3.1 (P1→P2→P3, `POST /platform/tenants` idempotent, saga, entitlements, owner invite, **PROVISIONING→ACTIVE**).

## 8.2 Tenant Suspension

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | P1 → P3 Tenant Detail → Lifecycle tab | `/platform/tenants/:id` | `GET /platform/tenants/:id` | `platform.tenant.read` + reason | — |
| 2 | Suspend (reason modal ≥10) | P3 confirm | `POST /platform/tenants/:id/suspend` | `platform.tenant.manage` | `TenantState` **ACTIVE→SUSPENDED** ⇒ `tenant.state_changed` (audit Required) |

Effect on tenants: all tenant traffic now hits the Tenant State Gate → `503 TENANT_SUSPENDED` → A10 (admin login allowed to settle). Failure: `support` role attempting suspend → `403` (read-biased). Success: tenant suspended, reason + audit recorded.

## 8.3 Tenant Reactivation

Screen: P3 Lifecycle tab. Route: `/platform/tenants/:id`. API: `POST /platform/tenants/:id/resume`. Permission: `platform.tenant.manage` + reason. State: **SUSPENDED→ACTIVE** ⇒ `tenant.state_changed`. (Archive path: `POST .../archive` → **ARCHIVED**.) Audit: Required. Failure: resuming a **DELETED** tenant is not offered (terminal). Success: tenant **ACTIVE**, traffic restored.

## 8.4 Feature Entitlement Management

| Step | Screen | Route | API | Permission | State |
|---|---|---|---|---|---|
| 1 | P3 Tenant Detail → Entitlements tab | `/platform/tenants/:id` | `GET /platform/tenants/:id/entitlements` | `platform.entitlement.manage` + reason | — |
| 2 | Grant / modify (entitlement-grant modal) | P3 modal | `PUT /platform/tenants/:id/entitlements` | `platform.entitlement.manage` | writes `entitlements` + `entitlement_grant_history` ⇒ `config.entitlement.changed` (audit Required) |
| — | Global flags / catalogs | P4 / P5 | `GET/POST/PUT /platform/feature-flags`; `/platform/catalog/{permissions,item-types,extension-points}` | `platform.feature_flag.manage`; `platform.catalog.manage` (**super_admin only** for catalog) | global registries updated |

This is the **only** place entitlements change. Effect on tenants: the next tenant request re-reads entitlements; a newly-granted key lights up its journeys (community/certs/gamification/analytics/custom-domain). Failure: `operations` attempting catalog-manage → `403`. Success: tenant plan capabilities updated with append-only grant history.

## 8.5 Platform Audit Review

Screen: P6 Platform Audit. Route: `/platform/audit`. API: `GET /platform/audit`. Permission: `platform.audit.read` (+ `atlas.support` scoped to the tenant under its active support session). State: read-only cross-tenant/global stream incl. scope-enter/exit entries. Failure: tenant session reaching this → impossible (separate plane). Success: cross-tenant tamper-evident audit visibility.

## 8.6 Platform Health Monitoring (Eventing / Dead-Letter Ops)

Screen: P8 Eventing / Dead-Letter Ops. Route: `/platform/eventing`. API: `POST /internal/outbox/dead-letter/:id/replay`. Permission: `platform.tenant.manage` + reason. State: dead-lettered events inspected → replayed (idempotent at the outbox). Audit: Required. Failure: replay of an already-processed event is idempotent (no duplicate side effects). Success: stuck events recovered. **Rejected:** a "Platform Analytics" or generic "System Configuration" dashboard — neither has a backing permission/API in P0/P1 (Screen Inventory §9), so no such journey exists.

## 8.7 Platform Scope Access (the temporary elevation / support workflow)

**Entry:** P7 Support Sessions. **Goal:** open a reason-bound, time-boxed, read-biased window into one tenant to diagnose an issue.

| Step | Screen | Route | API | Permission | Scope mechanics |
|---|---|---|---|---|---|
| 1 | P7 Support Sessions → Open | `/platform/support` | `POST /platform/support/sessions` | `platform.support.access` | **Reason modal (≥10 chars)** per incident |
| 2 | `withPlatformScope(ctx, reason, fn)` | — | — | platform | sets `app.platform_scope='true'` + `app.tenant_id`; writes `platform.scope.enter` **before** |
| 3 | Read tenant data via scoped RLS policy | — | tenant read APIs under platform scope | role-bounded (support = read-biased) | `<table>_platform_scope` RLS `TO atlas_platform USING(true)`; every tenant touched recorded |
| 4 | Action completes / session expires | — | — | — | writes `platform.scope.exit` **after**; **no standing session persists** |

**Temporary elevation workflow:** access is per-action / per-incident, never standing. **Reason capture:** mandatory ≥10 chars on every entry. **Audit requirements:** enter + exit + every tenant touched; a platform route lacking audit fails CI. **Expiration workflow:** support sessions are time-boxed; scope exits at completion or timeout, and there is no persistent cross-tenant session. **Rejected patterns (CI-blocked):** a tenant request setting `app.platform_scope`; querying tenant data without reason+audit; sharing `platformPrisma` with tenant routes; building platform screens by disabling RLS; storing any `platform.*` permission in a tenant role.

---

# SECTION 9 — FUNDEDBEYOND JOURNEYS

FundedBeyond Academy is **Tenant #1**. Every flagship feature below resolves to generic Atlas permissions (Matrix §4), generic Atlas APIs (Inventory §3), and generic Atlas tables (DB v2 §1.1), with only **three** FB app-layer tables — `diagnostic_sessions`, `readiness_policies`, `attribution_tokens` — that store app state and **alter no generic engine**. FB uses the five seeded tenant roles unchanged. No FB-specific role, permission, table, engine, screen, or platform code exists. This is the screen-and-journey-layer proof of "configuration, not fork."

## 9.1 Free Trading Diagnostic

**Atlas engines used:** Assessment (`assessments` type=`diagnostic`, `attempts`, `attempt_answers`) → Competency (`competency_signals` → `competency_scores`). **Screens:** A2/A3/A4 (anon), L11 (auth). **APIs:** `/public/diagnostic/*`, `/diagnostic/*`, `attempt.*`. **FB-owned table:** `diagnostic_sessions` (session/anon-merge state only).

Flow = Journey A steps 1–4 (anon) and Journey D (auth retake). **Competency updates:** attempt submission emits signals via outbox ⇒ scoring computes the 5-dimension scores (TA/PSY/RISK/DISC/CR). **Readiness updates:** scores roll into `composite_readiness_state` → starting band. **No fork:** the diagnostic *is* an assessment attempt; scoring is generic signal emission; `diagnostic_sessions` only holds anon→account merge state.

## 9.2 Swipe Learning Session

**Atlas engines used:** Item registry (`item_types.swipe` seeded global), `item_collections` (swipe deck), `practice_sessions`/`practice_responses`, `srs_state` → Competency via outbox. **Screens:** L10 (learner), I7/I6 (authoring). **APIs:** `/items`, `/item-collections`, `/practice-sessions/*`, `/me/srs/due`. **FB-owned tables:** none.

Flow = Journey C. **Competency updates:** `practice.session_completed` ⇒ competency signal ⇒ `competency_scores` recomputed. **Readiness updates:** demonstrated practice contributes to the composite band. **No fork:** `swipe` is a registered global item-type renderer (extensibility), not an Assessment-core edit — this resolves Architecture-Review Inversions 1 & 3.

## 9.3 Challenge Readiness Journey

**Atlas engines used:** Competency composite (`composite_readiness_state`, `competency_bands`) + Learning-Path band gates; outbound CTA only. **Screens:** L12 (learner), T20 (policy admin). **APIs:** `/me/competency`, `/readiness-policy`, `/cta/attribution-token`. **FB-owned tables:** `readiness_policies` (thin CTA policy), `attribution_tokens` (outbound tokens).

Flow = Journey E. **Competency/readiness updates:** readiness is generic scoring output; the band drives CTA prominence per `readiness_policies` (T20). **No fork:** the CTA is an attributed outbound redirect, never checkout; no inbound `challenge.*` event is consumed. **Rejected (Phase 2):** simulated review depth, an in-app Challenge Readiness Center, funded-status verification.

## 9.4 Trader Career Roadmap Progression

**Atlas engines used:** Learning Path (`learning_paths`, `path_steps`, `path_step_gates` gate_type=`competency_band`, `path_enrollments`, `path_step_progress`). **Screens:** L5/L6 (learner), I9 (authoring). **APIs:** `/learning-paths/*`, `enrollment.create`, `progress.read`. **FB-owned tables:** none.

| Step | Screen | API | Permission | Readiness/Competency interaction |
|---|---|---|---|---|
| 1 | L5 Roadmap (7 stages, gated) | `GET /learning-paths`, `/learning-paths/:id/progress` | `learning_path.read`, `progress.read` (self) | each stage gate reads `composite_readiness_state` via generic `competency_band` gate |
| 2 | L6 Path/Stage Detail → enroll | `GET /learning-paths/:id`, `POST /learning-paths/:id/enroll` | `enrollment.create` (self) | stage unlocks when band gate satisfied |
| 3 | Complete stage units (Journeys B/C) | learning/practice APIs | self | competency signals advance band → unlock next gate |

**No fork:** band gates read the generic composite via the generic gate type; the 7-stage roadmap is ordinary learning-path configuration.

## 9.5 Hall of Fame Discovery

**Atlas engines used:** Community recognition space (`community_spaces`/`posts`) + Gamification (`leaderboard_definitions`/`leaderboard_snapshots`) + Certification (verifiable creds). **Screen:** L20. **APIs:** `GET /spaces/:id/posts` (HoF space), `GET /leaderboards/:id`, `GET /public/verify/:id`. **Entitlements:** `community.enable` + `gamification.enable`. **FB-owned tables:** none.

Flow: L1 → L20 Hall of Fame → recognition feed (consented community posts) + top-performers leaderboard + verifiable-cert links (→ A5 verify). **No fork:** pure read projection over generic surfaces. **Rejected (Phase 2/3):** funded-status verification (inbound — not in P1); HoF shows consented community + leaderboard + verifiable certs only, **not** funded-status-verified entries.

## 9.6 Community Engagement Journey

**Atlas engines used:** Community & Moderation (spaces/posts/comments/reactions). **Screens:** L17–L19 (+ M1–M4 moderation). **APIs:** `/spaces`, `/posts`, `/comments`, `/reactions`, `/moderation`. **Entitlement:** `community.enable`. Flow = Journey G + Moderator §6. **No fork:** FB community is generic community configured with FB spaces; moderation uses the generic moderator role.

## 9.7 Challenge CTA Attribution Journey

**Atlas engines used:** Competency (band) + FB app-layer attribution. **Screen:** L12. **API:** `POST /cta/attribution-token`. **FB-owned table:** `attribution_tokens`. Flow = Journey E step 3–4. **Mechanics:** an authorized readiness CTA mints a tenant-scoped, expiring `attribution_token` (carries no privilege) ⇒ `attribution.token_created` (audit Required), then redirects outbound. **No fork:** attribution is a thin side-effect table; the engine that computes readiness is generic scoring.

> **Proof of no platform fork (P0/P1):** across 9.1–9.7, every screen is a generic Atlas screen, every API a generic Atlas route, every permission a generic Atlas permission, every engine a generic Atlas engine, and the only FB-specific persistence is three app-state tables that touch no engine. FundedBeyond is a **tenant configuration**, not a platform fork. (Closes Architecture Review C3 / Inversion at the journey layer.)

---

# SECTION 10 — FAILURE FLOWS

Each failure resolves to a consistent machine reason (Matrix §8.5), a defined UX, a defined redirect, and a defined audit behavior. Cross-tenant existence is **never** leaked (no `404`-by-id that distinguishes another tenant's resource).

| # | Failure | Machine reason / HTTP | User experience | API / redirect behavior | Audit behavior |
|---|---|---|---|---|---|
| 10.1 | **Unauthorized access** (active member, no permission) | `PERMISSION_DENIED` / 403 | Action hidden in nav; deep-link shows "you don't have access" | handler never runs; redirect to role home | sensitive denies audited |
| 10.2 | **Missing membership** (stranger on host) | `NO_MEMBERSHIP` / 403 | Public landing A1; "request access / sign in" | protected route blocked at gate [4]; → A1/A6 | gate denials sampled |
| 10.3 | **Suspended membership** | `MEMBERSHIP_SUSPENDED` / 403 | Branded suspended notice; public + logout only | all protected routes blocked; → A10-style notice | sampled |
| 10.4 | **Missing entitlement** (plan lacks capability) | `ENTITLEMENT_REQUIRED` / 403 (UI may show 402/upgrade) | Feature hidden from nav; upgrade-prompt copy | blocked at [6] before permission; existing data read-only for admins/export | sensitive denials sampled (plan-drift) |
| 10.5 | **Ownership failure** (edit another's resource) | `OWNERSHIP_DENIED` / 403 | "You can only edit your own…"; action disabled | blocked inside `can()` [8]; stays on current screen | bypass(admin) on sensitive targets audited |
| 10.6 | **Relationship failure** (instructor not teaching; moderator on non-moderation workflow) | `RELATIONSHIP_DENIED` / 403 | Item not in their worklist; action absent | blocked inside `can()` [8] | — |
| 10.7 | **Invalid resource** (malformed/unknown id) | `VALIDATION_ERROR` / 400 or RLS-empty | "Not found / invalid"; never reveals other-tenant existence | RLS returns empty; no 404-by-id cross-tenant | — |
| 10.8 | **Expired / used invitation** | `CONFLICT` / 409 (or 403) | A9 "invitation invalid or expired"; contact admin | `POST /public/invitations/accept` rejects; single-use enforced | `identity.membership.*` on accept attempts |
| 10.9 | **Deleted course** (soft-deleted) | RLS-filtered / 404-by-host | Removed from catalog; existing deep-links show "no longer available" | soft-deleted rows excluded; learners lose visibility | DELETE audited (Required) |
| 10.10 | **Deleted user** (REMOVED membership) | `MEMBERSHIP_REMOVED` / 403 | Treated as no membership; re-invite required | protected routes blocked at [4]; `removed_at` set | membership change audited |
| 10.11 | **Archived content** (PUBLISHED→ARCHIVED) | RLS/visibility | Hidden from learner browse; admin can view/restore | archived excluded from learner queries; recoverable | lifecycle audited |
| 10.12 | **Tenant not ACTIVE** | `TENANT_SUSPENDED` / 503; `TENANT_NOT_FOUND` / 404 | A10 branded notice; admin login allowed to settle | blocked at [2] before auth | tenant.state_changed audited (platform side) |
| 10.13 | **Auth failure** | `AUTH_REQUIRED` / 401 | A6 login error; lockout/backoff | no principal resolved at [3]; → A6/A8 | login family audited |
| 10.14 | **Idempotency replay** | `IDEMPOTENCY_REPLAY` / 409 | No duplicate created; original result returned | replayed key returns original (provisioning, submit, responses, dispatch) | — |
| 10.15 | **Rate limited** | `RATE_LIMITED` / 429 | "Slow down" toast; retry after | token bucket exhausted (esp. public diagnostic, swipe loop) | — |

**Cross-cutting redirect rule:** a denial never bounces the user into a dead end — `401`→A6, `NO_MEMBERSHIP`→A1, `MEMBERSHIP_PENDING`→A9, `MEMBERSHIP_SUSPENDED/REMOVED`→A10 notice, `ENTITLEMENT_REQUIRED`→upgrade-prompt on the current shell, `PERMISSION/OWNERSHIP/RELATIONSHIP_DENIED`→stay with disabled action or role home.

---

# SECTION 11 — STATE TRANSITION MAPS

All states are the enums defined in Database Design v2 §ENUMS. No new states are introduced.

## 11.1 User / Membership Lifecycle (`MembershipStatus`)

```
                 invite (membership.invite)
        ┌──────────────────────────────────────┐
        ▼                                        │
   [INVITED] ──accept (/invitations/accept)──▶ [ACTIVE] ──suspend (membership.suspend)──▶ [SUSPENDED]
        │                                       ▲   │                                          │
   expire/void                                  │   │ resume (re-activate)  ◀──────────────────┘
        │                                       │   │
        ▼                                       │   └── remove (membership.remove) ──▶ [REMOVED]
   (no membership)                              └────────── re-invite ◀──────────────────┘
```
- Default role on first ACTIVE = `learner`. Global identity (`auth_principals`) is separate and crosses tenants; the membership never does. REMOVED sets `removed_at` (no soft-delete of the row; audit history retained).

## 11.2 Tenant Lifecycle (`TenantState`)

```
[PROVISIONING] ──saga SUCCEEDED──▶ [ACTIVE] ──suspend──▶ [SUSPENDED] ──resume──▶ [ACTIVE]
       │                              │                       
   saga FAILED                        ├── archive ──▶ [ARCHIVED]
   (replay via P8)                    └── (terminal) ──▶ [DELETED]
```
- Driven only from the platform plane (§8). Non-ACTIVE → Tenant State Gate blocks tenant traffic (503/404 → A10). DELETED is terminal.

## 11.3 Domain Lifecycle (`DomainStatus`)

```
[PENDING] ──DNS verified──▶ [ACTIVE] ──disable──▶ [DISABLED]
     └── verification fails ──▶ [FAILED] ──retry──▶ [PENDING]
```

## 11.4 Course / Assessment / Learning-Path Lifecycle (`PublishStatus`)

```
[DRAFT] ──submit (publish)──▶ [REVIEW] ──approve (workflow.transition.act)──▶ [PUBLISHED]
   ▲                              │                                              │
   └──── return-with-comment ◀────┘                                    archive ──▶ [ARCHIVED]
```
- Same enum governs `courses`, `assessments`, `learning_paths`, `items`, `item_collections`, `certificate_templates`. REVIEW→PUBLISHED is the human gate (S1). PUBLISHED→ARCHIVED is soft/recoverable. Where the tenant configures no review, DRAFT→PUBLISHED still records a (pass-through) transition.

## 11.5 Assessment Attempt Lifecycle (`AttemptStatus`)

```
[STARTED] ──submit (attempt.submit)──▶ [SUBMITTED] ──auto/subjective grade──▶ [GRADED]
    │                                       
    ├── timeout / leave ──▶ [ABANDONED]
    └── integrity violation ──▶ [VOIDED]
```
- Auto-graded assessments go SUBMITTED→GRADED immediately; subjective ones wait for I11 grading (`assessment.grade`). VOIDED is the integrity terminal state; ABANDONED on timeout/no-submit.

## 11.6 Certificate Lifecycle

```
(none) ──issue (certificate.issue, workflow + certification.enable)──▶ [issued] ──revoke (certificate.revoke)──▶ [revoked]
```
- Issuance is automation- or instructor-driven through the human gate; public verification (A5) resolves any status, returning "revoked" for revoked credentials without leaking tenant data.

## 11.7 Community Content / Moderation Lifecycle (`ModerationStatus`)

```
post/comment created (Visibility: PRIVATE|TENANT|PUBLIC|UNLISTED)
        │ report (moderation.case_opened)
        ▼
   [OPEN] ──open case──▶ [REVIEWING] ──decide (community.moderate)──▶ [ACTIONED] | [REJECTED] | [CLOSED]
                                              │
                                       appeal (appeal.create) ──▶ appeal.review ──▶ may move ACTIONED→REJECTED/CLOSED
```
- Content visibility is the `Visibility` enum; the moderation *case* uses `ModerationStatus`. Moderators action/delete content but never rewrite another author's body.

## 11.8 Diagnostic Lifecycle

```
anonymous: [diagnostic_session started] ──identity gate + merge──▶ bound to membership
authenticated retake: started ──(delivered as assessment attempt: STARTED→SUBMITTED→GRADED)──▶ competency signals emitted
```
- The diagnostic is an `assessment_type=diagnostic`; its lifecycle *is* the attempt lifecycle (11.5) plus the anon-merge step. `diagnostic_sessions` only tracks session/merge state.

## 11.9 Readiness Lifecycle (composite band, engine-owned)

```
competency signals (assessment/practice/diagnostic) ──outbox──▶ scoring computes competency_scores
        │ ⇒ competency.score_changed
        ▼
   composite_readiness_state recomputed ──band crosses threshold──▶ ⇒ readiness.band_changed
        │
        ▼
   band drives: L5 path-gate unlocks · L12 CTA prominence (per readiness_policies)
```
- No user write path exists (`competency.signal.create` does not exist). Bands are configured in T11; CTA policy in T20. Diagnostic alone never sets "Challenge Ready" — demonstrated signal is required.

---

# SECTION 12 — JOURNEY VALIDATION

This section is the implementation guardrail before wireframing. It proves the traversal map does not create unsupported UX, does not strand approved screens, and does not depend on APIs, permissions, entities, or workflows outside the approved Phase 0 + Phase 1A + Phase 1B surface.

## 12.1 No orphan screens

The journey map covers every Screen Inventory v1 surface either as a primary journey step, a child/supporting branch, a shared workflow surface, or an intentionally hidden/error/system surface.

| Screen group | Coverage verdict | Where covered |
|---|---|---|
| Anonymous A1–A10 | **Covered** | §2.1, §3.2–§3.3, §4 Journey A, §10 failure flows. A10 is a system route for non-ACTIVE/unresolved tenants. |
| Learner L1–L25 | **Covered** | §4 Journeys A–J plus supporting branches. L21 Resource Library and L22 Search Results are covered as discovery branches inside Journey B; L23–L25 are covered in Journeys H–J. |
| Instructor I1–I13 | **Covered** | §5. I13 is covered as learner-progress/content analytics review; it is non-blocking for MVP when T21 basic counts suffice. |
| Moderator M1–M4 | **Covered** | §6. M4 is covered as community-space administration; moderation-audit review is explicitly rejected for moderators and routed to T22. |
| Shared S1 | **Covered** | §5, §6, §7, §11.4 as the human approval gate for publish/issue/moderation workflows. |
| Tenant Admin T1–T24 | **Covered** | §7. T9 Feature Flags is covered as part of tenant setup/configuration; T10 is read-only by design; T21 analytics is non-blocking when basic T1 counts are sufficient. |
| Platform P1–P8 | **Covered** | §8. Platform screens are physically isolated and cannot be reached from tenant journeys. |

**Validation result:** **PASS.** No approved screen is left without a traversal. Screens that appear less frequently are supporting/control-plane surfaces, not missing journeys.

## 12.2 No orphan APIs

All Phase 0 and Phase 1 API groups are consumed by at least one journey or by a declared internal worker path.

| API group | Coverage verdict | Journey use |
|---|---|---|
| Tenancy / provisioning / domains | **Covered** | §3.1, §7.3, §8.1–§8.3. |
| Auth / session / invitation / membership | **Covered** | §3.2–§3.3, §7.4–§7.6. |
| Roles / permissions / overrides | **Covered** | §7.6. |
| Config / flags / entitlements | **Covered** | §7.1, §7.7, §8.4. |
| Branding / theme | **Covered** | §7.2. |
| Courses / modules / lessons / enrollments / progress | **Covered** | §4 Journey B, §5.1–§5.2. |
| Learning paths / path gates | **Covered** | §4 Journey A/B/D/E, §5.5, §9.4. |
| Items / collections / assessments / attempts / grading | **Covered** | §4 Journey B/D, §5.3–§5.4, §5.8. |
| Practice sessions / SRS / swipe | **Covered** | §4 Journey C, §9.2. |
| Competency / scoring / readiness policy / CTA token | **Covered** | §4 Journey A/C/D/E, §7 admin configuration, §9.1–§9.7. |
| Certificates / public verification | **Covered** | §4 Journey F, §5.6, §7.11, §9.5. |
| Community / moderation / appeals | **Covered** | §4 Journey G, §6.1–§6.3, §9.6. |
| Notifications | **Covered** | §4 Journey H, §7 notification templates. |
| Search | **Covered** | §4 Journey B supporting discovery branch, Resource Library, and topbar search. |
| Analytics / funnel / item statistics | **Covered** | §5.8, §7.8. |
| Workflow / automation / locales / extensions | **Covered** | §5 publish/issue gates, §7 admin config, §8 platform review. |
| Audit / export / deletion requests | **Covered** | §7.9–§7.11, §8.5, §10. |
| Internal outbox / dead letter | **Covered** | §3 provisioning saga, §4 event-driven scoring/certs/notifications, §8.6. It is not user-facing. |

**Validation result:** **PASS.** No public/tenant/platform API in Phase 0 + Phase 1 is unowned by a journey. Internal APIs are intentionally worker-only and must never be wired to UI.

## 12.3 No orphan permissions

The permission catalogue is consumed through screens and APIs only. The journey map does not introduce ad hoc authorization checks. Permissions fall into one of four valid buckets:

1. **Actor navigation permissions** — decide whether the route is visible or accessible.
2. **Resource action permissions** — create/update/publish/submit/moderate/revoke/export/process.
3. **Ownership/relationship-scoped permissions** — learner self-actions, instructor-owned content, instructor-of-course progress review, moderator-of-space actions.
4. **Platform-scope permissions** — tenant provisioning, suspension/reactivation, entitlement management, audit, health/dead-letter operations.

**Validation result:** **PASS.** No journey names a permission that is not already carried by the Screen Inventory/API Inventory/Permission Matrix. No journey bypasses `can()`.

## 12.4 No broken routes

Route validation rules:

- Public routes are limited to landing, public diagnostic, certificate verification, login/signup/reset, and invitation acceptance.
- Learner routes never expose `/studio/*`, `/moderate/*`, `/admin/*`, or `/platform/*`.
- Instructor routes never expose tenant member, role, branding, entitlement, platform, or broad admin screens.
- Moderator routes never expose audit-log review as a standalone right; moderation history stays inside cases and T22 remains admin-only.
- Tenant admin routes never expose `/platform/*`.
- Platform routes never embed tenant screens; platform access remains reason-bound and audited.

**Validation result:** **PASS.** No route requires a screen outside Screen Inventory v1. No protected route is treated as public.

## 12.5 No unsupported workflows

The following tempting workflows are explicitly rejected because they would require Phase 2–4 capabilities or new APIs/screens/entities:

| Unsupported workflow | Verdict | Reason |
|---|---|---|
| Academy challenge checkout | **Rejected** | FundedBeyond Academy only mints outbound attributed CTA tokens in P1; checkout is external. |
| Inbound `challenge.purchased/passed/funded` attribution loop | **Deferred** | Integration-depth handshake is Phase 2. P1 is outbound token only. |
| Challenge Readiness Center with simulated review | **Deferred** | Not in Phase 1 API/screen surface. |
| Funded Trader Program / verified funded groups | **Deferred** | Requires inbound challenge/funded status integration. |
| Public community browsing | **Rejected** | No public community route exists; community requires ACTIVE membership + entitlement. |
| Live sessions / webinars / events | **Deferred** | Phase 2. |
| Commerce checkout / subscriptions / tenant billing | **Deferred** | Phase 2+; FundedBeyond Academy v1 does not process challenge payments. |
| Mobile-specific journeys | **Deferred** | Phase 3 mobile white-label builds; web journeys may later be adapted. |
| AI coach / AI authoring | **Deferred** | Phase 4 and human-gated. |
| Marketplace / third-party plugin SDK | **Deferred** | Phase 4; P1 allows only first-party extension registration/configuration. |
| L2/L3 proctoring journeys | **Deferred** | P1 permits only L1 integrity/proctoring consent where configured. |

**Validation result:** **PASS.** Unsupported workflows are rejected instead of quietly smuggled into journeys.

## 12.6 No duplicate journeys

Duplicate-looking flows have been collapsed into shared traversal patterns:

| Potential duplicate | Resolution |
|---|---|
| Tenant provisioning in §3 and §8 | §3 defines the foundation mechanics; §8 defines the platform-admin operating journey. Same flow, two views. |
| Certificate issuance by instructor/admin/automation | One issuance lifecycle: `certificate.issue` + workflow gate + public verification. Actor differs; state machine does not. |
| Course, assessment, path publish | One publish lifecycle: **DRAFT → REVIEW → PUBLISHED**, surfaced via S1. |
| Learner diagnostic and FundedBeyond diagnostic | Same assessment/scoring substrate; FundedBeyond config supplies dimensions and copy. |
| Swipe learning and assessment practice | Same item/practice/competency signal path; swipe is a first-party generic item/practice type. |
| Moderation by moderator/admin | Same M1–M4 surfaces; admin uses tenant-scope bypass through `can()` when granted. |

**Validation result:** **PASS.** The journey map reuses shared flows instead of creating parallel flows.

## 12.7 Final validation verdict

**Validation verdict: PASS — approved to move into Wireframes v1, conditional on Phase 0 security gates.**

The traversal map is internally consistent with the approved Screen Inventory, API Inventory, Permission Matrix, and Database Design. It contains no new screens, APIs, permissions, roles, engines, or entities. It rejects unsupported Phase 2–4 workflows explicitly. Wireframes may now use this document as the canonical journey source.

---

# SECTION 13 — MVP JOURNEY ANALYSIS

This section prioritizes journeys by launch risk and product value. The order is not a development schedule; it is a launch-readiness priority stack.

## 13.1 Critical journeys

These are the journeys that define whether Atlas + FundedBeyond Academy works as a product, not merely as a set of screens.

| Priority | Journey | Why critical | Must prove |
|---|---|---|---|
| 1 | Host resolution + membership gate + authorization spine | Tenant isolation is the core platform invariant. | A user from Tenant A cannot access Tenant B; suspended/removed members cannot access protected routes. |
| 2 | Platform tenant provisioning | Atlas is a SaaS platform only if a second tenant can be provisioned without code. | Tenant **PROVISIONING → ACTIVE**, domain mapped, entitlements set, owner invited. |
| 3 | Invitation acceptance + first login | The tenant operating model depends on role-based onboarding. | Invite token creates ACTIVE membership, role assignment works, route resolution lands on correct dashboard. |
| 4 | Visitor diagnostic → account → roadmap | FundedBeyond’s top-of-funnel loop depends on this. | Anonymous diagnostic merges into a learner account and produces a next path without forking Atlas. |
| 5 | Enrollment → lesson → assessment → completion | Core LMS value. | Learner can enroll, learn, attempt, submit, receive grade/progress/cert path. |
| 6 | Swipe → competency → readiness | FundedBeyond’s differentiator. | Swipe/practice responses emit competency signals; readiness updates through generic scoring. |
| 7 | Readiness → attributed CTA | Monetization bridge without challenge checkout. | CTA token is minted, legal copy is shown, redirect is external and attributed. |
| 8 | Author → review → publish | Content supply chain. | Instructor cannot bypass the human gate; approver publishes via S1. |
| 9 | Admin member/role/entitlement/audit controls | Tenant operation and support. | Admin can manage users safely but cannot self-grant platform entitlements. |
| 10 | Data export + deletion request | Trust/compliance floor. | Export and deletion flows are auditable and tenant-scoped. |

## 13.2 Must work before launch

The following journeys are launch blockers:

1. **Tenant provisioning:** P1–P3/P8 path creates an ACTIVE tenant, domain record, entitlement set, owner invitation, and audit trail.
2. **Authentication + membership gate:** A6/A7/A9 to L1/T1/I1/M1 route resolution, including suspended/removed paths.
3. **Authorization spine:** Host → tenant state → auth → membership → entitlement → `can()` → resource loader → allowed/denied.
4. **Learner diagnostic onboarding:** A1/A2/A3/A4 → L1/L5/L12 with anon merge.
5. **Course learning loop:** L2/L3/L4/L7/L8/L9/L13/L14, backed by published content only.
6. **Swipe learning loop:** L10 → competency signals → L13/L12 updates.
7. **Challenge readiness CTA:** L12 + `POST /cta/attribution-token` only; no internal checkout.
8. **Instructor course/assessment/path publishing:** I2–I9 + S1 workflow gate.
9. **Tenant admin setup and operations:** T1–T13, T16–T17, T19–T20, T22–T24.
10. **Platform admin operations:** P1–P8 with reason-bound platform scope.
11. **Failure flows:** unauthorized, missing membership, suspended membership, missing entitlement, ownership failure, invalid/deleted/archived resource.

## 13.3 Nice-to-have journeys within Phase 1

These are valuable but should not block launch if the critical loop is stable:

| Journey/surface | Why nice-to-have | Safe fallback |
|---|---|---|
| L15 Achievements | Improves engagement. | Hide XP/badge widgets if gamification entitlement/config is not ready. |
| L16 Leaderboards | Adds competition/social proof. | Use basic progress and certificates first. |
| L19 Thread detail depth | Improves community usability. | Launch with feed + comments if necessary. |
| L20 Hall of Fame | Trust and recognition surface. | Show consented cert/community recognition only; no funded-status claims. |
| L21 Resource Library | Better discovery. | Resource-tagged courses can be found through catalog/search. |
| T14 Gamification config | Admin customization. | Seed default badge/streak rules. |
| T15 Notification templates | Brand polish. | Use safe system templates. |
| T18 Locales | Regional polish. | Single-locale launch. |
| T21 Analytics | Strong admin value. | Basic T1 counts and CSVs until dashboards mature. |
| I13 Studio analytics | Instructor optimization. | Use learner progress review first. |
| M4 Community spaces admin | Moderator self-service. | Admin can manage spaces initially. |

## 13.4 Journeys that can wait

These should **not** be built for Phase 0/1 even if they sound attractive:

- Commerce checkout, SaaS billing depth, subscriptions, payment providers, revenue share.
- Inbound challenge purchase/pass/funded events.
- Challenge Readiness Center, simulated challenge review, and challenge checkout recovery journeys.
- Live learning, webinars, events, cohorts with calendar/session operations.
- Full Funded Trader Program, verified funded groups, challenge groups.
- Referral/affiliate centers.
- Mobile app-specific onboarding and push notification journeys.
- L2/L3 proctoring dashboards, incident review, and proctor ops.
- Marketplace, third-party plugin SDK, plugin review/publishing.
- AI authoring, AI coach, AI recommendations.
- Multi-region/dedicated-tenant operating journeys.

## 13.5 Launch priority stack

| Launch layer | Journeys | Exit signal |
|---|---|---|
| **Foundation** | Tenant provisioning, auth, membership, authorization, audit, platform scope | Isolation/IDOR/membership/platform-scope tests green. |
| **Core LMS** | Course enrollment, lessons, assessments, progress, certificates | Learner can complete a published course end-to-end. |
| **FundedBeyond differentiator** | Diagnostic, swipe, scoring, readiness, attributed CTA | Visitor can become learner, improve readiness, and be redirected externally with attribution. |
| **Creator/admin operations** | Author/review/publish, admin setup, roles, data rights | Tenant can operate without developer intervention. |
| **Engagement layer** | Community, notifications, badges, leaderboards, Hall of Fame | Adds retention and trust after core loop is stable. |

## 13.6 MVP journey verdict

**MVP priority verdict: Launch only when the foundation spine, core LMS loop, FundedBeyond diagnostic/swipe/readiness loop, and admin/platform operations all work end-to-end.** Community, Hall of Fame, advanced analytics, and gamification improve conversion and retention, but they must not distract from proving the secure multi-tenant learning/readiness loop.

---

# SECTION 14 — CTO REVIEW

## 14.1 Missing journeys

**No launch-blocking journey is missing.** The journey map covers every required actor and every required Phase 0 + Phase 1A + Phase 1B product path.

The only “missing” journeys are intentionally absent because they are outside the approved scope:

| Missing/deferred journey | CTO position |
|---|---|
| Challenge checkout inside Academy | Correctly absent. Would violate FundedBeyond non-negotiable: Academy does not process challenge purchases. |
| Inbound challenge-result attribution | Correctly deferred to Phase 2. P1 supports outbound attribution only. |
| Live/webinar/event attendance | Correctly deferred. Not needed for MVP readiness loop. |
| Mobile app journeys | Correctly deferred to Phase 3; web journeys should be responsive but not mobile-build-specific. |
| AI coach/AI content generation | Correctly deferred to Phase 4 and human approval. |
| Marketplace/plugin publishing | Correctly deferred. P1 only needs first-party extension registration/configuration. |
| Public community browsing | Correctly rejected. No public route or permission exists. |
| Moderator audit-log review | Correctly rejected. Audit review belongs to Tenant Admin via T22. |

## 14.2 Duplicate journeys

The document correctly avoids duplicate journey architecture. Duplicates that commonly cause product bloat are intentionally merged:

- Course publish, assessment publish, path publish, certificate issue: all use the same S1 human approval model.
- Admin and instructor content operations: shared Studio screens with different `can()` outcomes.
- Moderator and admin moderation: shared moderation surfaces with different role reach.
- Diagnostic and assessment: diagnostic is a configured assessment/scoring journey, not a separate platform engine.
- Swipe and practice: swipe is an item/practice type that emits generic competency signals.
- FundedBeyond roadmap and Atlas learning paths: roadmap is a configured learning path with competency gates.

**CTO verdict:** Duplication is under control.

## 14.3 Overengineered journeys

These journeys are valid but should be implemented in their thinnest acceptable version first:

| Journey | Risk | Keep it lean by |
|---|---|---|
| Hall of Fame | Could accidentally imply verified funded status before inbound integration exists. | Only show consented community/certificate/leaderboard data in P1. |
| Gamification | Can distract from learning/readiness. | Start with streaks/XP/badges seeded from defaults; defer complex badge economy. |
| Analytics | Dashboards can explode scope. | Start with learning/assessment/funnel basics and CSV; avoid custom report builder. |
| Automation rules | Rule builders can become a product alone. | Support only Phase 1 safe rules: completion→certificate, streak nudges, publish/issue workflows. |
| Feature flags/config | Easy to over-configure. | Keep tenant-admin flags bounded; entitlement-like flags remain read-only. |
| Resource Library | Could become a CMS. | Treat as resource-tagged course/content search, not a new content system. |
| Community moderation | Could become a full trust & safety suite. | Keep to report → case → decision → appeal. |

## 14.4 Journeys to defer

Defer anything that introduces payments, external challenge state, live delivery complexity, mobile app operations, marketplace governance, AI review, or higher proctoring depth.

**Hard defer list:** commerce checkout, SaaS billing UX, inbound `challenge.*` events, Challenge Readiness Center, Funded Trader Program, live/webinar/events, affiliates/referrals, mobile white-label build flows, L2/L3 proctoring ops, marketplace/plugin publishing, AI coach/authoring, platform billing/analytics consoles, multi-region tenant operations.

## 14.5 Security concerns

| Concern | Severity | Required control |
|---|---|---|
| Tenant breakout through host/JWT mismatch | **Critical** | Host wins over JWT; membership gate rechecked every request; RLS via transaction-local tenant context. |
| Transaction pooling tenant leakage | **Critical** | `set_config(..., true)` inside `withTenantTx`; no session-level `SET`; Phase 0 pooling tests must pass. |
| Platform-scope abuse | **Critical** | Separate platform shell/client/DB role; reason capture; enter/exit audit; no standing tenant-session elevation. |
| Entitlement bypass | **High** | Single `enforceEntitlement` chokepoint; no plan-name checks; CI gate for entitlement routes. |
| Ownership bypass | **High** | Ownership/relationship inside `can()`, not endpoint-specific code. |
| Public diagnostic abuse | **High** | Tight per-host/IP-hash rate limits; anonymous merge tokens single-use; no raw PII in anti-abuse records. |
| Readiness CTA regulatory/compliance risk | **High** | Legal copy/disclaimer in readiness policy; CTA is guidance/education handoff, not suitability guarantee; no internal challenge sale. |
| Data export/deletion risk | **High** | Export and deletion are audited; irreversible processing requires confirmation and appropriate permission. |
| Moderator overreach | **Medium** | Moderators can action/delete via moderation flow, not rewrite another user's content body. |
| Community privacy | **Medium** | Space visibility + membership checks; no public community browsing. |

## 14.6 UX risks

| UX risk | Impact | Mitigation in wireframes |
|---|---|---|
| Diagnostic identity gate feels like bait-and-switch | Lower signup conversion | Show partial value before gate; explain that account unlocks history/roadmap. |
| Membership errors feel confusing | Support load | Use specific states: invited, suspended, removed, no membership; do not show generic failure. |
| Entitlement-hidden screens confuse admins | Upgrade/support friction | Show entitlement review in T10 and non-destructive upgrade prompts where appropriate. |
| Instructor publish flow feels slow | Content ops friction | Clearly label “Submit for review,” show status, reviewer comments, and next action. |
| Readiness CTA sounds like financial advice | Legal/compliance exposure | Use tenant-configured legal copy; frame as educational readiness, not guarantee. |
| Learner overwhelmed by LMS-style navigation | Lower engagement | Route L1 to one next-best action; keep roadmap and swipe prominent. |
| Admin console feels too large | Onboarding friction | T1 should expose a setup checklist and hide non-MVP optional areas until needed. |
| Platform support scope feels invasive | Trust risk | Show reason, expiry, and audit trail for support access. |

## 14.7 Final approval verdict

**Verdict: APPROVED FOR WIREFRAMES v1 — conditional.**

This User Flows & Journey Maps v1 document is implementation-ready as the authoritative traversal map for Phase 0 + Phase 1A + Phase 1B. It sits on the approved Screen Inventory, API Inventory, Permission Matrix, and Database Design without redesigning the product. It does not create new screens, APIs, permissions, roles, engines, workflows, or entities. It keeps FundedBeyond as Tenant #1 configuration on generic Atlas engines and rejects unsupported Phase 2–4 functionality instead of inventing shortcuts.

**Approval conditions before wireframes/build handoff:**

1. Phase 0 transaction-pooling RLS, IDOR, membership-gate, and platform-scope tests must pass before Phase 1 journeys are implemented.
2. Every wireframe must include its screen ID, route, API calls, permission gate, entitlement gate if any, and failure state.
3. The readiness CTA wireframe must include legal/disclaimer copy and must never imply challenge purchase or guaranteed funding inside the Academy.
4. Public diagnostic screens must include rate-limit/abuse and identity-merge failure states.
5. Admin and platform wireframes must expose audit/reason capture where required.
6. No wireframe may introduce a new screen or route not present in Screen Inventory v1 and API Inventory v1.

**Exact next document:** **WIREFRAMES v1 — Phase 0 + Phase 1A + Phase 1B**, using this traversal map as the source of truth.

---
*Atlas LMS — User Flows & Journey Maps v1 complete. Approved for Wireframes v1, conditional on the Phase 0 security gates and strict no-new-scope enforcement.*
