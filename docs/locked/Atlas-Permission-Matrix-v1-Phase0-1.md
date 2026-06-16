# Atlas LMS — Permission Matrix v1
## Phase 0 + Phase 1 Authorization Design

**Role:** Principal SaaS Architect · Principal Security Architect · Principal Authorization Architect · Principal Product Architect · CTO
**Status:** Implementation-ready authorization specification — conditional approval (see §18)
**Scope:** Phase 0 foundation + Phase 1 FundedBeyond Academy MVP on generic Atlas engines only
**Source of truth:** Atlas LMS Database Design v2 (Phase 0 + Phase 1). Where this document references a table, column, role, enum, helper function, or wrapper, it is the one defined there. This document adds **no** tables and redesigns **nothing**.
**Binds:** every API route, screen, background worker, workflow transition, automation action, and raw/ORM database access path in Phase 0 + Phase 1.

> **Reading contract.** This is not a feature PRD, a database document, or an API document. It is the single authoritative authorization model. If an API spec, screen, or service contradicts this document, this document wins and the other artifact is defective. Phase 2–4 capabilities (commerce/billing depth, inbound challenge events, live/webinar, L2/L3 proctoring, mobile builds, full plugin sandbox/marketplace, AI layer) are explicitly **out of scope** and no permissions are defined for them.

---

## 1. Authorization Principles

These eight principles are non-negotiable and every later section is an application of them.

**1.1 Default deny.** No actor has any capability unless a permission is explicitly granted through a role, a permission bundle, or an explicit `allow` override. The base state of `can(...)` is `false`. Absence of a rule is denial, never silent allow. A route with no declared authorization is a defect, not a public route (public routes are explicitly enumerated in §8.4).

**1.2 Least privilege.** Roles carry the minimum permission set required for their function. Capabilities that are sensitive (role assignment, membership removal, publish, revoke, moderate, delete, entitlement and platform operations) are isolated into discrete permissions so they can be withheld independently. No role receives a wildcard except the platform Super Admin within platform scope (§10).

**1.3 Tenant isolation is absolute.** Every authorization decision is evaluated inside a resolved tenant context. No tenant permission, role, override, or relationship can read or write another tenant's data. Isolation is enforced at three layers that must all agree: PostgreSQL RLS (`tenant_id = app.current_tenant_id()`), the transaction-scoped tenant GUC set by `withTenantTx`, and the `can()` / membership-gate guards. No permission may bypass any of these layers. The only cross-tenant path that exists is the audited platform escape hatch (§10), which runs as a separate database role.

**1.4 Ownership validation.** When a permission grants action over a resource *the actor authored or owns*, ownership is part of the authorization decision, never a layered afterthought. The ownership predicate is resolved **inside** `can(actor, permission, resourceRef, tenantContext)` (Architecture Review **M6**), so it is structurally impossible to authorize an owned-resource action without passing the ownership check.

**1.5 Relationship validation.** When a permission depends on a relationship between actor and resource (instructor-of-course, author-of-item, member-of-space, assignee-of-grading-task, moderator-of-space), the relationship predicate is resolved inside `can(...)` exactly like ownership. Relationship checks never live ad hoc per endpoint.

**1.6 Entitlement validation.** Authorization (can this actor do it) and entitlement (is this tenant's plan allowed to have it) are **separate, both-required** gates. Entitlement is enforced through one chokepoint, `enforceEntitlement(tenantId, key, ctx)` (Architecture Review **M5**), checked against `entitlements` rows — **never** against plan names. A capability is reachable only if entitlement passes *and* permission passes.

**1.7 Auditability.** Every authorization-state mutation and every cross-tenant platform access produces a tamper-evident `audit_entries` record (append-only, hash-chained). Sensitive allows/denies are audited. Audit is not optional and cannot be bypassed by any code path (§13).

**1.8 Super Admin boundaries.** The platform Super Admin is **not a tenant role** and is structurally incapable of being one. It is never stored in `roles` / `user_roles`, never assigned via tenant membership, never resolvable from a tenant session, and operates only through the `atlas_platform` database role inside `withPlatformScope()` with a mandatory reason and enter/exit audit. A tenant session can never escalate into platform scope.

---

## 2. Authorization Architecture

### 2.1 Exact evaluation order

Every protected request passes through this pipeline **in this order**. A failure at any stage short-circuits the request with the status defined in §8.5; later stages never run.

```
1. Host Resolution          host → tenant            (tenant_domains → tenants)
2. Tenant State Gate        tenant must be ACTIVE    (PROVISIONING/SUSPENDED/ARCHIVED/DELETED → blocked)
3. Authentication           JWT → auth_principal     (Supabase Auth)
4. Membership Gate          (tenant_id, principal) → ACTIVE membership   ← LOAD-BEARING
5. Transaction Context      withTenantTx: set_config('app.tenant_id', …, true) + actor + request_id
6. Entitlement Check        enforceEntitlement(tenantId, key)            (plan capability)
7. Permission Check         can(actor, permission, resourceRef, ctx)     (RBAC + overrides)
8. Ownership / Relationship resolved INSIDE can() for owned/related resources
9. Resource Access          Prisma/SQL inside the tenant transaction; RLS re-checks tenant_id
```

Critical ordering rules:

- **Host wins over the JWT tenant claim** (Engine 1 precedence: custom domain → subdomain → JWT → header). A principal authenticated for Tenant A who visits Tenant B's host is treated as a Tenant B *visitor*; the **membership gate (step 4) is the only thing that authorizes them**, so it is load-bearing on every request and is non-bypassable and audited (Architecture Review **M10**).
- **Steps 1–5 run before any business logic and before any Prisma call.** No handler may touch the database outside `withTenantTx` (or `withPlatformScope` for platform routes).
- **RLS (step 9) is a backstop, not the primary control.** Even if a query is malformed, RLS filters to the resolved tenant. A correct request passes both the application gate and RLS; they must always agree.
- **Entitlement before permission.** A capability the tenant's plan does not include is rejected as `ENTITLEMENT_REQUIRED` before the per-actor permission is even considered, so upgrade prompts are consistent and we never leak feature existence through inconsistent error codes.

### 2.2 Platform-route variant

Platform routes (`/api/platform/**`) replace steps 3–8 with: authenticate principal → assert platform role → `withPlatformScope(ctx, reason, fn)` which sets `app.platform_scope='true'` on the `atlas_platform` role and writes `platform.scope.enter` / `platform.scope.exit` audit entries. Platform routes still resolve and set `app.tenant_id` whenever they touch a specific tenant's data, and run under that tenant's RLS via the platform policy (§10).

### 2.3 Three planes of identity

| Plane | Store | Crosses tenants? | Used by |
|---|---|---|---|
| Global principal | `auth_principals` (GLOBAL) | n/a | Authentication only; never exposed to tenant APIs |
| Tenant membership | `memberships` (TENANT, RLS) | No | Membership gate, actor identity inside a tenant |
| Tenant profile | `member_profiles` (TENANT, RLS) | No | Display name / avatar / bio per tenant |

The actor inside `can()` is always a **membership**, never a global principal. Tenant code resolves users through `memberships` + `member_profiles` only; global user IDs are never returned to tenant APIs.

---

## 3. Role Inventory

Two strictly separated families: **platform roles** (above tenants, never in tenant RBAC tables) and **tenant roles** (the five system roles seeded by provisioning per Database Design v2 §18.2).

### 3.1 Platform roles (platform scope only)

Platform roles are represented as `platform.*` permission bundles attached to `auth_principals` flagged as platform operators (a platform allow-list, not `user_roles`). They are exercised **only** through `withPlatformScope()` on the `atlas_platform` DB role. They are never seeded into any tenant's `roles` table and cannot be assigned by any tenant.

| Role key | Responsibilities | Hard limits |
|---|---|---|
| `atlas.super_admin` | Full platform operations: create/suspend/archive tenants, drive provisioning, set tenant entitlements, manage global catalogues (permissions, bundles, feature flags, item types, extension points), read cross-tenant audit, enter tenant data for support. The only role above tenants. | Must use `withPlatformScope` + reason + audit for every cross-tenant action. Cannot be impersonated from a tenant session. Cannot disable RLS globally. Every write is audited. |
| `atlas.operations` | Tenant lifecycle and provisioning operations: provision/suspend/resume, feature-flag and entitlement administration, queue/worker operability. | No standing read into tenant *content*; tenant-data reads require a reason-bound platform-scope session and are audited. Cannot manage the permission catalogue unless also `super_admin`. |
| `atlas.support` | Reason-bound, time-boxed **read-mostly** access into a single tenant to diagnose issues; read cross-tenant audit for the tenant under support. | Read-biased: no destructive platform actions, no entitlement changes, no catalogue changes. Every entry is `platform.scope.enter`/`exit` audited with a reason ≥ 10 chars; access is per-incident, never standing. |

> Keep this list at three. Additional platform personas are expressed as narrower `platform.*` bundles, **not** new roles, to prevent platform-role explosion.

### 3.2 Tenant roles (the five seeded system roles)

Seeded per tenant with `roles.is_system = true`. Tenants may create additional custom roles (`role.create`), but custom roles are bounded by the tenant's entitlements and by no-grant-up (§14.2). FundedBeyond uses these five generic roles unchanged — no FundedBeyond-specific role exists.

| Role key | Responsibilities | Limitations |
|---|---|---|
| `owner` | Ultimate tenant authority. Everything `admin` can do, plus: manage all roles including `admin`, assign/revoke `admin`, manage `permission_overrides`, publish branding/config, request tenant data export and deletion, read tenant audit. Exactly one owner per tenant by convention. | Cannot perform any `platform.*` action. Cannot read or affect another tenant. Cannot grant a permission it does not itself hold (no grant-up). |
| `admin` | Day-to-day tenant administration: members (invite/suspend/remove), roles below `admin`, branding/config edit + publish, all learning/assessment/competency/certification/community/gamification/workflow/automation/notification/search/analytics management, moderation, exports. | Cannot remove or demote the `owner`. Cannot assign the `owner` role. Cannot edit `platform.*`. Bounded by entitlements. No grant-up. |
| `instructor` | Authoring + delivery of learning: create/update/publish own courses, learning paths, items, assessments, competency content; grade attempts; view progress and competency scores for learners in courses/paths they teach. | Edits only resources where they are the owner/author or hold the teaching relationship (§6/§7). No member management, no roles, no branding/config, no moderation, no platform. |
| `moderator` | Community integrity: moderate posts/comments (hide/lock/action), open/decide moderation cases, review appeals, manage community spaces. | No content authoring (courses/items/assessments), no member or role management, no branding/config, no platform. Moderation scoped to spaces within the tenant. |
| `learner` | Consume the product: read published content, enroll, take assessments/practice/diagnostics, earn XP/badges/streaks/certificates, post/comment/react, submit appeals, search, view *own* progress, scores, certificates, and profile. | Writes only own resources (ownership-gated). Cannot author, manage, moderate, configure, or administer anything. Default role for new members. |

Default role on provisioning: a newly accepted member receives `learner` unless invited into a higher role by an authorized admin/owner.

---

## 4. Permission Catalog

Convention: `<context>.<resource>.<action>` (Atlas PRD AuthZ standard). Every key below is seeded into the global `permissions` catalogue (Database Design v2 §18.1) and grouped into bundles. **Resource Type** names the `target_type` used in `can()` resolution and `audit_entries.target_type`. Verbs are deliberately reused (`read/create/update/delete/publish/manage/...`) to prevent permission explosion. `manage` denotes a coarse create+update+delete bundle used only where fine-grained separation adds no security value.

### 4.0 Platform context (`platform.*`) — never granted to tenant roles

| Permission key | Description | Resource type |
|---|---|---|
| `platform.tenant.read` | List/inspect tenants and provisioning state | `tenant` |
| `platform.tenant.manage` | Create, suspend, resume, archive tenants; drive provisioning saga | `tenant` |
| `platform.entitlement.manage` | Grant/modify tenant `entitlements` (writes `entitlement_grant_history`) | `entitlement` |
| `platform.feature_flag.manage` | Manage global `feature_flags` catalogue + defaults | `feature_flag` |
| `platform.catalog.manage` | Manage global `permissions`, `permission_bundles`, `item_types`, `extension_points` | `catalog` |
| `platform.audit.read` | Read cross-tenant / global audit stream | `audit_entry` |
| `platform.support.access` | Enter reason-bound platform scope into a tenant (read-biased support) | `tenant` |

### 4.1 Tenancy (`tenancy.*`) — PC-1

| Permission key | Description | Resource type |
|---|---|---|
| `tenancy.domain.read` | View tenant domains / verification state | `tenant_domain` |
| `tenancy.domain.manage` | Add custom domain, set primary (custom domain **entitlement-gated**) | `tenant_domain` |
| `tenancy.provisioning.read` | View tenant provisioning jobs/status | `provisioning_job` |

### 4.2 Identity & Membership (`membership.*`, `profile.*`) — PC-2

| Permission key | Description | Resource type |
|---|---|---|
| `membership.read` | List/inspect tenant memberships | `membership` |
| `membership.invite` | Invite a principal into the tenant | `membership` |
| `membership.suspend` | Suspend a membership | `membership` |
| `membership.remove` | Remove a membership | `membership` |
| `profile.read` | View member profiles (subject to visibility) | `member_profile` |
| `profile.update` | Update a member profile (own by ownership; any with `membership.read`+admin) | `member_profile` |

### 4.3 Access Control (`role.*`, `permission_override.*`) — PC-3

| Permission key | Description | Resource type |
|---|---|---|
| `role.read` | View roles and their permissions | `role` |
| `role.create` | Create a custom tenant role | `role` |
| `role.update` | Edit a role's permission set | `role` |
| `role.delete` | Delete a custom role | `role` |
| `role.assign` | Assign a role to a membership | `user_role` |
| `role.revoke` | Revoke a role from a membership | `user_role` |
| `permission_override.manage` | Create/remove explicit allow/deny overrides | `permission_override` |

### 4.4 Branding (`branding.*`) — PC-4

Branding and theme share one authority boundary (separate tables, same governance) to avoid explosion.

| Permission key | Description | Resource type |
|---|---|---|
| `branding.read` | View branding/theme config and versions | `tenant_branding` |
| `branding.update` | Edit branding + theme (draft) | `tenant_branding` |
| `branding.publish` | Publish a branding/theme version | `tenant_branding_version` |

### 4.5 Configuration (`config.*`, `feature_flag.*`, `entitlement.*`) — PC-4

| Permission key | Description | Resource type |
|---|---|---|
| `config.read` | View tenant runtime configuration | `tenant_config` |
| `config.update` | Edit tenant configuration (draft) | `tenant_config` |
| `config.publish` | Publish a config version | `tenant_config_version` |
| `feature_flag.read` | View effective tenant flag values | `feature_flag_override` |
| `feature_flag.override` | Set tenant feature-flag overrides | `feature_flag_override` |
| `entitlement.read` | View own tenant's entitlements (read-only; changes are platform-only) | `entitlement` |

### 4.6 Learning (`course.*`, `lesson.*`, `enrollment.*`, `progress.*`, `learning_path.*`) — PC-5

| Permission key | Description | Resource type |
|---|---|---|
| `course.read` | Read courses (published for learners; any for admin/owner; own for instructor) | `course` |
| `course.create` | Create a course | `course` |
| `course.update` | Edit a course + its modules/lessons/assets | `course` |
| `course.delete` | Soft-delete a course | `course` |
| `course.publish` | Publish/unpublish a course | `course` |
| `enrollment.read` | View enrollments (own for learner; course's for instructor; all for admin) | `enrollment` |
| `enrollment.create` | Enroll (self-enroll for learner; enroll others for admin) | `enrollment` |
| `enrollment.manage` | Manage/transfer/cancel enrollments | `enrollment` |
| `progress.read` | View lesson/path progress (own; learners-in-my-course for instructor; all for admin) | `lesson_progress` |
| `learning_path.read` | Read learning paths | `learning_path` |
| `learning_path.create` | Create a learning path | `learning_path` |
| `learning_path.update` | Edit path steps + gates | `learning_path` |
| `learning_path.delete` | Soft-delete a path | `learning_path` |
| `learning_path.publish` | Publish a path | `learning_path` |

### 4.7 Assessment (`item.*`, `item_collection.*`, `assessment.*`, `attempt.*`, `practice.*`) — PC-6

| Permission key | Description | Resource type |
|---|---|---|
| `item.read` | Read items / item bank | `item` |
| `item.create` | Create an item (any registered `item_type`, incl. `swipe`) | `item` |
| `item.update` | Edit an item + options + dimension weights | `item` |
| `item.delete` | Soft-delete an item | `item` |
| `item_collection.manage` | Create/edit decks, quiz banks, practice sets | `item_collection` |
| `assessment.read` | Read assessments | `assessment` |
| `assessment.create` | Create quiz/exam/diagnostic/readiness_review | `assessment` |
| `assessment.update` | Edit assessment composition + config | `assessment` |
| `assessment.delete` | Soft-delete an assessment | `assessment` |
| `assessment.publish` | Publish an assessment | `assessment` |
| `assessment.grade` | Perform manual/subjective grading of attempts | `grading_task` |
| `attempt.start` | Start an attempt | `attempt` |
| `attempt.submit` | Submit answers / finalize an attempt | `attempt` |
| `attempt.read` | Read attempts (own; relationship for instructor; all for admin) | `attempt` |
| `practice.start` | Start a swipe/practice/review session | `practice_session` |

> `item_type.*` is a **global catalogue** read-only to tenants via SQL grant (Database Design v2 §5.4). Registering a new item-type *renderer* (e.g. swipe) is an extensibility action, not an Assessment-core edit (§4.16) — this is the no-fork resolution of Inversions 1 and 3.

### 4.8 Competency & Scoring (`competency.*`, `scoring_profile.*`, `scoring_config.*`) — PC-7

| Permission key | Description | Resource type |
|---|---|---|
| `competency.dimension.read` | Read competency dimensions (TA/PSY/RISK/DISC/CR are tenant config) | `competency_dimension` |
| `competency.dimension.manage` | Create/edit dimensions | `competency_dimension` |
| `scoring_profile.read` | Read scoring profiles | `scoring_profile` |
| `scoring_profile.create` | Create a scoring profile | `scoring_profile` |
| `scoring_profile.update` | Edit a scoring profile | `scoring_profile` |
| `scoring_config.publish` | Publish a versioned scoring config | `scoring_config_version` |
| `competency.band.manage` | Define band thresholds/labels | `competency_band` |
| `competency.score.read` | Read scores/readiness (own; relationship for instructor; all for admin) | `competency_score` |
| `competency.signal.read` | Read raw competency signals (admin/analytics) | `competency_signal` |

> Competency **signals are emitted by engines through the outbox**, never written by users — there is intentionally no `competency.signal.create` permission. This preserves the bounded-context rule that assessment code emits signals and only the scoring context writes scores.

### 4.9 Certification (`certificate.*`, `certificate_template.*`) — PC-8

| Permission key | Description | Resource type |
|---|---|---|
| `certificate_template.read` | Read certificate templates | `certificate_template` |
| `certificate_template.manage` | Create/edit templates | `certificate_template` |
| `certificate_template.publish` | Publish a template | `certificate_template` |
| `certificate.read` | Read certificates (own for learner; all for admin) | `certificate` |
| `certificate.issue` | Manually issue a certificate (normally automation-driven) | `certificate` |
| `certificate.revoke` | Revoke an issued certificate | `certificate` |

> **Public certificate verification** is a public route (§8.4): it resolves by `credential_id`, returns a minimal public projection, logs `credential_verifications`, and uses **no tenant-admin privilege**. No tenant permission is consumed.

### 4.10 Gamification (`gamification.*`, `badge.*`, `leaderboard.*`) — PC-9

| Permission key | Description | Resource type |
|---|---|---|
| `gamification.profile.read` | Read XP/level profile (own for learner; all for admin) | `gamification_profile` |
| `badge.read` | Read badge definitions/awards | `badge` |
| `badge.manage` | Create/edit badge definitions; manual award | `badge` |
| `leaderboard.read` | View leaderboards | `leaderboard_definition` |
| `leaderboard.manage` | Configure leaderboards | `leaderboard_definition` |

> The `point_ledger` is append-only and written only by engines via events — no user-facing write permission exists.

### 4.11 Community & Moderation (`community.*`, `post.*`, `comment.*`, `reaction.*`, `appeal.*`) — PC-11

| Permission key | Description | Resource type |
|---|---|---|
| `community.space.read` | View spaces (visibility-scoped) | `community_space` |
| `community.space.manage` | Create/edit/delete spaces | `community_space` |
| `community.space.join` | Join a space (`group_memberships`) | `group_membership` |
| `post.read` | Read posts (visibility + space membership) | `post` |
| `post.create` | Create a post | `post` |
| `post.update` | Edit a post (own by ownership; any via `community.moderate`) | `post` |
| `post.delete` | Delete a post (own by ownership; any via `community.moderate`) | `post` |
| `comment.create` | Create a comment | `comment` |
| `comment.update` | Edit a comment (own; any via moderate) | `comment` |
| `comment.delete` | Delete a comment (own; any via moderate) | `comment` |
| `reaction.create` | React to post/comment | `reaction` |
| `community.moderate` | Open/decide moderation cases; hide/lock/action any content | `moderation_case` |
| `appeal.create` | Submit an appeal (own moderation case) | `appeal` |
| `appeal.review` | Review/decide appeals | `appeal` |

### 4.12 Notifications (`notification.*`) — PC-14

| Permission key | Description | Resource type |
|---|---|---|
| `notification.template.read` | Read notification templates | `notification_template` |
| `notification.template.manage` | Create/edit templates | `notification_template` |
| `notification.read.self` | Read own in-app notifications | `notification_dispatch` |

> `notification_dispatches` are written by the eventing/worker tier idempotently; there is no user "send" permission. Sends are a side effect of automation/workflow, not a directly authorized action.

### 4.13 Search (`search.*`) — PC-14

| Permission key | Description | Resource type |
|---|---|---|
| `search.query` | Query tenant search index (results RLS- and visibility-scoped) | `search_index_entry` |
| `search.reindex.manage` | Trigger/administer reindex jobs | `search_index_entry` |

### 4.14 Analytics & Data Rights (`analytics.*`, `data.*`, `audit.*`) — PC-15 / PC-16

| Permission key | Description | Resource type |
|---|---|---|
| `analytics.dashboard.view` | View enterprise/advanced dashboards (**entitlement-gated**) | `analytics_rollup` |
| `analytics.funnel.view` | View funnel rollups | `funnel_daily_rollup` |
| `data.export.run` | Run a tenant data-export job (data-export-as-a-right) | `export_job` |
| `data.deletion.request` | File a deletion request | `deletion_request` |
| `data.deletion.manage` | Approve/process deletion requests | `deletion_request` |
| `audit.read` | Read tenant-scoped audit log | `audit_entry` |

### 4.15 Workflow & Orchestration (`workflow.*`, `automation.*`, `locale.*`) — PC-17

| Permission key | Description | Resource type |
|---|---|---|
| `workflow.definition.read` | Read workflow definitions | `workflow_definition` |
| `workflow.definition.manage` | Create/edit workflow definitions | `workflow_definition` |
| `workflow.transition.act` | Approve/reject a review→publish transition (**the human gate**) | `workflow_transition` |
| `automation.rule.read` | Read automation rules | `automation_rule` |
| `automation.rule.manage` | Create/edit automation rules | `automation_rule` |
| `locale.read` | Read locale resources | `locale_resource` |
| `locale.manage` | Edit locale resources | `locale_resource` |

### 4.16 Extensibility (`extension.*`) — PC-18

| Permission key | Description | Resource type |
|---|---|---|
| `extension.point.read` | Read global extension-point catalogue | `extension_point` |
| `extension.registration.read` | Read tenant extension registrations | `extension_registration` |
| `extension.registration.manage` | Register/configure first-party extensions (e.g. swipe renderer, lesson-completed hook) | `extension_registration` |

> First-party extension points only. The third-party SDK/sandbox/signing/marketplace stays Phase 4; no permissions for it exist here.

### 4.17 FundedBeyond app-layer (`diagnostic.*`, `readiness_policy.*`) — generic config, no fork

| Permission key | Description | Resource type |
|---|---|---|
| `diagnostic.start` | Start a diagnostic session (**public variant** for the free unauthenticated diagnostic — see §8.4) | `diagnostic_session` |
| `readiness_policy.read` | Read readiness CTA policy | `readiness_policy` |
| `readiness_policy.manage` | Configure readiness CTA policy + legal copy | `readiness_policy` |

> `attribution_tokens` are minted by app/system logic as a side effect of an authorized readiness CTA, not by a directly user-invoked permission. They carry no privilege and are tenant-scoped + expiring.

---

## 5. Role → Permission Matrix

`A` = allowed by default role grant · `—` = denied (default deny) · `O` = allowed but ownership-constrained · `R` = allowed but relationship-constrained. `O`/`R` constraints are resolved inside `can()` (§6/§7). Platform roles are in a separate matrix because they are never tenant roles.

### 5.1 Tenant role matrix

| Permission | owner | admin | instructor | moderator | learner |
|---|:--:|:--:|:--:|:--:|:--:|
| tenancy.domain.read | A | A | — | — | — |
| tenancy.domain.manage | A | A | — | — | — |
| tenancy.provisioning.read | A | A | — | — | — |
| membership.read | A | A | — | — | — |
| membership.invite | A | A | — | — | — |
| membership.suspend | A | A | — | — | — |
| membership.remove | A | A¹ | — | — | — |
| profile.read | A | A | A | A | A |
| profile.update | A | A | O | O | O |
| role.read | A | A | — | — | — |
| role.create | A | A | — | — | — |
| role.update | A | A² | — | — | — |
| role.delete | A | A² | — | — | — |
| role.assign | A | A³ | — | — | — |
| role.revoke | A | A³ | — | — | — |
| permission_override.manage | A | A³ | — | — | — |
| branding.read | A | A | — | — | — |
| branding.update | A | A | — | — | — |
| branding.publish | A | A | — | — | — |
| config.read | A | A | — | — | — |
| config.update | A | A | — | — | — |
| config.publish | A | A | — | — | — |
| feature_flag.read | A | A | — | — | — |
| feature_flag.override | A | A | — | — | — |
| entitlement.read | A | A | — | — | — |
| course.read | A | A | A | — | A⁴ |
| course.create | A | A | A | — | — |
| course.update | A | A | O/R | — | — |
| course.delete | A | A | O/R | — | — |
| course.publish | A | A | R⁵ | — | — |
| enrollment.read | A | A | R | — | O |
| enrollment.create | A | A | — | — | O |
| enrollment.manage | A | A | R | — | — |
| progress.read | A | A | R | — | O |
| learning_path.read | A | A | A | — | A⁴ |
| learning_path.create | A | A | A | — | — |
| learning_path.update | A | A | O/R | — | — |
| learning_path.delete | A | A | O/R | — | — |
| learning_path.publish | A | A | R⁵ | — | — |
| item.read | A | A | A | — | — |
| item.create | A | A | A | — | — |
| item.update | A | A | O | — | — |
| item.delete | A | A | O | — | — |
| item_collection.manage | A | A | A | — | — |
| assessment.read | A | A | A | — | A⁴ |
| assessment.create | A | A | A | — | — |
| assessment.update | A | A | O/R | — | — |
| assessment.delete | A | A | O/R | — | — |
| assessment.publish | A | A | R⁵ | — | — |
| assessment.grade | A | A | R | — | — |
| attempt.start | A | A | — | — | A |
| attempt.submit | A | A | — | — | O |
| attempt.read | A | A | R | — | O |
| practice.start | A | A | — | — | A |
| competency.dimension.read | A | A | A | — | — |
| competency.dimension.manage | A | A | — | — | — |
| scoring_profile.read | A | A | A | — | — |
| scoring_profile.create | A | A | — | — | — |
| scoring_profile.update | A | A | — | — | — |
| scoring_config.publish | A | A | — | — | — |
| competency.band.manage | A | A | — | — | — |
| competency.score.read | A | A | R | — | O |
| competency.signal.read | A | A | — | — | — |
| certificate_template.read | A | A | A | — | — |
| certificate_template.manage | A | A | — | — | — |
| certificate_template.publish | A | A | — | — | — |
| certificate.read | A | A | R | — | O |
| certificate.issue | A | A | R⁵ | — | — |
| certificate.revoke | A | A | — | — | — |
| gamification.profile.read | A | A | R | — | O |
| badge.read | A | A | A | A | A |
| badge.manage | A | A | — | — | — |
| leaderboard.read | A | A | A | A | A |
| leaderboard.manage | A | A | — | — | — |
| community.space.read | A | A | A | A | A⁶ |
| community.space.manage | A | A | — | A | — |
| community.space.join | A | A | A | A | A |
| post.read | A | A | A | A | A⁶ |
| post.create | A | A | A | A | A |
| post.update | A | A | O | O/moderate | O |
| post.delete | A | A | O | A(moderate) | O |
| comment.create | A | A | A | A | A |
| comment.update | A | A | O | O/moderate | O |
| comment.delete | A | A | O | A(moderate) | O |
| reaction.create | A | A | A | A | A |
| community.moderate | A | A | — | A | — |
| appeal.create | A | A | O | O | O |
| appeal.review | A | A | — | A | — |
| notification.template.read | A | A | — | — | — |
| notification.template.manage | A | A | — | — | — |
| notification.read.self | A | A | A | A | A |
| search.query | A | A | A | A | A |
| search.reindex.manage | A | A | — | — | — |
| analytics.dashboard.view | A⁷ | A⁷ | R⁷ | — | — |
| analytics.funnel.view | A⁷ | A⁷ | — | — | — |
| data.export.run | A | A | — | — | — |
| data.deletion.request | A | A | — | — | O⁸ |
| data.deletion.manage | A | A | — | — | — |
| audit.read | A | A | — | — | — |
| workflow.definition.read | A | A | A | — | — |
| workflow.definition.manage | A | A | — | — | — |
| workflow.transition.act | A | A | R | A⁹ | — |
| automation.rule.read | A | A | A | — | — |
| automation.rule.manage | A | A | — | — | — |
| locale.read | A | A | A | A | A |
| locale.manage | A | A | — | — | — |
| extension.point.read | A | A | A | — | — |
| extension.registration.read | A | A | A | — | — |
| extension.registration.manage | A | A | — | — | — |
| diagnostic.start | A | A | A | A | A |
| readiness_policy.read | A | A | A | — | A |
| readiness_policy.manage | A | A | — | — | — |

**Footnotes:**
¹ `admin` may remove members but **never** the `owner` (§14.2). ² `admin` cannot edit/delete the `owner` system role or any role carrying permissions `admin` lacks (no grant-up). ³ `admin` cannot assign `owner`, cannot assign or override a permission it does not itself hold (no grant-up). ⁴ `learner` reads only `PUBLISHED` content they are entitled/enrolled to see. ⁵ Publish/issue by instructor is gated through `workflow.transition.act` on a review workflow when the tenant requires review (human gate). ⁶ `learner` community read scoped by space visibility + `group_memberships`. ⁷ `analytics.dashboard.view` is **entitlement-gated** (`analytics.dashboard.view` entitlement) — the role grant is necessary but not sufficient. ⁸ `learner` deletion request applies only to their own account/data. ⁹ `moderator` acts on review transitions only for moderation workflows.

### 5.2 Platform role matrix

| Permission | atlas.super_admin | atlas.operations | atlas.support |
|---|:--:|:--:|:--:|
| platform.tenant.read | A | A | A |
| platform.tenant.manage | A | A | — |
| platform.entitlement.manage | A | A | — |
| platform.feature_flag.manage | A | A | — |
| platform.catalog.manage | A | — | — |
| platform.audit.read | A | A | A¹⁰ |
| platform.support.access | A | A | A |

¹⁰ `atlas.support` audit read is scoped to the tenant currently under a reason-bound support session. All platform actions require `withPlatformScope` + reason + enter/exit audit regardless of role (§10).

---

## 6. Ownership Rules

Ownership is the predicate `actor.membership_id == resource.<owner_column>`, evaluated **inside** `can()`. When a matrix cell is `O`, the action is authorized only if ownership holds (or the actor independently holds the admin-level permission that bypasses ownership for that context). Owner columns are taken directly from Database Design v2.

| Question | Rule | Owner column |
|---|---|---|
| Can an instructor edit *any* course? | No. Only courses they created (or hold the teaching relationship for). Admin/owner may edit any. | `courses.created_by_membership_id` |
| Can an instructor edit *any* item/assessment? | No. Only items they authored; assessments they authored or teach. | `items.created_by_membership_id` |
| Can a learner edit their own profile? | Yes (own only). Admin may edit any profile in-tenant via `membership.read` + admin. | `member_profiles.membership_id` |
| Can a learner read others' attempts/scores? | No. Learners read only their own attempts/scores/progress/certs/gamification. | `attempts.membership_id`, `competency_scores.membership_id`, `lesson_progress.membership_id`, `certificates.membership_id`, `gamification_profiles.membership_id` |
| Can a learner submit an attempt that isn't theirs? | No. `attempt.submit` ownership-checks `attempts.membership_id`. | `attempts.membership_id` |
| Can a moderator edit community posts? | They may **delete/action any** post/comment via `community.moderate`; editing *content body* of another user's post is not granted (action, not rewrite). Authors edit own posts via ownership. | `posts.author_membership_id`, `comments.author_membership_id` |
| Can a member appeal someone else's moderation case? | No. `appeal.create` ownership-checks `appeals.submitted_by_membership_id` against the case subject. | `appeals.submitted_by_membership_id` |
| Can a tenant owner revoke a tenant admin? | Yes. `owner` may `role.revoke` `admin`. `admin` may **not** revoke or demote `owner`. | `user_roles` + role rank guard |
| Can an admin remove the owner's membership? | No. `membership.remove` is blocked when the target holds the `owner` role. | `memberships` + owner guard |
| Can a grader grade an attempt not assigned to them? | Only if they hold `assessment.grade` *and* the relationship/assignment holds, or are admin. | `grading_tasks.assigned_to_membership_id` |

**Ownership bypass authority:** holding the context's admin permission (`admin`/`owner` grants) authorizes the action regardless of ownership, *within the tenant only*, and such bypasses on sensitive targets are audited. There is no cross-tenant ownership bypass.

---

## 7. Relationship Rules

Relationship predicates are resolved inside `can()` exactly like ownership. A matrix cell of `R` requires the relationship to hold.

| Relationship | Definition | Required for | Resolver source |
|---|---|---|---|
| Course Instructor | actor is `courses.created_by_membership_id` **or** assigned teacher of the course/path | `course.update/delete/publish`, `learning_path.*` writes (instructor), `enrollment.read/manage`, `progress.read`, `attempt.read`, `competency.score.read` for learners in that course/path | `courses`, `learning_paths`, enrollment links |
| Assessment Author | actor authored the assessment (or its items) | `assessment.update/delete/publish` (instructor) | `assessments` (via authored items / created_by) |
| Grading Assignee | actor is `grading_tasks.assigned_to_membership_id` | `assessment.grade` (instructor, non-admin) | `grading_tasks.assigned_to_membership_id` |
| Space Member | actor has a `group_memberships` row for the space | `post.read`/`community.space.read` for `PRIVATE`/`UNLISTED` spaces; `post.create` in members-only spaces | `group_memberships` |
| Community Moderator | actor holds `community.moderate` (moderator/admin/owner) | moderating any post/comment, deciding cases/appeals | role grant + tenant scope |
| Certificate Issuer | actor is instructor/author of the awarding course/program, gated by workflow | `certificate.issue` (instructor path) | course/program link + `workflow_transitions` |
| Workflow Approver | actor holds `workflow.transition.act` and is a valid actor for the workflow's target type | review→publish approvals | `workflow_definitions`, `workflow_transitions` |

**When relationships are required vs not:** admin/owner act tenant-wide and skip the relationship predicate (still tenant-scoped + audited). Instructor/moderator/learner are relationship- or ownership-bound. Public routes (§8.4) require neither but are tenant-host-scoped.

---

## 8. Membership Gate Rules

The membership gate is step 4 of §2.1 and is load-bearing on every protected request. It evaluates the `memberships` row for `(app.tenant_id, auth_principal_id)` — resolved **after** the host determines the tenant, so a JWT valid in Tenant A grants nothing on Tenant B's host.

### 8.1 State behavior

`MembershipStatus` enum is `INVITED · ACTIVE · SUSPENDED · REMOVED` (Database Design v2). "Pending" maps to `INVITED`.

| State | Protected tenant routes | Public tenant routes (§8.4) | Notes |
|---|---|---|---|
| `ACTIVE` | Allowed; proceed to entitlement + permission checks | Allowed | Normal operating state |
| `INVITED` (Pending) | **Blocked** — only the invitation-acceptance endpoint is reachable | Allowed | Cannot consume product until acceptance creates `ACTIVE` |
| `SUSPENDED` | **Blocked** on all protected routes | Allowed | May see a "suspended" notice; no data writes |
| `REMOVED` | **Blocked** — treated as "no membership" | Allowed | `removed_at` set; re-invite required to return |
| No membership row | **Blocked** | Allowed | Authenticated principal who is a stranger to this tenant |

### 8.2 Exact 401 vs 403 behavior

| Condition | Status | Machine reason |
|---|---|---|
| No JWT / invalid / expired / principal unresolvable | **401** Unauthenticated | `AUTH_REQUIRED` |
| Authenticated, but no membership in host tenant | **403** Forbidden | `NO_MEMBERSHIP` |
| Membership `INVITED` on a protected route | **403** Forbidden | `MEMBERSHIP_PENDING` |
| Membership `SUSPENDED` | **403** Forbidden | `MEMBERSHIP_SUSPENDED` |
| Membership `REMOVED` | **403** Forbidden | `MEMBERSHIP_REMOVED` |
| Active membership, permission denied | **403** Forbidden | `PERMISSION_DENIED` |
| Active membership, ownership/relationship fails | **403** Forbidden | `OWNERSHIP_DENIED` / `RELATIONSHIP_DENIED` |
| Active membership + permission, but plan lacks capability | **403** Forbidden | `ENTITLEMENT_REQUIRED` (presentation layer MAY surface as 402/upgrade prompt) |
| Tenant state not `ACTIVE` (SUSPENDED/ARCHIVED) | **503** for tenant traffic; admin login allowed to settle account | `TENANT_SUSPENDED` |
| Tenant `DELETED` / host unresolved | **404** | `TENANT_NOT_FOUND` |

Principle: **401 means "we don't know who you are"; 403 means "we know who you are and you can't."** Never leak whether a resource exists in another tenant — cross-tenant access returns the same `403 NO_MEMBERSHIP` (or RLS-empty result), never `404`-by-id that distinguishes existence.

### 8.3 Identity decision (recorded tradeoff)

Phase 0/1 uses **global `auth_principals` + per-tenant `memberships`/`member_profiles`** (Database Design v2 §9.3). This matches Supabase Auth and minimizes auth complexity, at the cost of a wider account-takeover blast radius. Mitigations are mandatory: admin MFA required, Redis-backed session/JWT revocation list, audit on login + membership/role changes + platform access, and per-tenant profile isolation. This is an accepted, documented tradeoff for P0/1.

### 8.4 Public route allow-list (no active membership required)

Only these may run without an active membership; all still resolve `app.tenant_id` from host and run under tenant RLS:

- Public academy landing pages.
- Public/free **diagnostic start** (`diagnostic.start` public variant) — with its own rate-limit/abuse model and anonymous→account merge; stores `anonymous_id`, `ip_hash`, `user_agent_hash`, never raw IP/device.
- Public **certificate verification** (minimal public projection, logs `credential_verifications`).
- Login / signup / invitation acceptance.

Every other route is protected and default-deny.

---

## 9. Entitlement Enforcement Rules

Entitlement is a **tenant-plan** gate enforced through the single chokepoint `enforceEntitlement(tenantId, entitlementKey, usageContext)` (Architecture Review **M5**), evaluated against `entitlements` rows (`tenant_id, key, value_json, source, expires_at`). **Plan names are never checked** — they are presentation only.

### 9.1 Behavior when the plan lacks a capability

| Capability | Entitlement key | If absent/expired |
|---|---|---|
| Community | `community.enable` (+ `community.private_spaces.enable`) | Community routes return `403 ENTITLEMENT_REQUIRED`; spaces/posts hidden from nav; existing data preserved read-only for admins/export |
| Certificates | `certification.enable` | Issue/verify blocked; templates read-only; no new credentials minted |
| Advanced Analytics | `analytics.dashboard.view` | `analytics.dashboard.view` permission becomes unreachable → `403 ENTITLEMENT_REQUIRED`; basic counts may remain |
| Gamification | `gamification.enable` | XP/badges/leaderboards routes return `403 ENTITLEMENT_REQUIRED`; ledger frozen, not deleted |
| Custom domain | `branding.custom_domain.enable` | `tenancy.domain.manage` for custom domains blocked; atlas-subdomain still works |
| Data export | `data.export.enable` (always-on by policy) | Export is a right; default-granted to every plan |

### 9.2 Authorization behavior

Entitlement is checked **before** permission (§2.1 step 6). Even an `owner` cannot exercise a capability the tenant is not entitled to — entitlement is about the *tenant*, permission is about the *actor*; **both must pass**. Entitlement and permission are independent: a missing entitlement returns `ENTITLEMENT_REQUIRED` (consistent upgrade prompt), a present entitlement with missing permission returns `PERMISSION_DENIED`. The two reasons are never conflated.

### 9.3 Error + audit behavior

- Error: `403` with machine reason `ENTITLEMENT_REQUIRED` and the missing `entitlementKey` (no internal detail leaked).
- Entitlement **grants/changes** are platform-only (`platform.entitlement.manage`) and write `entitlement_grant_history` (append) **and** an `audit_entries` row. Tenants may only `entitlement.read`.
- Entitlement enforcement **denials** on sensitive capabilities are sampled/audited to detect plan-drift and probing; routine learner-side denials need not be individually audited to avoid log flooding (rely on rollups).

---

## 10. Platform Scope Access (Super Admin Escape Hatch)

The only sanctioned cross-tenant path. Verbatim to Database Design v2 §8 and Atlas PRD FR5.

### 10.1 Mechanics

1. Separate `atlas_platform` database role and dedicated `platformPrisma` client — never shared with tenant routes.
2. `withPlatformScope(ctx, reason, fn)` wrapper: asserts the principal holds the required `platform.*` permission, requires a `reason` of ≥ 10 characters, sets `app.platform_scope='true'` and `app.actor_principal_id` transaction-locally, writes `platform.scope.enter` audit **before** and `platform.scope.exit` audit **after** the action.
3. When touching a specific tenant's data, platform code still resolves and sets `app.tenant_id`; the `<table>_platform_scope` RLS policy (`TO atlas_platform USING(true)`) permits the access, while normal `atlas_app` traffic remains bound by `tenant_id = app.current_tenant_id()`.
4. Access is **temporary / per-action**, never a standing session. Support access is reason-bound per incident.

### 10.2 Hard requirements

- Explicit reason (≥ 10 chars) on every platform-scope entry.
- Audit required, before and after — `platform.scope.enter` / `platform.scope.exit`. A platform route lacking audit is a CI failure (§16).
- Temporary elevation only; no persistent cross-tenant session.
- Tenant access logging: every tenant whose data is read/written under platform scope is recorded in the audit payload.
- Must **not** bypass audit. Must **not** disable RLS globally to "see everything" — platform reach comes from the scoped `atlas_platform` policy, not from turning RLS off.

### 10.3 Rejected patterns (CI/review must block)

- A tenant request (`atlas_app`) setting `app.platform_scope='true'`.
- Platform support querying tenant data without a reason and audit.
- Sharing the `platformPrisma` client with normal API routes.
- Building Super Admin screens by disabling RLS.
- Storing any `platform.*` permission in a tenant `roles`/`user_roles` row.

---

## 11. Screen Authorization Matrix

Phase 0 + Phase 1 screens. Columns are the capability the screen exposes; a blank means the screen does not offer that action. `V` view · `C` create · `E` edit · `D` delete · `P` publish · `M` moderate. Cell shows the roles that get that capability (`O`/`P` = owner, `A` = admin, `I` = instructor, `Mo` = moderator, `L` = learner; `SA` = platform Super Admin family). Ownership/relationship/entitlement constraints from §5–§9 still apply.

| Screen | View | Create | Edit | Delete | Publish | Moderate |
|---|---|---|---|---|---|---|
| Platform: Tenant Console | SA | SA | SA | SA(archive) | — | — |
| Platform: Entitlements & Flags | SA | SA | SA | — | — | — |
| Platform: Catalog (perms/item types/ext points) | SA | SA(super) | SA(super) | — | — | — |
| Platform: Cross-tenant Audit | SA | — | — | — | — | — |
| Tenant Settings / Branding & Theme | O,A | O,A | O,A | — | O,A | — |
| Tenant Configuration | O,A | O,A | O,A | — | O,A | — |
| Domains | O,A | O,A | O,A | O,A | — | — |
| Members & Invitations | O,A | O,A(invite) | O,A(suspend) | O,A(remove)¹ | — | — |
| Roles & Permissions | O,A | O,A | O,A² | O,A² | — | — |
| Role Assignment | O,A | O,A | O,A³ | O,A³ | — | — |
| Courses (catalog/builder) | O,A,I,L⁴ | O,A,I | O,A,I⁵ | O,A,I⁵ | O,A,I⁶ | — |
| Lessons / Modules / Assets | O,A,I,L⁴ | O,A,I | O,A,I⁵ | O,A,I⁵ | O,A,I⁶ | — |
| Learning Paths / Roadmap | O,A,I,L⁴ | O,A,I | O,A,I⁵ | O,A,I⁵ | O,A,I⁶ | — |
| Enrollments | O,A,I,L | O,A,L(self) | O,A | O,A | — | — |
| Item Bank | O,A,I | O,A,I | O,A,I⁵ | O,A,I⁵ | — | — |
| Item Collections / Decks (incl. swipe) | O,A,I | O,A,I | O,A,I | O,A,I | O,A,I⁶ | — |
| Assessments / Quizzes / Exams | O,A,I,L⁴ | O,A,I | O,A,I⁵ | O,A,I⁵ | O,A,I⁶ | — |
| Take Assessment (attempt) | L⁷ | L | L(own,in-progress) | — | — | — |
| Grading Queue | O,A,I | — | O,A,I(grade) | — | — | — |
| Practice / Swipe Session | L | L | — | — | — | — |
| Competency Dimensions & Bands | O,A,I⁴ | O,A | O,A | O,A | — | — |
| Scoring Profiles & Config | O,A,I⁴ | O,A | O,A | — | O,A | — |
| My Readiness / Scores | O,A,L,I⁸ | — | — | — | — | — |
| Certificate Templates | O,A,I⁴ | O,A | O,A | O,A | O,A | — |
| Certificates (issued) | O,A,L⁸ | O,A,I⁶ | — | O,A(revoke) | — | — |
| Public Certificate Verification | public | — | — | — | — | — |
| Badges / XP / Leaderboards | all | O,A | O,A | O,A | — | — |
| Community Spaces | all⁹ | O,A,Mo | O,A,Mo | O,A,Mo | — | O,A,Mo |
| Posts / Comments | all⁹ | all | O¹⁰ | O,Mo,A | — | O,A,Mo |
| Moderation Queue / Appeals | O,A,Mo | O,A,Mo | O,A,Mo | — | — | O,A,Mo |
| Notification Templates | O,A | O,A | O,A | O,A | — | — |
| My Notifications | all(own) | — | — | — | — | — |
| Search | all | — | — | — | — | — |
| Analytics Dashboards | O,A⁷ | — | — | — | — | — |
| Funnel Analytics | O,A⁷ | — | — | — | — | — |
| Data Export | O,A | O,A | — | — | — | — |
| Deletion Requests | O,A,L⁸ | O,A,L⁸ | O,A | — | — | — |
| Audit Log (tenant) | O,A | — | — | — | — | — |
| Workflows | O,A,I⁴ | O,A | O,A | — | O,A,I,Mo(act)¹¹ | — |
| Automation Rules | O,A,I⁴ | O,A | O,A | O,A | — | — |
| Extensions (first-party) | O,A,I⁴ | O,A | O,A | O,A | — | — |
| Readiness Policy | O,A | O,A | O,A | — | — | — |
| Diagnostic (public + in-app) | public+all | public+all(start) | — | — | — | — |

Footnotes mirror §5: ¹ never the owner; ² no grant-up, not owner role; ³ cannot assign owner; ⁴ read-only for the listed lower roles; ⁵ ownership/relationship-constrained for instructor; ⁶ publish via workflow human-gate where required; ⁷ entitlement-gated; ⁸ own data only for learner; ⁹ visibility + space-membership scoped; ¹⁰ author edits own; ¹¹ `act` = approve/reject transition only.

---

## 12. API Authorization Matrix

Representative Phase 0 + Phase 1 routes. Every route declares: required permission, ownership check, relationship check, and entitlement. Unlisted routes still obey §2.1; a route with no declared permission fails CI (§16). Routes are tenant-scoped under the resolved host unless prefixed `/api/platform`.

| Route (method) | Permission | Ownership | Relationship | Entitlement |
|---|---|---|---|---|
| `GET /api/platform/tenants` | `platform.tenant.read` | — | — | — (platform scope + audit) |
| `POST /api/platform/tenants` | `platform.tenant.manage` | — | — | — |
| `POST /api/platform/tenants/:id/suspend` | `platform.tenant.manage` | — | — | — |
| `PUT /api/platform/tenants/:id/entitlements` | `platform.entitlement.manage` | — | — | — (writes grant history + audit) |
| `GET /api/platform/audit` | `platform.audit.read` | — | — | — |
| `GET /api/members` | `membership.read` | — | — | — |
| `POST /api/members/invite` | `membership.invite` | — | — | — |
| `POST /api/members/:id/suspend` | `membership.suspend` | — | owner-guard (target ≠ owner) | — |
| `DELETE /api/members/:id` | `membership.remove` | — | owner-guard | — |
| `GET /api/me/profile` | `profile.read` | self | — | — |
| `PUT /api/me/profile` | `profile.update` | self (`member_profiles.membership_id`) | — | — |
| `PUT /api/members/:id/profile` | `profile.update`+`membership.read` | bypass(admin) | — | — |
| `GET /api/roles` | `role.read` | — | — | — |
| `POST /api/roles` | `role.create` | — | no-grant-up | — |
| `PUT /api/roles/:id` | `role.update` | — | no-grant-up, not-owner-role | — |
| `POST /api/members/:id/roles` | `role.assign` | — | no-grant-up, cannot-assign-owner | — |
| `DELETE /api/members/:id/roles/:roleId` | `role.revoke` | — | rank-guard (admin ≠ revoke owner) | — |
| `POST /api/permission-overrides` | `permission_override.manage` | — | no-grant-up | — |
| `PUT /api/branding` | `branding.update` | — | — | — |
| `POST /api/branding/publish` | `branding.publish` | — | — | — |
| `POST /api/domains` (custom) | `tenancy.domain.manage` | — | — | `branding.custom_domain.enable` |
| `PUT /api/config` | `config.update` | — | — | — |
| `POST /api/config/publish` | `config.publish` | — | — | — |
| `POST /api/courses` | `course.create` | — | — | — |
| `PUT /api/courses/:id` | `course.update` | `courses.created_by_membership_id` (instructor) / bypass(admin) | course-instructor | — |
| `DELETE /api/courses/:id` | `course.delete` | same | course-instructor | — |
| `POST /api/courses/:id/publish` | `course.publish` | — | course-instructor + workflow gate | — |
| `POST /api/enrollments` | `enrollment.create` | self (learner) / bypass(admin) | — | — |
| `GET /api/courses/:id/progress` | `progress.read` | self (learner) | course-instructor | — |
| `POST /api/items` | `item.create` | — | — | — |
| `PUT /api/items/:id` | `item.update` | `items.created_by_membership_id` / bypass(admin) | — | — |
| `POST /api/assessments` | `assessment.create` | — | — | — |
| `POST /api/assessments/:id/publish` | `assessment.publish` | — | assessment-author + workflow gate | — |
| `POST /api/assessments/:id/attempts` | `attempt.start` | self | — | — |
| `POST /api/attempts/:id/submit` | `attempt.submit` | `attempts.membership_id` | — | — |
| `GET /api/attempts/:id` | `attempt.read` | `attempts.membership_id` (learner) | grading-assignee / course-instructor | — |
| `POST /api/grading-tasks/:id/grade` | `assessment.grade` | — | `grading_tasks.assigned_to_membership_id` / bypass(admin) | — |
| `POST /api/practice-sessions` | `practice.start` | self | — | — |
| `POST /api/scoring-profiles` | `scoring_profile.create` | — | — | — |
| `POST /api/scoring-config/:id/publish` | `scoring_config.publish` | — | — | — |
| `GET /api/me/competency` | `competency.score.read` | self | — | — |
| `GET /api/members/:id/competency` | `competency.score.read` | bypass(admin) | course-instructor | — |
| `POST /api/certificates/:id/revoke` | `certificate.revoke` | — | — | `certification.enable` |
| `GET /api/verify/:credentialId` | **public** | — | — | — (logs `credential_verifications`) |
| `GET /api/leaderboards/:id` | `leaderboard.read` | — | — | `gamification.enable` |
| `GET /api/spaces/:id/posts` | `post.read` | — | space-member (private/unlisted) | `community.enable` |
| `POST /api/spaces/:id/posts` | `post.create` | — | space-member | `community.enable` |
| `PUT /api/posts/:id` | `post.update` | `posts.author_membership_id` / bypass(moderate) | — | `community.enable` |
| `DELETE /api/posts/:id` | `post.delete` | `posts.author_membership_id` | `community.moderate` (any) | `community.enable` |
| `POST /api/moderation/cases/:id/decide` | `community.moderate` | — | — | `community.enable` |
| `POST /api/appeals` | `appeal.create` | `appeals.submitted_by_membership_id` | — | `community.enable` |
| `POST /api/appeals/:id/review` | `appeal.review` | — | `community.moderate` | `community.enable` |
| `GET /api/analytics/dashboards` | `analytics.dashboard.view` | — | — | `analytics.dashboard.view` |
| `POST /api/exports` | `data.export.run` | — | — | `data.export.enable` |
| `POST /api/deletion-requests` | `data.deletion.request` | self (learner) / any(admin) | — | — |
| `GET /api/audit` | `audit.read` | — | — | — |
| `POST /api/workflows/:id/transition` | `workflow.transition.act` | — | workflow-approver | — |
| `POST /api/automation-rules` | `automation.rule.manage` | — | — | — |
| `POST /api/extensions/registrations` | `extension.registration.manage` | — | — | — |
| `POST /api/diagnostic/start` | `diagnostic.start` (public variant) | — | — | — (rate-limited) |
| `PUT /api/readiness-policy` | `readiness_policy.manage` | — | — | — |

---

## 13. Audit Requirements

Every row below produces an append-only, hash-chained `audit_entries` record (`action`, `target_type`, `target_id`, `actor_membership_id`/`actor_principal_id`, `before_json`, `after_json`, `request_id`, hashed IP/UA). Audit writes ride the same transaction as the change. Audit is non-bypassable; missing audit on a sensitive action is a CI failure (§16).

| Authorization action | `audit_entries.action` | Notes |
|---|---|---|
| Role assigned to member | `access.role.assigned` | includes role_id, target membership |
| Role revoked | `access.role.revoked` | rank-guard outcome recorded |
| Role created/updated/deleted | `access.role.*` | before/after permission set |
| Permission override set/removed | `access.override.set` / `.removed` | effect, reason, expiry |
| Membership invited/suspended/removed | `identity.membership.*` | state transition |
| Login (esp. admin/super admin) | `identity.login` | MFA result |
| Entitlement granted/changed (platform) | `config.entitlement.changed` | + `entitlement_grant_history` row |
| Feature flag override changed | `config.feature_flag.changed` | — |
| Branding/config published | `config.branding.published` / `config.config.published` | version id |
| Certificate issued / revoked | `credential.issued` / `credential.revoked` | credential_id |
| Workflow transition (publish gate) | `workflow.transition` | from/to state, actor |
| Moderation decision / appeal decision | `community.moderation.decided` | case id |
| Data export requested / deletion requested | `data.export.requested` / `data.deletion.requested` | scope |
| Platform scope entered / exited | `platform.scope.enter` / `platform.scope.exit` | **mandatory**, reason, tenant(s) touched |
| Entitlement denial (sensitive caps, sampled) | `authz.entitlement.denied` | drift/probe detection |
| Ownership/relationship bypass by admin on sensitive target | `authz.ownership.bypassed` | accountability for admin reach |

---

## 14. Security Threat Review

### 14.1 IDOR (object reference tampering)
**Risk:** `GET /api/attempts/:id` or `/api/posts/:id` with another user's or another tenant's id. **Mitigations (defense in depth):** (1) RLS forces `tenant_id = app.current_tenant_id()`, so a cross-tenant id returns empty; (2) ownership/relationship resolved inside `can()` blocks same-tenant cross-user access; (3) errors are uniform `403`/empty, never existence-revealing `404`-by-id; (4) every tenant-facing endpoint must ship an IDOR test (§16, §17). **Residual:** none structural; relies on no handler bypassing `withTenantTx` — enforced by CI gate.

### 14.2 Privilege escalation / grant-up
**Risk:** an `admin` grants itself or another member a permission it does not hold, or assigns `owner`. **Mitigations:** no-grant-up rule — `role.update`/`role.assign`/`permission_override.manage` reject any permission the actor does not itself currently hold; `admin` can never assign `owner` or edit the `owner` system role; rank guard prevents an `admin` from revoking/removing the `owner`. All such attempts are audited (`access.*`). **Residual:** an owner can grant broadly within its own tenant by design; bounded by tenant isolation and audit.

### 14.3 Tenant breakout
**Risk:** principal authenticated in Tenant A acts on Tenant B because the JWT exists (host wins over JWT claim). **Mitigations:** the membership gate (load-bearing) requires an `ACTIVE` membership in the *host-resolved* tenant before anything proceeds (Architecture Review M10); RLS independently filters to `app.tenant_id`; transaction-scoped GUC (`set_config(..., true)`) prevents pooled-connection tenant bleed (Architecture Review C1/C2); no client-supplied `tenant_id` is ever trusted on writes. **Residual:** global-identity ATO blast radius — mitigated by admin MFA, session/JWT revocation, and audit (§8.3).

### 14.4 Role escalation via state confusion
**Risk:** a `SUSPENDED`/`REMOVED`/`INVITED` member retains access, or a removed member's cached permissions persist. **Mitigations:** membership state is re-checked every request at step 4 (no trusting stale tokens); permission cache keyed on `(tenant, membership, version)` with Redis revocation on role/membership change; `INVITED` reaches only the acceptance endpoint. **Residual:** cache TTL window — bounded by short TTL + explicit revocation.

### 14.5 Ownership bypass
**Risk:** an endpoint authorizes an owned-resource action without the ownership predicate (the classic "endpoint #15 forgot"). **Mitigation:** ownership/relationship is resolved **inside** `can(actor, perm, resourceRef, ctx)` (M6) — you cannot call the authorization function without supplying the resource ref, and a CI gate fails any owned-resource route whose handler does not pass a resource ref. **Residual:** admin tenant-wide bypass is intentional and audited (`authz.ownership.bypassed`).

### 14.6 Platform-scope abuse
**Risk:** standing or unaudited cross-tenant access; a tenant route flipping `platform_scope`. **Mitigations:** separate `atlas_platform` DB role + dedicated client; `withPlatformScope` enforces reason + enter/exit audit; tenant `atlas_app` connections are physically unable to satisfy the platform RLS policy; CI fails platform routes lacking audit and fails any tenant code setting `app.platform_scope`. **Residual:** insider misuse — bounded by mandatory reason + immutable hash-chained audit + least-privilege platform bundles.

### 14.7 Entitlement bypass
**Risk:** code checks plan name instead of entitlement, or skips the entitlement gate. **Mitigation:** single `enforceEntitlement` chokepoint against `entitlements` rows (M5); plan-name checks are banned; CI fails entitlement-gated routes (per registry) missing the call. **Residual:** drift detected via sampled `authz.entitlement.denied` audit.

---

## 15. Implementation Contract

### 15.1 `can()` input/output contract

```ts
type ResourceRef =
  | { type: string; id: string }            // existing resource (ownership/relationship resolvable)
  | { type: string; id: null };             // create-class action (no instance yet)

interface TenantContext {
  tenantId: string;            // resolved from host, set as app.tenant_id
  actorMembershipId: string;   // ACTIVE membership (set by membership gate)
  tenantState: 'ACTIVE';       // gate guarantees ACTIVE for protected routes
  requestId: string;
}

interface Decision {
  allowed: boolean;
  reason:
    | 'OK'
    | 'PERMISSION_DENIED'
    | 'OWNERSHIP_DENIED'
    | 'RELATIONSHIP_DENIED'
    | 'NO_MEMBERSHIP'
    | 'TENANT_STATE';
  audit?: boolean;             // true => caller must persist an authz audit entry
}

// MUST be the only authorization decision point. resourceRef is REQUIRED.
function can(
  actor: TenantContext,
  permissionKey: string,
  resourceRef: ResourceRef,
  tenantContext: TenantContext
): Promise<Decision>;
```

`can()` internally and in this fixed order: (1) confirm `actor` membership is `ACTIVE`; (2) resolve effective permissions = role_permissions(union of assigned roles) ∪ overrides(allow) − overrides(deny) — **deny overrides always win**; (3) require `permissionKey` ∈ effective set; (4) if the permission/resource type is owned/related, resolve the ownership/relationship predicate against the resource (admin/owner context permission may bypass, tenant-scoped, audited); (5) confirm tenant state; (6) flag audit for sensitive allow/deny. `can()` performs **no** entitlement check — that is `enforceEntitlement` and runs first.

### 15.2 Authorization middleware contract

Order per request: `resolveHost → assertTenantActive → authenticate → membershipGate → withTenantTx(set GUCs) → enforceEntitlement(*) → can(*) → handler`. The middleware refuses to invoke a handler that has not declared `{ permission, entitlement?, resourceLoader? }` metadata. `resourceLoader` returns the `ResourceRef` so `can()` always receives a resource. No handler may open a Prisma transaction itself.

### 15.3 Service-layer contract

Services accept an already-authorized `TenantContext` and a verified `ResourceRef`; they never re-resolve the tenant from client input and never re-authenticate. Services may call `can()` again for secondary resources they touch (defense in depth) but must not weaken the route decision. Cross-context access goes through service interfaces/events, never direct foreign-context SQL (Database Design v2 §3).

### 15.4 RLS interaction model

`can()` is the **primary** gate; RLS is the **backstop**. Every tenant query runs inside `withTenantTx`, which sets `app.tenant_id` transaction-locally; RLS policies (`tenant_id = app.current_tenant_id()`) re-enforce isolation even if application logic is wrong. They must always agree: a decision `allowed=true` that RLS would block indicates a bug (wrong tenant context) and must fail tests. Global catalogue tables (`permissions`, `permission_bundles`, `feature_flags`, `item_types`, `extension_points`) are read via SQL grant, not RLS.

### 15.5 Ownership validation model

Ownership = `actor.membershipId === resource[ownerColumn]`, resolved by the `resourceLoader` + a per-resource-type owner-column map (the columns enumerated in §6). For create-class actions (`id: null`) ownership is N/A and the permission grant alone authorizes. Admin/owner context grants bypass ownership within-tenant only, with `authz.ownership.bypassed` audit on sensitive targets.

### 15.6 Entitlement validation model

```ts
function enforceEntitlement(
  tenantId: string,
  entitlementKey: string,
  usageContext?: Record<string, unknown>
): Promise<void>; // throws EntitlementRequiredError(entitlementKey) => 403 ENTITLEMENT_REQUIRED
```

Reads the active `entitlements` row for `(tenantId, key)` where `expires_at` is null or future. Never reads plan names. Caches per tenant in Redis with invalidation on `platform.entitlement.manage`. Runs **before** `can()`.

---

## 16. CI Security Gates

CI must **fail the build** if any of the following is true. These extend (and do not replace) the schema gates in Database Design v2 §20.

1. A protected route has no declared `permission` in its authorization metadata.
2. A permission key used in code is missing from the `permissions` registry / catalog (§4).
3. A route acting on an owned/related resource type does not supply a `resourceLoader` (i.e., calls `can()` without a `ResourceRef`).
4. An entitlement-gated route (per the entitlement registry in §9) does not call `enforceEntitlement`.
5. A tenant-facing handler executes Prisma/SQL outside `withTenantTx` (tenant scope missing).
6. A platform route does not run inside `withPlatformScope` or lacks `platform.scope.enter`/`exit` audit.
7. Any tenant code path sets `app.platform_scope` or uses the `platformPrisma`/`atlas_platform` client.
8. A raw SQL migration contains session-level `SET app.tenant_id` (only `set_config(..., true)` allowed).
9. A `platform.*` permission appears in a `roles`/`role_permissions`/`user_roles` seed or fixture.
10. A sensitive authorization action (§13) lacks a corresponding audit write.
11. A new tenant-facing endpoint ships without an IDOR test and a membership-gate test.
12. A role seed grants a permission outside the §5 matrix (drift detection against the matrix as the spec).
13. Any authorization decision is made outside `can()` (ad-hoc `if (role === 'admin')` checks are banned).

---

## 17. Test Plan

**17.1 Authorization tests.** For each role × each permission, assert allow/deny matches the §5 matrix; assert default-deny for unmapped permissions; assert deny-override beats allow.

**17.2 Ownership tests.** Instructor edits own course → allow; edits another instructor's course → `OWNERSHIP_DENIED`; admin edits any → allow (audited). Learner submits own attempt → allow; submits another's → deny. Learner updates own profile → allow; another's → deny.

**17.3 Relationship tests.** Instructor reads progress/scores for learners in their course → allow; for learners in a course they don't teach → `RELATIONSHIP_DENIED`. Grader grades assigned task → allow; unassigned (non-admin) → deny. Non-member reads private space post → deny; member → allow.

**17.4 IDOR tests.** For every tenant-facing GET/PUT/DELETE: supply (a) another tenant's id → empty/`403`, never `404`-by-existence; (b) another same-tenant user's id on an owned resource → `403`. Run the cross-tenant IDOR matrix (Database Design v2 §21.1/§21.3).

**17.5 Tenant isolation tests.** Tenant A cannot read/write B's courses, memberships, attempts, scores, posts, search, private certs (Database Design v2 §21.1). RLS direct-query tests with `atlas_app`: no `app.tenant_id` → zero rows; mismatched `tenant_id` insert/update/delete fails (§21.2). Transaction-pooling test: A then B then high-concurrency A/B, assert no GUC leak (§21.4) — **Phase 0 exit gate**.

**17.6 Platform scope tests.** Tenant role cannot use `platformPrisma`; Super Admin route writes `platform.scope.enter`/`exit`; missing reason fails; platform query succeeds only on `atlas_platform`; tenant request setting `platform_scope` rejected.

**17.7 Membership gate tests.** Valid JWT + no membership → `403 NO_MEMBERSHIP`; `SUSPENDED` → `403`; `REMOVED` → `403`; `INVITED` reaches only acceptance; host-tenant ≠ JWT-tenant → membership gate wins; public diagnostic works without membership but only under host tenant; no JWT → `401`.

**17.8 Entitlement tests.** Community/certs/gamification/advanced-analytics off → `403 ENTITLEMENT_REQUIRED` even for owner; on → permission gate decides; plan-name checks absent (static analysis); entitlement change invalidates cache + writes history + audit.

---

## 18. Final CTO Verdict

**Verdict: APPROVED for implementation — conditional.** This authorization model sits correctly on Database Design v2, redesigns nothing, adds no tables, defines no Phase 2–4 permissions, avoids permission and role explosion (≈110 permissions, 3 platform roles, 5 tenant roles, heavy verb reuse), keeps Super Admin structurally isolated from tenant roles, and routes every decision through one `can()` plus one `enforceEntitlement` with ownership/relationship folded in (closing Architecture Review M5, M6, M10). FundedBeyond consumes only generic Atlas authorization — its diagnostic, swipe, scoring, and readiness surfaces are ordinary configuration on generic engines, not forks.

**Conditions that must be met before/at implementation:**

1. The Phase 0 transaction-pooling RLS/IDOR harness (§17.5) is green **before** any §4 permission is wired to a handler — the membership gate and RLS are load-bearing and must be proven on the real pooled stack first (C1/C2).
2. `can()` and `enforceEntitlement` are the *only* decision points; the §16 CI gates are live in the pipeline before feature routes merge.
3. The no-grant-up rule, owner rank-guard, and platform-scope separation have passing tests (§17.2, §17.6) before role-management or platform UIs ship.
4. Admin/Super-Admin MFA, Redis-backed revocation, and the audit hash-chain are operational before production traffic (§8.3, §13).
5. The §5 matrix is committed as machine-readable seed data and CI diffs role seeds against it (gate 12) — the matrix is the spec, not documentation.

**Exact next document to produce:** **API Contract & Endpoint Specification v1 (Phase 0 + Phase 1)** — the route-by-route binding that, for every endpoint, declares its `permission`, `resourceLoader`, ownership/relationship predicate, `entitlement`, request/response schema (Zod), idempotency key where applicable, and emitted outbox event. It operationalizes §11/§12/§15 into the contract that handlers and the authorization middleware implement, and is the artifact the engineering team builds against next.
