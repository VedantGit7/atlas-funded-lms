# Atlas LMS — API Inventory v1
## Phase 0 + Phase 1 API Surface Definition

**Role:** Principal SaaS Architect · Principal API Architect · Principal Backend Architect · Principal Security Architect · Principal Product Architect · CTO
**Status:** Implementation-ready inventory — conditional approval (see §13)
**Scope:** Phase 0 foundation + Phase 1 FundedBeyond Academy MVP on generic Atlas engines only.

> **What this document is.** It is the authoritative list of every API surface that must exist in Phase 0 and Phase 1, with the authorization, ownership, relationship, entitlement, and audit obligations each one carries.
>
> **What this document is not.** Not an OpenAPI spec, not request/response schemas, not implementation code, not a redesign of architecture or permissions. Where it names a table, permission, role, enum, helper, error code, or event, that artifact is the one defined in **Database Design v2** and **Permission Matrix v1**; those two documents plus the **Atlas bounded contexts** are the sole sources of truth. Phase 2–4 surfaces (commerce/checkout, inbound `challenge.*` events, live/webinar/event, L2/L3 proctoring, mobile builds, third-party plugin sandbox/marketplace, AI layer) are **out of scope** and no endpoints are defined for them.
>
> **Precedence.** If any future API spec contradicts the Permission Matrix, the Permission Matrix wins and the spec is defective. This inventory never adds a permission, table, role, or entitlement that those documents do not already define.

---

## SECTION 1 — API Design Principles

### 1.1 API-first strategy
Every capability is a contract before it is a screen. The contract surface is the route plus its declared authorization metadata `{ permission, entitlement?, resourceLoader? }` (Permission Matrix §15.2). The middleware refuses to invoke a handler that has not declared this metadata, so an undeclared route is a build failure, not a public route. Web, mobile, instructor tooling, FundedBeyond app-layer logic, and platform operations all consume the same contracts; there is no private back-channel that bypasses `can()` / `enforceEntitlement`.

### 1.2 REST conventions
- Resources are nouns; collections are plural (`/api/v1/courses`, `/api/v1/attempts`).
- HTTP verbs carry semantics: `GET` (read, safe, no side effects), `POST` (create or invoke a state transition), `PUT` (full update of a mutable resource), `PATCH` (partial update where defined), `DELETE` (soft-delete where the table is soft-deletable; never a hard delete of append-only/ledger/audit data).
- State transitions that are not plain CRUD are modeled as sub-resource `POST` actions: `POST /courses/:id/publish`, `POST /attempts/:id/submit`, `POST /workflows/:id/transition`. This keeps publish/submit/revoke/transition individually permissioned (least privilege, Permission Matrix §1.2).
- IDs are UUIDv7 strings, application-generated (Database Design v2 §4.2). A route never accepts a client-supplied `tenant_id`; tenant is always resolved from host (§1.11).
- Responses never expose the global `auth_principals` id; tenant APIs return only `membership` / `member_profile` identity (Permission Matrix §2.3).

### 1.3 Versioning strategy
- Major version in the URL prefix: `/api/v1/**` (tenant + learner + instructor), `/api/v1/platform/**` (platform). The Permission Matrix used `/api/...` as shorthand; this inventory canonicalizes it to `/api/v1/...`.
- Public marketing/verification/diagnostic routes live under `/api/v1/public/**`.
- Breaking changes require a new major version; additive fields are non-breaking and ship in-place. Event payloads carry their own `schema_version` (Database Design v2 §17.1) independent of the HTTP version.

### 1.4 Error conventions
Single error envelope on every non-2xx response:
```
{ "error": { "code": <machineReason>, "message": <safe human text>, "requestId": <uuid> } }
```
Machine reasons are exactly the Permission Matrix §8.5 set, extended with transport-level codes. Errors never reveal cross-tenant existence (no `404`-by-id that distinguishes another tenant's resource — Permission Matrix §8.2).

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed body/params (Zod boundary failure) |
| 401 | `AUTH_REQUIRED` | No/invalid/expired JWT; principal unresolvable |
| 403 | `NO_MEMBERSHIP` | Authenticated, no membership in host tenant |
| 403 | `MEMBERSHIP_PENDING` / `MEMBERSHIP_SUSPENDED` / `MEMBERSHIP_REMOVED` | Membership state blocks protected routes |
| 403 | `PERMISSION_DENIED` | `can()` denied by role/override |
| 403 | `OWNERSHIP_DENIED` / `RELATIONSHIP_DENIED` | Owned/related predicate failed inside `can()` |
| 403 | `ENTITLEMENT_REQUIRED` | Tenant plan lacks capability (UI may surface as upgrade/402) |
| 404 | `TENANT_NOT_FOUND` | Host unresolved / tenant `DELETED` |
| 409 | `CONFLICT` / `IDEMPOTENCY_REPLAY` | Unique-constraint or idempotency-key collision |
| 429 | `RATE_LIMITED` | Token bucket exhausted |
| 503 | `TENANT_SUSPENDED` | Tenant not `ACTIVE` (admin login allowed to settle) |

### 1.5 Pagination strategy
Cursor-based only (no offset). List endpoints accept `?limit` (default 25, max 100) and `?cursor`; responses return `{ data: [...], page: { nextCursor, hasMore } }`. Cursors are opaque and encode the sort key (UUIDv7 / `created_at`/`occurred_at`). Append-only and high-volume tables (`audit_entries`, `outbox_events`, `practice_responses`, `competency_signals`, `point_ledger`) are read forward-only by `occurred_at` to respect partitioning (Database Design v2 §14).

### 1.6 Filtering strategy
Filters are an explicit per-resource allow-list of query params mapped to indexed columns (Database Design v2 §11) — never free-form SQL or arbitrary field filtering. Examples: courses by `?status=`, assessments by `?type=`, attempts by `?membershipId=` (subject to ownership/relationship in `can()`), audit by `?action=`. A filter param not on the allow-list is a `400 VALIDATION_ERROR`. All filters apply *after* RLS, never as a substitute for it.

### 1.7 Sorting strategy
`?sort=<field>:<asc|desc>` restricted to indexed sort keys per resource (e.g. `updated_at`, `created_at`, `position`, `xp_total`). Default sort is the resource's natural index (e.g. `position` for path steps/lessons, `occurred_at desc` for ledgers). Unindexed sort fields are rejected to protect the shared Postgres (Database Design v2 §22.5).

### 1.8 Idempotency strategy
Mutating routes whose underlying table carries an idempotency unique constraint (Database Design v2 §12) **require** an `Idempotency-Key` header; the server persists it to the table's `idempotency_key` column inside `withTenantTx`. A replay with the same key returns the original result, not a duplicate. Mandatory on:
- `POST /platform/tenants` and provisioning steps → `provisioning_jobs(tenant_id, idempotency_key)`
- `POST /attempts/:id/submit` and answer writes → `attempts` / `attempt_answers`
- `POST /practice-sessions/:id/responses` → `practice_responses`
- any engine signal write → `competency_signals`, `point_ledger`
- notification dispatch → `notification_dispatches`
- outbox publication → `outbox_events`
Idempotency keys are scoped by `tenant_id`; collisions across tenants are impossible by constraint design.

### 1.9 Rate limiting strategy
Redis/Upstash token buckets (Database Design v2 §0 stack), enforced before `withTenantTx`:
- **Anonymous/public** (diagnostic start, certificate verify, landing): per-IP-hash + per-host, tightest budget; the free diagnostic has its own abuse model (anonymous→account merge, `ip_hash`/`user_agent_hash` only — Permission Matrix §8.4).
- **Authenticated tenant**: per-`(tenant, membership)` plus per-tenant aggregate ceiling tied to `tenants.query_budget_json` / `statement_timeout_ms`.
- **Platform**: per-principal; platform-scope entries are additionally reason-gated and audited (not rate-limited away).
- **Write-heavy loops** (swipe responses): elevated but bounded buckets; server-side re-validation of any offline-batched signal before it touches scoring (roadmap §6, deferred depth in P3 but the gate exists in P1).

### 1.10 Audit requirements
Every authorization-state mutation and every sensitive action writes an append-only, hash-chained `audit_entries` row in the **same transaction** as the change (Permission Matrix §13, Database Design v2 §16). Audit is non-bypassable; a sensitive action with no audit write fails CI (Permission Matrix §16 gate 10). Each inventory entry below carries an explicit **Audit** field; "Required" means a §13 action key is emitted, "—" means routine read with no individual audit (covered by rollups).

### 1.11 Tenant isolation requirements
- Host → tenant resolution runs first (`tenant_domains` → `tenants`); **host wins over the JWT tenant claim** (Permission Matrix §2.1).
- The **membership gate** is load-bearing on every protected request and re-evaluated per request (no trusting stale tokens).
- All tenant DB work runs inside `withTenantTx`, which sets `app.tenant_id` via `set_config(..., true)` transaction-locally (never session-level `SET`) — the only pooling-safe pattern (Database Design v2 §7).
- **RLS is the backstop, `can()` is the primary control**; they must always agree. A handler touching Prisma/SQL outside `withTenantTx` is a CI failure (Permission Matrix §16 gate 5).
- The only cross-tenant path is the audited platform escape hatch on the separate `atlas_platform` role inside `withPlatformScope` (§5 / Permission Matrix §10).

---

## SECTION 2 — Bounded Context API Map

Contexts map 1:1 to Database Design v2 `PC-*` ownership and the Permission Matrix catalogue groups. "Owner" = the single authoritative writer (Database Design v2 §3). "Dependencies" are read/emit relationships, expressed through service interfaces or the outbox — never direct foreign-context SQL.

| # | Context | PC | Owner | Phase | Dependencies (consumes / emits) | API groups |
|---|---|---|---|---|---|---|
| 1 | **Tenancy & Provisioning** | PC-1 | Tenancy | P0 | resolved by all; emits `tenant.*` | `/platform/tenants`, `/domains`, `/provisioning` |
| 2 | **Identity** | PC-2 | Identity | P0 | Supabase Auth (global `auth_principals`); emits `membership.*` | `/auth/session`, `/me`, `/members` (read) |
| 3 | **Membership** | PC-2 | Identity | P0 | Access (roles); emits `membership.*` | `/members`, `/invitations` |
| 4 | **Access Control** | PC-3 | Access | P0 | Identity; emits `role.*`, `permission.*` | `/roles`, `/permission-overrides`, `/members/:id/roles` |
| 5 | **Branding** | PC-4 | Config/Branding | P0/P1 | Tenancy; emits `config.branding.*` | `/branding`, `/theme` |
| 6 | **Configuration** | PC-4 | Config | P0 | Access (entitlement read); emits `config.*`, `entitlement.changed` | `/config`, `/feature-flags`, `/entitlements` (read) |
| 7 | **Learning** | PC-5 | Learning | P1 | Assessment (gates), Workflow (publish); emits `course.*`, `lesson.completed`, `path.step_completed` | `/courses`, `/modules`, `/lessons`, `/enrollments`, `/learning-paths`, `/progress` |
| 8 | **Assessment** | PC-6 | Assessment | P1 | Item-type registry (global), Workflow, Integrity; emits `assessment.*`, `practice.session_completed` | `/items`, `/item-collections`, `/assessments`, `/attempts`, `/practice-sessions`, `/grading-tasks` |
| 9 | **Competency & Scoring** | PC-7 | Scoring | P1 | consumes signals via outbox (never user writes); emits `competency.*`, `readiness.band_changed` | `/competency-dimensions`, `/scoring-profiles`, `/scoring-config`, `/me/competency`, `/members/:id/competency` |
| 10 | **Certification** | PC-8 | Credentialing | P1 | Workflow (issue gate), Learning; emits `certificate.issued/revoked` | `/certificate-templates`, `/certificates`, public `/verify` |
| 11 | **Gamification** | PC-9 | Engagement | P1 | consumes events; Redis hot path; emits `badge.awarded`, `streak.updated` | `/gamification`, `/badges`, `/leaderboards`, `/streaks` |
| 12 | **Community & Moderation** | PC-11 | Community / Moderation | P1 | Identity, Search, Notification; emits `community.post_created`, `moderation.case_opened` | `/spaces`, `/posts`, `/comments`, `/reactions`, `/moderation`, `/appeals` |
| 13 | **Notifications** | PC-14 | Eventing/Notification | P1 | consumes outbox; emits `notification.queued` | `/notification-templates`, `/me/notifications` |
| 14 | **Search** | PC-14 | Eventing/Search | P1 | consumes outbox to index; RLS+visibility scoped | `/search`, `/search/reindex` |
| 15 | **Analytics** | PC-15 | Analytics | P1 | consumes outbox; entitlement-gated dashboards | `/analytics/dashboards`, `/analytics/funnel`, `/item-statistics` |
| 16 | **Workflow & Orchestration** | PC-17 | Orchestration | P1 | gates publish/issue across Learning/Assessment/Cert; emits `workflow.transition` | `/workflows`, `/automation-rules`, `/locales` |
| 17 | **Extensibility** | PC-18 | Extensibility | P1 | global `extension_points` (read), tenant `extension_registrations` | `/extension-points`, `/extensions/registrations` |
| — | **Audit / Data Rights** | PC-16 | Audit/Compliance | P0/P1 | append-only hash-chain; emits `data.*` | `/audit`, `/exports`, `/deletion-requests` |
| — | **Eventing** | PC-14 | Eventing | P0 | outbox→worker relay; no direct user write | internal only (`/internal/outbox` worker, not a public surface) |
| — | **FundedBeyond app-layer** | FB-1/2/5 | FB app layer | P1 | consumes generic engines only; emits `attribution.token_created` | `/diagnostic`, `/readiness-policy`, `/cta` |

---

## SECTION 3 — Complete API Inventory (Phase 0 + Phase 1)

Convention for each entry: **Endpoint · Method · Purpose · Permission · Ownership · Relationship · Entitlement · Audit.** "—" = none. "self" = ownership against the actor's `membership_id`. "bypass(admin)" = owner/admin context grants bypass ownership within-tenant, audited on sensitive targets. Routes are tenant-scoped under the resolved host unless prefixed `/api/v1/platform`. Public routes are in **Section 4**; platform routes are in **Section 5**.

> All routes inherit the §2.1 pipeline (host → tenant-state → auth → membership gate → `withTenantTx` → `enforceEntitlement` → `can` → handler). Only deltas from that baseline are listed per entry.

### 3.0 Eventing & health (Phase 0, internal/operational)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/health` | GET | Liveness/readiness probe | public (no tenant) | — | — | — | — |
| `/api/v1/internal/outbox/relay` | POST | Worker relays outbox batch (worker auth, `atlas_worker`) | internal | — | — | — | — |
| `/api/v1/internal/outbox/dead-letter/:id/replay` | POST | Replay a dead-lettered event | `platform.tenant.manage` (platform) | — | — | — | Required |

> The outbox is written **in the same transaction** as the source write by each owning context; it is never a user-facing "emit event" endpoint. The relay worker is the only consumer surface.

### 3.1 Tenancy & Provisioning (PC-1)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/domains` | GET | List tenant domains + verification state | `tenancy.domain.read` | — | — | — | — |
| `/api/v1/domains` | POST | Add custom domain / set primary | `tenancy.domain.manage` | — | — | `branding.custom_domain.enable` (custom only) | Required |
| `/api/v1/domains/:id` | DELETE | Disable a domain | `tenancy.domain.manage` | — | — | — | Required |
| `/api/v1/provisioning/jobs` | GET | View provisioning jobs/status for this tenant | `tenancy.provisioning.read` | — | — | — | — |

> Tenant **creation** is a platform action (§5). These tenant-facing routes manage domains/visibility only; `tenants` is GLOBAL and never written by tenant code (Database Design v2 §6.2).

### 3.2 Identity, Session & Membership (PC-2)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/auth/session` | GET | Resolve current membership context for host tenant | authenticated (membership gate) | — | — | — | — |
| `/api/v1/auth/logout` | POST | Revoke session (Redis revocation list) | authenticated | — | — | — | Required (`identity.login` family) |
| `/api/v1/me` | GET | Current member identity (membership + profile) | authenticated | self | — | — | — |
| `/api/v1/me/profile` | GET | Read own profile | `profile.read` | self | — | — | — |
| `/api/v1/me/profile` | PUT | Update own profile | `profile.update` | self (`member_profiles.membership_id`) | — | — | — |
| `/api/v1/members` | GET | List/inspect tenant memberships | `membership.read` | — | — | — | — |
| `/api/v1/members/:id` | GET | Inspect a membership | `membership.read` | — | — | — | — |
| `/api/v1/members/:id/profile` | GET | Read a member profile (visibility-scoped) | `profile.read` | — | — | — | — |
| `/api/v1/members/:id/profile` | PUT | Edit any profile (admin) | `profile.update` + `membership.read` | bypass(admin) | — | — | Required |
| `/api/v1/members/invite` | POST | Invite a principal into the tenant | `membership.invite` | — | — | — | Required (`identity.membership.*`) |
| `/api/v1/members/:id/suspend` | POST | Suspend a membership | `membership.suspend` | — | owner-guard (target ≠ owner) | — | Required |
| `/api/v1/members/:id` | DELETE | Remove a membership | `membership.remove` | — | owner-guard | — | Required |

### 3.3 Access Control (PC-3)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/roles` | GET | View roles + their permissions | `role.read` | — | — | — | — |
| `/api/v1/roles` | POST | Create a custom tenant role | `role.create` | — | no-grant-up | — | Required (`access.role.*`) |
| `/api/v1/roles/:id` | PUT | Edit a role's permission set | `role.update` | — | no-grant-up, not-owner-role | — | Required |
| `/api/v1/roles/:id` | DELETE | Delete a custom role | `role.delete` | — | not-owner-role | — | Required |
| `/api/v1/members/:id/roles` | POST | Assign a role to a membership | `role.assign` | — | no-grant-up, cannot-assign-owner | — | Required (`access.role.assigned`) |
| `/api/v1/members/:id/roles/:roleId` | DELETE | Revoke a role | `role.revoke` | — | rank-guard (admin ≠ revoke owner) | — | Required (`access.role.revoked`) |
| `/api/v1/permission-overrides` | GET | List explicit allow/deny overrides | `role.read` | — | — | — | — |
| `/api/v1/permission-overrides` | POST | Create an allow/deny override | `permission_override.manage` | — | no-grant-up | — | Required (`access.override.set`) |
| `/api/v1/permission-overrides/:id` | DELETE | Remove an override | `permission_override.manage` | — | no-grant-up | — | Required (`access.override.removed`) |

### 3.4 Branding & Theme (PC-4)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/branding` | GET | View branding/theme config + versions | `branding.read` | — | — | — | — |
| `/api/v1/branding` | PUT | Edit branding draft | `branding.update` | — | — | — | — |
| `/api/v1/theme` | PUT | Edit theme tokens draft | `branding.update` | — | — | — | — |
| `/api/v1/branding/publish` | POST | Publish branding/theme version | `branding.publish` | — | — | — | Required (`config.branding.published`) |
| `/api/v1/branding/versions` | GET | List branding/theme version history | `branding.read` | — | — | — | — |

### 3.5 Configuration, Flags & Entitlements (read) (PC-4)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/config` | GET | View tenant runtime config | `config.read` | — | — | — | — |
| `/api/v1/config` | PUT | Edit config draft | `config.update` | — | — | — | — |
| `/api/v1/config/publish` | POST | Publish a config version | `config.publish` | — | — | — | Required (`config.config.published`) |
| `/api/v1/feature-flags` | GET | View effective flag values | `feature_flag.read` | — | — | — | — |
| `/api/v1/feature-flags/:key` | PUT | Set a tenant flag override | `feature_flag.override` | — | — | — | Required (`config.feature_flag.changed`) |
| `/api/v1/entitlements` | GET | View own tenant entitlements (read-only) | `entitlement.read` | — | — | — | — |

> Entitlement **changes** are platform-only (§5). Tenants can read but never grant their own entitlements (Permission Matrix §9.3).

### 3.6 Learning (PC-5)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/courses` | GET | List courses (published for learner; own for instructor; all for admin) | `course.read` | learner: enrolled/published | instructor: course-instructor | — | — |
| `/api/v1/courses/:id` | GET | Read a course | `course.read` | — | — | — | — |
| `/api/v1/courses` | POST | Create a course | `course.create` | — | — | — | — |
| `/api/v1/courses/:id` | PUT | Edit a course | `course.update` | `courses.created_by_membership_id` / bypass(admin) | course-instructor | — | — |
| `/api/v1/courses/:id` | DELETE | Soft-delete a course | `course.delete` | same | course-instructor | — | Required |
| `/api/v1/courses/:id/publish` | POST | Publish/unpublish a course | `course.publish` | — | course-instructor + workflow gate | — | Required (`workflow.transition` if gated; `course.published` event) |
| `/api/v1/courses/:id/modules` | GET/POST | List/create modules | `course.read` / `course.update` | (parent course) | course-instructor | — | POST: — |
| `/api/v1/modules/:id` | PUT/DELETE | Edit/soft-delete a module | `course.update` / `course.delete` | parent course owner / bypass(admin) | course-instructor | — | DELETE: Required |
| `/api/v1/modules/:id/lessons` | GET/POST | List/create lessons | `course.read` / `course.update` | parent | course-instructor | — | — |
| `/api/v1/lessons/:id` | GET/PUT/DELETE | Read/edit/soft-delete a lesson | `course.read` / `course.update` / `course.delete` | parent course owner / bypass(admin) | course-instructor | — | DELETE: Required |
| `/api/v1/lessons/:id/assets` | GET/POST/DELETE | Manage lesson assets (R2/video refs) | `course.read` / `course.update` | parent | course-instructor | — | — |
| `/api/v1/lessons/:id/progress` | POST | Record lesson progress / completion | `progress.read` (write own) | self | — | — | — (emits `lesson.completed`) |
| `/api/v1/enrollments` | GET | View enrollments | `enrollment.read` | learner: self | instructor: course-instructor | — | — |
| `/api/v1/enrollments` | POST | Enroll (self for learner; others for admin) | `enrollment.create` | self / bypass(admin) | — | — | — |
| `/api/v1/enrollments/:id` | PUT/DELETE | Manage/transfer/cancel enrollment | `enrollment.manage` | — | course-instructor | — | — |
| `/api/v1/courses/:id/progress` | GET | View progress for a course | `progress.read` | learner: self | course-instructor | — | — |
| `/api/v1/learning-paths` | GET | Read learning paths / roadmaps | `learning_path.read` | — | — | — | — |
| `/api/v1/learning-paths/:id` | GET | Read a path + steps + gates | `learning_path.read` | — | — | — | — |
| `/api/v1/learning-paths` | POST | Create a learning path | `learning_path.create` | — | — | — | — |
| `/api/v1/learning-paths/:id` | PUT | Edit path steps + gates | `learning_path.update` | author / bypass(admin) | course-instructor | — | — |
| `/api/v1/learning-paths/:id` | DELETE | Soft-delete a path | `learning_path.delete` | same | course-instructor | — | Required |
| `/api/v1/learning-paths/:id/publish` | POST | Publish a path | `learning_path.publish` | — | course-instructor + workflow gate | — | Required (`workflow.transition` if gated) |
| `/api/v1/learning-paths/:id/enroll` | POST | Enroll self into a path | `enrollment.create` | self | — | — | — |
| `/api/v1/learning-paths/:id/progress` | GET | View path-step progress | `progress.read` | learner: self | course-instructor | — | — (emits `path.step_completed`) |

### 3.7 Assessment + Item Registry (PC-6)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/item-types` | GET | Read global item-type catalogue (incl. `swipe`) | `extension.point.read` (catalogue read via grant) | — | — | — | — |
| `/api/v1/items` | GET | Read items / item bank | `item.read` | — | — | — | — |
| `/api/v1/items` | POST | Create an item (any registered type) | `item.create` | — | — | — | — |
| `/api/v1/items/:id` | PUT | Edit item + options + dimension weights | `item.update` | `items.created_by_membership_id` / bypass(admin) | — | — | — |
| `/api/v1/items/:id` | DELETE | Soft-delete an item | `item.delete` | same | — | — | Required |
| `/api/v1/items/:id/dimension-weights` | GET/PUT | Read/set generic dimension tagging | `item.read` / `item.update` | item author / bypass(admin) | — | — | — |
| `/api/v1/item-collections` | GET/POST | List/create decks, quiz banks, practice sets (incl. swipe deck) | `item.read` / `item_collection.manage` | — | — | — | — |
| `/api/v1/item-collections/:id` | PUT/DELETE | Edit/soft-delete a collection | `item_collection.manage` | — | — | — | DELETE: Required |
| `/api/v1/item-collections/:id/items` | POST/DELETE | Compose collection membership | `item_collection.manage` | — | — | — | — |
| `/api/v1/assessments` | GET | Read assessments | `assessment.read` | — | — | — | — |
| `/api/v1/assessments/:id` | GET | Read an assessment + composition | `assessment.read` | — | — | — | — |
| `/api/v1/assessments` | POST | Create quiz/exam/diagnostic/readiness_review | `assessment.create` | — | — | — | — |
| `/api/v1/assessments/:id` | PUT | Edit composition + config | `assessment.update` | author / bypass(admin) | assessment-author | — | — |
| `/api/v1/assessments/:id` | DELETE | Soft-delete an assessment | `assessment.delete` | same | assessment-author | — | Required |
| `/api/v1/assessments/:id/publish` | POST | Publish an assessment | `assessment.publish` | — | assessment-author + workflow gate | — | Required (`workflow.transition` if gated) |
| `/api/v1/assessments/:id/attempts` | POST | Start an attempt | `attempt.start` | self | — | — | — (emits `assessment.started`) |
| `/api/v1/attempts/:id` | GET | Read an attempt | `attempt.read` | `attempts.membership_id` (learner) | grading-assignee / course-instructor | — | — |
| `/api/v1/attempts/:id/answers` | POST | Submit an answer (idempotent) | `attempt.submit` | `attempts.membership_id` | — | — | — |
| `/api/v1/attempts/:id/submit` | POST | Finalize an attempt (idempotent) | `attempt.submit` | `attempts.membership_id` | — | — | — (emits `assessment.submitted`) |
| `/api/v1/grading-tasks` | GET | List grading queue | `assessment.grade` | — | grading-assignee / bypass(admin) | — | — |
| `/api/v1/grading-tasks/:id/grade` | POST | Grade a subjective attempt | `assessment.grade` | — | `grading_tasks.assigned_to_membership_id` / bypass(admin) | — | Required (`assessment.graded` event; grade-change audit) |
| `/api/v1/practice-sessions` | POST | Start a swipe/drill/review session | `practice.start` | self | — | — | — |
| `/api/v1/practice-sessions/:id/responses` | POST | Record a swipe/practice response (idempotent) | `practice.start` | self | — | — | — |
| `/api/v1/practice-sessions/:id/complete` | POST | Complete a session | `practice.start` | self | — | — | — (emits `practice.session_completed`) |
| `/api/v1/me/srs/due` | GET | Read own spaced-repetition due items | `practice.start` | self (`srs_state.membership_id`) | — | — | — |

> Item-type *registration* of a new renderer (e.g. swipe) is an extensibility action (§3.17), **not** an Assessment-core edit — this is the no-fork resolution of Inversions 1 & 3 (Permission Matrix §4.7 note). `swipe` is seeded into the global `item_types` catalogue (Database Design v2 §18.1), so authoring swipe items uses ordinary `item.create`.

### 3.8 Competency & Scoring (PC-7)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/competency-dimensions` | GET | Read dimensions (TA/PSY/RISK/DISC/CR are tenant config) | `competency.dimension.read` | — | — | — | — |
| `/api/v1/competency-dimensions` | POST/PUT/DELETE | Manage dimensions | `competency.dimension.manage` | — | — | — | Required (sensitive config) |
| `/api/v1/scoring-profiles` | GET | Read scoring profiles | `scoring_profile.read` | — | — | — | — |
| `/api/v1/scoring-profiles` | POST | Create a scoring profile | `scoring_profile.create` | — | — | — | Required |
| `/api/v1/scoring-profiles/:id` | PUT | Edit a scoring profile | `scoring_profile.update` | — | — | — | Required |
| `/api/v1/scoring-profiles/:id/bands` | GET/PUT | Read/define band thresholds + labels | `scoring_profile.read` / `competency.band.manage` | — | — | — | PUT: Required |
| `/api/v1/scoring-config/:id/publish` | POST | Publish a versioned scoring config | `scoring_config.publish` | — | — | — | Required (versioned, append-only) |
| `/api/v1/me/competency` | GET | Read own scores + readiness | `competency.score.read` | self | — | — | — |
| `/api/v1/me/competency/history` | GET | Read own score trajectory snapshots | `competency.score.read` | self | — | — | — |
| `/api/v1/members/:id/competency` | GET | Read a learner's scores | `competency.score.read` | bypass(admin) | course-instructor | — | — |
| `/api/v1/competency-signals` | GET | Read raw signals (admin/analytics) | `competency.signal.read` | — | — | — | — |

> There is **no** `competency.signal.create` route. Signals are emitted by engines through the outbox (`competency.signal_recorded`); only the scoring context computes `competency_scores` / `composite_readiness_state` and emits `competency.score_changed` / `readiness.band_changed` (Permission Matrix §4.8 note, Database Design v2 §3).

### 3.9 Certification (PC-8)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/certificate-templates` | GET | Read templates | `certificate_template.read` | — | — | `certification.enable` | — |
| `/api/v1/certificate-templates` | POST/PUT/DELETE | Manage templates | `certificate_template.manage` | — | — | `certification.enable` | DELETE: Required |
| `/api/v1/certificate-templates/:id/publish` | POST | Publish a template | `certificate_template.publish` | — | — | `certification.enable` | Required |
| `/api/v1/certificates` | GET | Read certificates (own for learner; all for admin) | `certificate.read` | learner: self | course-instructor | `certification.enable` | — |
| `/api/v1/certificates/issue` | POST | Manually issue a certificate (normally automation-driven) | `certificate.issue` | — | course-instructor + workflow gate | `certification.enable` | Required (`credential.issued`) |
| `/api/v1/certificates/:id/revoke` | POST | Revoke an issued certificate | `certificate.revoke` | — | — | `certification.enable` | Required (`credential.revoked`) |

> Public certificate **verification** is in Section 4 (no tenant permission, logs `credential_verifications`).

### 3.10 Gamification (PC-9)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/me/gamification` | GET | Read own XP/level/streak profile | `gamification.profile.read` | self | — | `gamification.enable` | — |
| `/api/v1/members/:id/gamification` | GET | Read a learner's profile | `gamification.profile.read` | bypass(admin) | course-instructor | `gamification.enable` | — |
| `/api/v1/badges` | GET | Read badge definitions/awards | `badge.read` | — | — | `gamification.enable` | — |
| `/api/v1/badges` | POST/PUT | Manage badge definitions; manual award | `badge.manage` | — | — | `gamification.enable` | Required (manual award) |
| `/api/v1/leaderboards` | GET | List leaderboards | `leaderboard.read` | — | — | `gamification.enable` | — |
| `/api/v1/leaderboards/:id` | GET | Read a leaderboard (Redis hot path, Postgres source) | `leaderboard.read` | — | — | `gamification.enable` | — |
| `/api/v1/leaderboards` | POST/PUT | Configure leaderboards | `leaderboard.manage` | — | — | `gamification.enable` | — |
| `/api/v1/me/streaks` | GET | Read own streaks | `gamification.profile.read` | self | — | `gamification.enable` | — |
| `/api/v1/me/streaks/:key/freeze` | POST | Use a streak freeze | `gamification.profile.read` (own write) | self | — | `gamification.enable` | — |

> `point_ledger` and `badge_awards` (event-driven) are append-only and written by engines via events, not user writes (Permission Matrix §4.10). Emits `badge.awarded`, `streak.updated`.

### 3.11 Community & Moderation (PC-11)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/spaces` | GET | List spaces (visibility-scoped) | `community.space.read` | — | space-member (private/unlisted) | `community.enable` (+`community.private_spaces.enable`) | — |
| `/api/v1/spaces` | POST/PUT/DELETE | Manage spaces | `community.space.manage` | — | — | `community.enable` | DELETE: Required |
| `/api/v1/spaces/:id/join` | POST | Join a space | `community.space.join` | self | — | `community.enable` | — |
| `/api/v1/spaces/:id/posts` | GET | Read posts in a space | `post.read` | — | space-member (private/unlisted) | `community.enable` | — |
| `/api/v1/spaces/:id/posts` | POST | Create a post | `post.create` | — | space-member | `community.enable` | — (emits `community.post_created`) |
| `/api/v1/posts/:id` | PUT | Edit a post | `post.update` | `posts.author_membership_id` / bypass(moderate) | — | `community.enable` | — |
| `/api/v1/posts/:id` | DELETE | Delete a post | `post.delete` | `posts.author_membership_id` | `community.moderate` (any) | `community.enable` | Required (moderate path) |
| `/api/v1/posts/:id/comments` | GET/POST | Read/create comments | `post.read` / `comment.create` | — | space-member | `community.enable` | — |
| `/api/v1/comments/:id` | PUT/DELETE | Edit/delete a comment | `comment.update` / `comment.delete` | `comments.author_membership_id` / bypass(moderate) | `community.moderate` (any) | `community.enable` | DELETE moderate: Required |
| `/api/v1/reactions` | POST/DELETE | React/unreact to post/comment | `reaction.create` | self | — | `community.enable` | — |
| `/api/v1/moderation/cases` | GET/POST | List/open moderation cases | `community.moderate` | — | — | `community.enable` | POST: Required (`moderation.case_opened`) |
| `/api/v1/moderation/cases/:id/decide` | POST | Decide a moderation case | `community.moderate` | — | — | `community.enable` | Required (`community.moderation.decided`) |
| `/api/v1/appeals` | POST | Submit an appeal (own case) | `appeal.create` | `appeals.submitted_by_membership_id` | — | `community.enable` | Required |
| `/api/v1/appeals/:id/review` | POST | Review/decide an appeal | `appeal.review` | — | `community.moderate` | `community.enable` | Required (`community.moderation.decided`) |

### 3.12 Notifications (PC-14)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/notification-templates` | GET | Read templates | `notification.template.read` | — | — | — | — |
| `/api/v1/notification-templates` | POST/PUT/DELETE | Manage templates | `notification.template.manage` | — | — | — | — |
| `/api/v1/me/notifications` | GET | Read own in-app notifications | `notification.read.self` | self | — | — | — |
| `/api/v1/me/notifications/:id/read` | POST | Mark a notification read | `notification.read.self` | self | — | — | — |

> No user "send" route. `notification_dispatches` are written idempotently by the worker tier as a side effect of automation/workflow (`notification.queued` event).

### 3.13 Search (PC-14)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/search` | GET | Query tenant index (RLS + visibility scoped) | `search.query` | — | visibility/space-member | — | — |
| `/api/v1/search/reindex` | POST | Trigger/administer reindex job | `search.reindex.manage` | — | — | — | — |

### 3.14 Analytics & Data Rights (PC-15 / PC-16)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/analytics/dashboards` | GET | View advanced dashboards | `analytics.dashboard.view` | — | instructor: course-relationship | `analytics.dashboard.view` | — |
| `/api/v1/analytics/funnel` | GET | View funnel rollups | `analytics.funnel.view` | — | — | `analytics.dashboard.view` | — |
| `/api/v1/analytics/item-statistics` | GET | View assessment item statistics | `analytics.dashboard.view` | — | assessment-author | `analytics.dashboard.view` | — |
| `/api/v1/exports` | GET/POST | List/run a tenant data-export job | `data.export.run` | — | — | `data.export.enable` (policy always-on) | POST: Required (`data.export.requested`) |
| `/api/v1/exports/:id` | GET | Poll an export job + signed download | `data.export.run` | — | — | `data.export.enable` | — |
| `/api/v1/deletion-requests` | GET/POST | List/file a deletion request | `data.deletion.request` | self (learner) / any(admin) | — | — | POST: Required (`data.deletion.requested`) |
| `/api/v1/deletion-requests/:id/process` | POST | Approve/process a deletion request | `data.deletion.manage` | — | — | — | Required |
| `/api/v1/audit` | GET | Read tenant-scoped audit log | `audit.read` | — | — | — | — |

### 3.15 Workflow & Orchestration (PC-17)

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/workflows` | GET | Read workflow definitions | `workflow.definition.read` | — | — | — | — |
| `/api/v1/workflows` | POST/PUT | Manage workflow definitions | `workflow.definition.manage` | — | — | — | — |
| `/api/v1/workflows/:id/transition` | POST | Approve/reject a review→publish transition (the human gate) | `workflow.transition.act` | — | workflow-approver (moderator: moderation workflows only) | — | Required (`workflow.transition`) |
| `/api/v1/automation-rules` | GET | Read automation rules | `automation.rule.read` | — | — | — | — |
| `/api/v1/automation-rules` | POST/PUT/DELETE | Manage automation rules | `automation.rule.manage` | — | — | — | — |
| `/api/v1/locales` | GET | Read locale resources | `locale.read` | — | — | — | — |
| `/api/v1/locales/:locale` | PUT | Edit locale resources | `locale.manage` | — | — | — | — |

### 3.16 Extensibility (PC-18) — first-party only

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/extension-points` | GET | Read global extension-point catalogue | `extension.point.read` | — | — | — | — |
| `/api/v1/extensions/registrations` | GET | Read tenant extension registrations | `extension.registration.read` | — | — | — | — |
| `/api/v1/extensions/registrations` | POST/PUT/DELETE | Register/configure first-party extensions (e.g. swipe renderer, lesson-completed hook) | `extension.registration.manage` | — | — | — | Required (sensitive config) |

> Third-party SDK / sandbox / signing / marketplace stay Phase 4; no endpoints for them exist here.

### 3.17 FundedBeyond app-layer (FB-1/2/5) — generic config, no fork

See **Section 9** for full detail. Generic surface entries:

| Endpoint | Method | Purpose | Permission | Own | Rel | Entitlement | Audit |
|---|---|---|---|---|---|---|---|
| `/api/v1/diagnostic/start` | POST | Start a diagnostic session (authenticated variant) | `diagnostic.start` | self | — | — | — |
| `/api/v1/diagnostic/:id/result` | GET | Read own diagnostic scorecard + band | `diagnostic.start` (own read) / `competency.score.read` | self | — | — | — |
| `/api/v1/readiness-policy` | GET | Read readiness CTA policy | `readiness_policy.read` | — | — | — | — |
| `/api/v1/readiness-policy` | PUT | Configure readiness CTA policy + legal copy | `readiness_policy.manage` | — | — | — | Required (`readiness policy changes`) |
| `/api/v1/cta/attribution-token` | POST | Mint an outbound attributed CTA token (side-effect of an authorized readiness CTA) | `readiness_policy.read` (system-minted) | self/anon | — | — | Required (`attribution.token_created`) |

---

## SECTION 4 — Public APIs

Public routes are the **only** routes that may run without an active membership (Permission Matrix §8.4). Every one still resolves `app.tenant_id` from host and runs under tenant RLS. No public route ever uses tenant-admin privilege.

| Endpoint | Method | Purpose | Auth | Rate limiting | Abuse controls |
|---|---|---|---|---|---|
| `/api/v1/public/landing/:slug` | GET | Public academy landing page content | none | per-IP-hash + per-host | cache; no PII; read-only projection |
| `/api/v1/public/diagnostic/start` | POST | Start the free, unauthenticated diagnostic | none (anonymous) | tightest per-IP-hash bucket | stores `anonymous_id`, `ip_hash`, `user_agent_hash` only; never raw IP/device; anonymous→account merge token |
| `/api/v1/public/diagnostic/:anonId/result` | GET | Read anonymous diagnostic scorecard | anonymous session token | per-IP-hash | session-token bound; expires; no enumeration of others' sessions |
| `/api/v1/public/verify/:credentialId` | GET | Verify a certificate | none | per-IP-hash | resolves by `credential_id`; minimal public projection; logs `credential_verifications`; no tenant-admin privilege |
| `/api/v1/public/auth/login` | POST | Login (Supabase Auth) | none | per-IP-hash + per-email-hash | lockout/backoff; MFA challenge for admins; revocation list |
| `/api/v1/public/auth/signup` | POST | Signup | none | per-IP-hash | email verification; bot/abuse heuristics |
| `/api/v1/public/invitations/accept` | POST | Accept an invitation → creates `ACTIVE` membership | invite token | per-token | single-use token; `INVITED`→`ACTIVE` only; audited (`identity.membership.*`) |

**Cross-cutting public-route rules:**
- Host resolution and tenant-state gate still apply: a `SUSPENDED`/`ARCHIVED`/`DELETED` tenant returns `503`/`404` (Permission Matrix §8.2).
- A `401` is returned only where authentication is *attempted and fails*; truly public reads never demand auth.
- The anonymous diagnostic is the highest-abuse surface and carries its own dedicated bucket + merge model (roadmap §12).

---

## SECTION 5 — Platform APIs (`/api/v1/platform/**`)

Platform routes replace steps 3–8 of the pipeline with: authenticate principal → assert `platform.*` permission → `withPlatformScope(ctx, reason, fn)` on the `atlas_platform` role → set `app.platform_scope='true'` and resolve `app.tenant_id` when touching a tenant. **Every** platform route requires a reason ≥ 10 chars and writes `platform.scope.enter` / `platform.scope.exit` audit (Permission Matrix §10). No tenant session can reach these.

| Endpoint | Method | Purpose | Platform permission | Platform scope | Audit |
|---|---|---|---|---|---|
| `/api/v1/platform/tenants` | GET | List/inspect tenants + provisioning state | `platform.tenant.read` | enter/exit + reason | Required |
| `/api/v1/platform/tenants` | POST | Create a tenant (drives provisioning saga; idempotent) | `platform.tenant.manage` | enter/exit + reason | Required (`tenant.created` event) |
| `/api/v1/platform/tenants/:id` | GET | Inspect one tenant | `platform.tenant.read` | enter/exit + reason | Required |
| `/api/v1/platform/tenants/:id/suspend` | POST | Suspend a tenant | `platform.tenant.manage` | enter/exit + reason | Required (`tenant.state_changed`) |
| `/api/v1/platform/tenants/:id/resume` | POST | Resume a suspended tenant | `platform.tenant.manage` | enter/exit + reason | Required (`tenant.state_changed`) |
| `/api/v1/platform/tenants/:id/archive` | POST | Archive a tenant | `platform.tenant.manage` | enter/exit + reason | Required (`tenant.state_changed`) |
| `/api/v1/platform/tenants/:id/provisioning` | GET | Inspect provisioning jobs/saga state | `platform.tenant.read` | enter/exit + reason | Required |
| `/api/v1/platform/tenants/:id/entitlements` | GET/PUT | Read/grant/modify tenant entitlements | `platform.entitlement.manage` | enter/exit + reason | Required (`config.entitlement.changed` + `entitlement_grant_history`) |
| `/api/v1/platform/feature-flags` | GET/POST/PUT | Manage global flag catalogue + defaults | `platform.feature_flag.manage` | enter/exit + reason | Required |
| `/api/v1/platform/catalog/permissions` | GET/POST | Manage global permission catalogue | `platform.catalog.manage` | enter/exit + reason | Required |
| `/api/v1/platform/catalog/item-types` | GET/POST | Manage global item-type registry | `platform.catalog.manage` | enter/exit + reason | Required |
| `/api/v1/platform/catalog/extension-points` | GET/POST | Manage global extension-point catalogue | `platform.catalog.manage` | enter/exit + reason | Required |
| `/api/v1/platform/audit` | GET | Read cross-tenant / global audit stream | `platform.audit.read` | enter/exit + reason | Required |
| `/api/v1/platform/support/sessions` | POST | Open a reason-bound, time-boxed support session into one tenant | `platform.support.access` | enter/exit + reason (per incident) | Required (every tenant touched recorded) |

**Hard rules (CI-enforced, Permission Matrix §10.3 / §16):** a tenant (`atlas_app`) request setting `app.platform_scope` is rejected; the `platformPrisma` client is never shared with tenant routes; no `platform.*` permission appears in any tenant `roles`/`user_roles`; a platform route lacking enter/exit audit fails the build.

---

## SECTION 6 — Tenant Admin APIs (owner / admin view)

These are the Section 3 routes filtered to the owner/admin surface (full authority within the tenant, bounded by entitlements + no-grant-up + owner rank-guard). Authoritative attributes live in Section 3; this is the persona index.

- **Members:** `GET /members`, `GET /members/:id`, `POST /members/invite`, `POST /members/:id/suspend`, `DELETE /members/:id` (owner-guard), `PUT /members/:id/profile` (bypass admin).
- **Roles:** `GET/POST /roles`, `PUT/DELETE /roles/:id` (no-grant-up, not-owner-role), `POST /members/:id/roles` (cannot-assign-owner), `DELETE /members/:id/roles/:roleId` (rank-guard), `POST/DELETE /permission-overrides` (no-grant-up).
- **Branding:** `GET/PUT /branding`, `PUT /theme`, `POST /branding/publish`, `GET /branding/versions`.
- **Domains:** `GET/POST /domains` (`branding.custom_domain.enable` for custom), `DELETE /domains/:id`.
- **Configuration:** `GET/PUT /config`, `POST /config/publish`, `GET /feature-flags`, `PUT /feature-flags/:key`, `GET /entitlements` (read-only).
- **Learning:** full `/courses`, `/modules`, `/lessons`, `/learning-paths`, `/enrollments` (admin bypass ownership/relationship within tenant).
- **Assessments:** full `/items`, `/item-collections`, `/assessments`, `/grading-tasks`.
- **Competency:** `/competency-dimensions` manage, `/scoring-profiles`, `/scoring-config/:id/publish`, `/scoring-profiles/:id/bands`, `GET /members/:id/competency`.
- **Certificates:** `/certificate-templates` manage/publish, `POST /certificates/issue`, `POST /certificates/:id/revoke` (`certification.enable`).
- **Community:** `/spaces` manage, `/moderation/cases`, `/appeals/:id/review` (admin holds `community.moderate`).
- **Analytics:** `GET /analytics/dashboards`, `/analytics/funnel`, `/analytics/item-statistics` (`analytics.dashboard.view` entitlement).
- **Data rights & audit:** `GET/POST /exports`, `GET/POST /deletion-requests`, `POST /deletion-requests/:id/process`, `GET /audit`.
- **Orchestration:** `/workflows`, `/automation-rules`, `/locales`, `/extensions/registrations`, `PUT /readiness-policy`.

Owner-only deltas over admin: assign/revoke `admin`, edit the `owner` system role, manage `permission_overrides` broadly, request export/deletion of the whole tenant, read full tenant audit (Permission Matrix §3.2).

## SECTION 7 — Instructor APIs

Instructors author and deliver; every write is ownership- or relationship-constrained inside `can()` (Permission Matrix §5/§6/§7). No member/role/branding/config/moderation/platform access.

- **Authoring (own/teaching only):** `POST /courses`, `PUT/DELETE /courses/:id` (`courses.created_by_membership_id`), `POST /courses/:id/publish` (course-instructor + workflow gate), module/lesson/asset writes under owned courses, `POST /learning-paths`, `PUT/DELETE /learning-paths/:id`, `POST /learning-paths/:id/publish`.
- **Item & assessment authoring:** `POST /items`, `PUT/DELETE /items/:id` (`items.created_by_membership_id`), `POST /item-collections` + composition, `POST /assessments`, `PUT/DELETE /assessments/:id` (assessment-author), `POST /assessments/:id/publish` (author + workflow gate).
- **Grading:** `GET /grading-tasks`, `POST /grading-tasks/:id/grade` (assigned-grader relationship).
- **Delivery oversight (relationship-scoped):** `GET /courses/:id/progress`, `GET /enrollments` (course-instructor), `PUT/DELETE /enrollments/:id` (manage), `GET /attempts/:id` (course-instructor/grading-assignee), `GET /members/:id/competency` (learners in their course/path), `GET /analytics/dashboards` (relationship-scoped, entitlement-gated).
- **Issuance (gated):** `POST /certificates/issue` (instructor path: course/program relationship + workflow gate).
- **Read-only platform-of-tenant config:** `GET` on `/competency-dimensions`, `/scoring-profiles`, `/certificate-templates`, `/workflows`, `/automation-rules`, `/extension-points`, `/extensions/registrations`, `/readiness-policy` (read), `/locales`.

Instructor is denied all `O/—` cells for resources they neither own nor teach → `OWNERSHIP_DENIED` / `RELATIONSHIP_DENIED`.

## SECTION 8 — Learner APIs

Learners consume; writes are own-resource only (ownership-gated). Default role for new members.

- **Discovery & enrollment:** `GET /courses` (published/enrolled), `GET /courses/:id`, `GET /learning-paths`, `POST /enrollments` (self), `POST /learning-paths/:id/enroll` (self).
- **Consumption & progress:** `GET /lessons/:id`, `POST /lessons/:id/progress` (self), `GET /courses/:id/progress` (self), `GET /learning-paths/:id/progress` (self).
- **Assessment & practice:** `POST /assessments/:id/attempts` (self), `POST /attempts/:id/answers` + `POST /attempts/:id/submit` (own attempt), `GET /attempts/:id` (own), `POST /practice-sessions` + `/responses` + `/complete` (self), `GET /me/srs/due`.
- **Competency & readiness:** `GET /me/competency`, `GET /me/competency/history`, `POST /diagnostic/start`, `GET /diagnostic/:id/result` (own), `GET /readiness-policy` (read), `POST /cta/attribution-token` (own, system-minted).
- **Credentials & engagement:** `GET /certificates` (own), `GET /me/gamification`, `GET /badges`, `GET /leaderboards/:id`, `GET /me/streaks`, `POST /me/streaks/:key/freeze`.
- **Community:** `GET /spaces` (visibility), `POST /spaces/:id/join`, `GET/POST /spaces/:id/posts` (space-member), `PUT/DELETE /posts/:id` (own), comments/reactions (own), `POST /appeals` (own case).
- **Self-service:** `GET/PUT /me/profile` (own), `GET /me/notifications` + mark-read, `GET /search`, `POST /deletion-requests` (own data).

Every learner read of another user's attempt/score/progress/cert/profile returns `OWNERSHIP_DENIED`; cross-tenant returns `NO_MEMBERSHIP`/RLS-empty (never existence-revealing).

---

## SECTION 9 — FundedBeyond APIs (generic engines only, no fork)

FundedBeyond is Tenant #1. Its flagship surfaces are **configuration on generic Atlas engines**, exactly as the Corrected Roadmap requires. Each feature below names the generic engine + tables it rides; the only FB-owned app-layer tables are `diagnostic_sessions`, `readiness_policies`, `attribution_tokens` (Database Design v2 §1.1, FB-1/2/5) — none of which alter a generic engine.

### 9.1 Diagnostic Engine
Rides: Assessment (`assessments` with `assessment_type=diagnostic`) + Competency (`competency_signals` → `competency_scores`/`composite_readiness_state`) + FB `diagnostic_sessions`.

| Endpoint | Method | Purpose | Permission | Entitlement | Audit |
|---|---|---|---|---|---|
| `/api/v1/public/diagnostic/start` | POST | Anonymous free diagnostic start | public `diagnostic.start` variant | — (rate-limited) | — |
| `/api/v1/public/diagnostic/:anonId/result` | GET | Anonymous five-dimension scorecard + band | anonymous-session token | — | — |
| `/api/v1/diagnostic/start` | POST | Authenticated diagnostic start | `diagnostic.start` | — | — |
| `/api/v1/diagnostic/:id/result` | GET | Authenticated scorecard (TA/PSY/RISK/DISC/CR) + band | `diagnostic.start` / `competency.score.read` (self) | — | — |
| `/api/v1/diagnostic/:anonId/merge` | POST | Merge anonymous session into account on signup | invite/merge token | — | Required (anonymous→account merge) |

The diagnostic *is* an assessment attempt; scoring flows through generic signal emission (`competency.signal_recorded` → scoring projection). No diagnostic-specific scoring engine exists.

### 9.2 Swipe Learning
Rides: Assessment item registry (`item_types.swipe`, seeded) + `item_collections` (swipe deck) + `practice_sessions`/`practice_responses` + `srs_state`.

| Endpoint | Method | Purpose | Permission | Entitlement | Audit |
|---|---|---|---|---|---|
| `/api/v1/practice-sessions` | POST | Start a swipe session over a swipe deck | `practice.start` (self) | — | — |
| `/api/v1/practice-sessions/:id/responses` | POST | Record a swipe (idempotent) | `practice.start` (self) | — | — |
| `/api/v1/practice-sessions/:id/complete` | POST | Complete session (emits `practice.session_completed`) | `practice.start` (self) | — | — |
| `/api/v1/me/srs/due` | GET | Due swipe items (spaced repetition) | `practice.start` (self) | — | — |
| `/api/v1/item-collections` (swipe decks) | POST/PUT | Author swipe decks (instructor/admin) | `item_collection.manage` | — | — |
| `/api/v1/items` (swipe items) | POST/PUT | Author swipe items (`item_type_key=swipe`) | `item.create`/`item.update` | — | — |

Swipe responses feed competency through the same outbox signal path as any item — no bespoke pipeline.

### 9.3 Challenge Readiness
Rides: Competency composite (`composite_readiness_state`, `competency_bands`) + FB `readiness_policies` (thin CTA policy) + `attribution_tokens`. Readiness **never blocks** a user; it times the CTA's prominence (FB PRD principle 4 / roadmap §Phase 1 exit).

| Endpoint | Method | Purpose | Permission | Entitlement | Audit |
|---|---|---|---|---|---|
| `/api/v1/me/competency` | GET | Own readiness band + per-dimension scores | `competency.score.read` (self) | — | — |
| `/api/v1/readiness-policy` | GET | Read CTA policy + legal copy | `readiness_policy.read` | — | — |
| `/api/v1/readiness-policy` | PUT | Configure CTA policy + legal copy | `readiness_policy.manage` | — | Required |
| `/api/v1/cta/attribution-token` | POST | Mint signed outbound attributed CTA token (redirect to `fundedbeyond.com`) | `readiness_policy.read` (system-minted side effect) | — | Required (`attribution.token_created`) |

This is the full extent of P1 conversion: **outbound attributed redirect only**. Inbound `challenge.purchased/passed/funded` handshake, simulated readiness review depth, and Challenge Readiness Center are Phase 2 (Integration 27) and are **not** defined here.

### 9.4 Trader Career Roadmap
Rides: Learning Path (`learning_paths`, `path_steps`, `path_step_gates` with `gate_type=competency_band`) + `path_enrollments`/`path_step_progress`. No FB-specific tables.

| Endpoint | Method | Purpose | Permission | Entitlement | Audit |
|---|---|---|---|---|---|
| `/api/v1/learning-paths` (roadmap) | GET | View the trader roadmap (7-stage) | `learning_path.read` | — | — |
| `/api/v1/learning-paths/:id/enroll` | POST | Enroll into the roadmap | `enrollment.create` (self) | — | — |
| `/api/v1/learning-paths/:id/progress` | GET | Roadmap progress with competency-band gates | `progress.read` (self) | — | — |
| `/api/v1/learning-paths` (authoring) | POST/PUT/publish | Author/sequence roadmap stages + gates | `learning_path.*` (instructor/admin) | — | publish: Required if gated |

Stage gates that require a readiness band use the generic `path_step_gates.gate_type=competency_band` — the gate reads `composite_readiness_state`, it does not embed FB logic.

### 9.5 Hall of Fame
Rides generic engines only: Community (`community_spaces` recognition space) + Gamification (`leaderboard_definitions`/`leaderboard_snapshots`) + Certification (verifiable credentials), all consent-gated. **Funded-trader verification is inbound and Phase 2/3** — in P1, Hall of Fame surfaces consented community + leaderboard + certificate data; it does not assert funded status.

| Endpoint | Method | Purpose | Permission | Entitlement | Audit |
|---|---|---|---|---|---|
| `/api/v1/spaces/:id/posts` (HoF space) | GET | Read the recognition space feed | `post.read` (visibility) | `community.enable` | — |
| `/api/v1/leaderboards/:id` (HoF board) | GET | Read recognition leaderboard | `leaderboard.read` | `gamification.enable` | — |
| `/api/v1/public/verify/:credentialId` | GET | Public verify a showcased certification | public | — | logs verification |

No `hall_of_fame` table or endpoint exists; it is a read projection over generic surfaces. Inbound-verified funded status, Funded Trader Program/Group, and AMA cadence are deferred to Phase 3 (roadmap).

---

## SECTION 10 — Event Emitter Map

Every state-changing API that emits an event writes the event to `outbox_events` **in the same transaction** as the write (Database Design v2 §17.3); a worker relays to consumers. No feature writes to a consumer (analytics/search/notification) directly. Event types are exactly the Phase 0/1 set (Database Design v2 §17.2).

| Producer API | Event(s) emitted | Producer context | Consumer(s) | Outbox? |
|---|---|---|---|---|
| `POST /platform/tenants` | `tenant.created` | Tenancy | Provisioning saga, Analytics | Yes |
| `*/tenants/:id/{suspend,resume,archive}` | `tenant.state_changed` | Tenancy | Notification, Analytics | Yes |
| `POST /members/invite`, `accept` | `membership.created` | Identity | Notification, Gamification (profile init), Analytics | Yes |
| `POST /members/:id/suspend`, `DELETE /members/:id` | `membership.status_changed` | Identity | Access (cache revoke), Notification | Yes |
| `POST /members/:id/roles` | `role.assigned` | Access | Permission cache invalidation (Redis), Audit | Yes |
| `POST /permission-overrides`, `PUT /roles/:id` | `permission.changed` | Access | Permission cache invalidation | Yes |
| `PUT /platform/tenants/:id/entitlements` | `entitlement.changed` | Config (platform) | Entitlement cache invalidation, Analytics | Yes |
| `POST /courses/:id/publish` | `course.published` | Learning | Search (index), Notification, Analytics | Yes |
| `POST /lessons/:id/progress` (complete) | `lesson.completed` | Learning | Competency (signal), Gamification, Automation | Yes |
| `GET/compute /learning-paths/:id/progress` (step done) | `path.step_completed` | Learning | Gamification, Automation, Analytics | Yes |
| `POST /assessments/:id/attempts` | `assessment.started` | Assessment | Analytics, Proctoring (L1) | Yes |
| `POST /attempts/:id/submit` | `assessment.submitted` | Assessment | Competency (signal), Automation, Analytics | Yes |
| `POST /grading-tasks/:id/grade` | `assessment.graded` | Assessment | Competency (signal), Certification (auto-issue rule), Notification | Yes |
| `POST /practice-sessions/:id/complete` | `practice.session_completed` | Assessment | Competency (signal), Gamification (streak/XP), Analytics | Yes |
| (engine, via outbox) | `competency.signal_recorded` | Scoring (consumer of above) | Scoring projection worker | Yes |
| Scoring projection | `competency.score_changed` | Scoring | Readiness, Analytics, Notification | Yes |
| Scoring projection | `readiness.band_changed` | Scoring | FB readiness CTA, Notification, Analytics | Yes |
| `POST /certificates/issue` (or auto) | `certificate.issued` | Credentialing | Notification, Gamification, Search, Analytics | Yes |
| (engine) badge criteria met | `badge.awarded` | Engagement | Notification, Analytics | Yes |
| `*/practice` / daily activity | `streak.updated` | Engagement | Notification (nudge via Automation), Analytics | Yes |
| `POST /spaces/:id/posts` | `community.post_created` | Community | Search (index), Notification (mentions), Analytics | Yes |
| `POST /moderation/cases` | `moderation.case_opened` | Moderation | Notification, Analytics | Yes |
| (worker, side effect) | `notification.queued` | Notification | Dispatch worker → `notification_dispatches` | Yes |
| `POST /exports` | `export.requested` | Audit/Compliance | Export worker | Yes |
| `POST /cta/attribution-token` | `attribution.token_created` | FB app-layer | Analytics (funnel), Audit | Yes |

**Invariants:** (1) producer and outbox write share one transaction; (2) consumers are decoupled — adding a consumer never changes a producer; (3) competency signals are **only** produced by engines consuming upstream events, never by user-facing writes (Permission Matrix §4.8); (4) a new event producer that does not write through the outbox fails CI (Database Design v2 §20 gate 15).

---

## SECTION 11 — API Security Review

Each risk maps to the Permission Matrix §14 threat model and the concrete API surfaces above.

### 11.1 IDOR (object-reference tampering)
**Surface:** any `GET/PUT/DELETE /…/:id` carrying another user's or tenant's id (`/attempts/:id`, `/posts/:id`, `/members/:id/competency`, `/certificates`).
**Mitigations:** (1) RLS forces `tenant_id = app.current_tenant_id()` → cross-tenant id returns empty; (2) ownership/relationship resolved **inside** `can()` blocks same-tenant cross-user access; (3) uniform `403`/empty, never existence-revealing `404`-by-id (Permission Matrix §8.2); (4) every tenant-facing endpoint ships an IDOR test (CI gate 11).
**Residual:** none structural, contingent on no handler bypassing `withTenantTx` — enforced by CI gate 5.

### 11.2 Tenant breakout
**Surface:** principal authenticated in Tenant A hitting Tenant B's host on any protected route.
**Mitigations:** host wins over JWT claim; the load-bearing **membership gate** requires `ACTIVE` membership in the host-resolved tenant (M10); RLS independently filters to `app.tenant_id`; transaction-scoped GUC via `set_config(..., true)` prevents pooled-connection bleed (C1/C2); no client-supplied `tenant_id` is ever trusted on writes (§1.2/§1.11).
**Residual:** global-identity ATO blast radius → admin MFA, Redis session/JWT revocation, audit on login/membership/role changes (Permission Matrix §8.3).

### 11.3 Permission bypass
**Surface:** a route shipping without declared `permission`, or ad-hoc `if (role==='admin')` logic.
**Mitigations:** middleware refuses handlers lacking `{permission, entitlement?, resourceLoader?}` metadata; `can()` is the **only** decision point; CI fails routes with no declared permission (gate 1), permission keys absent from the catalogue (gate 2), and any decision made outside `can()` (gate 13). Entitlement is checked **before** permission so feature existence never leaks through inconsistent error codes.
**Residual:** drift detected by sampled `authz.entitlement.denied` / `access.*` audit.

### 11.4 Ownership / relationship bypass
**Surface:** the classic "endpoint #15 forgot the ownership check" on owned resources (`PUT /courses/:id`, `PUT /items/:id`, `POST /attempts/:id/submit`, `PUT /posts/:id`, `POST /appeals`).
**Mitigations:** ownership/relationship is resolved **inside** `can(actor, perm, resourceRef, ctx)` (M6) — the function cannot be called without a `ResourceRef`; CI fails any owned-resource route whose handler does not supply a `resourceLoader` (gate 3). Admin/owner tenant-wide bypass is intentional, within-tenant only, and audited (`authz.ownership.bypassed`).
**Residual:** admin reach within a tenant — bounded by audit + tenant isolation.

### 11.5 Entitlement bypass
**Surface:** community/certs/gamification/advanced-analytics/custom-domain routes (`/spaces`, `/certificates`, `/leaderboards`, `/analytics/*`, custom `/domains`).
**Mitigations:** single `enforceEntitlement` chokepoint against `entitlements` rows (M5); plan-name checks are banned; CI fails entitlement-gated routes missing the call (gate 4); even an `owner` is blocked when the tenant is not entitled (Permission Matrix §9.2).
**Residual:** plan-drift/probing detected via sampled denial audit (Permission Matrix §9.3).

### 11.6 Platform-scope abuse
**Surface:** any `/api/v1/platform/**` route; a tenant route attempting to flip `app.platform_scope`.
**Mitigations:** separate `atlas_platform` role + dedicated client; `withPlatformScope` enforces reason ≥ 10 + enter/exit audit; `atlas_app` connections physically cannot satisfy the platform RLS policy; CI fails platform routes lacking audit and any tenant code setting `platform_scope` (gates 6–9). Access is per-action/per-incident, never standing.
**Residual:** insider misuse — bounded by mandatory reason + immutable hash-chained audit + least-privilege platform bundles.

### 11.7 Public-route abuse (added surface)
**Surface:** `/public/diagnostic/start` (unauthenticated, write-capable), `/public/verify/:id`, login/signup.
**Mitigations:** dedicated tightest rate-limit buckets; `ip_hash`/`user_agent_hash` only (no raw PII); anonymous→account merge tokens are single-use; verification returns a minimal projection with no tenant-admin privilege; all public routes still run under host-resolved RLS.

---

## SECTION 12 — API Implementation Order

Ordered exactly as development must build, aligned to Database Design v2 §19 migration order and the Corrected Roadmap. **Phase 0 is correctness, not features**; no Phase 1 route is wired until the Phase 0 isolation/IDOR harness is green under transaction-mode pooling.

### Phase 0 — Foundation & correctness gates (build first, in this order)
1. `/api/v1/health` + the `withTenantTx` / `withPlatformScope` wrappers + middleware skeleton (host→tenant→state→auth→membership gate).
2. Platform tenancy: `POST/GET /platform/tenants`, `*/suspend|resume|archive`, `/platform/tenants/:id/provisioning` (drives provisioning saga).
3. Identity & session: `/auth/session`, `/auth/logout`, `/me`, `/public/auth/login|signup`, `/public/invitations/accept`.
4. Membership: `/members*`, invite/suspend/remove (owner-guard).
5. Access control: `/roles*`, `/members/:id/roles`, `/permission-overrides` (no-grant-up, rank-guard).
6. Configuration & entitlements: `/config*`, `/feature-flags*`, `GET /entitlements`, `/platform/tenants/:id/entitlements`, `/platform/feature-flags`, `/platform/catalog/*`.
7. Audit & eventing: `GET /audit`, `/platform/audit`, internal outbox relay + dead-letter replay.
**Phase 0 exit gate:** cross-tenant IDOR matrix green under transaction pooling; membership-gate + platform-scope + append-only tests passing; CI security gates live (Permission Matrix §17.5, §18 condition 1).

### Phase 1A — Core learning loop on generic engines
8. Branding/theme + domains: `/branding`, `/theme`, `/branding/publish`, `/domains`.
9. Learning: `/courses`, `/modules`, `/lessons`, `/lesson assets`, `/enrollments`, `/progress`, `/learning-paths` (+ gates).
10. Item registry + Assessment: `/item-types` (read), `/items`, `/item-collections`, `/assessments`, `/attempts`, `/grading-tasks`. (Resolves Inversions 1 & 3 — registry + swipe item type as first-party generic capability.)
11. Practice/swipe: `/practice-sessions` + `/responses` + `/complete`, `/me/srs/due`.
12. Competency & Scoring: `/competency-dimensions`, `/scoring-profiles`, `/scoring-config/:id/publish`, `/scoring-profiles/:id/bands`, `/me/competency`, `/members/:id/competency`. (Resolves Inversion 2 — generic scoring engine in Phase 1.)
13. Certification: `/certificate-templates`, `/certificates`, `/certificates/:id/revoke`, public `/verify/:credentialId`.
14. Workflow human-gate (needed by publish/issue): `/workflows`, `/workflows/:id/transition`.
**Phase 1A exit:** a visitor can diagnose → get a path → assess → see readiness rise, on generic engines, with zero FB-specific platform code.

### Phase 1B — Engagement, surfacing, orchestration, FB app-layer
15. Gamification: `/me/gamification`, `/badges`, `/leaderboards`, `/me/streaks` (Redis-backed) (`gamification.enable`).
16. Community & moderation: `/spaces`, `/posts`, `/comments`, `/reactions`, `/moderation`, `/appeals` (`community.enable`).
17. Notifications: `/notification-templates`, `/me/notifications`.
18. Search: `/search`, `/search/reindex`.
19. Analytics: `/analytics/dashboards`, `/analytics/funnel`, `/analytics/item-statistics` (`analytics.dashboard.view`).
20. Automation & locales & extensions: `/automation-rules`, `/locales`, `/extension-points`, `/extensions/registrations`.
21. Data rights: `/exports`, `/deletion-requests`.
22. FB app-layer (config on the above): `/diagnostic/*` (+ public variant + merge), `/readiness-policy`, `/cta/attribution-token`, roadmap paths, Hall-of-Fame read projections.
**Phase 1B exit:** full diagnostic→path→streak→assess→readiness→attributed-CTA loop; second-tenant provisioning smoke test passes; data export works; zero FB-specific platform code (Corrected Roadmap Phase 1 exit; Database Design v2 §23 condition 8).

---

## SECTION 13 — CTO Review

### 13.1 Missing APIs (added here vs the §12 representative matrix)
The Permission Matrix's §12 was explicitly *representative*. This inventory completes it. Surfaces not enumerated in the matrix but **required** and now included: session/logout, profile self-read, module/lesson/asset sub-resources, learning-path enroll/progress, item dimension-weights and collection composition, attempt-answer writes (distinct from submit), SRS due list, scoring bands, competency history/signals read, certificate templates lifecycle, streak-freeze, comments/reactions, moderation case list, notification mark-read, item-statistics, export polling/download, deletion processing, the internal outbox relay/dead-letter replay, and the FB diagnostic merge + result reads. None introduce a new permission, table, or entitlement.

### 13.2 Overengineered / watch-list
- **`PATCH` semantics**: deliberately omitted except where partial update is genuinely needed; do not proliferate `PATCH` variants alongside `PUT`. Keep to `PUT`.
- **Per-field filter explosion**: the allow-listed filter approach must not drift into a generic query language. Hold the line at indexed columns (§1.6).
- **`/cta/attribution-token` as a "permission"**: correctly modeled as a system-minted side effect of an authorized readiness CTA, not a user-invoked privilege (Permission Matrix §4.17 note). Resist turning it into a first-class CRUD resource.

### 13.3 APIs to defer (explicitly NOT built in P0/P1)
Commerce/checkout, SaaS billing, subscriptions; inbound `challenge.purchased/passed/funded` integration + conversion attribution depth + Challenge Readiness Center; live/webinar/event; L2/L3 proctoring; mobile white-label build endpoints + push credentials; third-party plugin SDK/sandbox/signing + marketplace; AI layer / AI coach; Funded Trader Program/Group + inbound-verified Hall of Fame; multi-region/dedicated-tenant routing. These map to Phases 2–4 (Corrected Roadmap; Database Design v2 §2). Any of these appearing in a P0/P1 PR is rejected.

### 13.4 Conditions carried forward (binding)
1. Phase 0 transaction-pooling RLS/IDOR + membership-gate + platform-scope harness green **before** any Phase 1 route is wired to `can()` (Permission Matrix §18.1, Database Design v2 §23).
2. `can()` + `enforceEntitlement` are the only decision points; the §16 CI gates are live before feature routes merge.
3. Idempotency keys enforced on every route backed by an idempotency constraint (§1.8); outbox-in-same-transaction enforced for every event producer (§10).
4. Admin/Super-Admin MFA, Redis revocation, and the audit hash-chain operational before production traffic.
5. Legal review of the readiness→CTA wording complete before the public diagnostic + attribution token go live (Corrected Roadmap cross-cutting / C4).
6. Second-tenant provisioning smoke test passes before declaring FundedBeyond Phase 1 complete.

### 13.5 Final approval
**Verdict: APPROVED — conditional.** This inventory sits cleanly on Database Design v2 and Permission Matrix v1, redesigns nothing, adds no permissions/tables/entitlements, covers only Phase 0 + Phase 1, routes every protected surface through the membership gate → `enforceEntitlement` → `can()` pipeline with ownership/relationship folded into `can()`, keeps Super Admin structurally isolated on `atlas_platform`, and expresses every FundedBeyond flagship (Diagnostic, Swipe, Readiness, Roadmap, Hall of Fame) as configuration on generic Atlas engines with **zero tenant-specific platform code** — closing the C3 inversion that motivated the Corrected Roadmap.

**Exact next document to produce:** **API Contract & Endpoint Specification v1 (Phase 0 + Phase 1)** — the route-by-route binding that, per endpoint, declares request/response Zod schemas, the `resourceLoader` implementation, idempotency-key handling, emitted outbox event payload `schema_version`, and rate-limit bucket, operationalizing this inventory into the contract handlers and middleware implement.

---
*Atlas LMS API Inventory v1 — implementation-ready. Sources of truth: Atlas LMS Database Design v2, Atlas Permission Matrix v1, Atlas bounded contexts, Dependency Analysis & Corrected Roadmap. No architecture or permissions redesigned; Phase 0 + Phase 1 only.*
