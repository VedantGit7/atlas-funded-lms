# ATLAS LMS — SPRINT PLANNING v1
## Phase 0 + Phase 1A + Phase 1B Engineering Execution Plan
**Status:** Implementation-ready sprint planning document  
**Scope:** Converts locked artifacts into epics, stories, tasks, sprint order, dependencies, and validation gates.  
**Team Assumption:** 1 Product Lead · 1 Full Stack Engineer · 1 Frontend Engineer · 1 Backend Engineer · 1 QA Engineer  
**Sprint Duration:** 2 weeks per sprint unless leadership explicitly changes cadence.  
**Binding Rule:** This plan adds no new screens, APIs, permissions, workflows, entities, architecture decisions, or product behavior.

## Source-of-Truth Contract

This Sprint Planning v1 converts the locked artifacts into an execution roadmap only. It does not create or alter product scope.

Locked constraints applied throughout:

- Phase 0 is an isolation/correctness phase before feature work.
- Phase 1A delivers core learning loop surfaces.
- Phase 1B delivers engagement and app-layer surfaces.
- FundedBeyond Academy is Tenant #1 configuration only; no fork, branch, or tenant-specific platform code is permitted.
- All protected requests run tenant resolution → tenant-state gate → authentication → ACTIVE membership gate → withTenantTx → entitlement gate where applicable → `can()` authorization → resource access.
- Every API route must use the approved route metadata and declared authorization model.
- Every screen must use an approved screen ID only.
- Every database reference must be an approved P0/P1 table only.
- Deferred items are rejected from this plan: commerce checkout, SaaS billing depth, inbound challenge purchase/pass/funded events, live/webinar/event, L2/L3 proctoring, native mobile build endpoints, full plugin marketplace/sandbox, AI layer/AI coach, multi-region/dedicated tenant routing, and inbound-verified Hall of Fame.
## 1. Executive Summary

Atlas LMS Sprint Planning v1 sequences the approved Phase 0 + Phase 1A + Phase 1B scope into 11 engineering sprints.

The plan is intentionally dependency-first:

1. Prove tenant isolation, RLS, transaction-local tenant context, membership gate, authorization, audit, and platform isolation before product surfaces.
2. Provision tenants, branding, domains, storage references, and operational consoles before core learning.
3. Build learning, lessons, assessment, item registry, workflow, competency scoring, readiness, and swipe in the exact order that avoids a FundedBeyond fork.
4. Add certification, notifications, automation, community, moderation, search, analytics, data rights, and role consoles only after the core learning/scoring loop is sound.
5. End with FundedBeyond Tenant #1 configuration and full release validation, including a second-tenant smoke test.

The critical path is: **Database/RLS → Tenant Resolution → Auth/Membership → Authorization/Entitlement → Audit/Outbox → Provisioning/Branding → Course/Lesson → Item Registry/Assessment → Workflow → Competency/Readiness → Diagnostic/Swipe → Gamification/Certificates/Community/Analytics → Consoles → Release Hardening**.
## 2. Development Principles
- **No feature before isolation.** Phase 0 exits only when RLS, transaction-local tenant context, and cross-tenant IDOR tests are green.
- **Host is authoritative.** Tenant resolution uses host/domain first; no API accepts client-supplied `tenant_id`.
- **Membership is load-bearing.** Every protected route re-checks ACTIVE membership for the resolved tenant.
- **Default deny.** Every protected route declares `{ permission, entitlement?, resourceLoader? }`; missing metadata fails build.
- **Entitlement before permission.** Tenant plan/capability gate runs before `can()` where applicable.
- **Ownership and relationship inside `can()`.** Endpoint-specific ownership shortcuts are forbidden.
- **Audit irreversible and sensitive actions.** Audit rows are written in the same transaction as the mutation.
- **Outbox for side effects.** Events, notifications, rollups, and derived projections use the outbox/worker pattern.
- **No self-hosted video.** Lessons store provider references and R2 asset references only.
- **FundedBeyond is configuration.** Diagnostic, readiness, swipe, dimensions, policies, branding, community, and content are data/config on generic Atlas engines.
- **Human gate stays visible.** Publish, issue, revoke, and review transitions use workflow surfaces, not direct state flips.
- **Responsive web only for this scope.** Native mobile app/build endpoints are deferred.
## 3. Dependency Graph
### 3.1 Critical Path
```text
Sprint 0  Database Foundation + RLS + CI
    ↓
Sprint 1  Tenant Resolution + Auth + Membership + can()
    ↓
Sprint 2  Entitlements + Audit/Outbox + Provisioning + Branding + Storage
    ↓
Sprint 3  Course + Lesson + Progress
    ↓
Sprint 4  Workflow + Item Registry + Assessment + Grading
    ↓
Sprint 5  Learning Paths + Competency + Readiness + CTA Token
    ↓
Sprint 6  Public Diagnostic + Swipe + Gamification
    ↓
Sprint 7  Certificates + Notifications + Automation/Locales
    ↓
Sprint 8  Community + Moderation + Search + Analytics
    ↓
Sprint 9  Learner/Instructor/Moderator/Tenant Admin/Platform Consoles + Data Rights
    ↓
Sprint 10 Observability + FundedBeyond Config + Release Validation
```
### 3.2 Blocking Dependencies
| Blocker | Blocks | Reason |
|---|---|---|
| RLS + withTenantTx | All tenant APIs/screens | Tenant isolation is the platform invariant. |
| Host tenant resolution | Auth, public branding, protected routes | Tenant must be known before session/membership/permission. |
| Membership gate | All protected routes | ACTIVE membership is required for protected surfaces. |
| Permission catalogue + can() | All protected APIs | Default-deny and ownership/relationship checks must be centralized. |
| Entitlement gate | Community/certificates/gamification/analytics/domains/data export where gated | Tenant capability must fail before permission. |
| Audit/outbox | Provisioning, role changes, publish, certificates, moderation, exports | Sensitive mutations must be auditable and side effects must be reliable. |
| Item-type registry | Swipe and generic practice | Swipe must not modify Assessment core. |
| Competency scoring | Readiness and diagnostic value | Readiness depends on generic scoring projections. |
| Legal/readiness copy approval | Readiness CTA and public diagnostic launch | Readiness must be educational, not financial advice. |

### 3.3 Parallel Workstreams
- **Frontend:** Design System/shadcn component composition, shell implementation, screen wiring after API contracts are ready.
- **Backend:** API handlers, middleware, `can()`, entitlements, service boundaries, outbox, workers, Zod validation.
- **Database:** Prisma models, migrations, RLS, indexes, idempotency constraints, append-only protections, seed data.
- **DevOps:** Vercel/Cloudflare/Supabase/R2/Redis/Sentry/PostHog/Better Stack configuration and CI/CD gates.
- **QA:** Isolation matrix, authorization matrix, API integration tests, E2E journeys, release readiness checks.
## 4. Epic Inventory
### ATL-EPIC-001 — Platform Foundation
**Objective:** Establish the repository, CI gates, runtime conventions, environment separation, request spine, and engineering guardrails required before any product feature work.

**Dependencies:** None

**Deliverables:**
- Next.js App Router + TypeScript monorepo baseline
- Tailwind + shadcn/ui baseline wired to Design System v1
- CI gates for typecheck, lint, tests, authorization metadata, tenant-safe DB access, audit-sensitive actions
- Environment configuration for Vercel, Cloudflare, Supabase, R2, Sentry, PostHog, Better Stack

**Related APIs:** `/api/v1/health`, `/api/v1/internal/outbox/*`

**Related DB Tables:** `outbox_events`, `event_deliveries`, `dead_letter_events`, `audit_entries`

**Related Screens:** `All shells`, `A10`

**Related Permissions:** `route metadata required`, `default deny`

**Stories:** ATL-STORY-001, ATL-STORY-045

### ATL-EPIC-002 — Authentication & Membership
**Objective:** Implement Supabase Auth bridge, session handling, invitation acceptance, membership gate, and per-tenant profile boundary.

**Dependencies:** Platform Foundation, Tenant Resolution, Database Foundation

**Deliverables:**
- Auth/session bridge
- Signup/login/reset flows
- Invitation acceptance flow
- ACTIVE membership gate on every protected request
- Member profile boundary

**Related APIs:** `POST /public/auth/login`, `POST /public/auth/signup`, `POST /public/invitations/accept`, `GET /me`, `GET/PUT /me/profile`, `GET /members`, `POST /members/invite`

**Related DB Tables:** `auth_principals`, `memberships`, `member_profiles`

**Related Screens:** `A6`, `A7`, `A8`, `A9`, `L24`, `T2`, `T3`

**Related Permissions:** `pub`, `membership.read`, `membership.invite`, `membership.suspend`, `membership.remove`, `profile.read`, `profile.update`

**Stories:** ATL-STORY-005, ATL-STORY-006, ATL-STORY-014

### ATL-EPIC-003 — Tenant Resolution
**Objective:** Resolve tenant from host before auth/business logic and enforce tenant lifecycle state before rendering or API access.

**Dependencies:** Database Foundation

**Deliverables:**
- Host → tenant middleware
- Custom domain/subdomain resolution
- Tenant state gate
- Unknown/suspended/archived/deleted handling
- No client-supplied tenant_id acceptance

**Related APIs:** `All /api/v1/** routes`

**Related DB Tables:** `tenants`, `tenant_domains`

**Related Screens:** `A10`, `All protected screens`

**Related Permissions:** `n/a before auth`, `tenant-state gate`

**Stories:** ATL-STORY-003, ATL-STORY-004

### ATL-EPIC-004 — Authorization Engine
**Objective:** Implement default-deny authorization, entitlement gate, role/permission catalogue, ownership/relationship predicates, and platform-scope isolation.

**Dependencies:** Authentication & Membership, Tenant Resolution, Database Foundation, Audit Infrastructure

**Deliverables:**
- Seeded permission catalogue
- Tenant role model
- can() decision service
- enforceEntitlement() service
- Permission overrides
- Platform-scope wrapper with reason capture
- CI route metadata enforcement

**Related APIs:** `/roles`, `/permission-overrides`, `/members/:id/roles`, `/entitlements`, `/platform/*`

**Related DB Tables:** `permissions`, `permission_bundles`, `roles`, `role_permissions`, `user_roles`, `permission_overrides`, `entitlements`, `entitlement_grant_history`, `audit_entries`

**Related Screens:** `T3`, `T4`, `T5`, `T10`, `P1-P8`

**Related Permissions:** `role.*`, `permission_override.*`, `entitlement.read`, `platform.*`

**Stories:** ATL-STORY-007, ATL-STORY-008, ATL-STORY-009, ATL-STORY-019

### ATL-EPIC-005 — Database Foundation
**Objective:** Deliver Prisma schema, migrations, RLS, transaction-local tenant context, append-only rules, seed data, indexes, idempotency constraints, and isolation tests.

**Dependencies:** Platform Foundation

**Deliverables:**
- Initial Prisma schema and migrations
- RLS policies for tenant tables
- withTenantTx using transaction-local set_config(..., true)
- withPlatformScope using atlas_platform role
- Seed data for system roles, permissions, item types, extension points
- Isolation/IDOR test harness

**Related APIs:** `Internal DB access only`

**Related DB Tables:** `All P0/P1 tables in Database Design v2`

**Related Screens:** `None directly`

**Related Permissions:** `All permissions enforced by DB context + can()`

**Stories:** ATL-STORY-002, ATL-STORY-003

### ATL-EPIC-006 — Storage Foundation
**Objective:** Wire Cloudflare R2 and asset-reference patterns without self-hosted video or plaintext secret storage.

**Dependencies:** Platform Foundation, Database Foundation, Tenant Resolution

**Deliverables:**
- R2 bucket conventions
- Signed upload/read helpers where allowed
- Lesson asset reference storage
- Branding asset references
- Provider video URL storage rules
- secret_refs only for references

**Related APIs:** `GET/POST/DELETE /lessons/:id/assets`, `GET/PUT /branding`, `PUT /theme`

**Related DB Tables:** `lesson_assets`, `tenant_branding`, `tenant_theme`, `secret_refs`

**Related Screens:** `I4`, `T6`, `L4`

**Related Permissions:** `course.update`, `branding.update`, `branding.publish`

**Stories:** ATL-STORY-013

### ATL-EPIC-007 — Audit Infrastructure
**Objective:** Make sensitive actions append tamper-evident audit entries in the same transaction and surface tenant/platform audit views.

**Dependencies:** Database Foundation, Authorization Engine

**Deliverables:**
- audit_entries append-only writes
- Hash-chain verification routine
- Audit action taxonomy wiring
- Tenant audit log
- Platform audit log
- CI check for sensitive action audit

**Related APIs:** `GET /audit`, `GET /platform/audit`

**Related DB Tables:** `audit_entries`

**Related Screens:** `T22`, `P6`

**Related Permissions:** `audit.read`, `platform.audit.read`

**Stories:** ATL-STORY-010, ATL-STORY-019

### ATL-EPIC-008 — Notification Infrastructure
**Objective:** Implement notification templates, dispatches, in-app inbox, and event-driven dispatch foundation.

**Dependencies:** Audit Infrastructure, Database Foundation, Eventing

**Deliverables:**
- Notification templates CRUD
- Notification dispatch pipeline
- In-app notification inbox
- Mark-read action
- Outbox-driven template dispatch

**Related APIs:** `GET/POST/PUT/DELETE /notification-templates`, `GET /me/notifications`, `POST /me/notifications/:id/read`

**Related DB Tables:** `notification_templates`, `notification_dispatches`, `outbox_events`

**Related Screens:** `T15`, `L23`

**Related Permissions:** `notification.template.read`, `notification.template.manage`, `notification.read.self`

**Stories:** ATL-STORY-031

### ATL-EPIC-009 — Course Engine
**Objective:** Create/read/update/publish courses with tenant isolation, instructor ownership, enrollment, catalog discovery, and workflow publish handoff.

**Dependencies:** Authorization Engine, Storage Foundation, Audit Infrastructure, Workflow

**Deliverables:**
- Course CRUD
- Instructor-owned course manager
- Learner catalog/detail
- Enrollment creation
- Course publish submission

**Related APIs:** `GET/POST /courses`, `GET/PUT/DELETE /courses/:id`, `GET /courses/:id/modules`, `POST /enrollments`, `POST /courses/:id/publish`

**Related DB Tables:** `courses`, `course_modules`, `enrollments`, `workflow_transitions`

**Related Screens:** `L2`, `L3`, `I2`, `I3`

**Related Permissions:** `course.read`, `course.create`, `course.update`, `course.publish`, `enrollment.create`

**Stories:** ATL-STORY-016, ATL-STORY-017

### ATL-EPIC-010 — Lesson Engine
**Objective:** Implement lesson authoring, asset references, learner playback, progress capture, resume/complete behavior, and next/previous navigation.

**Dependencies:** Course Engine, Storage Foundation

**Deliverables:**
- Lesson CRUD
- Asset reference management
- Lesson player
- Progress writes
- Resume position

**Related APIs:** `GET/PUT/DELETE /lessons/:id`, `GET/POST/DELETE /lessons/:id/assets`, `POST /lessons/:id/progress`

**Related DB Tables:** `lessons`, `lesson_assets`, `lesson_progress`

**Related Screens:** `L4`, `I4`

**Related Permissions:** `course.read`, `course.update`, `progress.read`, `progress.write.self`

**Stories:** ATL-STORY-018

### ATL-EPIC-011 — Learning Path Engine
**Objective:** Implement learning paths, path steps, gates, enrollments, learner roadmap, and instructor/admin path builder.

**Dependencies:** Course Engine, Assessment Engine, Competency Engine, Workflow

**Deliverables:**
- Learning path CRUD
- Path steps and gates
- Path enrollment
- Roadmap and program detail
- Path publish workflow

**Related APIs:** `GET/POST /learning-paths`, `GET/PUT/DELETE /learning-paths/:id`, `POST /learning-paths/:id/enroll`, `GET /learning-paths/:id/progress`, `POST /learning-paths/:id/publish`

**Related DB Tables:** `learning_paths`, `path_steps`, `path_step_gates`, `path_enrollments`, `path_step_progress`, `workflow_transitions`

**Related Screens:** `L5`, `L6`, `I9`

**Related Permissions:** `learning_path.read`, `learning_path.create`, `learning_path.update`, `learning_path.publish`, `enrollment.create`, `progress.read`

**Stories:** ATL-STORY-023

### ATL-EPIC-012 — Assessment Engine
**Objective:** Implement assessments, attempts, autosave answers, submit flow, result review, L1 proctoring hooks, and grading queue.

**Dependencies:** Question Bank, Authorization Engine, Audit Infrastructure, Workflow

**Deliverables:**
- Assessment builder
- Attempt start/answer/submit
- Attempt result view
- Grading task queue/detail
- L1 consent and event capture where configured

**Related APIs:** `GET/POST /assessments`, `GET/PUT/DELETE /assessments/:id`, `POST /assessments/:id/attempts`, `GET /attempts/:id`, `POST /attempts/:id/answers`, `POST /attempts/:id/submit`, `GET/POST /grading-tasks`

**Related DB Tables:** `assessments`, `assessment_items`, `attempts`, `attempt_answers`, `grading_tasks`, `exam_security_policies`, `proctoring_sessions`, `proctoring_events`, `proctoring_reports`

**Related Screens:** `L7`, `L8`, `L9`, `I8`, `I10`, `I11`

**Related Permissions:** `assessment.read`, `assessment.create`, `assessment.update`, `assessment.publish`, `attempt.start`, `attempt.submit`, `attempt.read`, `assessment.grade`

**Stories:** ATL-STORY-021, ATL-STORY-022

### ATL-EPIC-013 — Question Bank
**Objective:** Implement pluggable item-type registry, item authoring, item options, dimension weights, item collections/decks, and swipe item registration as generic first-party configuration.

**Dependencies:** Authorization Engine, Competency Engine

**Deliverables:**
- Global item-type catalogue seeded
- Item bank
- Item editor
- Dimension weights
- Item collections/decks
- Swipe item type registered without Assessment core fork

**Related APIs:** `GET /item-types`, `GET/POST /items`, `PUT /items/:id`, `GET/PUT /items/:id/dimension-weights`, `GET/POST /item-collections`, `PUT/DELETE /item-collections/:id`, `POST/DELETE /item-collections/:id/items`

**Related DB Tables:** `item_types`, `items`, `item_options`, `item_dimension_weights`, `item_collections`, `item_collection_items`

**Related Screens:** `I5`, `I6`, `I7`, `T19`

**Related Permissions:** `item.read`, `item.create`, `item.update`, `item_collection.manage`, `extension.registration.manage`

**Stories:** ATL-STORY-020

### ATL-EPIC-014 — Certificates Engine
**Objective:** Implement certificate templates, issuance, revocation, learner certificate wallet, and public verification.

**Dependencies:** Course Engine, Assessment Engine, Workflow, Audit Infrastructure

**Deliverables:**
- Template CRUD/publish
- Certificate issue/revoke
- Learner certificate list
- Public verification page/API
- Credential verification audit/projection

**Related APIs:** `GET/POST/PUT/DELETE /certificate-templates`, `POST /certificate-templates/:id/publish`, `GET /certificates`, `POST /certificates/issue`, `POST /certificates/:id/revoke`, `GET /public/verify/:credentialId`

**Related DB Tables:** `certificate_templates`, `certificates`, `credential_verifications`, `workflow_transitions`

**Related Screens:** `A5`, `L14`, `T12`, `T13`

**Related Permissions:** `certificate_template.read`, `certificate_template.manage`, `certificate_template.publish`, `certificate.read`, `certificate.issue`, `certificate.revoke`, `pub`

**Stories:** ATL-STORY-030

### ATL-EPIC-015 — Competency Engine
**Objective:** Implement generic dimension configuration, scoring profiles, scoring configs, signal ingestion, current score projection, and score history.

**Dependencies:** Question Bank, Assessment Engine, Audit Infrastructure

**Deliverables:**
- Competency dimension CRUD
- Scoring profile CRUD
- Versioned scoring config publish
- Signal-source catalogue
- Signal ingestion from assessment/practice
- Current score projection
- Score snapshots/history

**Related APIs:** `GET/POST/PUT/DELETE /competency-dimensions`, `GET/POST/PUT /scoring-profiles`, `GET/PUT /scoring-profiles/:id/bands`, `POST /scoring-config/:id/publish`, `GET /me/competency`, `GET /me/competency/history`, `GET /members/:id/competency`, `GET /competency-signals`

**Related DB Tables:** `competency_dimensions`, `scoring_profiles`, `scoring_config_versions`, `competency_bands`, `signal_sources`, `competency_signals`, `competency_scores`, `competency_score_snapshots`

**Related Screens:** `L1`, `L12`, `L13`, `I12`, `T11`

**Related Permissions:** `competency.dimension.manage`, `scoring_profile.create`, `scoring_profile.update`, `scoring_config.publish`, `competency.score.read`, `competency.signal.read`

**Stories:** ATL-STORY-024, ATL-STORY-025

### ATL-EPIC-016 — Readiness Engine
**Objective:** Configure generic composite readiness state and policy for FundedBeyond without tenant-specific code; support educational readiness display and attributed CTA token.

**Dependencies:** Competency Engine, Analytics Engine, Legal copy approval gate

**Deliverables:**
- Readiness policy config
- Composite readiness state projection
- Learner readiness screen
- Admin readiness policy screen
- CTA attribution token issuance
- Educational/non-advice copy controls

**Related APIs:** `GET /readiness-policy`, `GET/PUT /readiness-policy`, `GET /me/competency`, `GET /me/competency/history`, `POST /cta/attribution-token`

**Related DB Tables:** `composite_readiness_state`, `scoring_profiles`, `scoring_config_versions`, `funnel_daily_rollups`

**Related Screens:** `L12`, `T20`, `A2-A4`

**Related Permissions:** `readiness_policy.read`, `readiness_policy.manage`, `competency.score.read`

**Stories:** ATL-STORY-026, ATL-STORY-027, ATL-STORY-044

### ATL-EPIC-017 — Swipe Learning Engine
**Objective:** Implement swipe practice as a first-party generic assessment/practice mode with SRS due queue, response batching, signal generation, and gamification triggers.

**Dependencies:** Question Bank, Assessment Engine, Competency Engine, Gamification Engine

**Deliverables:**
- Swipe item type registration
- Due queue
- Practice session start/response/complete
- Server-side validation before scoring
- Competency signal emission
- Streak/XP events

**Related APIs:** `GET /me/srs/due`, `POST /practice-sessions`, `POST /practice-sessions/:id/responses`, `POST /practice-sessions/:id/complete`

**Related DB Tables:** `item_types`, `practice_sessions`, `practice_responses`, `srs_state`, `competency_signals`, `point_ledger`, `streak_states`

**Related Screens:** `L10`

**Related Permissions:** `practice.start`, `practice.submit`, `competency.score.read`

**Stories:** ATL-STORY-028

### ATL-EPIC-018 — Gamification Engine
**Objective:** Implement XP, badges, streaks, freezes, leaderboards, learner achievements, and tenant gamification configuration.

**Dependencies:** Eventing, Swipe Learning Engine, Course Engine, Assessment Engine

**Deliverables:**
- Gamification profile
- Point ledger writes
- Badge definitions/awards
- Streak states/freezes
- Leaderboard definitions/snapshots
- Learner achievement and leaderboard screens

**Related APIs:** `GET /me/gamification`, `GET /me/streaks`, `POST /me/streaks/:key/freeze`, `GET/POST/PUT /badges`, `GET/POST/PUT /leaderboards`, `GET /leaderboards`, `GET /leaderboards/:id`

**Related DB Tables:** `gamification_profiles`, `point_ledger`, `badges`, `badge_awards`, `streak_states`, `streak_freezes`, `leaderboard_definitions`, `leaderboard_snapshots`

**Related Screens:** `L1`, `L15`, `L16`, `T14`, `L20`

**Related Permissions:** `gamification.profile.read`, `badge.read`, `badge.manage`, `leaderboard.read`, `leaderboard.manage`

**Stories:** ATL-STORY-029

### ATL-EPIC-019 — Community Engine
**Objective:** Implement spaces, group membership, posts, comments, reactions, mentions, community feed/thread screens, and Hall of Fame presentation within approved P1 limits.

**Dependencies:** Authorization Engine, Notification Infrastructure, Search, Moderation Engine

**Deliverables:**
- Community spaces
- Space join
- Posts/comments/reactions
- Mentions
- Community hub/feed/thread
- Hall of Fame based on approved space/leaderboard/certificate projections

**Related APIs:** `GET /spaces`, `POST /spaces/:id/join`, `GET/POST /spaces/:id/posts`, `GET /posts/:id/comments`, `POST /posts/:id/comments`, `PUT/DELETE /comments/:id`, `POST /reactions`

**Related DB Tables:** `community_spaces`, `group_memberships`, `posts`, `comments`, `reactions`, `mentions`

**Related Screens:** `L17`, `L18`, `L19`, `L20`, `M4`

**Related Permissions:** `community.space.read`, `community.space.join`, `post.read`, `post.create`, `comment.create`, `comment.update`, `comment.delete`, `reaction.create`

**Stories:** ATL-STORY-033

### ATL-EPIC-020 — Moderation Engine
**Objective:** Implement moderation cases, decisions, appeals, moderator queue/detail, and admin/moderator community actions.

**Dependencies:** Community Engine, Audit Infrastructure, Workflow

**Deliverables:**
- Moderation case queue
- Case decision flow
- Appeals review
- Moderation delete/update path
- Decision append-only history

**Related APIs:** `GET/POST /moderation/cases`, `POST /moderation/cases/:id/decide`, `POST /appeals/:id/review`, `DELETE /posts/:id`, `PUT/DELETE /comments/:id`

**Related DB Tables:** `moderation_cases`, `moderation_decisions`, `appeals`, `posts`, `comments`

**Related Screens:** `M1`, `M2`, `M3`, `M4`

**Related Permissions:** `community.moderate`, `appeal.review`, `community.space.manage`

**Stories:** ATL-STORY-034

### ATL-EPIC-021 — Tenant Administration
**Objective:** Deliver tenant admin operational screens for members, roles, configuration, entitlements, audit, data exports, deletion requests, and system setup health.

**Dependencies:** Authentication & Membership, Authorization Engine, Branding & White Label, Audit Infrastructure, Data Rights

**Deliverables:**
- Admin dashboard
- Member management
- Role management
- Config/feature flag/entitlement views
- Audit log
- Exports/deletion workflows
- Tenant setup checklist

**Related APIs:** `GET /members`, `POST /members/invite`, `POST /members/:id/suspend`, `DELETE /members/:id`, `GET/POST/PUT/DELETE /roles`, `GET /audit`, `GET/POST /exports`, `GET/POST /deletion-requests`

**Related DB Tables:** `memberships`, `member_profiles`, `roles`, `user_roles`, `permission_overrides`, `tenant_config`, `feature_flag_overrides`, `entitlements`, `audit_entries`, `export_jobs`, `deletion_requests`

**Related Screens:** `T1-T5`, `T8-T10`, `T22-T24`

**Related Permissions:** `membership.*`, `profile.*`, `role.*`, `permission_override.*`, `config.*`, `feature_flag.*`, `entitlement.read`, `audit.read`, `data.*`

**Stories:** ATL-STORY-009, ATL-STORY-015, ATL-STORY-032, ATL-STORY-037

### ATL-EPIC-022 — Branding & White Label
**Objective:** Implement tenant branding/theme/domain administration, runtime theme delivery, public/tenant shell branding, and custom-domain lifecycle.

**Dependencies:** Tenant Resolution, Storage Foundation, Authorization Engine

**Deliverables:**
- Tenant branding admin
- Theme token admin
- Branding/theme version history
- Domain management
- Runtime branding load without data flash
- Cloudflare custom hostname lifecycle as approved

**Related APIs:** `GET/PUT /branding`, `PUT /theme`, `POST /branding/publish`, `GET /branding/versions`, `GET/POST /domains`, `DELETE /domains/:id`, `GET /public/landing/:slug`

**Related DB Tables:** `tenant_branding`, `tenant_theme`, `tenant_branding_version`, `tenant_theme_version`, `tenant_domains`

**Related Screens:** `A1`, `A10`, `T6`, `T7`, `All shells`

**Related Permissions:** `branding.read`, `branding.update`, `branding.publish`, `tenancy.domain.read`, `tenancy.domain.manage`, `pub`

**Stories:** ATL-STORY-012, ATL-STORY-044

### ATL-EPIC-023 — Analytics Engine
**Objective:** Implement P1 analytics rollups, learner/instructor/admin dashboards, funnel rollups, and assessment item statistics without ingesting trading P&L or deferred inbound challenge events.

**Dependencies:** Eventing, Competency Engine, Assessment Engine, Gamification Engine

**Deliverables:**
- Analytics rollups
- Funnel daily rollups
- Item statistics
- Studio analytics
- Admin analytics
- Learner progress history

**Related APIs:** `GET /analytics/dashboards`, `GET /analytics/funnel`, `GET /analytics/item-statistics`, `GET /me/competency/history`

**Related DB Tables:** `analytics_rollups`, `funnel_daily_rollups`, `item_statistics`, `materialized_view_registry`, `competency_score_snapshots`

**Related Screens:** `L13`, `I13`, `T21`

**Related Permissions:** `analytics.dashboard.view`, `analytics.funnel.view`, `competency.score.read`

**Stories:** ATL-STORY-025, ATL-STORY-035, ATL-STORY-036

### ATL-EPIC-024 — Platform Administration
**Objective:** Implement isolated platform operations for tenant provisioning, tenant lifecycle, global flags/catalog, support sessions, audit, and event replay.

**Dependencies:** Database Foundation, Authorization Engine, Audit Infrastructure, Monitoring & Observability

**Deliverables:**
- Platform tenant list/detail
- Provision tenant flow
- Tenant suspend/archive/delete actions where approved
- Global feature flags
- Global catalog for permissions/item types/extension points
- Reason-bound support sessions
- Platform eventing/dead-letter ops

**Related APIs:** `GET /platform/tenants`, `POST /platform/tenants`, `GET /platform/tenants/:id`, `POST /platform/tenants/:id/suspend`, `GET/POST/PUT /platform/feature-flags`, `GET/POST /platform/catalog/{permissions,item-types,extension-points}`, `POST /platform/support/sessions`, `POST /internal/outbox/dead-letter/:id/replay`

**Related DB Tables:** `tenants`, `tenant_domains`, `provisioning_jobs`, `feature_flags`, `permissions`, `item_types`, `extension_points`, `audit_entries`, `dead_letter_events`, `event_deliveries`

**Related Screens:** `P1-P8`

**Related Permissions:** `platform.tenant.read`, `platform.tenant.manage`, `platform.entitlement.manage`, `platform.feature_flag.manage`, `platform.catalog.manage`, `platform.support.access`, `platform.audit.read`

**Stories:** ATL-STORY-011, ATL-STORY-042, ATL-STORY-044

### ATL-EPIC-025 — Monitoring & Observability
**Objective:** Wire Sentry, PostHog, Better Stack, structured logs, request IDs, uptime checks, error boundaries, and release health gates.

**Dependencies:** Platform Foundation

**Deliverables:**
- Request-id propagation
- Sentry server/client capture
- PostHog event taxonomy implementation for approved events
- Better Stack uptime/log drains
- Operational dashboards
- Release health checks

**Related APIs:** `All routes emit requestId and telemetry`

**Related DB Tables:** `outbox_events`, `audit_entries`, `analytics_rollups`

**Related Screens:** `All error/loading states`, `P8`

**Related Permissions:** `No user permission; observability access outside product scope`

**Stories:** ATL-STORY-001, ATL-STORY-043, ATL-STORY-045

### ATL-EPIC-026 — Public Website
**Objective:** Implement approved public allow-list screens: landing, diagnostic public flow, certificate verification, login/signup/reset/invite, and tenant unavailable notice.

**Dependencies:** Tenant Resolution, Branding & White Label, Authentication & Membership, Readiness Engine, Certificates Engine

**Deliverables:**
- Public Academy Home
- Anonymous diagnostic runner
- Identity gate
- Anonymous scorecard
- Certificate verification
- Login/signup/reset/invite
- Tenant unavailable notice

**Related APIs:** `GET /public/landing/:slug`, `POST /public/diagnostic/start`, `GET /public/diagnostic/:anonId/result`, `POST /public/auth/signup`, `POST /public/diagnostic/:anonId/merge`, `GET /public/verify/:credentialId`, `POST /public/auth/login`, `POST /public/invitations/accept`

**Related DB Tables:** `tenant_branding`, `tenant_theme`, `attempts`, `attempt_answers`, `competency_scores`, `certificates`, `credential_verifications`, `memberships`

**Related Screens:** `A1-A10`

**Related Permissions:** `pub`, `diagnostic.start variant`

**Stories:** ATL-STORY-014, ATL-STORY-027, ATL-STORY-030

### ATL-EPIC-027 — Learner Experience
**Objective:** Assemble learner shell, dashboard, catalog, lesson, roadmap, assessment, swipe, readiness, certificates, community, notifications, profile, and settings screens.

**Dependencies:** Public Website, Course Engine, Lesson Engine, Learning Path Engine, Assessment Engine, Swipe Learning Engine, Readiness Engine, Community Engine, Notification Infrastructure

**Deliverables:**
- Learner shell
- Dashboard next-best-action
- Course/lesson flow
- Roadmap/program flow
- Assessment flow
- Swipe flow
- Readiness/progress/certificates/achievements/community/search/notifications/profile/settings

**Related APIs:** `Learner-facing routes from API Inventory`

**Related DB Tables:** `memberships`, `member_profiles`, `enrollments`, `lesson_progress`, `path_step_progress`, `attempts`, `practice_sessions`, `competency_scores`, `composite_readiness_state`, `certificates`, `gamification_profiles`, `posts`, `notifications`

**Related Screens:** `L1-L25`

**Related Permissions:** `profile.*`, `course.read`, `enrollment.create`, `progress.read`, `assessment.read`, `attempt.*`, `practice.*`, `competency.score.read`, `certificate.read`, `gamification.profile.read`, `post.*`, `notification.read.self`, `data.deletion.request`

**Stories:** ATL-STORY-016, ATL-STORY-018, ATL-STORY-021, ATL-STORY-023, ATL-STORY-026, ATL-STORY-028, ATL-STORY-029, ATL-STORY-031, ATL-STORY-033, ATL-STORY-035, ATL-STORY-038

### ATL-EPIC-028 — Instructor Studio
**Objective:** Assemble studio shell and approved authoring/teaching surfaces for courses, lessons, items, assessments, paths, grading, roster/progress, and studio analytics.

**Dependencies:** Course Engine, Lesson Engine, Question Bank, Assessment Engine, Learning Path Engine, Workflow, Analytics Engine

**Deliverables:**
- Studio dashboard
- Course manager/builder
- Lesson editor
- Item bank/editor/collections
- Assessment builder
- Learning path builder
- Grading queue/detail
- Learner roster/progress
- Studio analytics

**Related APIs:** `Instructor-facing /courses, /items, /assessments, /learning-paths, /grading-tasks, /analytics endpoints`

**Related DB Tables:** `courses`, `lessons`, `items`, `item_collections`, `assessments`, `learning_paths`, `grading_tasks`, `enrollments`, `analytics_rollups`

**Related Screens:** `I1-I13`

**Related Permissions:** `course.*`, `item.*`, `item_collection.manage`, `assessment.*`, `learning_path.*`, `assessment.grade`, `enrollment.read`, `progress.read`, `analytics.dashboard.view`

**Stories:** ATL-STORY-017, ATL-STORY-018, ATL-STORY-020, ATL-STORY-021, ATL-STORY-022, ATL-STORY-023, ATL-STORY-036, ATL-STORY-039

### ATL-EPIC-029 — Moderator Experience
**Objective:** Assemble moderator shell and approved moderation queue, case detail, appeals review, and community space admin surfaces.

**Dependencies:** Community Engine, Moderation Engine

**Deliverables:**
- Moderation shell
- Moderation queue
- Case detail/decision
- Appeals review
- Community spaces admin

**Related APIs:** `GET/POST /moderation/cases`, `POST /moderation/cases/:id/decide`, `POST /appeals/:id/review`, `GET/POST/PUT/DELETE /spaces`

**Related DB Tables:** `moderation_cases`, `moderation_decisions`, `appeals`, `community_spaces`, `posts`, `comments`

**Related Screens:** `M1-M4`

**Related Permissions:** `community.moderate`, `appeal.review`, `community.space.manage`

**Stories:** ATL-STORY-034, ATL-STORY-040

### ATL-EPIC-030 — Tenant Admin Console
**Objective:** Assemble full tenant admin console surfaces using only approved T-series screens and existing APIs.

**Dependencies:** Tenant Administration, Branding & White Label, Competency Engine, Certificates Engine, Gamification Engine, Notification Infrastructure, Analytics Engine, Workflow, Extensibility

**Deliverables:**
- Admin shell
- All T1-T24 screen wiring
- Guarded actions
- Entitlement downgrade/upgrade prompts where route-gated
- Owner-only action hiding/denial
- Audit/reason UI where required

**Related APIs:** `Tenant-admin routes from API Inventory`

**Related DB Tables:** `All T-series related P0/P1 tenant tables`

**Related Screens:** `T1-T24`

**Related Permissions:** `membership.*`, `role.*`, `permission_override.*`, `branding.*`, `tenancy.domain.*`, `config.*`, `feature_flag.*`, `entitlement.read`, `competency.*`, `certificate.*`, `badge.*`, `leaderboard.*`, `notification.*`, `automation.*`, `workflow.*`, `locale.*`, `extension.*`, `readiness_policy.*`, `analytics.*`, `audit.*`, `data.*`

**Stories:** ATL-STORY-015, ATL-STORY-024, ATL-STORY-026, ATL-STORY-029, ATL-STORY-031, ATL-STORY-032, ATL-STORY-036, ATL-STORY-037, ATL-STORY-041

### ATL-EPIC-031 — Platform Console
**Objective:** Assemble physically isolated platform console with platform role checks, MFA/reason capture, and audited cross-tenant operations.

**Dependencies:** Platform Administration, Audit Infrastructure, Monitoring & Observability

**Deliverables:**
- Platform shell
- P1-P8 screen wiring
- Platform role enforcement
- Reason-bound support scope
- Platform audit
- Dead-letter replay UI
- No tenant session escalation path

**Related APIs:** `/api/v1/platform/**`, `/api/v1/internal/outbox/**`

**Related DB Tables:** `tenants`, `tenant_domains`, `provisioning_jobs`, `feature_flags`, `permissions`, `item_types`, `extension_points`, `audit_entries`, `dead_letter_events`

**Related Screens:** `P1-P8`

**Related Permissions:** `platform.*`

**Stories:** ATL-STORY-011, ATL-STORY-042

## 5. User Story Inventory
| Story | Title | Sprint | Points | Complexity | Risk | Primary Epic(s) |
|---|---|---:|---:|---|---|---|
| ATL-STORY-001 | Bootstrap repository, app shell, and CI guardrails | 0 | 5 | Medium | Medium | ATL-EPIC-001, ATL-EPIC-025 |
| ATL-STORY-002 | Create Prisma baseline, migrations, and seed skeleton | 0 | 8 | High | High | ATL-EPIC-005 |
| ATL-STORY-003 | Implement RLS and transaction-local tenant context | 0 | 13 | High | Critical | ATL-EPIC-005, ATL-EPIC-003 |
| ATL-STORY-004 | Create host-based tenant resolution middleware | 1 | 8 | High | Critical | ATL-EPIC-003 |
| ATL-STORY-005 | Implement Supabase Auth session bridge | 1 | 5 | Medium | Medium | ATL-EPIC-002 |
| ATL-STORY-006 | Implement membership gate and invitation acceptance | 1 | 8 | High | Critical | ATL-EPIC-002 |
| ATL-STORY-007 | Seed permission catalogue, roles, and role assignments | 1 | 8 | High | High | ATL-EPIC-004 |
| ATL-STORY-008 | Build can() authorization engine with ownership and relationship predicates | 1 | 13 | High | Critical | ATL-EPIC-004 |
| ATL-STORY-009 | Implement entitlement gate and feature flag reads | 2 | 8 | High | High | ATL-EPIC-004, ATL-EPIC-021 |
| ATL-STORY-010 | Implement audit log and outbox infrastructure | 2 | 8 | High | Critical | ATL-EPIC-007 |
| ATL-STORY-011 | Implement platform tenant provisioning | 2 | 13 | High | Critical | ATL-EPIC-024, ATL-EPIC-031 |
| ATL-STORY-012 | Implement branding, theme, and domain administration | 2 | 8 | Medium | High | ATL-EPIC-022 |
| ATL-STORY-013 | Implement Cloudflare R2 storage and asset reference helpers | 2 | 5 | Medium | Medium | ATL-EPIC-006 |
| ATL-STORY-014 | Implement public auth and tenant-unavailable screens | 2 | 5 | Medium | Medium | ATL-EPIC-026, ATL-EPIC-002 |
| ATL-STORY-015 | Implement admin member, profile, role, and permission override management | 3 | 8 | High | High | ATL-EPIC-021, ATL-EPIC-030 |
| ATL-STORY-016 | Implement course catalog, detail, and enrollment | 3 | 5 | Medium | Medium | ATL-EPIC-009, ATL-EPIC-027 |
| ATL-STORY-017 | Implement course manager and course builder | 3 | 8 | High | High | ATL-EPIC-009, ATL-EPIC-028 |
| ATL-STORY-018 | Implement lesson editor, lesson player, assets, and progress | 3 | 8 | Medium | High | ATL-EPIC-010, ATL-EPIC-027, ATL-EPIC-028 |
| ATL-STORY-019 | Implement workflow human gate | 4 | 8 | High | High | ATL-EPIC-004, ATL-EPIC-007 |
| ATL-STORY-020 | Implement item-type registry, item bank, item editor, and collections | 4 | 13 | High | Critical | ATL-EPIC-013, ATL-EPIC-028 |
| ATL-STORY-021 | Implement assessment builder, attempt runner, submit, and results | 4 | 13 | High | Critical | ATL-EPIC-012, ATL-EPIC-027, ATL-EPIC-028 |
| ATL-STORY-022 | Implement grading queue and grading detail | 4 | 5 | Medium | Medium | ATL-EPIC-012, ATL-EPIC-028 |
| ATL-STORY-023 | Implement learning paths, roadmap, path gates, and path builder | 5 | 13 | High | High | ATL-EPIC-011, ATL-EPIC-027, ATL-EPIC-028 |
| ATL-STORY-024 | Implement competency dimensions, scoring profiles, and config publish | 5 | 13 | High | Critical | ATL-EPIC-015, ATL-EPIC-030 |
| ATL-STORY-025 | Implement signal ingestion, score projections, and competency history | 5 | 13 | High | Critical | ATL-EPIC-015, ATL-EPIC-023 |
| ATL-STORY-026 | Implement readiness policy, learner readiness, and CTA attribution token | 5 | 8 | High | High | ATL-EPIC-016, ATL-EPIC-027, ATL-EPIC-030 |
| ATL-STORY-027 | Implement public diagnostic and anonymous-to-account merge | 6 | 13 | High | High | ATL-EPIC-026, ATL-EPIC-016 |
| ATL-STORY-028 | Implement swipe practice, due queue, and server-validated responses | 6 | 13 | High | Critical | ATL-EPIC-017, ATL-EPIC-027 |
| ATL-STORY-029 | Implement gamification profiles, XP, badges, streaks, and leaderboards | 6 | 8 | Medium | Medium | ATL-EPIC-018, ATL-EPIC-027, ATL-EPIC-030 |
| ATL-STORY-030 | Implement certificates, templates, issuance, revocation, and public verification | 7 | 8 | High | High | ATL-EPIC-014, ATL-EPIC-026 |
| ATL-STORY-031 | Implement notification templates, dispatches, and learner inbox | 7 | 5 | Medium | Medium | ATL-EPIC-008, ATL-EPIC-027, ATL-EPIC-030 |
| ATL-STORY-032 | Implement automation rules and locale resources | 7 | 5 | Medium | Medium | ATL-EPIC-021, ATL-EPIC-030 |
| ATL-STORY-033 | Implement community spaces, posts, comments, reactions, and Hall of Fame projection | 8 | 13 | High | High | ATL-EPIC-019, ATL-EPIC-027 |
| ATL-STORY-034 | Implement moderation queue, case decisions, and appeals | 8 | 8 | High | High | ATL-EPIC-020, ATL-EPIC-029 |
| ATL-STORY-035 | Implement search index entries and search results | 8 | 5 | Medium | Medium | ATL-EPIC-023, ATL-EPIC-027 |
| ATL-STORY-036 | Implement analytics dashboards, funnel rollups, and item statistics | 8 | 8 | High | High | ATL-EPIC-023, ATL-EPIC-028, ATL-EPIC-030 |
| ATL-STORY-037 | Implement data export and deletion requests | 9 | 8 | High | High | ATL-EPIC-021, ATL-EPIC-030 |
| ATL-STORY-038 | Assemble learner shell and full L1-L25 experience | 9 | 8 | High | Medium | ATL-EPIC-027 |
| ATL-STORY-039 | Assemble instructor studio I1-I13 | 9 | 5 | Medium | Medium | ATL-EPIC-028 |
| ATL-STORY-040 | Assemble moderator experience M1-M4 | 9 | 3 | Medium | Medium | ATL-EPIC-029 |
| ATL-STORY-041 | Assemble tenant admin console T1-T24 | 9 | 8 | High | High | ATL-EPIC-030 |
| ATL-STORY-042 | Assemble platform console P1-P8 and support/session tooling | 9 | 8 | High | Critical | ATL-EPIC-031, ATL-EPIC-024 |
| ATL-STORY-043 | Wire Sentry, PostHog, Better Stack, request IDs, and release health gates | 10 | 5 | Medium | Medium | ATL-EPIC-025 |
| ATL-STORY-044 | Configure FundedBeyond as Tenant #1 without platform fork | 10 | 8 | High | Critical | ATL-EPIC-024, ATL-EPIC-016, ATL-EPIC-022 |
| ATL-STORY-045 | Run integrated security, tenant isolation, E2E, and release readiness suite | 10 | 13 | High | Critical | ATL-EPIC-001, ATL-EPIC-025 |

## 6. Detailed Stories and Task Breakdown
### ATL-STORY-001
**Title:** Bootstrap repository, app shell, and CI guardrails

**Description:** Create the locked-stack application foundation and CI gates before feature code.

**Actor:** System

**Sprint:** Sprint 0

**Story Points:** 5  
**Complexity:** Medium  
**Risk Level:** Medium

**Dependencies:** None

**Database Tables:** `outbox_events`, `audit_entries`

**APIs:** `/api/v1/health`

**Permissions:** `route metadata required`

**Screens:** `All shells`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Sensitive mutations write `audit_entries` in the same transaction as the state change.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-002
**Title:** Create Prisma baseline, migrations, and seed skeleton

**Description:** Implement the Database Design v2 schema baseline and migration workflow.

**Actor:** System

**Sprint:** Sprint 0

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-001

**Database Tables:** `All P0/P1 tables`

**APIs:** `Internal DB access only`

**Permissions:** `All permissions seeded later`

**Screens:** None

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- No user-facing UI unless listed screens require shell/error-state changes.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-003
**Title:** Implement RLS and transaction-local tenant context

**Description:** Wrap every tenant DB access in withTenantTx using transaction-local tenant context and RLS.

**Actor:** System

**Sprint:** Sprint 0

**Story Points:** 13  
**Complexity:** High  
**Risk Level:** Critical

**Dependencies:** ATL-STORY-002

**Database Tables:** `All TENANT tables`, `tenants`, `tenant_domains`

**APIs:** `All tenant APIs`

**Permissions:** `tenant isolation invariant`

**Screens:** `All protected screens`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-004
**Title:** Create host-based tenant resolution middleware

**Description:** Resolve tenant from host before auth/business logic and enforce tenant state.

**Actor:** System

**Sprint:** Sprint 1

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** Critical

**Dependencies:** ATL-STORY-003

**Database Tables:** `tenants`, `tenant_domains`

**APIs:** `All /api/v1/** routes`

**Permissions:** `n/a before auth`

**Screens:** `A10`, `All screens`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-005
**Title:** Implement Supabase Auth session bridge

**Description:** Bridge Supabase identity into Atlas auth_principals and expose session-safe identity.

**Actor:** Anonymous Visitor / Member

**Sprint:** Sprint 1

**Story Points:** 5  
**Complexity:** Medium  
**Risk Level:** Medium

**Dependencies:** ATL-STORY-004

**Database Tables:** `auth_principals`

**APIs:** `POST /public/auth/login`, `POST /public/auth/signup`, `Supabase reset flow`, `GET /me`

**Permissions:** `pub`, `profile.read`

**Screens:** `A6`, `A7`, `A8`, `L24`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-006
**Title:** Implement membership gate and invitation acceptance

**Description:** Enforce ACTIVE membership for protected routes and convert valid invite tokens into memberships.

**Actor:** Invited Member / System

**Sprint:** Sprint 1

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** Critical

**Dependencies:** ATL-STORY-005

**Database Tables:** `memberships`, `member_profiles`, `audit_entries`

**APIs:** `POST /public/invitations/accept`, `GET /me`, `GET /members`

**Permissions:** `pub`, `membership.read`, `membership.invite`

**Screens:** `A9`, `T2`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Sensitive mutations write `audit_entries` in the same transaction as the state change.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-007
**Title:** Seed permission catalogue, roles, and role assignments

**Description:** Seed the approved permission catalogue and tenant roles without wildcard tenant access.

**Actor:** Tenant Admin / System

**Sprint:** Sprint 1

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-006

**Database Tables:** `permissions`, `permission_bundles`, `roles`, `role_permissions`, `user_roles`

**APIs:** `GET/POST /roles`, `POST /members/:id/roles`, `DELETE /members/:id/roles/:roleId`

**Permissions:** `role.read`, `role.create`, `role.assign`, `role.revoke`

**Screens:** `T3`, `T4`, `T5`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Sensitive mutations write `audit_entries` in the same transaction as the state change.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-008
**Title:** Build can() authorization engine with ownership and relationship predicates

**Description:** Implement default-deny can() with ownership and relationship checks resolved inside the decision.

**Actor:** System

**Sprint:** Sprint 1

**Story Points:** 13  
**Complexity:** High  
**Risk Level:** Critical

**Dependencies:** ATL-STORY-007

**Database Tables:** `roles`, `role_permissions`, `user_roles`, `permission_overrides`, `audit_entries`

**APIs:** `All protected APIs`

**Permissions:** `All protected permissions`

**Screens:** `All protected screens`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Sensitive mutations write `audit_entries` in the same transaction as the state change.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-009
**Title:** Implement entitlement gate and feature flag reads

**Description:** Enforce capability entitlement before permission and expose read-only tenant entitlement state.

**Actor:** System / Tenant Admin

**Sprint:** Sprint 2

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-008

**Database Tables:** `entitlements`, `entitlement_grant_history`, `feature_flags`, `feature_flag_overrides`

**APIs:** `GET /entitlements`, `GET /feature-flags`, `PUT /feature-flags/:key`

**Permissions:** `entitlement.read`, `feature_flag.read`, `feature_flag.override`

**Screens:** `T9`, `T10`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-010
**Title:** Implement audit log and outbox infrastructure

**Description:** Create tamper-evident audit and outbox foundations for sensitive state changes.

**Actor:** System

**Sprint:** Sprint 2

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** Critical

**Dependencies:** ATL-STORY-003, ATL-STORY-008

**Database Tables:** `audit_entries`, `outbox_events`, `event_deliveries`, `dead_letter_events`

**APIs:** `GET /audit`, `GET /platform/audit`, `POST /internal/outbox/dead-letter/:id/replay`

**Permissions:** `audit.read`, `platform.audit.read`, `platform.tenant.manage`

**Screens:** `T22`, `P6`, `P8`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Sensitive mutations write `audit_entries` in the same transaction as the state change.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-011
**Title:** Implement platform tenant provisioning

**Description:** Provision a tenant, seed base roles/entitlements, configure domains, and invite owner idempotently.

**Actor:** Platform Operations

**Sprint:** Sprint 2

**Story Points:** 13  
**Complexity:** High  
**Risk Level:** Critical

**Dependencies:** ATL-STORY-010

**Database Tables:** `tenants`, `tenant_domains`, `provisioning_jobs`, `entitlements`, `roles`, `memberships`, `audit_entries`

**APIs:** `GET /platform/tenants`, `POST /platform/tenants`, `GET /platform/tenants/:id`

**Permissions:** `platform.tenant.read`, `platform.tenant.manage`, `platform.entitlement.manage`

**Screens:** `P1`, `P2`, `P3`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Sensitive mutations write `audit_entries` in the same transaction as the state change.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-012
**Title:** Implement branding, theme, and domain administration

**Description:** Allow tenants to manage approved brand/theme/domain configuration with history.

**Actor:** Tenant Admin

**Sprint:** Sprint 2

**Story Points:** 8  
**Complexity:** Medium  
**Risk Level:** High

**Dependencies:** ATL-STORY-011

**Database Tables:** `tenant_branding`, `tenant_theme`, `tenant_branding_version`, `tenant_theme_version`, `tenant_domains`

**APIs:** `GET/PUT /branding`, `PUT /theme`, `POST /branding/publish`, `GET /branding/versions`, `GET/POST /domains`, `DELETE /domains/:id`

**Permissions:** `branding.read`, `branding.update`, `branding.publish`, `tenancy.domain.read`, `tenancy.domain.manage`

**Screens:** `T6`, `T7`, `A1`, `A10`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-013
**Title:** Implement Cloudflare R2 storage and asset reference helpers

**Description:** Store only approved asset references and provider video URLs; never self-host video or plaintext secrets.

**Actor:** System / Instructor / Admin

**Sprint:** Sprint 2

**Story Points:** 5  
**Complexity:** Medium  
**Risk Level:** Medium

**Dependencies:** ATL-STORY-012

**Database Tables:** `lesson_assets`, `tenant_branding`, `tenant_theme`, `secret_refs`

**APIs:** `GET/POST/DELETE /lessons/:id/assets`, `GET/PUT /branding`

**Permissions:** `course.update`, `branding.update`

**Screens:** `I4`, `T6`, `L4`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-014
**Title:** Implement public auth and tenant-unavailable screens

**Description:** Ship the public authentication and tenant-state surfaces from the approved allow-list.

**Actor:** Anonymous Visitor

**Sprint:** Sprint 2

**Story Points:** 5  
**Complexity:** Medium  
**Risk Level:** Medium

**Dependencies:** ATL-STORY-012

**Database Tables:** `auth_principals`, `memberships`, `tenant_branding`, `tenant_theme`

**APIs:** `POST /public/auth/login`, `POST /public/auth/signup`, `POST /public/invitations/accept`

**Permissions:** `pub`

**Screens:** `A6`, `A7`, `A8`, `A9`, `A10`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-015
**Title:** Implement admin member, profile, role, and permission override management

**Description:** Give tenant admins controlled member/role management under can() and audit.

**Actor:** Tenant Admin

**Sprint:** Sprint 3

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-007, ATL-STORY-008

**Database Tables:** `memberships`, `member_profiles`, `roles`, `user_roles`, `permission_overrides`, `audit_entries`

**APIs:** `GET /members`, `POST /members/invite`, `POST /members/:id/suspend`, `DELETE /members/:id`, `GET/PUT /members/:id/profile`, `GET/POST/DELETE /permission-overrides`

**Permissions:** `membership.read`, `membership.invite`, `membership.suspend`, `membership.remove`, `profile.read`, `profile.update`, `role.assign`, `role.revoke`, `permission_override.manage`

**Screens:** `T1`, `T2`, `T3`, `T4`, `T5`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Sensitive mutations write `audit_entries` in the same transaction as the state change.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-016
**Title:** Implement course catalog, detail, and enrollment

**Description:** Allow learners to discover courses and enroll within tenant/permission constraints.

**Actor:** Learner

**Sprint:** Sprint 3

**Story Points:** 5  
**Complexity:** Medium  
**Risk Level:** Medium

**Dependencies:** ATL-STORY-015

**Database Tables:** `courses`, `course_modules`, `enrollments`

**APIs:** `GET /courses`, `GET /courses/:id`, `GET /courses/:id/modules`, `POST /enrollments`

**Permissions:** `course.read`, `enrollment.create`

**Screens:** `L2`, `L3`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-017
**Title:** Implement course manager and course builder

**Description:** Allow instructors/admins to create and manage courses with ownership-aware writes.

**Actor:** Instructor

**Sprint:** Sprint 3

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-016

**Database Tables:** `courses`, `course_modules`, `workflow_transitions`

**APIs:** `GET/POST /courses`, `GET/PUT/DELETE /courses/:id`, `GET/POST /courses/:id/modules`, `PUT/DELETE /modules/:id`, `POST /courses/:id/publish`

**Permissions:** `course.read`, `course.create`, `course.update`, `course.publish`

**Screens:** `I2`, `I3`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-018
**Title:** Implement lesson editor, lesson player, assets, and progress

**Description:** Ship lesson authoring and learner completion/resume behavior.

**Actor:** Learner / Instructor

**Sprint:** Sprint 3

**Story Points:** 8  
**Complexity:** Medium  
**Risk Level:** High

**Dependencies:** ATL-STORY-013, ATL-STORY-017

**Database Tables:** `lessons`, `lesson_assets`, `lesson_progress`

**APIs:** `GET/PUT/DELETE /lessons/:id`, `GET/POST/DELETE /lessons/:id/assets`, `GET /lessons/:id/assets`, `POST /lessons/:id/progress`

**Permissions:** `course.read`, `course.update`, `progress.read`

**Screens:** `L4`, `I4`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-019
**Title:** Implement workflow human gate

**Description:** Create the shared review/approval path for publish and certificate issuance workflows.

**Actor:** Approver / Instructor / Admin

**Sprint:** Sprint 4

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-010, ATL-STORY-017

**Database Tables:** `workflow_definitions`, `workflow_transitions`, `audit_entries`

**APIs:** `GET /workflows`, `POST /workflows/:id/transition`

**Permissions:** `workflow.definition.read`, `workflow.definition.manage`, `workflow.transition.act`

**Screens:** `S1`, `T17`, `I3`, `I8`, `I9`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Sensitive mutations write `audit_entries` in the same transaction as the state change.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-020
**Title:** Implement item-type registry, item bank, item editor, and collections

**Description:** Provide the generic registry needed for swipe without modifying Assessment core.

**Actor:** Instructor / Tenant Admin

**Sprint:** Sprint 4

**Story Points:** 13  
**Complexity:** High  
**Risk Level:** Critical

**Dependencies:** ATL-STORY-019

**Database Tables:** `item_types`, `items`, `item_options`, `item_dimension_weights`, `item_collections`, `item_collection_items`, `extension_points`, `extension_registrations`

**APIs:** `GET /item-types`, `GET/POST /items`, `PUT /items/:id`, `GET/PUT /items/:id/dimension-weights`, `GET/POST /item-collections`, `PUT/DELETE /item-collections/:id`, `POST/DELETE /item-collections/:id/items`, `GET /extension-points`, `GET/POST/PUT/DELETE /extensions/registrations`

**Permissions:** `item.read`, `item.create`, `item.update`, `item_collection.manage`, `extension.point.read`, `extension.registration.manage`

**Screens:** `I5`, `I6`, `I7`, `T19`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Swipe is implemented through the approved item-type/extension registry path and does not modify Assessment core logic directly.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-021
**Title:** Implement assessment builder, attempt runner, submit, and results

**Description:** Ship the full P1 assessment lifecycle with correct-answer secrecy and idempotent submit.

**Actor:** Learner / Instructor

**Sprint:** Sprint 4

**Story Points:** 13  
**Complexity:** High  
**Risk Level:** Critical

**Dependencies:** ATL-STORY-020

**Database Tables:** `assessments`, `assessment_items`, `attempts`, `attempt_answers`, `exam_security_policies`, `proctoring_sessions`, `proctoring_events`, `proctoring_reports`

**APIs:** `GET/POST /assessments`, `GET/PUT/DELETE /assessments/:id`, `POST /assessments/:id/publish`, `GET /assessments/:id`, `POST /assessments/:id/attempts`, `GET /attempts/:id`, `POST /attempts/:id/answers`, `POST /attempts/:id/submit`

**Permissions:** `assessment.read`, `assessment.create`, `assessment.update`, `assessment.publish`, `attempt.start`, `attempt.submit`, `attempt.read`

**Screens:** `L7`, `L8`, `L9`, `I8`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-022
**Title:** Implement grading queue and grading detail

**Description:** Allow relationship-scoped manual grading and feedback submission.

**Actor:** Instructor

**Sprint:** Sprint 4

**Story Points:** 5  
**Complexity:** Medium  
**Risk Level:** Medium

**Dependencies:** ATL-STORY-021

**Database Tables:** `grading_tasks`, `attempts`, `attempt_answers`, `competency_signals`

**APIs:** `GET /grading-tasks`, `GET /grading-tasks/:id`, `POST /grading-tasks/:id/grade`

**Permissions:** `assessment.grade`

**Screens:** `I10`, `I11`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-023
**Title:** Implement learning paths, roadmap, path gates, and path builder

**Description:** Build the staged roadmap and program path flow.

**Actor:** Learner / Instructor

**Sprint:** Sprint 5

**Story Points:** 13  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-021, ATL-STORY-019

**Database Tables:** `learning_paths`, `path_steps`, `path_step_gates`, `path_enrollments`, `path_step_progress`, `workflow_transitions`

**APIs:** `GET/POST /learning-paths`, `GET/PUT/DELETE /learning-paths/:id`, `POST /learning-paths/:id/enroll`, `GET /learning-paths/:id/progress`, `POST /learning-paths/:id/publish`

**Permissions:** `learning_path.read`, `learning_path.create`, `learning_path.update`, `learning_path.publish`, `enrollment.create`, `progress.read`

**Screens:** `L5`, `L6`, `I9`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-024
**Title:** Implement competency dimensions, scoring profiles, and config publish

**Description:** Configure generic dimensions, scoring profiles, band thresholds, and versioned rules.

**Actor:** Tenant Admin / System

**Sprint:** Sprint 5

**Story Points:** 13  
**Complexity:** High  
**Risk Level:** Critical

**Dependencies:** ATL-STORY-020

**Database Tables:** `competency_dimensions`, `scoring_profiles`, `scoring_config_versions`, `competency_bands`, `signal_sources`

**APIs:** `GET/POST/PUT/DELETE /competency-dimensions`, `GET/POST/PUT /scoring-profiles`, `GET/PUT /scoring-profiles/:id/bands`, `POST /scoring-config/:id/publish`

**Permissions:** `competency.dimension.manage`, `scoring_profile.create`, `scoring_profile.update`, `scoring_config.publish`, `competency.band.manage`

**Screens:** `T11`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-025
**Title:** Implement signal ingestion, score projections, and competency history

**Description:** Consume valid assessment/practice events and expose current/history projections.

**Actor:** System / Learner / Instructor

**Sprint:** Sprint 5

**Story Points:** 13  
**Complexity:** High  
**Risk Level:** Critical

**Dependencies:** ATL-STORY-024, ATL-STORY-021

**Database Tables:** `competency_signals`, `competency_scores`, `competency_score_snapshots`, `composite_readiness_state`, `analytics_rollups`

**APIs:** `GET /me/competency`, `GET /me/competency/history`, `GET /members/:id/competency`, `GET /competency-signals`

**Permissions:** `competency.score.read`, `competency.signal.read`

**Screens:** `L1`, `L12`, `L13`, `I12`, `T11`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-026
**Title:** Implement readiness policy, learner readiness, and CTA attribution token

**Description:** Surface educational readiness and outbound attribution without selling challenges inside Academy.

**Actor:** Learner / Tenant Admin

**Sprint:** Sprint 5

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-025

**Database Tables:** `composite_readiness_state`, `scoring_profiles`, `funnel_daily_rollups`, `tenant_config`

**APIs:** `GET /readiness-policy`, `GET/PUT /readiness-policy`, `POST /cta/attribution-token`, `GET /me/competency`, `GET /me/competency/history`

**Permissions:** `readiness_policy.read`, `readiness_policy.manage`, `competency.score.read`

**Screens:** `L12`, `T20`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Readiness/diagnostic copy is educational and does not imply financial advice, guaranteed pass, or in-Academy challenge purchase.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-027
**Title:** Implement public diagnostic and anonymous-to-account merge

**Description:** Deliver top-of-funnel diagnostic, partial anonymous scorecard, identity gate, and merge.

**Actor:** Anonymous Visitor / Learner

**Sprint:** Sprint 6

**Story Points:** 13  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-026, ATL-STORY-014

**Database Tables:** `attempts`, `attempt_answers`, `competency_signals`, `competency_scores`, `memberships`, `auth_principals`

**APIs:** `POST /public/diagnostic/start`, `GET /public/diagnostic/:anonId/result`, `POST /public/diagnostic/:anonId/merge`, `POST /public/auth/signup`, `POST /diagnostic/start`, `GET /diagnostic/:id/result`

**Permissions:** `pub`, `diagnostic.start`, `competency.score.read`

**Screens:** `A2`, `A3`, `A4`, `L11`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Readiness/diagnostic copy is educational and does not imply financial advice, guaranteed pass, or in-Academy challenge purchase.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-028
**Title:** Implement swipe practice, due queue, and server-validated responses

**Description:** Ship swipe as generic practice mode with validated signal emission.

**Actor:** Learner

**Sprint:** Sprint 6

**Story Points:** 13  
**Complexity:** High  
**Risk Level:** Critical

**Dependencies:** ATL-STORY-025, ATL-STORY-020

**Database Tables:** `practice_sessions`, `practice_responses`, `srs_state`, `competency_signals`, `point_ledger`, `streak_states`

**APIs:** `GET /me/srs/due`, `POST /practice-sessions`, `POST /practice-sessions/:id/responses`, `POST /practice-sessions/:id/complete`

**Permissions:** `practice.start`, `practice.submit`, `competency.score.read`

**Screens:** `L10`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Swipe is implemented through the approved item-type/extension registry path and does not modify Assessment core logic directly.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-029
**Title:** Implement gamification profiles, XP, badges, streaks, and leaderboards

**Description:** Enable P1 engagement primitives and screens.

**Actor:** Learner / Tenant Admin

**Sprint:** Sprint 6

**Story Points:** 8  
**Complexity:** Medium  
**Risk Level:** Medium

**Dependencies:** ATL-STORY-028

**Database Tables:** `gamification_profiles`, `point_ledger`, `badges`, `badge_awards`, `streak_states`, `streak_freezes`, `leaderboard_definitions`, `leaderboard_snapshots`

**APIs:** `GET /me/gamification`, `GET /me/streaks`, `POST /me/streaks/:key/freeze`, `GET/POST/PUT /badges`, `GET/POST/PUT /leaderboards`, `GET /leaderboards`, `GET /leaderboards/:id`

**Permissions:** `gamification.profile.read`, `badge.read`, `badge.manage`, `leaderboard.read`, `leaderboard.manage`

**Screens:** `L1`, `L15`, `L16`, `T14`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Event-producing mutations write outbox events transactionally and are idempotent where required.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-030
**Title:** Implement certificates, templates, issuance, revocation, and public verification

**Description:** Ship credential lifecycle with public verify and audited revoke.

**Actor:** Learner / Tenant Admin / Public

**Sprint:** Sprint 7

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-019, ATL-STORY-021

**Database Tables:** `certificate_templates`, `certificates`, `credential_verifications`, `workflow_transitions`, `audit_entries`

**APIs:** `GET/POST/PUT/DELETE /certificate-templates`, `POST /certificate-templates/:id/publish`, `GET /certificates`, `POST /certificates/issue`, `POST /certificates/:id/revoke`, `GET /public/verify/:credentialId`

**Permissions:** `certificate_template.read`, `certificate_template.manage`, `certificate_template.publish`, `certificate.read`, `certificate.issue`, `certificate.revoke`, `pub`

**Screens:** `A5`, `L14`, `T12`, `T13`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Sensitive mutations write `audit_entries` in the same transaction as the state change.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-031
**Title:** Implement notification templates, dispatches, and learner inbox

**Description:** Send and surface in-app notifications from approved event sources.

**Actor:** Learner / Tenant Admin / System

**Sprint:** Sprint 7

**Story Points:** 5  
**Complexity:** Medium  
**Risk Level:** Medium

**Dependencies:** ATL-STORY-010

**Database Tables:** `notification_templates`, `notification_dispatches`, `outbox_events`

**APIs:** `GET/POST/PUT/DELETE /notification-templates`, `GET /me/notifications`, `POST /me/notifications/:id/read`

**Permissions:** `notification.template.read`, `notification.template.manage`, `notification.read.self`

**Screens:** `T15`, `L23`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Event-producing mutations write outbox events transactionally and are idempotent where required.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-032
**Title:** Implement automation rules and locale resources

**Description:** Expose approved automation/localization management surfaces.

**Actor:** Tenant Admin / System

**Sprint:** Sprint 7

**Story Points:** 5  
**Complexity:** Medium  
**Risk Level:** Medium

**Dependencies:** ATL-STORY-031

**Database Tables:** `automation_rules`, `automation_runs`, `locale_resources`, `outbox_events`

**APIs:** `GET/POST/PUT/DELETE /automation-rules`, `GET /locales`, `PUT /locales/:locale`

**Permissions:** `automation.rule.read`, `automation.rule.manage`, `locale.read`, `locale.manage`

**Screens:** `T16`, `T18`, `L25`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-033
**Title:** Implement community spaces, posts, comments, reactions, and Hall of Fame projection

**Description:** Ship community participation and approved Hall of Fame surface without public community browsing.

**Actor:** Learner / Moderator

**Sprint:** Sprint 8

**Story Points:** 13  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-031

**Database Tables:** `community_spaces`, `group_memberships`, `posts`, `comments`, `reactions`, `mentions`, `leaderboard_snapshots`, `certificates`

**APIs:** `GET /spaces`, `POST /spaces/:id/join`, `GET/POST /spaces/:id/posts`, `GET /posts/:id/comments`, `POST /posts/:id/comments`, `PUT/DELETE /comments/:id`, `POST /reactions`, `GET /leaderboards/:id`, `GET /public/verify/:credentialId`

**Permissions:** `community.space.read`, `community.space.join`, `post.read`, `post.create`, `comment.create`, `comment.update`, `comment.delete`, `reaction.create`, `leaderboard.read`

**Screens:** `L17`, `L18`, `L19`, `L20`, `M4`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-034
**Title:** Implement moderation queue, case decisions, and appeals

**Description:** Enable evidence-first moderation and append-only decisions.

**Actor:** Moderator / Admin

**Sprint:** Sprint 8

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-033

**Database Tables:** `moderation_cases`, `moderation_decisions`, `appeals`, `posts`, `comments`, `audit_entries`

**APIs:** `GET/POST /moderation/cases`, `POST /moderation/cases/:id/decide`, `POST /appeals/:id/review`, `DELETE /posts/:id`, `PUT/DELETE /comments/:id`

**Permissions:** `community.moderate`, `appeal.review`, `community.space.manage`

**Screens:** `M1`, `M2`, `M3`, `M4`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Sensitive mutations write `audit_entries` in the same transaction as the state change.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-035
**Title:** Implement search index entries and search results

**Description:** Index and query approved tenant-scoped content/community resources.

**Actor:** Learner / System

**Sprint:** Sprint 8

**Story Points:** 5  
**Complexity:** Medium  
**Risk Level:** Medium

**Dependencies:** ATL-STORY-033, ATL-STORY-018

**Database Tables:** `search_index_entries`, `courses`, `lessons`, `posts`

**APIs:** `GET /search`

**Permissions:** `search.query`

**Screens:** `L2`, `L21`, `L22`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-036
**Title:** Implement analytics dashboards, funnel rollups, and item statistics

**Description:** Expose P1 analytics without deferred inbound challenge conversion events.

**Actor:** Instructor / Tenant Admin

**Sprint:** Sprint 8

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-025, ATL-STORY-029, ATL-STORY-033

**Database Tables:** `analytics_rollups`, `funnel_daily_rollups`, `item_statistics`, `materialized_view_registry`

**APIs:** `GET /analytics/dashboards`, `GET /analytics/funnel`, `GET /analytics/item-statistics`

**Permissions:** `analytics.dashboard.view`, `analytics.funnel.view`

**Screens:** `I13`, `T21`, `L13`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Event-producing mutations write outbox events transactionally and are idempotent where required.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-037
**Title:** Implement data export and deletion requests

**Description:** Deliver tenant data rights workflows with audit and confirmation.

**Actor:** Learner / Tenant Admin

**Sprint:** Sprint 9

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-010, ATL-STORY-015

**Database Tables:** `export_jobs`, `deletion_requests`, `audit_entries`

**APIs:** `GET/POST /exports`, `GET /exports/:id`, `GET/POST /deletion-requests`, `POST /deletion-requests/:id/process`

**Permissions:** `data.export.run`, `data.deletion.request`, `data.deletion.manage`

**Screens:** `T23`, `T24`, `L25`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Sensitive mutations write `audit_entries` in the same transaction as the state change.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-038
**Title:** Assemble learner shell and full L1-L25 experience

**Description:** Unify approved learner screens into one gated, responsive learner app.

**Actor:** Learner

**Sprint:** Sprint 9

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** Medium

**Dependencies:** ATL-STORY-036, ATL-STORY-037

**Database Tables:** `member_profiles`, `enrollments`, `lesson_progress`, `path_step_progress`, `attempts`, `practice_sessions`, `competency_scores`, `certificates`, `gamification_profiles`, `posts`, `notification_dispatches`

**APIs:** `Learner-facing API set`

**Permissions:** `Learner role permissions`

**Screens:** `L1-L25`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-039
**Title:** Assemble instructor studio I1-I13

**Description:** Unify approved studio screens into one ownership-aware instructor surface.

**Actor:** Instructor

**Sprint:** Sprint 9

**Story Points:** 5  
**Complexity:** Medium  
**Risk Level:** Medium

**Dependencies:** ATL-STORY-036

**Database Tables:** `courses`, `lessons`, `items`, `item_collections`, `assessments`, `learning_paths`, `grading_tasks`, `analytics_rollups`

**APIs:** `Instructor-facing API set`

**Permissions:** `Instructor role permissions`

**Screens:** `I1-I13`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-040
**Title:** Assemble moderator experience M1-M4

**Description:** Finalize moderation shell, navigation, and error states.

**Actor:** Moderator

**Sprint:** Sprint 9

**Story Points:** 3  
**Complexity:** Medium  
**Risk Level:** Medium

**Dependencies:** ATL-STORY-034

**Database Tables:** `moderation_cases`, `appeals`, `community_spaces`

**APIs:** `Moderator-facing API set`

**Permissions:** `Moderator role permissions`

**Screens:** `M1-M4`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-041
**Title:** Assemble tenant admin console T1-T24

**Description:** Unify admin surfaces with owner-only controls, entitlement states, and audit patterns.

**Actor:** Tenant Admin

**Sprint:** Sprint 9

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** High

**Dependencies:** ATL-STORY-037, ATL-STORY-036

**Database Tables:** `All T-series related tenant tables`

**APIs:** `Tenant-admin API set`

**Permissions:** `Tenant admin role permissions`

**Screens:** `T1-T24`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-042
**Title:** Assemble platform console P1-P8 and support/session tooling

**Description:** Deliver isolated platform console with reason capture and audited cross-tenant support.

**Actor:** Platform Super Admin / Operations / Support

**Sprint:** Sprint 9

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** Critical

**Dependencies:** ATL-STORY-011, ATL-STORY-010

**Database Tables:** `tenants`, `tenant_domains`, `provisioning_jobs`, `feature_flags`, `permissions`, `item_types`, `extension_points`, `audit_entries`, `dead_letter_events`

**APIs:** `/api/v1/platform/**`, `/api/v1/internal/outbox/**`

**Permissions:** `platform.*`

**Screens:** `P1-P8`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Sensitive mutations write `audit_entries` in the same transaction as the state change.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-043
**Title:** Wire Sentry, PostHog, Better Stack, request IDs, and release health gates

**Description:** Instrument the system for errors, product analytics, uptime, logs, and release confidence.

**Actor:** System

**Sprint:** Sprint 10

**Story Points:** 5  
**Complexity:** Medium  
**Risk Level:** Medium

**Dependencies:** ATL-STORY-001

**Database Tables:** `analytics_rollups`, `audit_entries`, `outbox_events`

**APIs:** `All routes`

**Permissions:** `No product permission`

**Screens:** `All screens`, `P8`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Sensitive mutations write `audit_entries` in the same transaction as the state change.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-044
**Title:** Configure FundedBeyond as Tenant #1 without platform fork

**Description:** Provision and configure Academy content/engines as data/config only.

**Actor:** Platform Operations / Tenant Admin

**Sprint:** Sprint 10

**Story Points:** 8  
**Complexity:** High  
**Risk Level:** Critical

**Dependencies:** ATL-STORY-042, ATL-STORY-041

**Database Tables:** `tenants`, `tenant_domains`, `tenant_branding`, `tenant_theme`, `tenant_config`, `entitlements`, `competency_dimensions`, `scoring_profiles`, `scoring_config_versions`, `readiness_policy`, `community_spaces`, `learning_paths`

**APIs:** `POST /platform/tenants`, `GET/PUT /branding`, `PUT /theme`, `GET/PUT /readiness-policy`, `GET/POST /learning-paths`, `GET/POST /spaces`

**Permissions:** `platform.tenant.manage`, `branding.update`, `readiness_policy.manage`, `learning_path.create`, `community.space.manage`

**Screens:** `P2`, `T6`, `T11`, `T20`, `T8`, `M4`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

### ATL-STORY-045
**Title:** Run integrated security, tenant isolation, E2E, and release readiness suite

**Description:** Prove MVP readiness with security, tenant isolation, authorization, E2E, performance, and release gates.

**Actor:** System / QA

**Sprint:** Sprint 10

**Story Points:** 13  
**Complexity:** High  
**Risk Level:** Critical

**Dependencies:** ATL-STORY-044

**Database Tables:** `All P0/P1 tables`

**APIs:** `All P0/P1 APIs`

**Permissions:** `All permission groups`

**Screens:** `A1-A10`, `L1-L25`, `I1-I13`, `M1-M4`, `T1-T24`, `S1`, `P1-P8`

**Acceptance Criteria:**
- Uses only approved APIs, tables, screens, permissions, and workflows listed above.
- All request/response boundaries validate with Zod where an HTTP/API boundary exists.
- Tenant-scoped data is accessed only inside `withTenantTx`; no client-supplied `tenant_id` is trusted.
- Authorization failures return safe envelopes without cross-tenant resource leakage.
- Readiness/diagnostic copy is educational and does not imply financial advice, guaranteed pass, or in-Academy challenge purchase.
- Loading, empty, error, and denied states follow Wireframes v1 / Design System v1 rules.
- Unit, integration, authorization, tenant-isolation, and E2E tests for this story pass.

**Engineering Notes:**
- Route handlers must declare authorization metadata before handler execution.
- Use cursor pagination for list APIs and indexed filters only.
- Prefer service interfaces/outbox across bounded contexts; do not query foreign context tables directly.
- Do not introduce Phase 2–4 surfaces or shortcuts during implementation.

**Frontend Tasks:**
- Implement approved wireframe states for listed screens/shells.
- Use Design System v1 tokens/components; hide guarded actions until permission/entitlement loaders complete.
- Add accessible loading, empty, error, and denial states.

**Backend Tasks:**
- Implement/extend approved route handlers or service layer only for listed APIs.
- Apply Zod validation, route metadata, requestId propagation, error envelope, and idempotency where required.
- Call `enforceEntitlement` and `can()` in the approved order for protected routes.

**Database Tasks:**
- Add or update only approved Prisma models/migrations/indexes/RLS policies for listed tables.
- Seed approved catalogue/config data where needed.
- Verify append-only/idempotency constraints for event, audit, ledger, response, and workflow tables.

**DevOps Tasks:**
- Update CI coverage for typecheck, lint, tests, authorization metadata, and tenant-safe DB access.
- Configure required environment variables/secrets by reference only.
- Ensure Sentry/PostHog/Better Stack instrumentation hooks are available where applicable.

**QA Tasks:**
- Write unit tests for helpers and validation.
- Write integration tests for API success/error paths.
- Write authorization and tenant-isolation tests for allowed/denied actor/resource combinations.
- Add or update E2E path for listed screens where user-facing.

## 7. Sprint Breakdown
### Sprint 0
**Sprint Objective:** Establish the codebase, CI, database baseline, RLS, and transaction-local tenant context. No product feature UI is accepted until isolation tests pass.

**Duration:** 2 weeks

**Stories Included:** ATL-STORY-001, ATL-STORY-002, ATL-STORY-003

**Dependencies:** Locked tech stack, Database Design v2 table inventory

**Deliverables:**
- Bootstrap repository, app shell, and CI guardrails
- Create Prisma baseline, migrations, and seed skeleton
- Implement RLS and transaction-local tenant context

**Demo Scope:**
- Health endpoint
- CI gate output
- Prisma migration applied to local/staging
- RLS tenant isolation test showing cross-tenant denial

**Exit Criteria:**
- Repo builds clean
- RLS policies active on tenant tables
- withTenantTx uses transaction-local set_config(..., true)
- Cross-tenant IDOR harness green for representative tables

**Testing Strategy:**
- **Unit Tests:** Zod schema validation; Permission metadata helpers; UI component state tests where screen work exists.
- **Integration Tests:** Route handler happy/error paths; Prisma transaction behavior; Outbox/audit side effects where mutation exists.
- **Authorization Tests:** 401/403/error-envelope assertions; can() allow/deny fixtures; Owner/admin/instructor/learner role contrasts.
- **Tenant Isolation Tests:** Tenant A cannot read Tenant B by ID; Host wins over JWT tenant claim; No client-supplied tenant_id accepted.
- **E2E Tests:** Health/build sanity; RLS direct SQL isolation harness; Migration rollback/smoke.

### Sprint 1
**Sprint Objective:** Implement the request spine: tenant resolution, auth, membership gate, roles, permissions, and can().

**Duration:** 2 weeks

**Stories Included:** ATL-STORY-004, ATL-STORY-005, ATL-STORY-006, ATL-STORY-007, ATL-STORY-008

**Dependencies:** Sprint 0 exit criteria

**Deliverables:**
- Create host-based tenant resolution middleware
- Implement Supabase Auth session bridge
- Implement membership gate and invitation acceptance
- Seed permission catalogue, roles, and role assignments
- Build can() authorization engine with ownership and relationship predicates

**Demo Scope:**
- Unknown tenant routes to A10
- Login/signup flow works
- Invite acceptance creates ACTIVE membership
- Permission denial shown without resource leakage

**Exit Criteria:**
- Every protected route has auth metadata
- No Prisma access outside withTenantTx
- Membership gate blocks INVITED/SUSPENDED/REMOVED/no-row states
- can() default-deny tests pass

**Testing Strategy:**
- **Unit Tests:** Zod schema validation; Permission metadata helpers; UI component state tests where screen work exists.
- **Integration Tests:** Route handler happy/error paths; Prisma transaction behavior; Outbox/audit side effects where mutation exists.
- **Authorization Tests:** 401/403/error-envelope assertions; can() allow/deny fixtures; Owner/admin/instructor/learner role contrasts.
- **Tenant Isolation Tests:** Tenant A cannot read Tenant B by ID; Host wins over JWT tenant claim; No client-supplied tenant_id accepted.
- **E2E Tests:** Critical path demo for sprint scope; Loading/error/empty states from Wireframes v1.

### Sprint 2
**Sprint Objective:** Bring the operational platform online: entitlement gate, audit/outbox, tenant provisioning, branding/domain, R2 references, and public auth surfaces.

**Duration:** 2 weeks

**Stories Included:** ATL-STORY-009, ATL-STORY-010, ATL-STORY-011, ATL-STORY-012, ATL-STORY-013, ATL-STORY-014

**Dependencies:** Sprint 1 authorization spine

**Deliverables:**
- Implement entitlement gate and feature flag reads
- Implement audit log and outbox infrastructure
- Implement platform tenant provisioning
- Implement branding, theme, and domain administration
- Implement Cloudflare R2 storage and asset reference helpers
- Implement public auth and tenant-unavailable screens

**Demo Scope:**
- Provision test tenant
- Apply brand/theme
- Domain row created
- Audit entry written for provisioning/branding
- Login/signup/invite pages render branded

**Exit Criteria:**
- Audit hash-chain writes for sensitive mutations
- Idempotent tenant provisioning works
- Entitlement failure returns ENTITLEMENT_REQUIRED
- No tenant data flashes before gate

**Testing Strategy:**
- **Unit Tests:** Zod schema validation; Permission metadata helpers; UI component state tests where screen work exists.
- **Integration Tests:** Route handler happy/error paths; Prisma transaction behavior; Outbox/audit side effects where mutation exists.
- **Authorization Tests:** 401/403/error-envelope assertions; can() allow/deny fixtures; Owner/admin/instructor/learner role contrasts.
- **Tenant Isolation Tests:** Tenant A cannot read Tenant B by ID; Host wins over JWT tenant claim; No client-supplied tenant_id accepted.
- **E2E Tests:** Critical path demo for sprint scope; Loading/error/empty states from Wireframes v1.

### Sprint 3
**Sprint Objective:** Deliver the first learning loop: member admin, course catalog/detail/enrollment, course builder, lesson editor/player, asset references, and progress.

**Duration:** 2 weeks

**Stories Included:** ATL-STORY-015, ATL-STORY-016, ATL-STORY-017, ATL-STORY-018

**Dependencies:** Sprint 2 tenant provisioning and brand foundation

**Deliverables:**
- Implement admin member, profile, role, and permission override management
- Implement course catalog, detail, and enrollment
- Implement course manager and course builder
- Implement lesson editor, lesson player, assets, and progress

**Demo Scope:**
- Admin invites instructor and learner
- Instructor creates course/module/lesson
- Learner enrolls and completes lesson
- Progress appears in learner state

**Exit Criteria:**
- Course ownership predicates pass
- Lesson assets are references only
- Enrollment/progress writes are tenant-scoped
- Learner and instructor screens meet wireframe states

**Testing Strategy:**
- **Unit Tests:** Zod schema validation; Permission metadata helpers; UI component state tests where screen work exists.
- **Integration Tests:** Route handler happy/error paths; Prisma transaction behavior; Outbox/audit side effects where mutation exists.
- **Authorization Tests:** 401/403/error-envelope assertions; can() allow/deny fixtures; Owner/admin/instructor/learner role contrasts.
- **Tenant Isolation Tests:** Tenant A cannot read Tenant B by ID; Host wins over JWT tenant claim; No client-supplied tenant_id accepted.
- **E2E Tests:** Critical path demo for sprint scope; Loading/error/empty states from Wireframes v1.

### Sprint 4
**Sprint Objective:** Deliver assessment authoring and execution: workflow human gate, item registry, item bank, assessment builder, attempts, submit/results, and grading.

**Duration:** 2 weeks

**Stories Included:** ATL-STORY-019, ATL-STORY-020, ATL-STORY-021, ATL-STORY-022

**Dependencies:** Sprint 3 learning loop

**Deliverables:**
- Implement workflow human gate
- Implement item-type registry, item bank, item editor, and collections
- Implement assessment builder, attempt runner, submit, and results
- Implement grading queue and grading detail

**Demo Scope:**
- Instructor submits course/assessment for review
- Approver transitions workflow
- Learner starts and submits assessment
- Instructor grades manual task

**Exit Criteria:**
- Publish does not bypass workflow
- Correct answers never sent to client
- Submit idempotency works
- Item-type registry supports swipe item type without Assessment fork

**Testing Strategy:**
- **Unit Tests:** Zod schema validation; Permission metadata helpers; UI component state tests where screen work exists.
- **Integration Tests:** Route handler happy/error paths; Prisma transaction behavior; Outbox/audit side effects where mutation exists.
- **Authorization Tests:** 401/403/error-envelope assertions; can() allow/deny fixtures; Owner/admin/instructor/learner role contrasts.
- **Tenant Isolation Tests:** Tenant A cannot read Tenant B by ID; Host wins over JWT tenant claim; No client-supplied tenant_id accepted.
- **E2E Tests:** Critical path demo for sprint scope; Loading/error/empty states from Wireframes v1.

### Sprint 5
**Sprint Objective:** Deliver roadmap, competency scoring, score history, readiness policy, and educational readiness CTA token.

**Duration:** 2 weeks

**Stories Included:** ATL-STORY-023, ATL-STORY-024, ATL-STORY-025, ATL-STORY-026

**Dependencies:** Sprint 4 assessment and item registry

**Deliverables:**
- Implement learning paths, roadmap, path gates, and path builder
- Implement competency dimensions, scoring profiles, and config publish
- Implement signal ingestion, score projections, and competency history
- Implement readiness policy, learner readiness, and CTA attribution token

**Demo Scope:**
- Admin configures dimensions/bands
- Learner sees roadmap and readiness
- Assessment response updates competency projection
- Ready learner receives outbound attribution token

**Exit Criteria:**
- Scoring config versioned before signals affect score
- Readiness copy avoids financial-advice framing
- Competency projections match expected fixture results
- Path gates respect competency/progress state

**Testing Strategy:**
- **Unit Tests:** Zod schema validation; Permission metadata helpers; UI component state tests where screen work exists.
- **Integration Tests:** Route handler happy/error paths; Prisma transaction behavior; Outbox/audit side effects where mutation exists.
- **Authorization Tests:** 401/403/error-envelope assertions; can() allow/deny fixtures; Owner/admin/instructor/learner role contrasts.
- **Tenant Isolation Tests:** Tenant A cannot read Tenant B by ID; Host wins over JWT tenant claim; No client-supplied tenant_id accepted.
- **E2E Tests:** Critical path demo for sprint scope; Loading/error/empty states from Wireframes v1.

### Sprint 6
**Sprint Objective:** Deliver FundedBeyond activation/retention loop: public diagnostic, anonymous merge, swipe practice, SRS due queue, XP/streaks/badges/leaderboards.

**Duration:** 2 weeks

**Stories Included:** ATL-STORY-027, ATL-STORY-028, ATL-STORY-029

**Dependencies:** Sprint 5 scoring/readiness foundation

**Deliverables:**
- Implement public diagnostic and anonymous-to-account merge
- Implement swipe practice, due queue, and server-validated responses
- Implement gamification profiles, XP, badges, streaks, and leaderboards

**Demo Scope:**
- Visitor completes diagnostic and signs up
- Swipe session emits validated competency signals
- Streak/XP changes after practice
- Leaderboard renders

**Exit Criteria:**
- Anonymous diagnostic rate limits pass
- Offline/batched swipe responses revalidated server-side
- Gamification ledger is append-only
- No challenge purchase/inbound event support introduced

**Testing Strategy:**
- **Unit Tests:** Zod schema validation; Permission metadata helpers; UI component state tests where screen work exists.
- **Integration Tests:** Route handler happy/error paths; Prisma transaction behavior; Outbox/audit side effects where mutation exists.
- **Authorization Tests:** 401/403/error-envelope assertions; can() allow/deny fixtures; Owner/admin/instructor/learner role contrasts.
- **Tenant Isolation Tests:** Tenant A cannot read Tenant B by ID; Host wins over JWT tenant claim; No client-supplied tenant_id accepted.
- **E2E Tests:** Critical path demo for sprint scope; Loading/error/empty states from Wireframes v1.

### Sprint 7
**Sprint Objective:** Deliver credentials, notifications, automation, and localization foundations.

**Duration:** 2 weeks

**Stories Included:** ATL-STORY-030, ATL-STORY-031, ATL-STORY-032

**Dependencies:** Sprint 6 learning/scoring/gamification loop

**Deliverables:**
- Implement certificates, templates, issuance, revocation, and public verification
- Implement notification templates, dispatches, and learner inbox
- Implement automation rules and locale resources

**Demo Scope:**
- Admin publishes certificate template
- Certificate issued and verified publicly
- Learner receives in-app notification
- Admin updates automation/locales

**Exit Criteria:**
- Certificate revoke audited
- Public verify leaks only minimal projection
- Notification dispatch idempotent
- Automation/locales remain within approved P1 surfaces

**Testing Strategy:**
- **Unit Tests:** Zod schema validation; Permission metadata helpers; UI component state tests where screen work exists.
- **Integration Tests:** Route handler happy/error paths; Prisma transaction behavior; Outbox/audit side effects where mutation exists.
- **Authorization Tests:** 401/403/error-envelope assertions; can() allow/deny fixtures; Owner/admin/instructor/learner role contrasts.
- **Tenant Isolation Tests:** Tenant A cannot read Tenant B by ID; Host wins over JWT tenant claim; No client-supplied tenant_id accepted.
- **E2E Tests:** Critical path demo for sprint scope; Loading/error/empty states from Wireframes v1.

### Sprint 8
**Sprint Objective:** Deliver engagement and reporting: community, moderation, search, analytics dashboards, funnel rollups, and item statistics.

**Duration:** 2 weeks

**Stories Included:** ATL-STORY-033, ATL-STORY-034, ATL-STORY-035, ATL-STORY-036

**Dependencies:** Sprint 7 eventing/notification/certificates

**Deliverables:**
- Implement community spaces, posts, comments, reactions, and Hall of Fame projection
- Implement moderation queue, case decisions, and appeals
- Implement search index entries and search results
- Implement analytics dashboards, funnel rollups, and item statistics

**Demo Scope:**
- Learner joins space and posts
- Moderator decides case
- Search returns tenant-scoped results
- Admin/studio analytics render

**Exit Criteria:**
- No public community browsing
- Moderation decisions append-only
- Search results filtered by tenant/permission
- Analytics exclude deferred inbound challenge conversion events

**Testing Strategy:**
- **Unit Tests:** Zod schema validation; Permission metadata helpers; UI component state tests where screen work exists.
- **Integration Tests:** Route handler happy/error paths; Prisma transaction behavior; Outbox/audit side effects where mutation exists.
- **Authorization Tests:** 401/403/error-envelope assertions; can() allow/deny fixtures; Owner/admin/instructor/learner role contrasts.
- **Tenant Isolation Tests:** Tenant A cannot read Tenant B by ID; Host wins over JWT tenant claim; No client-supplied tenant_id accepted.
- **E2E Tests:** Critical path demo for sprint scope; Loading/error/empty states from Wireframes v1.

### Sprint 9
**Sprint Objective:** Complete all role consoles and data-rights workflows: learner, instructor, moderator, tenant admin, platform console.

**Duration:** 2 weeks

**Stories Included:** ATL-STORY-037, ATL-STORY-038, ATL-STORY-039, ATL-STORY-040, ATL-STORY-041, ATL-STORY-042

**Dependencies:** Sprint 8 feature surfaces

**Deliverables:**
- Implement data export and deletion requests
- Assemble learner shell and full L1-L25 experience
- Assemble instructor studio I1-I13
- Assemble moderator experience M1-M4
- Assemble tenant admin console T1-T24
- Assemble platform console P1-P8 and support/session tooling

**Demo Scope:**
- Learner walks L1-L25 critical path
- Instructor studio flow passes
- Moderator queue passes
- Tenant admin manages all T-series screens
- Platform admin provisions/supports/audits tenant

**Exit Criteria:**
- Screen coverage matrix passes
- Owner-only/admin-only actions hidden and denied server-side
- Reason-bound platform support audited
- Exports/deletion workflows gated and confirmed

**Testing Strategy:**
- **Unit Tests:** Zod schema validation; Permission metadata helpers; UI component state tests where screen work exists.
- **Integration Tests:** Route handler happy/error paths; Prisma transaction behavior; Outbox/audit side effects where mutation exists.
- **Authorization Tests:** 401/403/error-envelope assertions; can() allow/deny fixtures; Owner/admin/instructor/learner role contrasts.
- **Tenant Isolation Tests:** Tenant A cannot read Tenant B by ID; Host wins over JWT tenant claim; No client-supplied tenant_id accepted.
- **E2E Tests:** Critical path demo for sprint scope; Loading/error/empty states from Wireframes v1.

### Sprint 10
**Sprint Objective:** Instrument, configure Tenant #1, harden release gates, and prove Internal Alpha → FundedBeyond Alpha readiness.

**Duration:** 2 weeks

**Stories Included:** ATL-STORY-043, ATL-STORY-044, ATL-STORY-045

**Dependencies:** Sprint 9 all surfaces complete

**Deliverables:**
- Wire Sentry, PostHog, Better Stack, request IDs, and release health gates
- Configure FundedBeyond as Tenant #1 without platform fork
- Run integrated security, tenant isolation, E2E, and release readiness suite

**Demo Scope:**
- Sentry/PostHog/Better Stack dashboards
- FundedBeyond tenant configured branded
- End-to-end visitor → diagnostic → account → path → swipe → assessment → readiness → CTA
- Second tenant smoke test

**Exit Criteria:**
- All P0/P1 E2E suites green
- Cross-tenant IDOR matrix green under pooling
- Critical path demos pass on staging
- CTO approval checklist signed

**Testing Strategy:**
- **Unit Tests:** Zod schema validation; Permission metadata helpers; UI component state tests where screen work exists.
- **Integration Tests:** Route handler happy/error paths; Prisma transaction behavior; Outbox/audit side effects where mutation exists.
- **Authorization Tests:** 401/403/error-envelope assertions; can() allow/deny fixtures; Owner/admin/instructor/learner role contrasts.
- **Tenant Isolation Tests:** Tenant A cannot read Tenant B by ID; Host wins over JWT tenant claim; No client-supplied tenant_id accepted.
- **E2E Tests:** Full MVP journey; All role consoles smoke; Second-tenant provisioning smoke; Release regression suite.

## 8. Team Structure and Resource Allocation

### 8.1 Team Roles

| Role | Primary Responsibility | Secondary Responsibility |
|---|---|---|
| Product Lead | Scope control, acceptance criteria, demo readiness, locked-artifact compliance | Legal/readiness copy coordination, release sign-off |
| Full Stack Engineer | Cross-cutting stories, app shell, integration glue, E2E-critical paths | Backend/Frontend overflow |
| Frontend Engineer | Screen implementation, shadcn/ui composition, accessibility states | E2E fixture support |
| Backend Engineer | API handlers, authz, DB transactions, outbox/workers, integrations | Observability and performance tuning |
| QA Engineer | Test strategy, automation, IDOR matrix, E2E suite, release validation | Regression triage and acceptance evidence |

### 8.2 Sprint-by-Sprint Load Strategy

| Sprint | Backend Load | Frontend Load | QA Load | Notes |
|---:|---|---|---|---|
| 0 | Very High | Low | High | DB/RLS correctness dominates. |
| 1 | Very High | Medium | High | Request spine and public auth start. |
| 2 | High | Medium | High | Provisioning/branding and audit must be demonstrable. |
| 3 | High | High | Medium | Learning loop can be built in parallel by FE/BE. |
| 4 | Very High | High | High | Assessment + registry + workflow are high-risk. |
| 5 | Very High | Medium | High | Scoring correctness and readiness copy gate. |
| 6 | High | High | High | Diagnostic/swipe/gamification activation loop. |
| 7 | Medium | Medium | Medium | Certificates/notifications/automation. |
| 8 | High | High | High | Community/moderation/search/analytics. |
| 9 | Medium | Very High | Very High | Console assembly and full screen coverage. |
| 10 | Medium | Medium | Very High | Release validation, instrumentation, Tenant #1 config. |
## 9. Release Plan
| Milestone | Entry Criteria | Scope | Exit Criteria |
|---|---|---|---|
| Internal Alpha | Sprint 5 complete; Phase 0 security gates green | Internal tenant only; auth, provisioning, branding, courses, lessons, assessment, scoring/readiness in staging | Internal team can complete course → assessment → score/readiness flow with audit/IDOR tests green |
| FundedBeyond Tenant Alpha | Sprint 8 complete; diagnostic/swipe/certs/community/analytics ready | academy.fundedbeyond.com configured as Tenant #1 in staging; selected admins/instructors/learners | Visitor diagnostic → account → roadmap → swipe → assessment → readiness → CTA demo passes; no fork detected |
| Beta | Sprint 9 complete; all role consoles/data rights/platform ops ready | Controlled production-like pilot with limited cohort and support readiness | All screen/API/DB/permission matrices pass; support/audit/dead-letter procedures validated |
| Production Release | Sprint 10 complete; CTO approval verdict PASS | Full P0/P1 MVP on Atlas generic engines; FundedBeyond is configuration only | Second-tenant smoke test passes; security/regression/performance/observability gates green |

## 10. Final Validation
### 10.1 Sprint Coverage Matrix
| Sprint | Story IDs | Primary Coverage |
|---:|---|---|
| 0 | ATL-STORY-001, ATL-STORY-002, ATL-STORY-003 | Bootstrap repository, app shell, and CI guardrails, Create Prisma baseline, migrations, and seed skeleton, Implement RLS and transaction-local tenant context |
| 1 | ATL-STORY-004, ATL-STORY-005, ATL-STORY-006, ATL-STORY-007, ATL-STORY-008 | Create host-based tenant resolution middleware, Implement Supabase Auth session bridge, Implement membership gate and invitation acceptance ... |
| 2 | ATL-STORY-009, ATL-STORY-010, ATL-STORY-011, ATL-STORY-012, ATL-STORY-013, ATL-STORY-014 | Implement entitlement gate and feature flag reads, Implement audit log and outbox infrastructure, Implement platform tenant provisioning ... |
| 3 | ATL-STORY-015, ATL-STORY-016, ATL-STORY-017, ATL-STORY-018 | Implement admin member, profile, role, and permission override management, Implement course catalog, detail, and enrollment, Implement course manager and course builder ... |
| 4 | ATL-STORY-019, ATL-STORY-020, ATL-STORY-021, ATL-STORY-022 | Implement workflow human gate, Implement item-type registry, item bank, item editor, and collections, Implement assessment builder, attempt runner, submit, and results ... |
| 5 | ATL-STORY-023, ATL-STORY-024, ATL-STORY-025, ATL-STORY-026 | Implement learning paths, roadmap, path gates, and path builder, Implement competency dimensions, scoring profiles, and config publish, Implement signal ingestion, score projections, and competency history ... |
| 6 | ATL-STORY-027, ATL-STORY-028, ATL-STORY-029 | Implement public diagnostic and anonymous-to-account merge, Implement swipe practice, due queue, and server-validated responses, Implement gamification profiles, XP, badges, streaks, and leaderboards |
| 7 | ATL-STORY-030, ATL-STORY-031, ATL-STORY-032 | Implement certificates, templates, issuance, revocation, and public verification, Implement notification templates, dispatches, and learner inbox, Implement automation rules and locale resources |
| 8 | ATL-STORY-033, ATL-STORY-034, ATL-STORY-035, ATL-STORY-036 | Implement community spaces, posts, comments, reactions, and Hall of Fame projection, Implement moderation queue, case decisions, and appeals, Implement search index entries and search results ... |
| 9 | ATL-STORY-037, ATL-STORY-038, ATL-STORY-039, ATL-STORY-040, ATL-STORY-041, ATL-STORY-042 | Implement data export and deletion requests, Assemble learner shell and full L1-L25 experience, Assemble instructor studio I1-I13 ... |
| 10 | ATL-STORY-043, ATL-STORY-044, ATL-STORY-045 | Wire Sentry, PostHog, Better Stack, request IDs, and release health gates, Configure FundedBeyond as Tenant #1 without platform fork, Run integrated security, tenant isolation, E2E, and release readiness suite |

### 10.2 Screen Coverage Matrix
| Screens | Area | Story Coverage | Status |
|---|---|---|---|
| A1-A10 | Public Website / Auth / Diagnostic / Verify | ATL-STORY-014, ATL-STORY-027, ATL-STORY-030, ATL-STORY-044, ATL-STORY-045 | Covered |
| L1-L25 | Learner app | ATL-STORY-016, 018, 023, 026, 027, 028, 029, 030, 031, 033, 035, 038, 045 | Covered |
| I1-I13 | Instructor Studio | ATL-STORY-017, 018, 020, 021, 022, 023, 036, 039, 045 | Covered |
| M1-M4 | Moderator Experience | ATL-STORY-033, 034, 040, 045 | Covered |
| T1-T24 | Tenant Admin Console | ATL-STORY-009, 012, 015, 024, 026, 029, 030, 031, 032, 036, 037, 041, 045 | Covered |
| S1 | Review & Approvals | ATL-STORY-019, 045 | Covered |
| P1-P8 | Platform Console | ATL-STORY-011, 010, 042, 043, 044, 045 | Covered |

### 10.3 API Coverage Matrix
| API Group | Approved Surface | Story Coverage | Status |
|---|---|---|---|
| Eventing & Health | /health, /internal/outbox/* | ATL-STORY-001, 010, 042, 043 | Covered |
| Tenancy & Provisioning | /platform/tenants, /domains, /provisioning | ATL-STORY-004, 011, 012, 042, 044 | Covered |
| Identity & Membership | /auth/session, /me, /members, /invitations | ATL-STORY-005, 006, 015 | Covered |
| Access Control | /roles, /permission-overrides, /members/:id/roles | ATL-STORY-007, 008, 015 | Covered |
| Branding & Theme | /branding, /theme, /domains | ATL-STORY-012, 013, 044 | Covered |
| Config/Flags/Entitlements | /config, /feature-flags, /entitlements | ATL-STORY-009, 041 | Covered |
| Learning | /courses, /modules, /lessons, /enrollments, /learning-paths, /progress | ATL-STORY-016, 017, 018, 023 | Covered |
| Assessment + Item Registry | /item-types, /items, /item-collections, /assessments, /attempts, /practice-sessions, /grading-tasks | ATL-STORY-020, 021, 022, 028 | Covered |
| Competency & Scoring | /competency-dimensions, /scoring-profiles, /scoring-config, /me/competency, /members/:id/competency | ATL-STORY-024, 025, 026 | Covered |
| Certification | /certificate-templates, /certificates, /public/verify | ATL-STORY-030 | Covered |
| Gamification | /gamification, /badges, /leaderboards, /streaks | ATL-STORY-029 | Covered |
| Community & Moderation | /spaces, /posts, /comments, /reactions, /moderation, /appeals | ATL-STORY-033, 034 | Covered |
| Notifications | /notification-templates, /me/notifications | ATL-STORY-031 | Covered |
| Search | /search | ATL-STORY-035 | Covered |
| Analytics & Data Rights | /analytics, /exports, /deletion-requests, /audit | ATL-STORY-036, 037, 010 | Covered |
| Workflow/Automation/Locales/Extensions | /workflows, /automation-rules, /locales, /extension-points, /extensions/registrations | ATL-STORY-019, 032, 020 | Covered |
| FundedBeyond app-layer config | /public/diagnostic, /diagnostic, /readiness-policy, /cta/attribution-token | ATL-STORY-026, 027, 044 | Covered as configuration only |

### 10.4 Database Coverage Matrix
| Context | Tables | Story Coverage |
|---|---|---|
| PC-1 Tenancy & Provisioning | tenants, tenant_domains, provisioning_jobs | ATL-STORY-002, 003, 004, 011, 012, 042, 044 |
| PC-2 Identity | auth_principals, memberships, member_profiles | ATL-STORY-005, 006, 015, 038 |
| PC-3 Access | permissions, permission_bundles, roles, role_permissions, user_roles, permission_overrides | ATL-STORY-007, 008, 015 |
| PC-4 Config/Branding | tenant_branding, tenant_theme, tenant_config, versions, feature_flags, feature_flag_overrides, entitlements, entitlement_grant_history | ATL-STORY-009, 012, 041, 044 |
| PC-5 Learning | courses, course_modules, lessons, lesson_assets, enrollments, lesson_progress, learning_paths, path_* | ATL-STORY-016, 017, 018, 023 |
| PC-6 Assessment | item_types, items, item_options, item_dimension_weights, item_collections, assessments, attempts, attempt_answers, grading_tasks, practice_sessions, practice_responses, srs_state | ATL-STORY-020, 021, 022, 028 |
| PC-7 Competency | competency_dimensions, scoring_profiles, scoring_config_versions, competency_bands, signal_sources, competency_signals, competency_scores, composite_readiness_state, snapshots | ATL-STORY-024, 025, 026, 027, 028 |
| PC-8 Credentialing | certificate_templates, certificates, credential_verifications | ATL-STORY-030 |
| PC-9 Engagement | gamification_profiles, point_ledger, badges, badge_awards, streak_states, streak_freezes, leaderboard_definitions, leaderboard_snapshots | ATL-STORY-029 |
| PC-10 Integrity | exam_security_policies, proctoring_sessions, proctoring_events, proctoring_reports | ATL-STORY-021 |
| PC-11 Community/Moderation | community_spaces, group_memberships, posts, comments, reactions, mentions, moderation_cases, moderation_decisions, appeals | ATL-STORY-033, 034 |
| PC-14 Eventing/Notification/Search | outbox_events, event_deliveries, dead_letter_events, notification_templates, notification_dispatches, search_index_entries | ATL-STORY-010, 031, 035, 042 |
| PC-15/16 Analytics/Audit/Data Rights | analytics_rollups, funnel_daily_rollups, item_statistics, materialized_view_registry, audit_entries, secret_refs, export_jobs, deletion_requests | ATL-STORY-010, 013, 036, 037, 043 |
| PC-17 Orchestration | automation_rules, automation_runs, workflow_definitions, workflow_transitions, locale_resources | ATL-STORY-019, 032 |
| PC-18 Extensibility | extension_points, extension_registrations | ATL-STORY-020, 041, 044 |

### 10.5 Permission Coverage Matrix
| Permission Group | Usage | Story Coverage |
|---|---|---|
| platform.* | Platform tenant/admin/support/audit/catalog/flags | ATL-STORY-011, 042, 045 |
| tenancy.* | Domain and tenant state operations | ATL-STORY-004, 011, 012 |
| membership.*, profile.* | Membership, invite, suspend/remove, profile | ATL-STORY-006, 015, 038 |
| role.*, permission_override.* | RBAC and overrides | ATL-STORY-007, 008, 015 |
| branding.*, config.*, feature_flag.*, entitlement.* | Branding/config/flags/entitlements | ATL-STORY-009, 012, 041 |
| course.*, lesson.*, enrollment.*, progress.*, learning_path.* | Learning core | ATL-STORY-016, 017, 018, 023 |
| item.*, item_collection.*, assessment.*, attempt.*, practice.* | Assessment/question/practice | ATL-STORY-020, 021, 022, 028 |
| competency.*, scoring_* | Competency/scoring | ATL-STORY-024, 025 |
| readiness_policy.* | Readiness policy and CTA rules | ATL-STORY-026, 044 |
| certificate.*, certificate_template.* | Credentialing | ATL-STORY-030 |
| gamification.*, badge.*, leaderboard.* | Engagement | ATL-STORY-029 |
| community.*, post.*, comment.*, reaction.*, appeal.* | Community/moderation | ATL-STORY-033, 034 |
| notification.* | Notification templates and inbox | ATL-STORY-031 |
| search.* | Search | ATL-STORY-035 |
| analytics.*, data.*, audit.* | Analytics, export/deletion, audit | ATL-STORY-010, 036, 037 |
| workflow.*, automation.*, locale.* | Workflow/orchestration/locales | ATL-STORY-019, 032 |
| extension.* | First-party extension registration only | ATL-STORY-020, 041 |
| pub | Public allow-list | ATL-STORY-014, 027, 030 |

### 10.6 Critical Path Analysis

The schedule is dominated by five high-risk dependencies:

1. **RLS/withTenantTx correctness.** If transaction-local tenant context fails under pooling, no protected feature can safely ship.
2. **Authorization spine.** If can()/entitlement/membership are inconsistent, every feature inherits security defects.
3. **Item registry + scoring.** FundedBeyond's flagship loop depends on these generic Atlas capabilities; this is the anti-fork gate.
4. **Readiness copy/legal gate.** Readiness must be educational and cannot imply guaranteed challenge success or financial advice.
5. **Console and release coverage.** With a small team, screen assembly and regression in Sprints 9–10 must be tightly controlled.

Mitigation: The plan front-loads correctness, isolates high-risk substrate work, defers non-MVP surfaces, and makes Sprints 9–10 primarily integration/regression/release-hardening rather than net-new engine development.
### 10.7 Resource Allocation Analysis

The team can execute this plan only if Product aggressively protects scope and engineers avoid parallel redesign. Backend load is heaviest in Sprints 0–6; frontend load peaks in Sprints 8–9; QA load is continuous and peaks in Sprints 9–10.

Recommended operating model:

- Product Lead owns acceptance criteria and rejects scope creep immediately.
- Backend Engineer owns DB/RLS/authz/API/outbox/scoring correctness.
- Frontend Engineer owns screen implementation after route contracts stabilize.
- Full Stack Engineer bridges shells, service/UI integration, and E2E-critical flows.
- QA Engineer starts the IDOR/authorization matrix in Sprint 0, not at the end.
### 10.8 MVP Readiness Validation
| Item | Required Result |
|---|---|
| Tenant isolation | Cross-tenant IDOR matrix green under transaction pooling. |
| Membership gate | ACTIVE membership required for every protected screen/API; INVITED/SUSPENDED/REMOVED/no-row handled correctly. |
| Authorization | Every protected route has metadata; can() resolves ownership/relationship; entitlement runs before permission. |
| Audit | Sensitive mutations produce same-transaction audit entries. |
| Provisioning | FundedBeyond tenant and a second smoke-test tenant provision without code changes. |
| Learning loop | Learner can enroll, consume lesson, complete assessment, and see progress. |
| FundedBeyond loop | Visitor can diagnose → create account → get roadmap → swipe → improve readiness → click attributed CTA. |
| No fork | Diagnostic, readiness, swipe, dimensions, branding, community, and content are configuration on generic engines. |
| Deferred scope | No commerce checkout, inbound challenge events, native mobile build endpoints, AI, live/webinar, full plugin sandbox, or marketplace APIs/screens ship in P0/P1. |
| Observability | Sentry, PostHog, Better Stack, request IDs, and release dashboards active. |

### 10.9 CTO Approval Verdict

**Verdict: APPROVED FOR ENGINEERING EXECUTION — conditional.**

This Sprint Planning v1 is implementation-ready as an execution roadmap for Phase 0 + Phase 1A + Phase 1B. It follows the locked artifacts, preserves the approved architecture, and converts the product into epics, stories, tasks, sprints, testing gates, and release milestones without creating new screens, APIs, permissions, entities, workflows, or product behavior.

Approval conditions before production release:

1. Sprint 0 isolation gates must pass before Phase 1 feature routes are connected to `can()`.
2. Every story must trace to approved API, DB, screen, and permission surfaces.
3. Every sensitive mutation must have same-transaction audit.
4. FundedBeyond Tenant #1 must be configured only through generic Atlas engines.
5. A second-tenant provisioning smoke test must pass before MVP is declared ready.
6. Readiness and CTA copy must pass legal/compliance review before public diagnostic and CTA launch.
