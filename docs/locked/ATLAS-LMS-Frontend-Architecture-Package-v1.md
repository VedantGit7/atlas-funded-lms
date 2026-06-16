# ATLAS LMS — FRONTEND ARCHITECTURE PACKAGE v1
## Phase 0 + Phase 1A + Phase 1B

**Status:** Implementation-ready frontend architecture blueprint  
**Technology:** Next.js 15+ · TypeScript · Tailwind · shadcn/ui · React Query · React Hook Form · Zod · Supabase Auth · Sentry · PostHog  
**Scope:** Frontend implementation architecture only.  
**Binding rule:** This package creates no new product scope, screens, APIs, permissions, workflows, entities, database architecture, tenant strategy, or FundedBeyond-specific platform fork.  
**Source of truth:** Locked Atlas LMS artifacts only.

---

# 1. Frontend Executive Summary

Atlas LMS frontend is the implementation layer for a single multi-tenant, white-label LMS SaaS application. It must render public academy surfaces, learner learning surfaces, instructor studio surfaces, moderation queues, tenant administration, and isolated platform operations without changing the approved product, API, permission, or architecture model.

The frontend goals are:

1. **Translate approved screens into Next.js App Router pages.** Every page maps to an approved Screen ID only.
2. **Preserve tenant isolation before render.** Host resolution, tenant-state gating, Supabase Auth, ACTIVE membership, entitlement, permission, ownership, and relationship checks must complete before protected UI appears.
3. **Support white-label tenants through configuration.** Branding, theme, logo, public copy, readiness policy, scoring dimensions, community, certificates, and FundedBeyond behavior are tenant data/configuration, never hardcoded frontend branches.
4. **Use server-first rendering.** Server Components own route composition, initial data loading, protected navigation, and route denial states. Client Components exist only where browser interactivity is required.
5. **Minimize client state.** React Query owns server state in client-heavy surfaces, React Hook Form owns form state, URL owns shareable filters/search, and React context is limited to safe UI shell state.
6. **Remain secure by default.** Client-side permission checks are display hints only. All mutating actions go through approved APIs or Server Actions that call the same authorized service path.
7. **Scale frontend delivery.** The folder structure is designed for Cursor, Claude Code, GitHub Copilot, and engineers to produce consistent pages, components, tests, forms, and API calls without inventing product scope.

Multi-tenant requirements:

- The host determines the tenant.
- The frontend never accepts or sends `tenant_id` from URL, query, form, localStorage, or hidden inputs.
- Protected route data is not fetched until the route gate has resolved.
- Tenant A assets, theme, navigation, resources, membership, or cached data must never appear on Tenant B host.
- Query keys, cache scopes, and browser storage keys include safe resolved tenant scope where needed, but never trust tenant scope supplied by the client.

White-label requirements:

- Tenant logo, colors, favicon, public copy, certificate issuer display, email-preview branding, and theme tokens come from approved branding/theme/config APIs.
- Shared UI components must not contain FundedBeyond names, colors, labels, copy, icons, route branches, or tenant-specific CSS.
- Platform console remains Atlas operational identity and must not be tenant-branded.

Security requirements:

- Default deny for every protected route and action.
- Permission and entitlement are server-authoritative.
- Entitlement checks happen before `can()` permission checks where applicable.
- Sensitive mutations require confirmation, idempotency where declared, same-transaction audit, and optimistic rollback on denial.
- Public routes load only public projections.
- Platform routes are physically and visually isolated.

Scalability requirements:

- Use Server Components, streaming, Suspense, pagination, cursor-based lists, lazy-loaded client islands, and route-group code splitting.
- Avoid global client stores for server data.
- Use React Query only for interactive refetching, mutations, pagination, infinite scroll, and client-heavy flows.
- Large datasets use filters, cursors, skeleton states, and export jobs rather than loading all rows into the browser.

---

# 2. Frontend Design Principles

## 2.1 Server-first architecture

Default to Server Components for routes, layouts, initial data loading, protected navigation, and read-heavy pages. Use Client Components only for interactivity that cannot run on the server.

## 2.2 Minimal client state

Client state is limited to UI-only values: open menus, active tabs, dialog state, local runner state, draft form state, temporary optimistic items, and keyboard/gesture state. Server data must not be duplicated into custom stores.

## 2.3 Secure by default

The UI may hide or disable controls based on server-provided permission/entitlement projections, but never treats those checks as authorization. The server route remains final authority.

## 2.4 Accessibility first

Every shared component must meet WCAG 2.2 AA expectations: semantic markup, keyboard operation, visible focus, non-color-only status, linked form errors, focus restoration, reduced motion, and chart/table fallbacks.

## 2.5 Tenant-aware rendering

Tenant context is resolved before rendering tenant UI. Branding may load for safe public states; protected data and member navigation may load only after membership and authorization gates.

## 2.6 Configuration over customization

Frontend behavior must be expressed through approved configuration, entitlements, feature flags, content, item types, scoring profiles, readiness policy, and branding. Tenant-specific `if tenant.slug === ...` branches are forbidden.

---

# 3. Complete App Router Architecture

## 3.1 Implementation note: root route conflict

The approved Screen Inventory assigns both A1 Public Academy Home and L1 Trader Dashboard to `/`. Next.js route groups do not change URL paths, so two physical `page.tsx` files cannot both own `/`.

Implementation rule:

- Use one physical `app/page.tsx` root entry.
- It resolves host tenant and safe session state.
- It renders A1 for anonymous/no ACTIVE membership public state.
- It renders L1 only after authenticated ACTIVE learner membership and route gate pass.
- This does not create a new screen or route; it is the implementation resolver for two approved `/` screen states.

## 3.2 Final route tree

```text
apps/web/src/app/
├── layout.tsx
├── page.tsx                                  # A1 or L1 root resolver
├── globals.css
├── loading.tsx
├── error.tsx
├── not-found.tsx
├── (public)/
│   ├── layout.tsx                            # PublicSiteShell
│   ├── p/[slug]/page.tsx                     # A1 public landing variant
│   ├── diagnostic/page.tsx                   # A2 + A3 modal composition
│   ├── diagnostic/result/page.tsx            # A4
│   ├── verify/[credentialId]/page.tsx        # A5
│   └── tenant-unavailable/page.tsx           # A10
├── (auth)/
│   ├── layout.tsx                            # AuthShell
│   ├── login/page.tsx                        # A6
│   ├── signup/page.tsx                       # A7
│   ├── reset-password/page.tsx               # A8
│   └── invite/accept/page.tsx                # A9
├── (learner)/
│   ├── layout.tsx                            # LearnerShell
│   ├── courses/page.tsx                      # L2
│   ├── courses/[id]/page.tsx                 # L3
│   ├── courses/[id]/lessons/[lessonId]/page.tsx # L4
│   ├── roadmap/page.tsx                      # L5
│   ├── paths/[id]/page.tsx                   # L6
│   ├── assessments/[id]/page.tsx             # L7
│   ├── attempts/[id]/page.tsx                # L8
│   ├── attempts/[id]/result/page.tsx         # L9
│   ├── swipe/page.tsx                        # L10
│   ├── diagnostic/me/page.tsx                # L11
│   ├── readiness/page.tsx                    # L12
│   ├── progress/page.tsx                     # L13
│   ├── certificates/page.tsx                 # L14
│   ├── achievements/page.tsx                 # L15
│   ├── leaderboards/page.tsx                 # L16
│   ├── community/page.tsx                    # L17
│   ├── community/spaces/[id]/page.tsx        # L18
│   ├── community/posts/[id]/page.tsx         # L19
│   ├── hall-of-fame/page.tsx                 # L20
│   ├── resources/page.tsx                    # L21
│   ├── search/page.tsx                       # L22
│   ├── notifications/page.tsx                # L23
│   ├── profile/page.tsx                      # L24
│   └── settings/page.tsx                     # L25
├── (studio)/
│   ├── layout.tsx                            # StudioShell
│   ├── studio/page.tsx                       # I1
│   ├── studio/courses/page.tsx               # I2
│   ├── studio/courses/[id]/page.tsx          # I3
│   ├── studio/courses/[id]/lessons/[lessonId]/page.tsx # I4
│   ├── studio/items/page.tsx                 # I5
│   ├── studio/items/[id]/page.tsx            # I6
│   ├── studio/item-collections/page.tsx      # I7
│   ├── studio/assessments/page.tsx           # I8 list/create
│   ├── studio/assessments/[id]/page.tsx      # I8 edit
│   ├── studio/learning-paths/page.tsx        # I9 list/create
│   ├── studio/learning-paths/[id]/page.tsx   # I9 edit
│   ├── studio/grading/page.tsx               # I10
│   ├── studio/grading/[taskId]/page.tsx      # I11
│   ├── studio/courses/[id]/learners/page.tsx # I12
│   └── studio/analytics/page.tsx             # I13
├── (moderation)/
│   ├── layout.tsx                            # ModerationShell
│   ├── moderate/cases/page.tsx               # M1
│   ├── moderate/cases/[id]/page.tsx          # M2
│   ├── moderate/appeals/page.tsx             # M3
│   └── moderate/spaces/page.tsx              # M4
├── (admin)/
│   ├── layout.tsx                            # TenantAdminShell
│   ├── admin/page.tsx                        # T1
│   ├── admin/members/page.tsx                # T2
│   ├── admin/members/[id]/page.tsx           # T3
│   ├── admin/roles/page.tsx                  # T4
│   ├── admin/roles/[id]/page.tsx             # T5
│   ├── admin/branding/page.tsx               # T6
│   ├── admin/domains/page.tsx                # T7
│   ├── admin/config/page.tsx                 # T8
│   ├── admin/feature-flags/page.tsx          # T9
│   ├── admin/entitlements/page.tsx           # T10
│   ├── admin/competency/page.tsx             # T11
│   ├── admin/certificates/templates/page.tsx # T12
│   ├── admin/certificates/page.tsx           # T13
│   ├── admin/gamification/page.tsx           # T14
│   ├── admin/notifications/templates/page.tsx # T15
│   ├── admin/automation/page.tsx             # T16
│   ├── admin/workflows/page.tsx              # T17
│   ├── admin/locales/page.tsx                # T18
│   ├── admin/extensions/page.tsx             # T19
│   ├── admin/readiness-policy/page.tsx       # T20
│   ├── admin/analytics/page.tsx              # T21
│   ├── admin/audit/page.tsx                  # T22
│   ├── admin/exports/page.tsx                # T23
│   └── admin/deletion-requests/page.tsx      # T24
├── (workflow)/
│   └── review/page.tsx                       # S1, shell resolver only
├── (platform)/
│   ├── layout.tsx                            # PlatformConsoleShell
│   ├── platform/page.tsx                     # P1
│   ├── platform/tenants/new/page.tsx         # P2
│   ├── platform/tenants/[id]/page.tsx        # P3
│   ├── platform/feature-flags/page.tsx       # P4
│   ├── platform/catalog/page.tsx             # P5
│   ├── platform/audit/page.tsx               # P6
│   ├── platform/support/page.tsx             # P7
│   └── platform/eventing/page.tsx            # P8
└── api/
    ├── health/route.ts
    └── v1/**/route.ts                        # Approved API Inventory routes only
```

## 3.3 Route-to-screen implementation map

#### Public/Auth route map

| Screen | Route | Actor | Shell | Permission | Entitlement | Data sources |
|---|---|---|---|---|---|---|
| A1 — Public Academy Home / Landing | `/` , `/p/:slug` | Anonymous Visitor | PublicSiteShell | pub | None route-level | `GET /public/landing/:slug`; branding/theme (resolved at edge) |
| A2 — Public Diagnostic (anonymous) | `/diagnostic` | Anonymous Visitor | PublicSiteShell | pub `diagnostic.start` variant | None route-level | `POST /public/diagnostic/start`; `GET /public/diagnostic/:anonId/result` |
| A3 — Diagnostic Identity Gate | modal on `/diagnostic` | Anonymous Visitor | PublicSiteShell | pub → signup | None route-level | `POST /public/auth/signup`; `POST /public/diagnostic/:anonId/merge` |
| A4 — Anonymous Diagnostic Scorecard | `/diagnostic/result` | Anonymous Visitor | PublicSiteShell | pub (session token) | None route-level | `GET /public/diagnostic/:anonId/result` |
| A5 — Certificate Verification | `/verify/:credentialId` | Anonymous Visitor | PublicSiteShell | pub | None route-level | `GET /public/verify/:credentialId` |
| A6 — Login | `/login` | Anonymous/Auth | AuthShell | pub | None route-level | `POST /public/auth/login` |
| A7 — Signup | `/signup` | Anonymous/Auth | AuthShell | pub | None route-level | `POST /public/auth/signup` |
| A8 — Password Reset | `/reset-password` | Anonymous/Auth | AuthShell | pub (Supabase Auth) | None route-level | Supabase Auth flow (no Atlas tenant API) |
| A9 — Invitation Acceptance | `/invite/accept?token=` | Anonymous/Auth | AuthShell | pub (invite token) | None route-level | `POST /public/invitations/accept` |
| A10 — Tenant Unavailable / Suspended Notice | system (503/404) | Anonymous/System | PublicSiteShell / TenantUnavailable | n/a | None route-level | tenant-state gate |

#### Learner route map

| Screen | Route | Actor | Shell | Permission | Entitlement | Data sources |
|---|---|---|---|---|---|---|
| L1 — Trader Dashboard (Home) | `/` | Learner | LearnerShell | `profile.read`, `competency.score.read` (self), `gamification.profile.read` (self), `progress.read` (self) | None route-level | `GET /me`, `/me/competency`, `/me/gamification`, `/me/streaks`, `/learning-paths/:id/progress`, `/readiness-policy` |
| L2 — Course Catalog | `/courses` | Learner | LearnerShell | `course.read`, `search.query` | None route-level | `GET /courses`, `GET /search` |
| L3 — Course Detail | `/courses/:id` | Learner | LearnerShell | `course.read`, `enrollment.create` (self) | None route-level | `GET /courses/:id`, `GET /courses/:id/modules`, `POST /enrollments` |
| L4 — Lesson Player | `/courses/:id/lessons/:lessonId` | Learner | LearnerShell | `course.read`, `progress.read` (write own) | None route-level | `GET /lessons/:id`, `GET /lessons/:id/assets`, `POST /lessons/:id/progress` |
| L5 — Trader Career Roadmap | `/roadmap` | Learner | LearnerShell | `learning_path.read`, `progress.read` (self) | None route-level | `GET /learning-paths`, `GET /learning-paths/:id`, `GET /learning-paths/:id/progress` |
| L6 — Learning Path / Program Detail | `/paths/:id` | Learner | LearnerShell | `learning_path.read`, `enrollment.create` (self), `progress.read` (self) | None route-level | `GET /learning-paths/:id`, `POST /learning-paths/:id/enroll`, `GET /learning-paths/:id/progress` |
| L7 — Assessment Overview (pre-start) | `/assessments/:id` | Learner | LearnerShell | `assessment.read`, `attempt.start` (self) | None route-level | `GET /assessments/:id`, `POST /assessments/:id/attempts` |
| L8 — Assessment Attempt Runner | `/attempts/:id` | Learner | LearnerShell | `attempt.submit` (own) | None route-level | `GET /attempts/:id`, `POST /attempts/:id/answers`, `POST /attempts/:id/submit` |
| L9 — Attempt Result / Review | `/attempts/:id/result` | Learner | LearnerShell | `attempt.read` (own) | None route-level | `GET /attempts/:id` |
| L10 — Swipe Learning | `/swipe` | Learner | LearnerShell | `practice.start` (self) | None route-level | `POST /practice-sessions`, `POST /practice-sessions/:id/responses`, `POST /practice-sessions/:id/complete`, `GET /me/srs/due` |
| L11 — Diagnostic (authenticated) | `/diagnostic/me` | Learner | LearnerShell | `diagnostic.start` (self), `competency.score.read` (self) | None route-level | `POST /diagnostic/start`, `GET /diagnostic/:id/result` |
| L12 — Competency & Readiness | `/readiness` | Learner | LearnerShell | `competency.score.read` (self), `readiness_policy.read` | None route-level | `GET /me/competency`, `GET /me/competency/history`, `GET /readiness-policy`, `POST /cta/attribution-token` |
| L13 — Progress Dashboard | `/progress` | Learner | LearnerShell | `competency.score.read` (self), `gamification.profile.read` (self), `attempt.read` (own), `certificate.read` (own) | None route-level | `GET /me/competency/history`, `/me/gamification`, `/attempts/:id`, `/certificates` |
| L14 — Certificates | `/certificates` | Learner | LearnerShell | `certificate.read` (own) | certification.enable | `GET /certificates`; share → `GET /public/verify/:credentialId` |
| L15 — Achievements & Badges | `/achievements` | Learner | LearnerShell | `gamification.profile.read` (self), `badge.read` | gamification.enable | `GET /me/gamification`, `GET /badges`, `GET /me/streaks`, `POST /me/streaks/:key/freeze` |
| L16 — Leaderboards | `/leaderboards` | Learner | LearnerShell | `leaderboard.read` | gamification.enable | `GET /leaderboards`, `GET /leaderboards/:id` |
| L17 — Community Hub | `/community` | Learner | LearnerShell | `community.space.read`, `community.space.join` | community.enable | `GET /spaces`, `POST /spaces/:id/join` |
| L18 — Community Space / Feed | `/community/spaces/:id` | Learner | LearnerShell | `post.read`, `post.create`, `reaction.create`, `comment.create` | community.enable | `GET/POST /spaces/:id/posts`, `POST /reactions` |
| L19 — Post Detail / Thread | `/community/posts/:id` | Learner | LearnerShell | `post.read`, `comment.create`, `comment.update/delete` (own) | community.enable | `GET /posts/:id/comments`, `POST /posts/:id/comments`, `PUT/DELETE /comments/:id` |
| L20 — Hall of Fame | `/hall-of-fame` | Learner | LearnerShell | `post.read`, `leaderboard.read` | community.enable; gamification.enable for leaderboard segment | `GET /spaces/:id/posts` (HoF space), `GET /leaderboards/:id`, `GET /public/verify/:credentialId` |
| L21 — Resource Library | `/resources` | Learner | LearnerShell | `course.read`, `search.query` | None route-level | `GET /courses` (resource-tagged), `GET /search` |
| L22 — Search Results | `/search` | Learner | LearnerShell | `search.query` | None route-level | `GET /search` |
| L23 — Notifications Inbox | `/notifications` | Learner | LearnerShell | `notification.read.self` (self) | None route-level | `GET /me/notifications`, `POST /me/notifications/:id/read` |
| L24 — Profile | `/profile` | Learner | LearnerShell | `profile.read` (self), `profile.update` (self) | None route-level | `GET/PUT /me/profile` |
| L25 — Settings | `/settings` | Learner | LearnerShell | `profile.update` (self), `locale.read`, `data.deletion.request` (own) | None route-level | `GET/PUT /me/profile`, `GET /locales`, `POST /deletion-requests` (own) |

#### Studio route map

| Screen | Route | Actor | Shell | Permission | Entitlement | Data sources |
|---|---|---|---|---|---|---|
| I1 — Studio Dashboard | `/studio` | Instructor | StudioShell | `course.read`, `assessment.grade`, `workflow.definition.read` | None route-level | `GET /courses` (own), `GET /grading-tasks`, `GET /workflows` |
| I2 — Course Manager | `/studio/courses` | Instructor | StudioShell | `course.read`, `course.create` | None route-level | `GET /courses` (own), `POST /courses` |
| I3 — Course Builder | `/studio/courses/:id` | Instructor | StudioShell | `course.update` (own), `course.publish` (own + workflow) | None route-level | `PUT /courses/:id`, `GET/POST /courses/:id/modules`, `PUT/DELETE /modules/:id`, `POST /courses/:id/publish` |
| I4 — Lesson Editor | `/studio/courses/:id/lessons/:lessonId` | Instructor | StudioShell | `course.update` (own) | None route-level | `GET/PUT/DELETE /lessons/:id`, `GET/POST/DELETE /lessons/:id/assets` |
| I5 — Item Bank | `/studio/items` | Instructor | StudioShell | `item.read`, `item.create` | None route-level | `GET /item-types`, `GET/POST /items` |
| I6 — Item Editor | `/studio/items/:id` | Instructor | StudioShell | `item.update` (own) | None route-level | `PUT /items/:id`, `GET/PUT /items/:id/dimension-weights` |
| I7 — Item Collections / Decks | `/studio/item-collections` | Instructor | StudioShell | `item.read`, `item_collection.manage` | None route-level | `GET/POST /item-collections`, `PUT/DELETE /item-collections/:id`, `POST/DELETE /item-collections/:id/items` |
| I8 — Assessment Builder | `/studio/assessments`, `/studio/assessments/:id` | Instructor | StudioShell | `assessment.create`, `assessment.update` (author), `assessment.publish` (author + workflow) | None route-level | `GET/POST /assessments`, `PUT/DELETE /assessments/:id`, `POST /assessments/:id/publish` |
| I9 — Learning Path Builder | `/studio/learning-paths`, `:id` | Instructor | StudioShell | `learning_path.create`, `learning_path.update` (author), `learning_path.publish` (author + workflow) | None route-level | `GET/POST /learning-paths`, `PUT/DELETE /learning-paths/:id`, `POST /learning-paths/:id/publish` |
| I10 — Grading Queue | `/studio/grading` | Instructor | StudioShell | `assessment.grade` (assignee/relationship) | None route-level | `GET /grading-tasks` |
| I11 — Grading Detail | `/studio/grading/:taskId` | Instructor | StudioShell | `assessment.grade` (assignee) | None route-level | `GET /grading-tasks/:id` (read), `POST /grading-tasks/:id/grade` |
| I12 — Learner Roster & Progress | `/studio/courses/:id/learners` | Instructor | StudioShell | `enrollment.read` (rel), `progress.read` (rel), `competency.score.read` (rel), `attempt.read` (rel) | None route-level | `GET /enrollments`, `GET /courses/:id/progress`, `GET /members/:id/competency`, `GET /attempts/:id` |
| I13 — Studio Analytics | `/studio/analytics` | Instructor | StudioShell | `analytics.dashboard.view` (rel) [entitlement] | analytics.dashboard.view | `GET /analytics/dashboards`, `GET /analytics/item-statistics` |

#### Moderation route map

| Screen | Route | Actor | Shell | Permission | Entitlement | Data sources |
|---|---|---|---|---|---|---|
| M1 — Moderation Queue | `/moderate/cases` | Moderator | ModerationShell | `community.moderate` | community.enable | `GET/POST /moderation/cases` |
| M2 — Moderation Case Detail | `/moderate/cases/:id` | Moderator | ModerationShell | `community.moderate` | community.enable | `POST /moderation/cases/:id/decide`; `DELETE /posts/:id`, `PUT/DELETE /comments/:id` (moderate path) |
| M3 — Appeals Review | `/moderate/appeals` | Moderator | ModerationShell | `appeal.review` | community.enable | `POST /appeals/:id/review` |
| M4 — Community Spaces Admin | `/moderate/spaces` | Moderator | ModerationShell | `community.space.manage` | community.enable | `GET/POST/PUT/DELETE /spaces` |

#### Tenant Admin route map

| Screen | Route | Actor | Shell | Permission | Entitlement | Data sources |
|---|---|---|---|---|---|---|
| T1 — Admin Dashboard | `/admin` | Tenant Admin | TenantAdminShell | `membership.read`, `audit.read` | None route-level | `GET /members`, `GET /audit`, `GET /provisioning/jobs` |
| T2 — Members | `/admin/members` | Tenant Admin | TenantAdminShell | `membership.read/invite/suspend/remove`, `profile.read` | None route-level | `GET /members`, `POST /members/invite`, `POST /members/:id/suspend`, `DELETE /members/:id` |
| T3 — Member Detail | `/admin/members/:id` | Tenant Admin | TenantAdminShell | `membership.read`, `profile.read/update`, `role.assign/revoke`, `permission_override.manage` | None route-level | `GET /members/:id`, `GET/PUT /members/:id/profile`, `POST /members/:id/roles`, `DELETE /members/:id/roles/:roleId`, `GET/POST/DELETE /permission-overrides` |
| T4 — Roles & Permissions | `/admin/roles` | Tenant Admin | TenantAdminShell | `role.read/create` | None route-level | `GET/POST /roles` |
| T5 — Role Editor | `/admin/roles/:id` | Tenant Admin | TenantAdminShell | `role.update/delete` (no-grant-up, not-owner-role) | None route-level | `PUT/DELETE /roles/:id` |
| T6 — Branding & Theme | `/admin/branding` | Tenant Admin | TenantAdminShell | `branding.read/update/publish` | None route-level | `GET/PUT /branding`, `PUT /theme`, `POST /branding/publish`, `GET /branding/versions` |
| T7 — Domains | `/admin/domains` | Tenant Admin | TenantAdminShell | `tenancy.domain.read/manage` | branding.custom_domain.enable for custom-domain add/verify only | `GET/POST /domains`, `DELETE /domains/:id` |
| T8 — Configuration | `/admin/config` | Tenant Admin | TenantAdminShell | `config.read/update/publish` | None route-level | `GET/PUT /config`, `POST /config/publish` |
| T9 — Feature Flags | `/admin/feature-flags` | Tenant Admin | TenantAdminShell | `feature_flag.read/override` | None route-level | `GET /feature-flags`, `PUT /feature-flags/:key` |
| T10 — Entitlements (read-only) | `/admin/entitlements` | Tenant Admin | TenantAdminShell | `entitlement.read` | None route-level | `GET /entitlements` |
| T11 — Competency & Scoring | `/admin/competency` | Tenant Admin | TenantAdminShell | `competency.dimension.manage`, `scoring_profile.create/update`, `competency.band.manage`, `scoring_config.publish`, `competency.signal.read` | None route-level | `GET/POST/PUT/DELETE /competency-dimensions`, `GET/POST/PUT /scoring-profiles`, `GET/PUT /scoring-profiles/:id/bands`, `POST /scoring-config/:id/publish`, `GET /competency-signals` |
| T12 — Certificate Templates | `/admin/certificates/templates` | Tenant Admin | TenantAdminShell | `certificate_template.read/manage/publish` | certification.enable | `GET/POST/PUT/DELETE /certificate-templates`, `POST /certificate-templates/:id/publish` |
| T13 — Issued Certificates | `/admin/certificates` | Tenant Admin | TenantAdminShell | `certificate.read` (all), `certificate.issue`, `certificate.revoke` | certification.enable | `GET /certificates`, `POST /certificates/issue`, `POST /certificates/:id/revoke` |
| T14 — Gamification Config | `/admin/gamification` | Tenant Admin | TenantAdminShell | `badge.manage`, `leaderboard.manage` | gamification.enable | `GET/POST/PUT /badges`, `GET/POST/PUT /leaderboards` |
| T15 — Notification Templates | `/admin/notifications/templates` | Tenant Admin | TenantAdminShell | `notification.template.read/manage` | None route-level | `GET/POST/PUT/DELETE /notification-templates` |
| T16 — Automation Rules | `/admin/automation` | Tenant Admin | TenantAdminShell | `automation.rule.read/manage` | None route-level | `GET/POST/PUT/DELETE /automation-rules` |
| T17 — Workflows | `/admin/workflows` | Tenant Admin | TenantAdminShell | `workflow.definition.read/manage` | None route-level | `GET/POST/PUT /workflows` |
| T18 — Locales | `/admin/locales` | Tenant Admin | TenantAdminShell | `locale.read/manage` | None route-level | `GET /locales`, `PUT /locales/:locale` |
| T19 — Extensions | `/admin/extensions` | Tenant Admin | TenantAdminShell | `extension.point.read`, `extension.registration.read/manage` | None route-level | `GET /extension-points`, `GET/POST/PUT/DELETE /extensions/registrations` |
| T20 — Readiness Policy | `/admin/readiness-policy` | Tenant Admin | TenantAdminShell | `readiness_policy.read/manage` | None route-level | `GET/PUT /readiness-policy` |
| T21 — Analytics | `/admin/analytics` | Tenant Admin | TenantAdminShell | `analytics.dashboard.view`, `analytics.funnel.view` [entitlement] | analytics.dashboard.view | `GET /analytics/dashboards`, `GET /analytics/funnel`, `GET /analytics/item-statistics` |
| T22 — Audit Log | `/admin/audit` | Tenant Admin | TenantAdminShell | `audit.read` | None route-level | `GET /audit` |
| T23 — Data Exports | `/admin/exports` | Tenant Admin | TenantAdminShell | `data.export.run` | data.export.enable, always-on by policy | `GET/POST /exports`, `GET /exports/:id` |
| T24 — Deletion Requests | `/admin/deletion-requests` | Tenant Admin | TenantAdminShell | `data.deletion.request`, `data.deletion.manage` | None route-level | `GET/POST /deletion-requests`, `POST /deletion-requests/:id/process` |

#### Shared Workflow route map

| Screen | Route | Actor | Shell | Permission | Entitlement | Data sources |
|---|---|---|---|---|---|---|
| S1 — Review & Approvals (Human Gate) | `/review` | Instructor / Tenant Admin / scoped reviewer | StudioShell or TenantAdminShell via shell resolver | `workflow.transition.act` (relationship/role-scoped) | None route-level | `GET /workflows`, `POST /workflows/:id/transition` |

#### Platform route map

| Screen | Route | Actor | Shell | Permission | Entitlement | Data sources |
|---|---|---|---|---|---|---|
| P1 — Platform Tenant List | `/platform` | Platform Super Admin | PlatformConsoleShell | `platform.tenant.read` | None route-level | `GET /platform/tenants` |
| P2 — Provision Tenant | `/platform/tenants/new` | Platform Super Admin | PlatformConsoleShell | `platform.tenant.manage` | None route-level | `POST /platform/tenants` (idempotent) |
| P3 — Tenant Detail | `/platform/tenants/:id` | Platform Super Admin | PlatformConsoleShell | `platform.tenant.read/manage`, `platform.entitlement.manage` | None route-level | `GET /platform/tenants/:id`, `*/suspend |
| P4 — Global Feature Flags | `/platform/feature-flags` | Platform Super Admin | PlatformConsoleShell | `platform.feature_flag.manage` | None route-level | `GET/POST/PUT /platform/feature-flags` |
| P5 — Global Catalog | `/platform/catalog` | Platform Super Admin | PlatformConsoleShell | `platform.catalog.manage` (super_admin only) | None route-level | `GET/POST /platform/catalog/{permissions,item-types,extension-points}` |
| P6 — Platform Audit | `/platform/audit` | Platform Super Admin | PlatformConsoleShell | `platform.audit.read` | None route-level | `GET /platform/audit` |
| P7 — Support Sessions | `/platform/support` | Platform Super Admin | PlatformConsoleShell | `platform.support.access` | None route-level | `POST /platform/support/sessions` |
| P8 — Eventing / Dead-Letter Ops | `/platform/eventing` | Platform Super Admin | PlatformConsoleShell | `platform.tenant.manage` | None route-level | `POST /internal/outbox/dead-letter/:id/replay` |


---

# 4. Layout Architecture

## 4.1 RootLayout

Responsibilities:

- Defines `<html>`, global metadata, font loading, global CSS, and global provider placement.
- Mounts Sentry/PostHog browser providers through a small client island.
- Does not fetch protected tenant/member data.
- Does not render tenant-member navigation.
- Does not perform permission decisions.

Data loading:

- Request ID and static environment metadata only.
- Tenant-specific data belongs in TenantBootstrap or shell layouts.

Boundaries:

- Global `error.tsx` handles unexpected app-level failures.
- Global `not-found.tsx` uses safe copy and avoids tenant/resource leakage.

## 4.2 TenantBootstrap

Responsibilities:

- Resolve host to tenant.
- Load safe tenant state and safe branding bootstrap.
- Apply published theme CSS variables.
- Redirect or render A10 for unavailable tenant states.
- Provide safe bootstrap context to public/auth/protected shells.

Data loading:

- Public-safe tenant projection: tenant display name, logo reference, theme tokens, favicon, tenant state.
- No membership-specific data.
- No protected nav.

Error/loading:

- Loading state is tenant-neutral until host resolution completes.
- Tenant unavailable uses A10 state.
- Unknown host returns safe not-found without tenant leakage.

## 4.3 PublicSiteShell

Responsibilities:

- Render public tenant-branded header, public main, footer/legal/support.
- Own public navigation only: landing, diagnostic, login/signup, certificate verification entry.
- Never render member nav, learner progress, admin actions, or private content.

Data loading:

- Public landing data through approved public APIs.
- Branding/theme from TenantBootstrap.

Boundaries:

- Public route errors use safe public `ErrorState`.
- Public diagnostic abuse/rate-limit errors surface safe retry copy.

## 4.4 AuthShell

Responsibilities:

- Render login/signup/reset/invite acceptance forms.
- Keep auth flows tenant-branded but not member-branded.
- Handle Supabase Auth UI orchestration and Atlas invitation acceptance.

Data loading:

- TenantBootstrap only.
- Invite token validation through approved public invitation API.

Boundaries:

- Auth errors are form-level.
- Successful login redirects according to server-resolved membership/role, not client preference.

## 4.5 LearnerShell

Responsibilities:

- Render learner header, search, notifications, profile menu, learner navigation, mobile bottom nav/drawer.
- Own L1–L25 learner navigation visibility.
- Hide entitlement-gated nav items unless enabled.
- Keep learner UI low-friction and next-action focused.

Data loading:

- ACTIVE membership.
- Safe profile projection.
- Learner navigation projection with permission + entitlement hints.
- Notification count if allowed.

Boundaries:

- Shell skeleton appears only after membership gate passes.
- Denial states do not leak resource existence.

## 4.6 StudioShell

Responsibilities:

- Render instructor/control header, studio sidebar, guarded primary action region, and editor/table content frame.
- Own I1–I13 navigation and S1 review entry where relationship-scoped.
- Keep creation, review state, validation, and workflow gate visible.

Data loading:

- Instructor-safe membership/role projection.
- Studio nav projection.
- Pending review/grading counts where permission allows.

Boundaries:

- Editor validation errors remain local and accessible.
- Publish/review actions always route through workflow state and approved APIs.

## 4.7 ModerationShell

Responsibilities:

- Render queue-focused moderation navigation and evidence-first layout.
- Own M1–M4 navigation.
- Surface severity, reason, reported content projection, action history, and decision controls.

Data loading:

- Moderator-safe nav projection.
- Queue counts if `community.enable` and permissions pass.

Boundaries:

- Reported content is shown only through moderation APIs.
- Decision modals require confirmation and audit context where declared.

## 4.8 TenantAdminShell

Responsibilities:

- Render tenant admin navigation, operational health, setup/configuration areas, and admin-only primary actions.
- Own T1–T24 navigation and S1 where admin/reviewer scoped.
- Separate owner-only controls inline through `can()` projections without creating owner-only screens.

Data loading:

- Admin membership and role projection.
- Entitlement summary.
- Tenant setup/branding/config state.
- Admin navigation projection.

Boundaries:

- Tenant admin cannot mutate entitlements; T10 is read-only.
- Owner-only actions hidden or disabled based on server projection, but server remains final authority.

## 4.9 PlatformConsoleShell

Responsibilities:

- Render platform operational identity, platform navigation, MFA/session status, reason banner, and platform-only table/detail pages.
- Own P1–P8 navigation.
- Never import tenant shells, tenant nav, tenant admin components, or tenant API clients.

Data loading:

- Platform role projection.
- Reason/scope state for reason-bound actions.
- Platform navigation projection.

Boundaries:

- Platform pages use platform route wrapper and platform client only.
- Platform access requires reason-bound scope where actioning tenants.
- All platform actions are audit-heavy.

---

# 5. Route Protection Architecture

## 5.1 Route classes

Public routes:

- A1 `/`, `/p/:slug`
- A2 `/diagnostic`
- A3 modal on `/diagnostic`
- A4 `/diagnostic/result`
- A5 `/verify/:credentialId`
- A10 tenant unavailable system route

Auth routes:

- A6 `/login`
- A7 `/signup`
- A8 `/reset-password`
- A9 `/invite/accept?token=`

Protected tenant routes:

- L1–L25
- I1–I13
- M1–M4
- T1–T24
- S1

Platform routes:

- P1–P8 under `/platform/*`

## 5.2 Exact implementation flow

```text
Incoming request
  ↓
Create/read requestId
  ↓
Resolve host → tenant
  ↓
Tenant state gate
  ↓
Classify route: public/auth/protected/platform
  ↓
If public: load public projection only → render PublicSiteShell
  ↓
If auth: load auth-safe tenant projection → render AuthShell
  ↓
If protected tenant route:
    authenticate via Supabase Auth
    resolve auth_principal
    require ACTIVE membership for resolved tenant
    load route metadata {permission, entitlement?, resourceLoader?}
    enforce entitlement if declared
    load resource ref if required
    can(actor, permission, resourceRef, ctx)
    load page data through approved API/resource projection
    render approved shell + page
  ↓
If platform route:
    authenticate platform principal
    assert platform role
    enter reason-bound platform scope where required
    load platform route metadata
    render PlatformConsoleShell + page
```

## 5.3 Public route rules

- Host resolution still runs.
- Tenant state gate still runs.
- Public branding may load.
- Public data is limited to public projections.
- No member nav.
- No private resource IDs.
- No hidden protected action payloads.

## 5.4 Auth route rules

- AuthShell may show tenant brand.
- Login/signup does not imply tenant access.
- After auth, server checks membership for the host tenant.
- INVITED membership routes only to A9.
- SUSPENDED, REMOVED, and no-row memberships cannot enter protected tenant routes.

## 5.5 Protected route rules

- Page files must export `screenId` and route metadata reference.
- Server gate runs before page body data load.
- Page returns `PermissionDenied`, `EntitlementRequired`, `MembershipRequired`, or `TenantUnavailable` states as applicable.
- Client Components receive only authorized projections.

## 5.6 Membership gate

Membership states:

| State | Frontend behavior |
|---|---|
| ACTIVE | Proceed to entitlement and permission checks. |
| INVITED | Block protected routes; route to A9 invitation acceptance. |
| SUSPENDED | Show blocked state/public-safe tenant notice. |
| REMOVED | Treat as no active tenant membership; no protected render. |
| No row | Public/auth routes only. |

## 5.7 Entitlement gate

- Entitlement runs before permission for entitled routes/actions.
- Frontend never checks plan names.
- Entitlement boundaries use server-provided entitlement projection only.
- Route-level missing entitlement shows `EntitlementRequired` state.
- Sub-action missing entitlement uses locked card/disabled action.
- Existing data must not be deleted or hidden from admin/export views solely because entitlement is disabled.

## 5.8 Permission-aware rendering

Use permission-aware rendering for display safety:

```tsx
<PermissionBoundary permission="course.update" resourceRef={{ type: 'course', id: course.id }}>
  <EditCourseButton />
</PermissionBoundary>
```

Rules:

- Boundary input comes from server projection.
- Never fetch hidden action payloads just to hide them.
- Never expose disabled admin controls to learners.
- Never treat UI boundary as authorization.

---

# 6. Component Architecture

## 6.1 Component folder structure

```text
components/
├── ui/                         # shadcn-wrapped primitives only
├── patterns/                   # reusable cross-domain patterns
├── domains/                    # visual/domain components without business logic
└── shells/                     # shell components and navigation frames
```

## 6.2 `components/ui/`

Ownership:

- Frontend/design-system engineers.

Responsibilities:

- Wrap shadcn/ui primitives.
- Apply Atlas tokens, accessibility defaults, variants, density, focus states, loading states.
- Remain domain-agnostic.

Allowed dependencies:

- React
- shadcn/ui
- Tailwind utilities
- shared type-only UI props

Forbidden:

- API calls
- route imports
- tenant-specific logic
- permission checks
- domain mutations

Examples:

- `Button`
- `Input`
- `Dialog`
- `Sheet`
- `DropdownMenu`
- `Table`
- `Badge`
- `Alert`
- `Skeleton`

## 6.3 `components/patterns/`

Responsibilities:

- Cross-domain reusable compositions.
- No hardcoded business use case.

Examples:

- `PageHeader`
- `EmptyState`
- `ErrorState`
- `PermissionBoundary`
- `EntitlementBoundary`
- `ConfirmDialog`
- `DataTable`
- `FilterBar`
- `PaginationControls`
- `AuditReasonDialog`
- `LoadingRegion`

Allowed dependencies:

- `components/ui`
- shared types
- utility hooks for UI only

Forbidden:

- direct domain API calls unless explicitly designed as a generic controlled component.

## 6.4 `components/domains/`

Responsibilities:

- Present domain-specific projections.
- Render typed view models returned by approved APIs/loaders.
- Contain no authorization logic beyond display hints.

Domain examples:

```text
components/domains/learning/
components/domains/assessment/
components/domains/practice/
components/domains/community/
components/domains/moderation/
components/domains/admin/
components/domains/platform/
components/domains/analytics/
components/domains/certificates/
```

## 6.5 `components/shells/`

Responsibilities:

- Shell layout and navigation composition.
- Shell-level loading and denial boundaries.
- Uses server-provided navigation projection.

Examples:

- `PublicSiteShell`
- `AuthShell`
- `LearnerShell`
- `StudioShell`
- `ModerationShell`
- `TenantAdminShell`
- `PlatformConsoleShell`
- `TenantBootstrap`

Forbidden:

- Platform shell importing tenant shell internals.
- Tenant shells importing platform components.
- Rendering protected nav before gates.

---

# 7. Screen Composition Architecture

## 7.1 Learner

Composition:

```text
LearnerShell
  LearnerHeader
  LearnerNavigation / LearnerMobileNav
  LearnerMain
    PageHeader
    PrimaryLearningRegion
    SecondaryProgressRegion
    ContextualActionRegion
```

Domain components:

- `ReadinessBandCard`
- `NextBestActionCard`
- `ContinueLearningCard`
- `CourseCard`
- `LessonPlayer`
- `AssessmentOverviewCard`
- `SwipePracticeCard`
- `ProgressTrendCard`
- `CertificateCard`
- `CommunitySpaceCard`
- `NotificationList`

Reusable patterns:

- Next-best-action pattern
- Progress card
- Empty learning state
- Entitlement-gated widget
- Safe CTA redirect confirm

Rules:

- One primary action in the first viewport.
- No admin-style data overload.
- Readiness and CTA copy must remain educational, not financial advice or guaranteed-success framing.

## 7.2 Instructor

Composition:

```text
StudioShell
  StudioHeader
  StudioSidebar
  ControlMain
    PageHeader
    GuardedPrimaryAction
    Builder/List/Detail Region
    ValidationRail or MetadataPanel
```

Domain components:

- `CourseManagerTable`
- `CourseBuilder`
- `LessonEditor`
- `ItemBankTable`
- `ItemEditor`
- `AssessmentBuilder`
- `LearningPathBuilder`
- `GradingQueue`
- `GradingDetail`
- `LearnerRosterTable`
- `StudioAnalyticsPanel`

Reusable patterns:

- Builder stepper
- Version/status badge
- Workflow status panel
- Guarded publish action
- Validation summary

Rules:

- Publish actions must show human gate state.
- Instructor-owned and relationship-scoped data comes from server projections.
- Admin reuse of studio screens is through permission/relationship rules, not duplicate screens.

## 7.3 Moderator

Composition:

```text
ModerationShell
  ModerationHeader
  ModerationSidebar
  QueueMain
    FilterBar
    CaseTable / CaseDetail
    EvidencePanel
    DecisionPanel
```

Domain components:

- `ModerationCaseTable`
- `ModerationEvidencePanel`
- `DecisionControls`
- `AppealReviewList`
- `CommunitySpaceAdminTable`

Reusable patterns:

- Severity badge
- Evidence card
- Reason-required confirm
- Audit/action history list

Rules:

- Evidence is not loaded until moderation permission and entitlement pass.
- Moderation indicators must be explicit but safe.
- Destructive decisions require confirmation and audit context where declared.

## 7.4 Tenant Admin

Composition:

```text
TenantAdminShell
  AdminHeader
  AdminSidebar
  AdminMain
    OperationalPageHeader
    SetupHealth / Risk / Config Region
    Tables / Forms / Details
    Audit / Version / Confirmation Panels
```

Domain components:

- `MembersTable`
- `RoleEditor`
- `BrandingEditor`
- `ThemeTokenEditor`
- `DomainVerificationPanel`
- `ConfigSectionForm`
- `EntitlementSummary`
- `CompetencyDimensionEditor`
- `CertificateTemplateEditor`
- `AutomationRuleBuilder`
- `AuditLogTable`
- `ExportJobTable`
- `DeletionRequestTable`

Reusable patterns:

- Admin table
- Version history panel
- Guarded owner-only action
- Entitlement read-only panel
- Reason/confirmation dialog

Rules:

- Tenant admins cannot mutate entitlements.
- Owner-only deltas remain inline and gated.
- Audit, export, deletion, and role changes are treated as sensitive surfaces.

## 7.5 Platform Admin

Composition:

```text
PlatformConsoleShell
  PlatformHeader
  PlatformReasonBanner
  PlatformSidebar
  PlatformMain
    CrossTenantTable / TenantDetail / Audit / Support / Eventing
```

Domain components:

- `PlatformTenantTable`
- `ProvisionTenantWizard`
- `TenantLifecyclePanel`
- `PlatformEntitlementEditor`
- `GlobalFeatureFlagEditor`
- `GlobalCatalogTabs`
- `PlatformAuditTable`
- `SupportSessionPanel`
- `DeadLetterEventTable`

Reusable patterns:

- Reason modal
- Platform danger zone
- Cross-tenant audit entry
- Tenant state badge

Rules:

- Platform shell never mounts tenant navigation.
- Platform support scope is reason-bound and time-boxed where required.
- Platform operations are not tenant roles.

---

# 8. Server Component Strategy

## 8.1 Must be Server Components

- `app/layout.tsx`
- `app/page.tsx` root resolver
- All shell layouts except small interactive subparts
- All route pages by default
- Route gate wrappers
- Protected navigation builders
- Initial dashboard/list/detail data loaders
- Permission/entitlement projection loaders
- Public landing and public verification data loader
- Admin/platform tables initial render

## 8.2 Should be Server Components

- Dashboard cards with non-interactive metrics
- Course catalog initial render
- Course detail outline
- Lesson metadata and asset list
- Assessment overview
- Attempt result/review read-only view
- Readiness summary and policy explanation
- Certificate list/public verification
- Community initial feed page
- Admin configuration pages before form hydration
- Analytics page frame and initial cards

## 8.3 Must never be Server Components

The following must be Client Components because they require browser state, events, or live interaction:

- Assessment attempt runner controls
- Autosave status and local answer buffer
- Swipe gesture card stack
- Rich editors/builders
- Drag/drop ordering controls
- Forms using React Hook Form
- Dialogs, drawers, command menus
- DataTable client filters where interactive
- Charts/tooltips/hover interactions
- Infinite scroll sentinel
- Toast provider
- Post composer/comment composer
- Theme preview controls

## 8.4 Examples by area

| Area | Server component responsibility | Client component island |
|---|---|---|
| Dashboard | load authorized summary projections | refresh widgets, CTA confirm |
| Courses | initial catalog/detail/outline | filters, enroll confirm |
| Lessons | load lesson/asset projection | video player controls, mark-complete button |
| Readiness | load score/policy/CTA eligibility | CTA redirect confirm |
| Community | initial spaces/feed | composer, reactions, infinite scroll |
| Admin | load settings/tables | forms, dialogs, table controls |
| Analytics | load card/table projections | charts, date filters, exports |
| Platform | load platform tables/details | reason dialogs, lifecycle confirms |

---

# 9. Client Component Strategy

## 9.1 Interactive components

Client Components are allowed for:

- Menus, dialogs, drawers, tabs, accordions.
- Tables with sorting/filtering/pagination interactions.
- Forms and rich builders.
- Assessment runner controls.
- Swipe gestures.
- Community composer, reactions, comments.
- Charts and client-side visual interactions.
- Optimistic UI with rollback.

## 9.2 Assessment runner

Rules:

- Client stores only current interaction state and unsent answer draft.
- Server controls attempt state, timing authority, question visibility, submission, and grading.
- Correct answers are never sent to the client before allowed review.
- Autosave mutations use approved attempt APIs.
- Submit uses confirmation and idempotency where declared.
- Tab/blur/fullscreen/copy-paste L1 proctoring signals are recorded only where configured by approved assessment/proctoring settings.

## 9.3 Swipe runner

Rules:

- Use gesture and keyboard controls.
- Use explicit buttons as non-gesture fallback.
- Use React Query mutation for each response or batched approved session response.
- Show instant feedback only from approved response payload.
- Update streak/XP optimistically only when safe and rollback on denial.

## 9.4 Community interactions

Rules:

- Composer validates with Zod-compatible schema.
- Reactions may be optimistic but must rollback on denial.
- Report modal must not reveal moderator-only state.
- Infinite scroll uses cursor pagination.
- Deleted/hidden/moderated content renders explicit allowed states.

## 9.5 Forms

Rules:

- React Hook Form + Zod resolver.
- Server revalidates every submission.
- Server errors map to field errors or form summary.
- Disable submit during mutation.
- Destructive actions require confirmation.

## 9.6 Charts

Rules:

- Client-render chart only after server-authorized data projection.
- Always include title, timeframe, text summary, and table fallback.
- Do not encode state by color alone.

---

# 10. Data Fetching Architecture

## 10.1 Data source rule

Frontend must consume approved API/resource-loader projections only. It must not import Prisma, repositories, or direct database helpers.

## 10.2 Server loaders

Server loaders live with features:

```text
features/<domain>/server/loaders.ts
```

Responsibilities:

- Call approved API client or approved page-data service boundary.
- Attach request/session cookies server-side.
- Parse response with output schema.
- Return safe view models.
- Throw typed route errors for `AUTH_REQUIRED`, `NO_MEMBERSHIP`, `ENTITLEMENT_REQUIRED`, `PERMISSION_DENIED`, `NOT_FOUND`, and transport errors.

Example:

```ts
export async function loadCourseCatalogPage(searchParams: CourseListParams) {
  const ctx = await requireTenantActor({
    screenId: 'L2',
    permission: 'course.read',
  });

  return apiClient.server.get('/api/v1/courses', {
    query: courseListQuerySchema.parse(searchParams),
    ctx,
    output: courseListResponseSchema,
  });
}
```

## 10.3 React Query

Use React Query for:

- Client-side pagination and infinite scroll.
- Mutations.
- Autosave.
- Reactions/comments.
- Form side effects.
- Tables that update without full route navigation.
- Client-only refetch after filters change.

Do not use React Query for:

- Initial protected route gating.
- Authorization decisions.
- Tenant resolution.
- Platform-scope establishment.
- Secrets or sensitive token storage.

## 10.4 Revalidation

Patterns:

- Server route data: `revalidatePath()` after Server Action mutation where route-level refresh is needed.
- React Query: invalidate exact query keys after API mutation.
- Public landing/theme: tag-based cache invalidated on branding/theme publish.
- Admin tables: invalidate list and detail keys after mutations.
- Assessment autosave: do not invalidate full attempt on every keystroke; update local cache minimally.

## 10.5 Caching

Rules:

- Cache keys must be tenant-aware on the server.
- Browser caches must be cleared on logout, membership denial, tenant switch by host, or authorization failure.
- Public cache can use safe tenant public tags.
- Protected pages are `no-store` unless explicitly safe and tenant-scoped.
- Do not cache entitlement or permission projections beyond server-approved lifetime.

## 10.6 Mutation patterns

Mutation flow:

```text
User action
  ↓
Client validation
  ↓
Disable submit / show pending
  ↓
API call or Server Action
  ↓
Server revalidation + authorization
  ↓
Success: invalidate/revalidate + show safe success
Failure: rollback optimistic state + show safe error/requestId
```

---

# 11. React Query Architecture

## 11.1 Folder structure

```text
features/<domain>/queries/
├── keys.ts
├── queries.ts
├── mutations.ts
└── invalidation.ts
```

## 11.2 Query key rules

Keys must be stable, typed, and scoped by resource but not by untrusted tenant input.

Examples:

```ts
export const courseKeys = {
  all: ['courses'] as const,
  list: (params: CourseListParams) => ['courses', 'list', params] as const,
  detail: (courseId: string) => ['courses', 'detail', courseId] as const,
};

export const attemptKeys = {
  detail: (attemptId: string) => ['attempt', attemptId] as const,
  result: (attemptId: string) => ['attempt', attemptId, 'result'] as const,
};

export const communityKeys = {
  posts: (spaceId: string, params: FeedParams) => ['community-posts', spaceId, params] as const,
};
```

## 11.3 Mutations

Mutation modules must:

- Call approved API client.
- Parse input with schema.
- Include `Idempotency-Key` where required.
- Surface request ID on error.
- Roll back optimistic updates on server denial.
- Invalidate exact keys only.

## 11.4 Invalidation

Examples:

| Mutation | Invalidate |
|---|---|
| enroll in course | course detail, learner dashboard, path progress |
| mark lesson complete | lesson, course progress, dashboard, competency if affected |
| submit attempt | attempt result, progress, competency, certificates if event-generated |
| post/comment/reaction | relevant feed/thread key |
| update branding/theme | branding preview, public theme tag |
| publish workflow transition | source artifact detail, S1 queue, public/list projection |

## 11.5 Optimistic updates

Allowed:

- Community reactions.
- Mark notification read.
- Local form draft state.
- Swipe response UI feedback when server response confirms enough metadata.

Not allowed:

- Role assignment.
- Permission overrides.
- Entitlement changes.
- Certificate issue/revoke.
- Tenant lifecycle changes.
- Data export/deletion process.
- Assessment final submission.

## 11.6 Pagination and infinite scroll

Rules:

- Use cursor-based pagination.
- URL state owns filters/sort where shareable.
- Infinite scroll must have accessible “Load more” fallback.
- Moderation/audit/platform tables prefer explicit pagination over infinite scroll for traceability.

---

# 12. API Client Architecture

## 12.1 Folder structure

```text
lib/api-client/
├── client.ts
├── server.ts
├── browser.ts
├── errors.ts
├── pagination.ts
├── retry.ts
├── idempotency.ts
├── schemas.ts
└── index.ts
```

## 12.2 Request layer

Responsibilities:

- Build approved `/api/v1/**` request paths.
- Attach credentials/cookies as appropriate.
- Attach request ID where provided.
- Attach `Idempotency-Key` for required mutations.
- Parse success output with Zod.
- Parse error envelope into typed `ApiError`.

Forbidden:

- Accepting `tenant_id` input.
- Building unapproved endpoints dynamically from user input.
- Swallowing error envelope codes.
- Retrying non-idempotent mutations automatically.

## 12.3 Auth handling

Server client:

- Uses request cookies/session.
- Does not expose tokens to components.
- Throws typed auth/membership errors.

Browser client:

- Uses same-origin credentials.
- Does not store Supabase tokens in custom localStorage.
- Clears query cache on logout/auth failure.

## 12.4 Error handling

```ts
export class ApiError extends Error {
  constructor(
    public code: AtlasErrorCode,
    public requestId: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
```

UI mapping:

| Code | UI state |
|---|---|
| AUTH_REQUIRED | Redirect/login prompt |
| NO_MEMBERSHIP | MembershipRequired |
| MEMBERSHIP_PENDING | A9 invitation acceptance path |
| MEMBERSHIP_SUSPENDED | blocked tenant/member state |
| ENTITLEMENT_REQUIRED | EntitlementRequired |
| PERMISSION_DENIED | PermissionDenied |
| OWNERSHIP_DENIED / RELATIONSHIP_DENIED | Safe denied/not-found without leak |
| VALIDATION_ERROR | field/form errors |
| RATE_LIMITED | retry-safe message |
| TENANT_UNAVAILABLE | A10 |

## 12.5 Pagination

Response shape expected by UI:

```ts
type CursorPage<T> = {
  data: T[];
  pageInfo: {
    nextCursor?: string;
    previousCursor?: string;
    hasNextPage: boolean;
  };
};
```

## 12.6 Retry strategy

- GET requests may retry on network/503 with bounded exponential backoff.
- Idempotent mutations may retry only when idempotency key is present.
- Non-idempotent mutations do not auto-retry.
- Validation, permission, entitlement, membership, and not-found errors never retry.

---

# 13. Form Architecture

## 13.1 Stack

- React Hook Form for form state.
- Zod for client-safe validation schema.
- Server revalidation always required.
- Server Actions allowed only as UI orchestration wrappers around approved service/API behavior.

## 13.2 Folder structure

```text
features/<domain>/forms/
├── <FormName>.tsx
├── fields.tsx
├── schema.ts
├── defaults.ts
└── submit.ts
```

## 13.3 Field architecture

Each form field uses shared field components:

```text
<FormField>
  <FormLabel />
  <FormControl />
  <FormDescription />
  <FormMessage />
</FormField>
```

Rules:

- Every input has accessible label.
- Errors link to inputs.
- Error summary focuses after failed submit.
- Required/optional states are explicit.
- Read-only permission state renders as read-only field, not hidden data.

## 13.4 Server Actions

Allowed:

- Form orchestration.
- Parsing form data.
- Calling approved service/API path.
- Returning field errors and request ID.
- Revalidating paths/tags.

Forbidden:

- Hidden APIs with new behavior.
- Direct Prisma usage.
- Ad hoc authorization.
- Accepting tenant IDs.

Example:

```ts
'use server';

export async function updateProfileAction(input: unknown) {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return toFieldErrors(parsed.error);

  try {
    await apiClient.server.put('/api/v1/me/profile', {
      body: parsed.data,
      output: profileResponseSchema,
    });
    revalidatePath('/profile');
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
```

## 13.5 Error handling

- `VALIDATION_ERROR` maps to fields.
- Authorization errors map to route/action denied state.
- Conflict maps to inline stale-state warning.
- Request ID shown for support.
- Raw DB/provider errors never shown.

---

# 14. State Management Architecture

## 14.1 Server state

Owned by:

- Server Components for initial route render.
- React Query for client refetch/mutation.

Forbidden:

- Redux/Zustand/global stores for server data.
- Duplicating server state into context.
- Manually syncing multiple server-state caches.

## 14.2 Client state

Allowed for:

- Dialog open/close.
- Active tabs.
- Form drafts.
- Local runner UI state.
- Swipe gesture state.
- Table column visibility.
- Temporary optimistic state.

## 14.3 URL state

Use URL state for:

- Search query.
- Table filters.
- Sort.
- Cursor/page.
- Deep-linkable tabs.
- Admin console view state.

Do not use URL state for:

- Tenant ID.
- Actor ID.
- Hidden permission data.
- Entitlement override.
- Sensitive tokens after exchange.

## 14.4 Form state

Owned by React Hook Form. Persist only when approved by product flow. Do not store sensitive form data in localStorage.

## 14.5 Context usage

Allowed contexts:

- `ThemeProvider`
- `QueryClientProvider`
- `PostHogProvider`
- `TooltipProvider`
- `ShellUiStateProvider`
- `CommandPaletteProvider` if approved as shared UI pattern inside existing screens

Forbidden contexts:

- `TenantIdContext` as client authority.
- `PermissionAuthorityContext` as authorization source.
- `GlobalUserStore` containing protected server data.
- `PlatformScopeContext` inside tenant app.

---

# 15. Table Architecture

## 15.1 Reusable DataTable

```text
components/patterns/data-table/
├── DataTable.tsx
├── DataTableToolbar.tsx
├── DataTablePagination.tsx
├── DataTableEmptyState.tsx
├── DataTableLoadingState.tsx
├── DataTableBulkActions.tsx
├── columns.tsx
└── types.ts
```

## 15.2 Table capabilities

- Server-authorized data source.
- Cursor pagination.
- URL-backed filters/sort.
- Column definitions typed to view model.
- Accessible row actions.
- Empty/loading/error states.
- Optional bulk actions where approved by screen/API.
- Density variants: comfortable, standard, compact.

## 15.3 Filters

- Use indexed allow-list only.
- Encode shareable filters in URL.
- Validate filter params with Zod.
- Never filter by hidden permission/tenant fields client-side.

## 15.4 Bulk actions

Allowed only where approved by API/screen. Must:

- Show selected count.
- Reconfirm destructive actions.
- Use idempotency where required.
- Rollback selection on denial.
- Provide request ID on failure.

## 15.5 Table usage by plane

| Plane | Table behavior |
|---|---|
| Admin | Standard/compact, filters, pagination, guarded row actions |
| Studio | Standard, creator-focused actions, review state visible |
| Moderation | Compact/evidence-first, severity filters, explicit decision actions |
| Platform | Compact, reason-bound actions, audit-heavy, no mobile card conversion for sensitive audit where exact scanning matters |

---

# 16. Analytics UI Architecture

## 16.1 Components

- Metric cards.
- Trend charts.
- Funnel charts.
- Item statistics tables.
- Segment/date filters.
- CSV export action where approved.
- Text summary and table fallback for every chart.

## 16.2 Loading strategy

- Page shell renders after permission/entitlement gate.
- Metric cards stream or skeleton independently.
- Large tables use cursor pagination.
- Charts load after summary cards where possible.

## 16.3 Large dataset handling

- No browser-side full export.
- CSV export calls approved export endpoint/action only.
- Date range and segment filters validated and indexed.
- Heavy aggregations use API projections/analytics read models, not frontend computation.

## 16.4 Security

- Analytics entitlement required where declared.
- Relationship-scoped instructor analytics only show allowed courses/items.
- Tenant admin analytics are tenant-wide only inside tenant context.
- Platform analytics screens are not in P0/P1 unless approved elsewhere; do not invent them.

---

# 17. Assessment UI Architecture

## 17.1 Runner composition

```text
AssessmentAttemptPage (Server)
  AttemptGate + load attempt projection
  AssessmentRunner (Client)
    RunnerHeader
    TimerDisplay
    QuestionNavigator
    QuestionRenderer
    AutosaveIndicator
    SubmitAttemptDialog
```

## 17.2 Question rendering

- Renderer selected by server-approved item type.
- Unknown item type fails safe.
- Swipe item type belongs to generic item registry, not tenant fork.
- Correct answer/explanation only appears when review policy allows.

## 17.3 Autosave

- Debounced or per-action autosave via `POST /attempts/:id/answers`.
- Show saved/saving/failed state.
- Retain unsent draft in memory only for current session.
- Do not persist assessment answers to localStorage unless explicitly approved by security review.

## 17.4 Submission

- Submit confirm modal.
- `POST /attempts/:id/submit`.
- Disable after submit begins.
- Server controls final state and grading.
- Redirect to L9 when result is available or show processing state if grading is async.

## 17.5 Results and review

- Result page is Server Component where possible.
- Per-item review is policy-bound.
- Dimension contribution shown only from approved result projection.
- No financial advice or guaranteed outcome framing.

## 17.6 Security constraints

- Timer authority is server-side.
- Do not expose full item bank in client payload.
- Do not expose answer keys before allowed review.
- Prevent accidental double-submit with idempotency/disabled state.
- Proctoring L1 signals are advisory inputs and must not auto-revoke/auto-publish outside approved workflow.

---

# 18. Swipe Learning UI Architecture

## 18.1 Card architecture

```text
SwipePage (Server)
  load due/deck/session eligibility
  SwipeRunner (Client)
    DeckHeader
    SwipeCardStack
    FeedbackPanel
    SessionProgress
    KeyboardFallbackControls
    SessionCompleteDialog
```

## 18.2 Gestures

- Horizontal swipe gestures for known/unknown or approved response options.
- Buttons for non-gesture fallback.
- Keyboard controls with visible hints.
- Reduced-motion mode disables aggressive animations.

## 18.3 Keyboard support

- Arrow keys or explicit visible shortcuts within runner scope only.
- Enter/Space for selected action.
- Escape exits only through safe confirm when session progress could be lost.

## 18.4 Mobile behavior

- Single-card focus.
- Large touch targets.
- No hidden required action behind gesture-only interface.
- Feedback region remains visible without covering controls.

## 18.5 Offline handling

P1 does not introduce offline-first learning. Allowed handling is limited to network resilience:

- Keep current unsent response in memory.
- Retry idempotent/session response where safe.
- Show reconnect state.
- Do not promise offline completion.
- Do not persist session queues across browser restarts unless later approved.

## 18.6 Scoring feedback

- Feedback comes from approved practice session response.
- XP/streak feedback must be server-confirmed or rolled back.
- Competency changes are read from projections after event/outbox processing, not guessed permanently on client.

---

# 19. Community UI Architecture

## 19.1 Feed

- L17 loads spaces and join eligibility.
- L18 loads post feed by space.
- L19 loads post detail and comments.
- Infinite scroll uses cursor pagination plus accessible Load More.

## 19.2 Posts

- Composer is Client Component.
- Body input is sanitized server-side.
- Preview must sanitize markdown/rich text.
- Mutations use approved community APIs.

## 19.3 Comments

- Thread view supports create/update/delete own comments where permission allows.
- Edit/delete controls use server-provided ownership projection.
- Moderator delete path is separate permissioned API behavior, not client role branching.

## 19.4 Moderation indicators

- Hidden/locked/deleted states use explicit status badges where allowed.
- Regular learners do not see moderator-only metadata.
- Reported state does not reveal who reported.

## 19.5 Reporting

- Report modal validates reason.
- Submission creates approved moderation case/report path.
- Confirmation copy is safe and does not promise outcome.

## 19.6 Pagination/infinite scroll

- Feed keys include `spaceId` and cursor/filter state.
- New post prepends optimistically only if server accepts.
- Moderation or deletion updates remove/replace cards safely.

---

# 20. Tenant Branding Architecture

## 20.1 Theme loading

Flow:

```text
Host → tenant resolution
  ↓
Load published tenant_theme + tenant_branding safe projection
  ↓
Map to CSS variables
  ↓
Apply to document before visible tenant UI
  ↓
Render shell/page
```

## 20.2 Color tokens

- Tenant colors map into approved semantic token slots.
- Destructive, warning, success, permission denied, audit severity, and platform colors remain semantic and cannot be overridden into unsafe meanings.
- Contrast correction runs before applying tokens.

## 20.3 Logo loading

- Logo references come from branding API/storage reference.
- Use Next image optimization where compatible.
- Provide alt text from tenant display name/issuer projection.
- Support light/dark variants where configured.

## 20.4 Tenant customization

Allowed customization:

- Logo/favicons.
- Theme colors/tokens.
- Public landing copy/content.
- Certificate issuer display.
- Email template preview branding.
- Readiness policy/legal copy.

Forbidden patterns:

- Tenant-specific component forks.
- Tenant-specific CSS files.
- Hardcoded FundedBeyond strings.
- Hardcoded tenant domains.
- Tenant-specific route branches.
- Platform shell tenant branding.

---

# 21. Accessibility Architecture

## 21.1 Standard

Atlas frontend must meet WCAG 2.2 AA for Phase 0 + Phase 1A + Phase 1B.

## 21.2 Keyboard navigation

- Skip link first.
- Header before nav before main.
- Route changes focus page title.
- Modal open focuses first meaningful element.
- Modal close returns focus to opener.
- Destructive modal focuses cancel by default unless a locked design requires otherwise.

## 21.3 Focus management

- Visible focus on all interactive elements.
- Focus trapped inside modal/drawer.
- Toasts do not steal focus.
- Error summary focuses after failed submit.

## 21.4 Forms

- Labels visible or accessible.
- Errors associated with fields.
- Required fields announced.
- Async submit states announced.

## 21.5 Tables

- Header associations.
- Keyboard row actions.
- Pagination buttons labeled.
- Filters labeled.
- Bulk action selection announced.

## 21.6 Charts

- Title, description, timeframe.
- Legend.
- Text summary.
- Table fallback.
- No color-only encoding.

## 21.7 Assessment accessibility

- Keyboard answer selection.
- Screen-reader readable prompt.
- Visible selected state.
- Timer announcement without excessive interruption.
- Submit confirmation.
- Review policy clearly stated.

## 21.8 Swipe accessibility

- Non-gesture fallback.
- Keyboard controls.
- Reduced-motion support.
- Clear feedback text.
- Touch targets 44px where practical.

---

# 22. Responsive Architecture

## 22.1 Breakpoints

Use Tailwind defaults unless Design System tokens override. Implementation behavior:

| Size | Behavior |
|---|---|
| Mobile | single column, bottom/drawer nav, stacked cards, no hidden required actions |
| Tablet | two-column where safe, side panels become drawers |
| Desktop | full shell sidebars, tables, builders, analytics layouts |
| Large desktop | constrained max-width for learner/public, wider control-plane tables |

## 22.2 Shell behavior

| Shell | Mobile | Desktop |
|---|---|---|
| PublicSiteShell | topbar menu | tenant-branded public header |
| AuthShell | centered/single column | centered form + brand panel where approved |
| LearnerShell | bottom nav or drawer | sidebar + header |
| StudioShell | drawer nav, stacked editor panels | sidebar + editor/list + side panel |
| ModerationShell | drawer nav, case cards where safe | queue table + evidence panel |
| TenantAdminShell | drawer nav, responsive cards/forms | sidebar + admin tables/forms |
| PlatformConsoleShell | drawer with platform warning | platform sidebar + dense tables |

## 22.3 Table behavior

- Learner/public tables may convert to cards.
- Admin/studio tables may convert to cards only when actions remain clear.
- Audit/platform-sensitive tables should preserve row/column scanning with horizontal scroll and sticky first column.

## 22.4 Analytics behavior

- Mobile: cards stack, charts become vertically arranged with table fallback.
- Desktop: cards grid, charts side by side only when readable.
- Exports remain explicit action, not hidden overflow.

---

# 23. Error Architecture

## 23.1 Required files

```text
app/error.tsx
app/not-found.tsx
app/loading.tsx
app/(public)/error.tsx
app/(auth)/error.tsx
app/(learner)/error.tsx
app/(studio)/error.tsx
app/(moderation)/error.tsx
app/(admin)/error.tsx
app/(platform)/error.tsx
```

## 23.2 Error components

```text
components/patterns/errors/
├── ErrorState.tsx
├── PermissionDenied.tsx
├── EntitlementRequired.tsx
├── MembershipRequired.tsx
├── TenantUnavailable.tsx
├── ValidationErrorSummary.tsx
└── NotFoundSafe.tsx
```

## 23.3 PermissionDenied

Use when actor is authenticated/known but not allowed. Copy:

- Title: “You do not have access”
- Description: “Your current role does not allow this action in this tenant.”

Do not expose ownership or relationship details that could leak existence.

## 23.4 EntitlementRequired

Use when tenant capability is disabled. Copy:

- Title: “This feature is not enabled for this tenant”
- Description: “Your tenant’s current entitlements do not include this capability.”

Admins may see review/contact platform copy. Learners/instructors/moderators see contact academy admin copy.

## 23.5 MembershipRequired

Use for authenticated users without ACTIVE membership on host tenant. INVITED routes to A9; no-row stays public/auth.

## 23.6 TenantUnavailable

Maps to A10. Used when tenant state is suspended/archived/deleted/unavailable. Public-safe branding only.

## 23.7 Loading states

- Public: tenant-safe skeleton after host resolution.
- Protected: shell skeleton only after membership gate passes.
- Platform: platform skeleton after platform role check.
- Never flash protected nav before gates.

---

# 24. Frontend Security Architecture

## 24.1 XSS prevention

- React escapes by default.
- Avoid `dangerouslySetInnerHTML`.
- Any rich text/markdown preview uses approved sanitizer.
- User-generated community content sanitized server-side and rendered through safe renderer.
- Locale strings sanitized and not used as raw HTML.

## 24.2 CSRF handling

- Same-origin API calls use secure cookies and CSRF/SameSite protections from backend architecture.
- Forms and Server Actions rely on framework protections plus server authorization.
- Browser API client does not send cross-origin mutable requests.

## 24.3 Safe rendering

- No render before gates.
- No hidden protected payloads in HTML.
- No cross-tenant data in error/not-found states.
- No stack traces/raw provider/DB errors.
- Request ID shown for support.

## 24.4 Permission-safe rendering

- UI permission checks are display hints.
- Hidden actions must not preload secret/action payloads.
- Server remains final authority.
- On authorization failure, clear sensitive cached data.

## 24.5 Sensitive data handling

- Do not persist assessment answers, auth tokens, invite tokens, or support scope tokens in localStorage.
- Remove invite/reset tokens from URL after exchange where safe.
- Do not log form bodies or sensitive data to PostHog/Sentry.
- Mask emails/PII where tables do not require full display.

## 24.6 Tenant isolation considerations

- No client-supplied tenant ID.
- Host change clears query cache.
- Query cache cleared on logout/membership failure.
- Tenant branding cache keyed by resolved host/tenant server-side.
- Platform code unavailable to tenant route bundles via import boundary.

---

# 25. Frontend Testing Architecture

## 25.1 Unit tests

Location:

```text
tests/unit/frontend/
features/**/__tests__/
components/**/__tests__/
```

Cover:

- Utility functions.
- Zod schemas.
- Query key factories.
- Error mappers.
- UI primitive states.
- Permission/entitlement boundary display behavior.

## 25.2 Component tests

Cover:

- Shell nav visibility with server-provided projections.
- Form validation states.
- DataTable empty/loading/error states.
- Assessment question renderers.
- Swipe keyboard/gesture fallback.
- Community composer/report modal.

## 25.3 Integration tests

Cover:

- Server loaders calling approved API clients.
- Server Actions validating and mapping errors.
- React Query mutations invalidating correct keys.
- Route-denial rendering.
- No direct Prisma/repository imports in frontend folders.

## 25.4 E2E tests

Required frontend journeys:

1. Visitor landing → public diagnostic → identity gate → signup.
2. Learner login → dashboard → enroll → lesson complete → progress visible.
3. Learner assessment start → autosave → submit → result.
4. Learner swipe session → response feedback → completion state.
5. Learner readiness → attributed CTA confirm.
6. Instructor course/assessment authoring → submit for review.
7. Review queue S1 → approve/reject transition.
8. Moderator queue → case decision.
9. Tenant admin member invite/role/config/branding workflows.
10. Platform tenant provision → tenant detail → entitlement update with reason.
11. Cross-tenant negative browser test: Tenant A session cannot see Tenant B resource by URL.

## 25.5 Accessibility tests

- Automated axe checks for all route categories.
- Keyboard-only flows for assessment, swipe, tables, modals, builders.
- Screen reader smoke tests for forms, charts, errors, and runner pages.
- Focus management assertions after route change/modal submit/error.

## 25.6 Visual regression strategy

- Snapshot shared components in light/dark and density variants.
- Snapshot shells per plane.
- Snapshot tenant branding with neutral test tenant and FundedBeyond config tenant.
- Do not snapshot live dynamic data directly; use seeded fixtures.

## 25.7 Test folder structure

```text
tests/
├── unit/frontend/
├── component/
├── integration/frontend/
├── e2e/
├── accessibility/
├── visual/
└── fixtures/
```

---

# 26. Frontend Performance Architecture

## 26.1 Code splitting

- Route groups naturally split bundles.
- Client islands are imported only where used.
- Heavy builders/charts/editors lazy-load.
- Platform code must not enter tenant bundles.

## 26.2 Lazy loading

Lazy-load:

- Charts.
- Rich editors.
- Drag/drop builders.
- Assessment runner extras.
- Swipe animation library if any.
- Platform-only heavy tables.

Do not lazy-load critical route gates or primary error states.

## 26.3 Image optimization

- Use Next image for logos/assets where compatible.
- Public logo dimensions constrained.
- Certificate verification remains printable/readable.
- Video is provider-hosted; no self-hosted video frontend path.

## 26.4 Bundle control

CI should block:

- Tenant-specific bundles.
- Platform imports in tenant code.
- Large chart/editor libraries in learner dashboard initial bundle.
- Duplicate UI libraries.
- Unused shadcn primitives imported globally.

## 26.5 Caching

- Tenant public data cache tagged by tenant/host.
- Protected data no-store by default unless safe and tenant-scoped.
- React Query stale times tuned per feature.
- Theme/branding invalidated on publish.

## 26.6 Streaming

- Use Suspense for independent dashboard widgets.
- Stream analytics cards before heavy charts.
- Stream admin table frame before rows where helpful.
- Avoid streaming protected data before route authorization.

## 26.7 Partial prerendering

Allowed only for public-safe shell/static chrome where tenant branding and route state are safe. Protected personalized content must not be prerendered without tenant/user gating.

---

# 27. Frontend Folder Structure

```text
apps/web/src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── loading.tsx
│   ├── error.tsx
│   ├── not-found.tsx
│   ├── (public)/
│   ├── (auth)/
│   ├── (learner)/
│   ├── (studio)/
│   ├── (moderation)/
│   ├── (admin)/
│   ├── (workflow)/
│   ├── (platform)/
│   └── api/
├── components/
│   ├── ui/
│   ├── patterns/
│   ├── domains/
│   └── shells/
├── features/
│   ├── auth/
│   ├── tenant/
│   ├── learning/
│   ├── assessment/
│   ├── practice/
│   ├── competency/
│   ├── readiness/
│   ├── certificates/
│   ├── community/
│   ├── moderation/
│   ├── studio/
│   ├── admin/
│   ├── platform/
│   ├── analytics/
│   ├── notifications/
│   ├── search/
│   └── workflow/
├── lib/
│   ├── api-client/
│   ├── auth/
│   ├── errors/
│   ├── routing/
│   ├── telemetry/
│   ├── security/
│   ├── formatting/
│   └── utils/
├── hooks/
│   ├── use-disclosure.ts
│   ├── use-media-query.ts
│   ├── use-debounced-value.ts
│   └── use-safe-hotkeys.ts
├── providers/
│   ├── AppProviders.tsx
│   ├── QueryProvider.tsx
│   ├── PostHogProvider.tsx
│   ├── ThemeProvider.tsx
│   └── TooltipProvider.tsx
├── schemas/
│   ├── common.ts
│   ├── api-errors.ts
│   └── pagination.ts
├── types/
│   ├── screen-id.ts
│   ├── route-metadata.ts
│   ├── api.ts
│   ├── permissions.ts
│   └── view-models.ts
├── actions/
│   ├── auth/
│   ├── profile/
│   ├── learning/
│   ├── assessment/
│   ├── community/
│   ├── admin/
│   └── platform/
└── middleware.ts
```

Folder explanations:

| Folder | Purpose |
|---|---|
| `app/` | Next.js route implementation for approved screens and approved APIs only. |
| `components/ui/` | shadcn-wrapped primitives with Atlas tokens. |
| `components/patterns/` | reusable cross-domain UI patterns. |
| `components/domains/` | typed visual components for domain projections. |
| `components/shells/` | shell layout/navigation components. |
| `features/` | feature modules with loaders, queries, forms, components, and schemas. |
| `lib/api-client/` | typed request, response, error, pagination, retry, idempotency helpers. |
| `lib/auth/` | frontend-safe auth helpers and redirects, no authorization authority. |
| `lib/errors/` | error envelope mapping and UI state helpers. |
| `lib/routing/` | screen metadata, route map, redirects, URL state parsers. |
| `lib/telemetry/` | Sentry/PostHog wrappers with privacy controls. |
| `hooks/` | UI-only hooks. |
| `providers/` | client providers only. |
| `schemas/` | shared frontend-safe Zod schemas. |
| `types/` | frontend view model and route metadata types. |
| `actions/` | Server Actions as UI orchestration wrappers only. |

---

# 28. Frontend Engineering Standards

## 28.1 Naming conventions

- Components: `PascalCase.tsx`
- Hooks: `use-kebab-case.ts` or `useX.ts` consistently per folder; exported hook names use `useX`.
- Schemas: `<thing>.schema.ts` or `schema.ts` inside form/feature folder.
- Query keys: `keys.ts`.
- Mutations: `mutations.ts`.
- Server loaders: `server/loaders.ts`.
- Actions: `<verb><Resource>Action`.

## 28.2 File conventions

- `page.tsx` must be a Server Component unless documented exception.
- `loading.tsx`, `error.tsx`, `not-found.tsx` use approved patterns.
- Client files start with `'use client'` and stay leaf-level where possible.
- Do not place business logic in `page.tsx`; compose feature loaders and components.

## 28.3 Import conventions

Allowed import direction:

```text
app → features → components/patterns → components/ui
features → lib/api-client, schemas, types
components/ui → no domain imports
platform features → platform-only components/lib
```

Forbidden:

- UI importing Prisma/repositories.
- Tenant code importing platform client/components.
- Components importing route handlers.
- Cross-domain direct writes.
- Hardcoded tenant/FundedBeyond imports.

## 28.4 Component conventions

Every reusable component defines:

- Purpose.
- Props.
- States: loading, empty, error, disabled, readonly where applicable.
- Accessibility behavior.
- Responsive behavior.
- Token usage.
- Test expectations.

## 28.5 Hook conventions

Hooks must be either:

- UI-only hooks in `hooks/`, or
- domain query/mutation hooks in `features/<domain>/queries`.

Hooks must not perform authorization decisions or tenant resolution.

## 28.6 Testing conventions

- Each new page gets route smoke test.
- Each form gets validation test.
- Each mutation gets success/error/authorization-denial behavior test.
- Each sensitive action gets confirmation and audit expectation in integration/E2E where applicable.
- Each new route must be checked against Screen ID, permission, entitlement, API, and shell.

---

# 29. Cursor & Claude Development Rules

## 29.1 How AI should generate components

AI must:

- Start from approved Screen ID.
- Use existing `components/ui` primitives.
- Use design-system density, spacing, states, and accessibility rules.
- Accept typed view-model props.
- Include loading/empty/error states.
- Avoid API calls inside presentational components.

AI must not:

- Create tenant-specific components.
- Hardcode FundedBeyond copy/colors.
- Add new actions not present in Screen Inventory/Wireframes.
- Invent statuses that do not map to approved enums/states.

## 29.2 How AI should generate pages

AI must:

1. Identify Screen ID.
2. Confirm route path.
3. Confirm actor shell.
4. Add route metadata reference.
5. Use server gate before data load.
6. Load data through approved loader/API.
7. Compose approved shell/page sections.
8. Add safe error/loading states.
9. Add tests.

AI must not:

- Create new routes.
- Create duplicate pages for same screen state.
- Render protected nav before membership gate.
- Fetch data client-side just to decide route access.

## 29.3 How AI should generate forms

AI must:

- Use React Hook Form + Zod.
- Use existing field components.
- Map server validation errors to fields.
- Disable during submit.
- Add confirmation for destructive/irreversible actions.
- Use approved API/Server Action only.

AI must not:

- Accept `tenant_id`.
- Skip server revalidation.
- Hide errors in console only.
- Send raw unsanitized rich text without schema/sanitizer path.

## 29.4 How AI should generate API calls

AI must:

- Use `lib/api-client`.
- Use approved `/api/v1/**` path from API Inventory.
- Parse input and output schemas.
- Handle error envelope.
- Include idempotency key where required.
- Invalidate exact React Query keys.

AI must not:

- Create API endpoints.
- Use raw fetch scattered across components.
- Construct endpoints from arbitrary strings.
- Retry non-idempotent mutations.

## 29.5 How AI should generate tests

AI must generate:

- Unit/component test for component state.
- Integration test for loader/action behavior where applicable.
- E2E path for critical user journeys.
- Accessibility checks for modals/forms/runners/tables.
- Negative authorization/tenant test for protected surfaces where applicable.

## 29.6 Forbidden AI patterns

- “Temporary” hardcoded tenant ID.
- `if tenant.slug === 'fundedbeyond'`.
- New role/permission/entity/API/screen.
- Direct Prisma import in app/features/components.
- Client-side authorization as final decision.
- `dangerouslySetInnerHTML` without approved sanitizer.
- Swallowing request IDs/errors.
- Optimistic updates for irreversible mutations.
- Platform imports in tenant bundles.
- Public community browsing.
- Commerce checkout/challenge purchase in Academy P1.
- Inbound challenge event UI in P1.
- Native mobile build endpoints/screens in P1.
- AI coach/generation screens in P1.

---

# 30. Final Validation

## 30.1 Screen Coverage Validation

Result: **PASS**

- Public/Auth: A1–A10 covered.
- Learner: L1–L25 covered.
- Instructor/Studio: I1–I13 covered.
- Moderator: M1–M4 covered.
- Shared Workflow: S1 covered.
- Tenant Admin: T1–T24 covered.
- Platform: P1–P8 covered.

Note: The implementation acknowledges the locked count nuance: 84 distinct screens in Screen Inventory summary; 85 row-level entries when A3 modal is counted as a modal screen entry.

## 30.2 API Coverage Validation

Result: **PASS**

- Every route map entry consumes only approved APIs listed in Screen Inventory/API Inventory.
- Frontend API client supports approved API groups only.
- Server Actions are wrappers and do not create hidden APIs.
- Internal outbox/dead-letter UI is limited to approved P8 path/action.

## 30.3 Permission Coverage Validation

Result: **PASS**

- Every protected route maps to approved permission(s).
- UI permission boundaries are display hints only.
- `can()` remains server-authoritative.
- Ownership/relationship checks are not reimplemented in frontend.

## 30.4 Design System Compliance Validation

Result: **PASS**

- Shells match public, learner, control-plane, and platform visual planes.
- UI uses shadcn-wrapped Atlas primitives.
- Density rules are respected.
- White-label boundaries are enforced.
- Accessibility and responsive standards are included.

## 30.5 Technical Architecture Compliance Validation

Result: **PASS**

- Server-first route composition.
- No direct frontend Prisma/repository access.
- API-first frontend data access.
- Route metadata and gate-before-render preserved.
- Sentry/PostHog integration boundaries defined.
- Platform isolation retained.

## 30.6 Multi-Tenant Validation

Result: **PASS**

- Host-resolved tenant context precedes render.
- No client-supplied tenant ID.
- Tenant branding is configuration.
- FundedBeyond remains Tenant #1 configuration only.
- Second-tenant smoke test remains required.
- Query/cache/security rules prevent cross-tenant UI leakage.

## 30.7 Frontend Readiness Assessment

Frontend readiness: **Implementation-ready, conditional on backend/API route metadata and design-system primitives being available.**

Ready for:

- App Router setup.
- Shell implementation.
- Route map scaffolding.
- API client implementation.
- Shared components/patterns.
- Feature modules.
- Forms/tables/runners.
- Frontend tests and CI import guards.

Not allowed:

- Redesigning screens.
- Adding routes or APIs.
- Adding new permissions/entities/workflows.
- Forking FundedBeyond.
- Moving authorization to client state.

## 30.8 CTO Approval Verdict

**Verdict: APPROVED FOR FRONTEND ENGINEERING EXECUTION — conditional.**

This Frontend Architecture Package v1 is approved as the official implementation blueprint for Atlas LMS Phase 0 + Phase 1A + Phase 1B frontend work.

Approval conditions before production release:

1. Every implemented page must map to an approved Screen ID.
2. Every protected route must gate before render.
3. Every API call must use approved API Inventory routes only.
4. Every mutating form/action must use Zod validation, server revalidation, and safe error mapping.
5. Every entitlement-gated route/action must use server-provided entitlement projection and server enforcement.
6. Every permission-gated action must remain server-authoritative.
7. No frontend code may include FundedBeyond-specific platform branches.
8. No public/protected/platform route may leak cross-tenant resource existence.
9. All critical learner, instructor, admin, moderation, platform, accessibility, and cross-tenant E2E tests must pass.
10. No frontend work may proceed by inventing missing backend behavior; gaps must be reported against locked artifacts.
