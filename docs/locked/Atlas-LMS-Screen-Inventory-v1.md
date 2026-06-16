# ATLAS LMS — SCREEN INVENTORY v1
## Phase 0 + Phase 1A + Phase 1B Complete Screen Architecture

**Role:** Principal Product Architect · Principal UX Architect · Principal SaaS Architect · Principal LMS Architect · Principal Security Architect · CTO
**Status:** Implementation-ready screen inventory — approved with conditions (see CTO Verdict §9)
**Scope:** Phase 0 + Phase 1A + Phase 1B only. **No Phase 2/3/4 screens.**

> **Reading contract.** This document sits **entirely on top of** four binding artifacts and adds nothing they do not already support: Atlas LMS Master PRD v3.0, FundedBeyond Academy Master PRD v1.0, **Atlas LMS Database Design v2 (Phase 0+1)**, **Atlas Permission Matrix v1**, and **Atlas API Inventory v1**. Every screen below names only permissions from the Permission Matrix §4/§5, only APIs from the API Inventory §3–§9, and only tables that exist in Database Design v2 §1.1. **If a screen would require a permission, API, entitlement, table, or workflow that those documents do not define, it is rejected** — rejections are listed explicitly in §9. This is not a wireframe or visual-design document; it is the complete set of user-facing surfaces that must exist before wireframing begins.

> **Phase split (authoritative, from API Inventory §12):**
> - **Phase 0** — correctness/foundation: tenancy & provisioning, identity/session, membership, access control, configuration/entitlements, audit/eventing. *No product features.*
> - **Phase 1A** — core learning loop: branding/theme/domains, learning (courses/paths), item registry + assessment, practice/swipe, competency & scoring, certification, workflow human-gate.
> - **Phase 1B** — engagement & app-layer: gamification, community & moderation, notifications, search, analytics, automation/locales/extensions, data rights, FundedBeyond app-layer (diagnostic, readiness policy, attributed CTA, roadmap, Hall of Fame).

---

## 0. Actor Model (from Permission Matrix §3)

Six actor planes. The five tenant roles are seeded per tenant; the three platform roles are **never** tenant roles and live only on the `atlas_platform` DB role behind `withPlatformScope()`.

| Actor | Source role(s) | Shell | Route prefix |
|---|---|---|---|
| **Anonymous Visitor** | none (host-resolved tenant, no membership) | Public site shell | `/` , `/public/*` (API) |
| **Learner** | `learner` (default new-member role) | Learner app shell | `/` (authenticated app) |
| **Instructor** | `instructor` | Studio shell | `/studio/*` |
| **Moderator** | `moderator` | Moderation shell (subset of admin chrome) | `/moderate/*` |
| **Tenant Admin** | `owner`, `admin` | Admin console shell | `/admin/*` |
| **Platform Super Admin** | `atlas.super_admin`, `atlas.operations`, `atlas.support` | Platform console (isolated) | `/platform/*` |

> `owner` = `admin` + owner-only deltas (assign/revoke `admin`, edit `owner` system role, broad overrides, full-tenant export/deletion, full audit). Owner-only controls live **inside** the relevant admin screens, gated in `can()` — they are **not** separate screens. Platform screens are physically isolated from tenant screens (separate shell, separate DB role, reason-bound + audited on every action).

---

# 1. COMPLETE SCREEN INVENTORY

Each table row carries: **Screen · Route · Actor · Permissions (Matrix §4) · APIs (Inventory §3–9) · Purpose · Major Components · Child Screens · Modals · Nav Placement · Phase.** `—` = none. `pub` = public route (no membership). Permissions shown are the *primary gate*; ownership/relationship/entitlement are resolved inside `can()`/`enforceEntitlement` per the Matrix and are noted where they shape the screen.

## 1.1 Anonymous Visitor Screens (public, host-resolved tenant, no membership)

> Only the §8.4 public allow-list may run without a membership: **landing, public diagnostic, certificate verification, login/signup/invitation-accept.** Everything else requires an account. (This bounds anonymous screens — see §9 rejection of "public community browsing.")

| # | Screen | Route | Permissions | APIs | Purpose | Major Components | Child / Modals | Nav | Phase |
|---|---|---|---|---|---|---|---|---|---|
| A1 | Public Academy Home / Landing | `/` , `/p/:slug` | pub | `GET /public/landing/:slug`; branding/theme (resolved at edge) | Convert visitors; diagnostic-first hero + config-driven trust proof | Hero + primary CTA, trust/funded-count copy (config), featured-cert verify entry, footer | → A2, A6, A7 | Topbar logo, hero CTA | 1A |
| A2 | Public Diagnostic (anonymous) | `/diagnostic` | pub `diagnostic.start` variant | `POST /public/diagnostic/start`; `GET /public/diagnostic/:anonId/result` | Free 5-dimension trader-readiness intake (anonymous) | Question runner (progress bar, mobile-first), per-item card | Identity Gate modal (A3) | Hero CTA | 1B |
| A3 | Diagnostic Identity Gate | modal on `/diagnostic` | pub → signup | `POST /public/auth/signup`; `POST /public/diagnostic/:anonId/merge` | Capture account at peak curiosity, before full scorecard | Signup form, "unlock full scorecard" framing | Signup (A7) | Inline modal | 1B |
| A4 | Anonymous Diagnostic Scorecard | `/diagnostic/result` | pub (session token) | `GET /public/diagnostic/:anonId/result` | Reveal partial band + tease full scorecard / prescribed path | Radar/bar of 5 dimensions, band, single prescribed next action | → A3 / app dashboard | post-runner | 1B |
| A5 | Certificate Verification | `/verify/:credentialId` | pub | `GET /public/verify/:credentialId` | Publicly confirm a credential's authenticity | Credential status card (minimal projection), issuer brand | — | direct link / QR | 1A |
| A6 | Login | `/login` | pub | `POST /public/auth/login` | Authenticate (Supabase Auth); MFA challenge for admins | Email/password form, MFA challenge, error states | Password Reset (A8), MFA modal | Topbar | 0 |
| A7 | Signup | `/signup` | pub | `POST /public/auth/signup` | Create global principal → tenant membership | Signup form, email-verification notice | Email-verify notice | Topbar / A3 | 0 |
| A8 | Password Reset | `/reset-password` | pub (Supabase Auth) | Supabase Auth flow (no Atlas tenant API) | Request/complete password reset | Request form, reset form | — | from A6 | 0 |
| A9 | Invitation Acceptance | `/invite/accept?token=` | pub (invite token) | `POST /public/invitations/accept` | Convert `INVITED` → `ACTIVE` membership (single-use token) | Token validation, accept CTA, role/tenant context | → app | invite link | 0 |
| A10 | Tenant Unavailable / Suspended Notice | system (503/404) | n/a | tenant-state gate | Branded notice when tenant `SUSPENDED`/`ARCHIVED`/`DELETED` | Status message; admin-login allowed path | A6 (admin only) | system | 0 |

## 1.2 Learner Screens (role `learner`)

| # | Screen | Route | Permissions | APIs | Purpose | Major Components | Child / Modals | Nav | Phase |
|---|---|---|---|---|---|---|---|---|---|
| L1 | Trader Dashboard (Home) | `/` | `profile.read`, `competency.score.read` (self), `gamification.profile.read` (self), `progress.read` (self) | `GET /me`, `/me/competency`, `/me/gamification`, `/me/streaks`, `/learning-paths/:id/progress`, `/readiness-policy` | Stage-aware home; one clear next-best-action | Readiness band card, streak/XP widget, "continue" card, next-gate card, recommended swipe/lesson, stage CTA | — | Sidebar (Home) | 1A (gamification widgets enhance in 1B) |
| L2 | Course Catalog | `/courses` | `course.read`, `search.query` | `GET /courses`, `GET /search` | Browse/discover content by category/stage; roadmap lock state | Filter rail (stage/dimension/persona/cert), course cards, lock badges, search box | → L3 | Sidebar (Learn) | 1A |
| L3 | Course Detail | `/courses/:id` | `course.read`, `enrollment.create` (self) | `GET /courses/:id`, `GET /courses/:id/modules`, `POST /enrollments` | Course outline + enroll | Module/lesson outline, enroll CTA, progress meter | → L4; Enroll confirm modal | from L2 | 1A |
| L4 | Lesson Player | `/courses/:id/lessons/:lessonId` | `course.read`, `progress.read` (write own) | `GET /lessons/:id`, `GET /lessons/:id/assets`, `POST /lessons/:id/progress` | Consume lesson (video-ref/text/pdf/embed); record progress | Content viewer, asset list, mark-complete, next/prev, resume position | → L7 (if quiz lesson) | within course | 1A |
| L5 | Trader Career Roadmap | `/roadmap` | `learning_path.read`, `progress.read` (self) | `GET /learning-paths`, `GET /learning-paths/:id`, `GET /learning-paths/:id/progress` | 7-stage gated visual path; next competence gate unmistakable | Stage timeline, lock/unlock states, competency-band gate badges, current-stage CTA | → L6 | Sidebar (Roadmap) | 1B (path engine 1A; band-gates 1B) |
| L6 | Learning Path / Program Detail | `/paths/:id` | `learning_path.read`, `enrollment.create` (self), `progress.read` (self) | `GET /learning-paths/:id`, `POST /learning-paths/:id/enroll`, `GET /learning-paths/:id/progress` | Stage/program detail: required units, gates, enroll | Step list, gate conditions, enroll CTA, progress rollup | → L3/L4/L7 | from L5 | 1A |
| L7 | Assessment Overview (pre-start) | `/assessments/:id` | `assessment.read`, `attempt.start` (self) | `GET /assessments/:id`, `POST /assessments/:id/attempts` | Rules, attempts remaining, pass mark, start | Rules panel, attempts/time info, L1-proctoring consent (if configured), start CTA | Proctoring Consent modal | from L4/L6 | 1A |
| L8 | Assessment Attempt Runner | `/attempts/:id` | `attempt.submit` (own) | `GET /attempts/:id`, `POST /attempts/:id/answers`, `POST /attempts/:id/submit` | Server-timed delivery; autosave; submit | Question canvas, timer, autosave indicator, secure-mode (if set), L1 proctoring signal capture (tab/blur/fullscreen/copy-paste) | Submit-confirm modal; "lost focus" warning | full-screen | 1A |
| L9 | Attempt Result / Review | `/attempts/:id/result` | `attempt.read` (own) | `GET /attempts/:id` | Score, pass/fail, per-item review per policy | Score summary, dimension contribution, per-item review (policy-bound) | — | from L8 | 1A |
| L10 | Swipe Learning | `/swipe` | `practice.start` (self) | `POST /practice-sessions`, `POST /practice-sessions/:id/responses`, `POST /practice-sessions/:id/complete`, `GET /me/srs/due` | Daily binary practice; streak/XP; feeds competency | Deck picker (by weakest dimension / SRS due), swipe card, instant-feedback, session summary, streak nudge | Session-complete modal | Sidebar (Practice) | 1A (practice engine); 1B (streak/XP surfacing) |
| L11 | Diagnostic (authenticated) | `/diagnostic/me` | `diagnostic.start` (self), `competency.score.read` (self) | `POST /diagnostic/start`, `GET /diagnostic/:id/result` | Re-takeable readiness diagnostic + scorecard | Question runner, 5-dimension scorecard, prescribed path routing | → L6 | from L1 / L12 | 1B |
| L12 | Competency & Readiness | `/readiness` | `competency.score.read` (self), `readiness_policy.read` | `GET /me/competency`, `GET /me/competency/history`, `GET /readiness-policy`, `POST /cta/attribution-token` | Show band + 5-dimension scorecard + readiness checklist; mint attributed outbound CTA | Band header, radar scorecard, readiness checklist (gaps → one-tap actions), **outbound attributed CTA** (prominence gated by band) | CTA redirect confirm | Sidebar (Readiness) | 1B |
| L13 | Progress Dashboard | `/progress` | `competency.score.read` (self), `gamification.profile.read` (self), `attempt.read` (own), `certificate.read` (own) | `GET /me/competency/history`, `/me/gamification`, `/attempts/:id`, `/certificates` | Improvement over time across dimensions | Per-dimension trend charts, assessment history, swipe-accuracy trend, streak history, stage timeline, certs earned | drill-in to history | Sidebar (Progress) | 1B (history depends on snapshots) |
| L14 | Certificates | `/certificates` | `certificate.read` (own) | `GET /certificates`; share → `GET /public/verify/:credentialId` | View/share/verify own credentials | Credential cards, share link, public-verify link | Share modal | Sidebar (Achievements) | 1A |
| L15 | Achievements & Badges | `/achievements` | `gamification.profile.read` (self), `badge.read` | `GET /me/gamification`, `GET /badges`, `GET /me/streaks`, `POST /me/streaks/:key/freeze` | XP/level/badges/streaks; spend streak freeze | XP/level header, badge grid, streak panel, freeze action | Freeze-confirm modal | Sidebar (Achievements) | 1B (entitlement `gamification.enable`) |
| L16 | Leaderboards | `/leaderboards` | `leaderboard.read` | `GET /leaderboards`, `GET /leaderboards/:id` | Cohort/course/tenant standings (privacy-aware) | Leaderboard table, time-window filter | — | Sidebar (Community) | 1B (entitlement `gamification.enable`) |
| L17 | Community Hub | `/community` | `community.space.read`, `community.space.join` | `GET /spaces`, `POST /spaces/:id/join` | Social home; recommended spaces by stage/band | Space cards (public/private/study), join CTA, recommendations | → L18 | Sidebar (Community) | 1B (entitlement `community.enable`) |
| L18 | Community Space / Feed | `/community/spaces/:id` | `post.read`, `post.create`, `reaction.create`, `comment.create` | `GET/POST /spaces/:id/posts`, `POST /reactions` | Read/post/react in a space (visibility + membership scoped) | Post feed, composer, reactions, pinned posts | → L19; Report modal | from L17 | 1B |
| L19 | Post Detail / Thread | `/community/posts/:id` | `post.read`, `comment.create`, `comment.update/delete` (own) | `GET /posts/:id/comments`, `POST /posts/:id/comments`, `PUT/DELETE /comments/:id` | Threaded discussion | Post body, comment thread, composer | Report modal; Edit/Delete confirm | from L18 | 1B |
| L20 | Hall of Fame | `/hall-of-fame` | `post.read`, `leaderboard.read` | `GET /spaces/:id/posts` (HoF space), `GET /leaderboards/:id`, `GET /public/verify/:credentialId` | Recognition: consented community + leaderboard + verifiable certs (**not** funded-status-verified in P1) | Recognition feed, top-performers board, verifiable-cert links | — | Sidebar (Community) | 1B |
| L21 | Resource Library | `/resources` | `course.read`, `search.query` | `GET /courses` (resource-tagged), `GET /search` | Searchable tools/templates/recordings | Filter/search, resource cards, download/open | — | Sidebar (Learn) | 1B (candidate merge — §5) |
| L22 | Search Results | `/search` | `search.query` | `GET /search` | Global tenant search (RLS + visibility scoped) | Query box, type filters, result list | — | Topbar search | 1B |
| L23 | Notifications Inbox | `/notifications` | `notification.read.self` (self) | `GET /me/notifications`, `POST /me/notifications/:id/read` | In-app notifications; mark read (**no preference center in P1 — §9**) | Notification list, mark-read, unread badge | — | Topbar bell | 1B |
| L24 | Profile | `/profile` | `profile.read` (self), `profile.update` (self) | `GET/PUT /me/profile` | View/edit own per-tenant profile | Display name/avatar/bio form, public preview | — | User menu | 0 (read) / 1A (full) |
| L25 | Settings | `/settings` | `profile.update` (self), `locale.read`, `data.deletion.request` (own) | `GET/PUT /me/profile`, `GET /locales`, `POST /deletion-requests` (own) | Account/profile/locale; request own-data deletion; logout | Account section, locale picker, **Request Account Deletion**, logout | Deletion-request confirm modal; logout confirm | User menu | 1A / deletion 1B |

> **Appeals** (`POST /appeals`, own moderation case) surface as a contextual action/modal inside L18/L19 and the user's notification of a moderation action — not a standalone learner screen.

## 1.3 Instructor Screens (role `instructor`; all writes ownership/relationship-scoped in `can()`)

| # | Screen | Route | Permissions | APIs | Purpose | Major Components | Child / Modals | Nav | Phase |
|---|---|---|---|---|---|---|---|---|---|
| I1 | Studio Dashboard | `/studio` | `course.read`, `assessment.grade`, `workflow.definition.read` | `GET /courses` (own), `GET /grading-tasks`, `GET /workflows` | Authoring home: my content, pending grading, review status | My-courses cards, grading-queue count, review/approval status, drafts | — | Studio sidebar | 1A |
| I2 | Course Manager | `/studio/courses` | `course.read`, `course.create` | `GET /courses` (own), `POST /courses` | List/create own courses; see lifecycle state | Course table (status: draft/review/published), create CTA | → I3 | Studio sidebar | 1A |
| I3 | Course Builder | `/studio/courses/:id` | `course.update` (own), `course.publish` (own + workflow) | `PUT /courses/:id`, `GET/POST /courses/:id/modules`, `PUT/DELETE /modules/:id`, `POST /courses/:id/publish` | Author course: modules, settings, access/drip/prereq, publish | Module tree (reorder), course settings, access rules, publish-to-review button | → I4; Publish/Submit-for-review modal; Delete confirm | from I2 | 1A |
| I4 | Lesson Editor | `/studio/courses/:id/lessons/:lessonId` | `course.update` (own) | `GET/PUT/DELETE /lessons/:id`, `GET/POST/DELETE /lessons/:id/assets` | Author lesson content + assets (video-ref/text/pdf/embed/quiz/assignment) | Rich editor, content-type picker, asset uploader (R2 signed), video-provider+url fields | Asset-delete confirm | within I3 | 1A |
| I5 | Item Bank | `/studio/items` | `item.read`, `item.create` | `GET /item-types`, `GET/POST /items` | List/author items (incl. `swipe`) | Item table, type filter, create (any registered item_type) | → I6 | Studio sidebar | 1A |
| I6 | Item Editor | `/studio/items/:id` | `item.update` (own) | `PUT /items/:id`, `GET/PUT /items/:id/dimension-weights` | Edit item + options + generic dimension tagging | Stem/options editor, answer key, **dimension-weights matrix** (TA/PSY/RISK/DISC/CR) | Delete confirm | from I5 | 1A |
| I7 | Item Collections / Decks | `/studio/item-collections` | `item.read`, `item_collection.manage` | `GET/POST /item-collections`, `PUT/DELETE /item-collections/:id`, `POST/DELETE /item-collections/:id/items` | Author quiz banks, **swipe decks**, practice sets; compose | Collection list, composer (add/remove items), deck-type | Delete confirm | Studio sidebar | 1A |
| I8 | Assessment Builder | `/studio/assessments`, `/studio/assessments/:id` | `assessment.create`, `assessment.update` (author), `assessment.publish` (author + workflow) | `GET/POST /assessments`, `PUT/DELETE /assessments/:id`, `POST /assessments/:id/publish` | Create quiz/exam/**diagnostic**/**readiness_review**; compose; config | Item picker, config (time/attempts/pass mark/shuffle/secure-mode/**L1 proctoring level**), publish-to-review | Publish/Submit modal; Delete confirm | Studio sidebar | 1A |
| I9 | Learning Path Builder | `/studio/learning-paths`, `:id` | `learning_path.create`, `learning_path.update` (author), `learning_path.publish` (author + workflow) | `GET/POST /learning-paths`, `PUT/DELETE /learning-paths/:id`, `POST /learning-paths/:id/publish` | Author/sequence roadmap stages + gates (incl. `competency_band` gates) | Step sequencer, gate editor (assessment/band), publish | Publish modal | Studio sidebar | 1A |
| I10 | Grading Queue | `/studio/grading` | `assessment.grade` (assignee/relationship) | `GET /grading-tasks` | Subjective grading worklist | Task table (filter by assessment/learner), assigned-only | → I11 | Studio sidebar | 1A |
| I11 | Grading Detail | `/studio/grading/:taskId` | `assessment.grade` (assignee) | `GET /grading-tasks/:id` (read), `POST /grading-tasks/:id/grade` | Grade answer; view attempt + attached L1 proctoring timeline (read-only) | Answer panel, rubric/score, feedback, **L1 proctoring timeline (read-only, attached to attempt)** | Finalize-grade confirm | from I10 | 1A |
| I12 | Learner Roster & Progress | `/studio/courses/:id/learners` | `enrollment.read` (rel), `progress.read` (rel), `competency.score.read` (rel), `attempt.read` (rel) | `GET /enrollments`, `GET /courses/:id/progress`, `GET /members/:id/competency`, `GET /attempts/:id` | Oversee learners in courses/paths I teach (relationship-scoped) | Roster table, progress %, per-dimension competency, attempt drill-in, manage enrollment | Enrollment-manage modal | from I3 | 1A |
| I13 | Studio Analytics | `/studio/analytics` | `analytics.dashboard.view` (rel) [entitlement] | `GET /analytics/dashboards`, `GET /analytics/item-statistics` | Course/assessment performance for my content | Completion/drop-off charts, item difficulty/discrimination | — | Studio sidebar | 1B (entitlement `analytics.dashboard.view`) |

> **Certificate issuance (instructor path)** — `POST /certificates/issue` is gated by course/program relationship **+ workflow**; it surfaces as an action inside I12 (issue to a qualifying learner) routed through the Review & Approvals gate (S1), not a standalone instructor screen.
> Instructor **read-only** references (competency-dimensions, scoring-profiles, certificate-templates, workflows, automation-rules, extension-points/registrations, readiness-policy, locales) are consumed inline (e.g., reading dimensions while setting item weights) and are **not** separate instructor screens.

## 1.4 Moderator Screens (role `moderator`; admin/owner also hold `community.moderate`)

| # | Screen | Route | Permissions | APIs | Purpose | Major Components | Child / Modals | Nav | Phase |
|---|---|---|---|---|---|---|---|---|---|
| M1 | Moderation Queue | `/moderate/cases` | `community.moderate` | `GET/POST /moderation/cases` | Reported/flagged content worklist | Case table (reason/severity), open-case action | → M2 | Moderate sidebar | 1B (entitlement `community.enable`) |
| M2 | Moderation Case Detail | `/moderate/cases/:id` | `community.moderate` | `POST /moderation/cases/:id/decide`; `DELETE /posts/:id`, `PUT/DELETE /comments/:id` (moderate path) | Decide a case: hide/lock/delete/action; history | Reported content, decision controls, action history | Decision confirm modal | from M1 | 1B |
| M3 | Appeals Review | `/moderate/appeals` | `appeal.review` | `POST /appeals/:id/review` | Review/decide member appeals | Appeal list, case context, decide | Decision confirm modal | Moderate sidebar | 1B |
| M4 | Community Spaces Admin | `/moderate/spaces` | `community.space.manage` | `GET/POST/PUT/DELETE /spaces` | Create/edit/delete spaces (shared with Tenant Admin) | Space table, space editor (visibility/membership) | Delete confirm | Moderate sidebar | 1B |

## 1.5 Tenant Admin Screens (roles `owner`/`admin`; owner-only deltas gated inline)

| # | Screen | Route | Permissions | APIs | Purpose | Major Components | Child / Modals | Nav | Phase |
|---|---|---|---|---|---|---|---|---|---|
| T1 | Admin Dashboard | `/admin` | `membership.read`, `audit.read` | `GET /members`, `GET /audit`, `GET /provisioning/jobs` | Tenant operating overview | Member/active-learner counts, content-status, pending reviews, moderation depth, entitlement summary | — | Admin sidebar (Home) | 0 (basic) / 1B (richer counts) |
| T2 | Members | `/admin/members` | `membership.read/invite/suspend/remove`, `profile.read` | `GET /members`, `POST /members/invite`, `POST /members/:id/suspend`, `DELETE /members/:id` | Manage tenant memberships | Member table, invite, suspend, remove (owner-guard) | Invite modal; Suspend/Remove confirm | Admin sidebar | 0 |
| T3 | Member Detail | `/admin/members/:id` | `membership.read`, `profile.read/update`, `role.assign/revoke`, `permission_override.manage` | `GET /members/:id`, `GET/PUT /members/:id/profile`, `POST /members/:id/roles`, `DELETE /members/:id/roles/:roleId`, `GET/POST/DELETE /permission-overrides` | One member: profile, roles, overrides (merges user+membership+role-assignment) | Profile editor, role assignment (cannot-assign-owner; rank-guard), override list | Role-assign modal; Override modal | from T2 | 0 |
| T4 | Roles & Permissions | `/admin/roles` | `role.read/create` | `GET/POST /roles` | List/create custom tenant roles | Role table (system vs custom), create CTA | → T5; Delete confirm | Admin sidebar | 0 |
| T5 | Role Editor | `/admin/roles/:id` | `role.update/delete` (no-grant-up, not-owner-role) | `PUT/DELETE /roles/:id` | Compose role from catalogue (bounded by entitlement + no-grant-up) | Permission-catalogue picker (grouped), grant-up guard warnings | Save/Delete confirm | from T4 | 0 |
| T6 | Branding & Theme | `/admin/branding` | `branding.read/update/publish` | `GET/PUT /branding`, `PUT /theme`, `POST /branding/publish`, `GET /branding/versions` | White-label identity + design tokens (draft → preview → publish) | Logo/colour/copy editor, theme-token editor, live preview, version history | Publish confirm; Restore-version modal | Admin sidebar | 1A |
| T7 | Domains | `/admin/domains` | `tenancy.domain.read/manage` | `GET/POST /domains`, `DELETE /domains/:id` | Subdomain + custom domain (entitlement-gated) | Domain list, DNS-record helper, verification state, set-primary | Add-domain modal; Delete confirm | Admin sidebar | 1A |
| T8 | Configuration | `/admin/config` | `config.read/update/publish` | `GET/PUT /config`, `POST /config/publish` | Namespaced tenant runtime config (proctoring, community, notifications, localization, integrations, security; commerce off in P1) | Section tabs, Zod-validated forms, version history, publish | Publish confirm | Admin sidebar | 0 |
| T9 | Feature Flags | `/admin/feature-flags` | `feature_flag.read/override` | `GET /feature-flags`, `PUT /feature-flags/:key` | View effective flags; toggle operational overrides (entitlement flags read-only) | Flag table (effective value + source), override toggles | Override confirm | Admin sidebar | 0 |
| T10 | Entitlements (read-only) | `/admin/entitlements` | `entitlement.read` | `GET /entitlements` | View tenant plan capabilities (granted by platform) | Entitlement list (key/value/expiry), upgrade-prompt copy | — | Admin sidebar | 0 |
| T11 | Competency & Scoring | `/admin/competency` | `competency.dimension.manage`, `scoring_profile.create/update`, `competency.band.manage`, `scoring_config.publish`, `competency.signal.read` | `GET/POST/PUT/DELETE /competency-dimensions`, `GET/POST/PUT /scoring-profiles`, `GET/PUT /scoring-profiles/:id/bands`, `POST /scoring-config/:id/publish`, `GET /competency-signals` | Configure generic scoring engine (FB configures TA/PSY/RISK/DISC/CR) | Dimension editor, scoring-profile editor, band-threshold editor, versioned-config publish, signal inspector | Publish-config confirm; Delete-dimension confirm | Admin sidebar | 1A |
| T12 | Certificate Templates | `/admin/certificates/templates` | `certificate_template.read/manage/publish` | `GET/POST/PUT/DELETE /certificate-templates`, `POST /certificate-templates/:id/publish` | Manage/publish branded cert templates | Template editor (dynamic fields), preview, publish, version | Publish/Delete confirm | Admin sidebar | 1A (entitlement `certification.enable`) |
| T13 | Issued Certificates | `/admin/certificates` | `certificate.read` (all), `certificate.issue`, `certificate.revoke` | `GET /certificates`, `POST /certificates/issue`, `POST /certificates/:id/revoke` | Oversee issued credentials; manual issue/revoke | Cert table, issue (gated), revoke (with reason) | Issue modal; Revoke confirm | Admin sidebar | 1A (entitlement `certification.enable`) |
| T14 | Gamification Config | `/admin/gamification` | `badge.manage`, `leaderboard.manage` | `GET/POST/PUT /badges`, `GET/POST/PUT /leaderboards` | Define badges + leaderboards | Badge-rule editor, leaderboard config | Manual-award confirm (audited) | Admin sidebar | 1B (entitlement `gamification.enable`) |
| T15 | Notification Templates | `/admin/notifications/templates` | `notification.template.read/manage` | `GET/POST/PUT/DELETE /notification-templates` | Manage email/in-app templates (branded) | Template list, per-event/channel/locale editor | Delete confirm | Admin sidebar | 1B |
| T16 | Automation Rules | `/admin/automation` | `automation.rule.read/manage` | `GET/POST/PUT/DELETE /automation-rules` | IF/THEN rules (e.g. completion→cert, payment-failed→reminder [P2], streak nudge) + runs log | Rule builder (trigger/condition/action), runs log | Disable/Delete confirm | Admin sidebar | 1B |
| T17 | Workflows | `/admin/workflows` | `workflow.definition.read/manage` | `GET/POST/PUT /workflows` | Define review→publish workflows (the human gate) | Stage/assignee editor, transitions | Save confirm | Admin sidebar | 1B (gate also used 1A — see S1) |
| T18 | Locales | `/admin/locales` | `locale.read/manage` | `GET /locales`, `PUT /locales/:locale` | Manage locale strings/regional settings | Locale list, string editor (sanitized) | — | Admin sidebar | 1B |
| T19 | Extensions | `/admin/extensions` | `extension.point.read`, `extension.registration.read/manage` | `GET /extension-points`, `GET/POST/PUT/DELETE /extensions/registrations` | Register/configure **first-party** extensions (swipe renderer, lesson-completed hook) | Extension-point catalogue (read), registration editor | Delete confirm | Admin sidebar | 1B |
| T20 | Readiness Policy | `/admin/readiness-policy` | `readiness_policy.read/manage` | `GET/PUT /readiness-policy` | Configure CTA prominence policy + **legal copy/disclaimers** | Band→prominence rules, legal-copy editor, outbound-redirect target | Publish confirm | Admin sidebar | 1B |
| T21 | Analytics | `/admin/analytics` | `analytics.dashboard.view`, `analytics.funnel.view` [entitlement] | `GET /analytics/dashboards`, `GET /analytics/funnel`, `GET /analytics/item-statistics` | Tenant dashboards: learning, assessment, funnel, community | Dashboard tabs, charts, date-range/segment, CSV export | — | Admin sidebar | 1B (entitlement `analytics.dashboard.view`) |
| T22 | Audit Log | `/admin/audit` | `audit.read` | `GET /audit` | Tenant-scoped append-only audit trail | Audit table (actor/action/target/time), action filter | Entry detail drawer | Admin sidebar | 0 |
| T23 | Data Exports | `/admin/exports` | `data.export.run` | `GET/POST /exports`, `GET /exports/:id` | Run/poll/download tenant data export (data-export-as-a-right) | Export-job list, run-export, signed download | Run-export confirm | Admin sidebar | 1B |
| T24 | Deletion Requests | `/admin/deletion-requests` | `data.deletion.request`, `data.deletion.manage` | `GET/POST /deletion-requests`, `POST /deletion-requests/:id/process` | Manage GDPR/deletion workflow | Request list, file-request, process/approve | Process confirm (irreversible) | Admin sidebar | 1B |

> **Course/Assessment/Path oversight for admin:** admins reuse the Studio authoring screens (I2–I9) with tenant-wide scope (ownership/relationship bypass inside `can()`, audited). No duplicate "admin courses" screens are created. The same applies to Community Spaces (M4) and the Moderation Queue (M1–M3), which admin/owner access via their `community.moderate`/`community.space.manage` grants.
> **Search reindex** (`POST /search/reindex`, `search.reindex.manage`) is a maintenance action surfaced as a button inside T8 Configuration — not a standalone screen.

## 1.6 Shared Workflow Screen

| # | Screen | Route | Permissions | APIs | Purpose | Major Components | Nav | Phase |
|---|---|---|---|---|---|---|---|---|
| S1 | Review & Approvals (Human Gate) | `/review` | `workflow.transition.act` (relationship/role-scoped) | `GET /workflows`, `POST /workflows/:id/transition` | Approve/reject review→publish transitions for courses, paths, assessments, certificate issuance, trading-plan submissions, and moderation escalations | Pending-transition queue, artifact preview, approve/reject/return with comment | Admin sidebar + Studio sidebar (relationship-scoped) | 1A (gate is required by publish in 1A) |

## 1.7 Platform Super Admin Screens (isolated; every action reason-bound + audited; MFA)

| # | Screen | Route | Permissions | APIs | Purpose | Major Components | Child / Modals | Nav | Phase |
|---|---|---|---|---|---|---|---|---|---|
| P1 | Platform Tenant List | `/platform` | `platform.tenant.read` | `GET /platform/tenants` | List/inspect tenants + provisioning state | Tenant table (state, plan, provisioning), search | → P2, P3 | Platform sidebar | 0 |
| P2 | Provision Tenant | `/platform/tenants/new` | `platform.tenant.manage` | `POST /platform/tenants` (idempotent) | Stand up a new tenant (drives provisioning saga) | Tenant-create wizard (slug/owner/plan/seed), idempotency-key | **Reason modal (≥10 chars)** | from P1 | 0 |
| P3 | Tenant Detail | `/platform/tenants/:id` | `platform.tenant.read/manage`, `platform.entitlement.manage` | `GET /platform/tenants/:id`, `*/suspend|resume|archive`, `GET .../provisioning`, `GET/PUT .../entitlements` | One tenant: lifecycle, provisioning, entitlements | Tabs: Overview, Lifecycle (suspend/resume/archive), Provisioning saga, **Entitlements** (grant/modify) | Reason modal; Lifecycle confirm; Entitlement-grant modal | from P1 | 0 |
| P4 | Global Feature Flags | `/platform/feature-flags` | `platform.feature_flag.manage` | `GET/POST/PUT /platform/feature-flags` | Manage global flag catalogue + defaults | Flag catalogue editor, default values, rollout type | Reason modal | Platform sidebar | 0 |
| P5 | Global Catalog | `/platform/catalog` | `platform.catalog.manage` (super_admin only) | `GET/POST /platform/catalog/{permissions,item-types,extension-points}` | Manage global registries: permissions, item-types (incl. `swipe`), extension-points | Tabs: Permissions, Item Types, Extension Points | Reason modal | Platform sidebar | 0 |
| P6 | Platform Audit | `/platform/audit` | `platform.audit.read` | `GET /platform/audit` | Cross-tenant/global audit stream | Audit table (cross-tenant), filters, scope-enter/exit entries | Reason modal | Platform sidebar | 0 |
| P7 | Support Sessions | `/platform/support` | `platform.support.access` | `POST /platform/support/sessions` | Open reason-bound, time-boxed read-biased session into one tenant | Open-session form (tenant + reason), active-session list | Reason modal (per incident) | Platform sidebar | 0 |
| P8 | Eventing / Dead-Letter Ops | `/platform/eventing` | `platform.tenant.manage` | `POST /internal/outbox/dead-letter/:id/replay` | Inspect/replay dead-lettered events | Dead-letter list, replay action | Replay confirm; Reason modal | Platform sidebar | 0 |

> **Deliberately excluded from Platform (no API/permission in P0/P1):** Platform Analytics, Platform Billing/Plan management, System Configuration UI beyond catalogs/flags. See §9. The user's example list named "Platform Analytics" and "System Configuration"; neither has a backing permission/API in P0/P1, so both are **rejected** here.

---

# 2. COMPLETE NAVIGATION TREE

### Anonymous
```
Public Site (host-resolved tenant)
├── Academy Home / Landing (A1)
├── Free Diagnostic (A2)
│   ├── Identity Gate [modal] (A3)
│   └── Anonymous Scorecard (A4)
├── Certificate Verification (A5)
├── Login (A6) ──→ Password Reset (A8)
├── Signup (A7)
└── Invitation Acceptance (A9)
    └── Tenant Unavailable Notice (A10) [system state]
```

### Learner
```
Learner App
├── Trader Dashboard / Home (L1)
├── Learn
│   ├── Course Catalog (L2)
│   │   └── Course Detail (L3)
│   │       └── Lesson Player (L4)
│   │           └── Assessment Overview (L7)
│   │               └── Attempt Runner (L8)
│   │                   └── Attempt Result (L9)
│   └── Resource Library (L21)
├── Roadmap (L5)
│   └── Path / Program Detail (L6)
├── Practice (Swipe) (L10)
├── Diagnostic (L11)
├── Readiness (L12)
├── Progress (L13)
├── Achievements (L15)
│   └── Certificates (L14)
├── Community (L17)
│   ├── Space / Feed (L18)
│   │   └── Post / Thread (L19)
│   ├── Leaderboards (L16)
│   └── Hall of Fame (L20)
├── Search (L22) [topbar]
├── Notifications (L23) [topbar]
└── User Menu
    ├── Profile (L24)
    └── Settings (L25)
```

### Instructor
```
Studio
├── Studio Dashboard (I1)
├── Course Manager (I2)
│   └── Course Builder (I3)
│       └── Lesson Editor (I4)
├── Item Bank (I5)
│   └── Item Editor (I6)
├── Item Collections / Decks (I7)
├── Assessment Builder (I8)
├── Learning Path Builder (I9)
├── Grading Queue (I10)
│   └── Grading Detail (I11)
├── Learner Roster (I12) [entered from a course]
├── Studio Analytics (I13)
└── Review & Approvals (S1) [relationship-scoped]
```

### Moderator
```
Moderation
├── Moderation Queue (M1)
│   └── Case Detail (M2)
├── Appeals Review (M3)
├── Community Spaces Admin (M4)
└── Review & Approvals (S1) [moderation workflows only]
```

### Tenant Admin (owner / admin)
```
Admin Console
├── Admin Dashboard (T1)
├── People
│   ├── Members (T2)
│   │   └── Member Detail (T3)
│   ├── Roles & Permissions (T4)
│   │   └── Role Editor (T5)
├── Appearance
│   ├── Branding & Theme (T6)
│   └── Domains (T7)
├── Platform Settings
│   ├── Configuration (T8)
│   ├── Feature Flags (T9)
│   └── Entitlements [read-only] (T10)
├── Learning Engine Config
│   ├── Competency & Scoring (T11)
│   ├── Certificate Templates (T12)
│   │   └── Issued Certificates (T13)
│   ├── Gamification (T14)
│   ├── Readiness Policy (T20)
│   └── Extensions (T19)
├── Content (reuses Studio I2–I9 at tenant scope)
├── Community (reuses M1–M4 via community.moderate / space.manage)
├── Orchestration
│   ├── Automation Rules (T16)
│   ├── Workflows (T17)
│   ├── Notification Templates (T15)
│   └── Locales (T18)
├── Insight
│   ├── Analytics (T21)
│   └── Audit Log (T22)
├── Data Rights
│   ├── Data Exports (T23)
│   └── Deletion Requests (T24)
└── Review & Approvals (S1)
```

### Platform Super Admin (isolated)
```
Platform Console  (atlas_platform; reason-bound + audited; MFA)
├── Tenant List (P1)
│   ├── Provision Tenant (P2)
│   └── Tenant Detail (P3)
│       ├── Lifecycle (suspend/resume/archive)
│       ├── Provisioning Saga
│       └── Entitlements (grant/modify)
├── Global Feature Flags (P4)
├── Global Catalog (P5)  [permissions · item-types · extension-points]
├── Platform Audit (P6)
├── Support Sessions (P7)
└── Eventing / Dead-Letter Ops (P8)
```

---

# 3. COMPLETE ROUTE INVENTORY

Legend: **PUB** = public (no membership) · **PROT** = protected (membership gate + `can()`) · **ENT** = additionally entitlement-gated · **PLAT** = platform scope (reason-bound + audited).

### Public routes (PUB)
```
/                          A1   PUB
/p/:slug                   A1   PUB
/diagnostic                A2   PUB
/diagnostic/result         A4   PUB (anon session token)
/verify/:credentialId      A5   PUB
/login                     A6   PUB
/signup                    A7   PUB
/reset-password            A8   PUB (Supabase Auth)
/invite/accept             A9   PUB (invite token)
```

### Learner routes (PROT; ENT marked)
```
/                          L1   PROT
/courses                   L2   PROT
/courses/:id               L3   PROT
/courses/:id/lessons/:lid  L4   PROT
/roadmap                   L5   PROT
/paths/:id                 L6   PROT
/assessments/:id           L7   PROT
/attempts/:id              L8   PROT
/attempts/:id/result       L9   PROT
/swipe                     L10  PROT
/diagnostic/me             L11  PROT
/readiness                 L12  PROT
/progress                  L13  PROT
/certificates              L14  PROT (ENT certification.enable)
/achievements              L15  PROT (ENT gamification.enable)
/leaderboards              L16  PROT (ENT gamification.enable)
/community                 L17  PROT (ENT community.enable)
/community/spaces/:id      L18  PROT (ENT community.enable)
/community/posts/:id       L19  PROT (ENT community.enable)
/hall-of-fame              L20  PROT (ENT community.enable + gamification.enable)
/resources                 L21  PROT
/search                    L22  PROT
/notifications             L23  PROT
/profile                   L24  PROT
/settings                  L25  PROT
```

### Instructor routes (PROT; ownership/relationship in can())
```
/studio                        I1   PROT
/studio/courses                I2   PROT
/studio/courses/:id            I3   PROT
/studio/courses/:id/lessons/:l I4   PROT
/studio/items                  I5   PROT
/studio/items/:id              I6   PROT
/studio/item-collections       I7   PROT
/studio/assessments            I8   PROT
/studio/assessments/:id        I8   PROT
/studio/learning-paths         I9   PROT
/studio/learning-paths/:id     I9   PROT
/studio/grading                I10  PROT
/studio/grading/:taskId        I11  PROT
/studio/courses/:id/learners   I12  PROT
/studio/analytics              I13  PROT (ENT analytics.dashboard.view)
/review                        S1   PROT
```

### Moderator routes (PROT; ENT community.enable)
```
/moderate/cases            M1   PROT (ENT)
/moderate/cases/:id        M2   PROT (ENT)
/moderate/appeals          M3   PROT (ENT)
/moderate/spaces           M4   PROT (ENT)
```

### Tenant Admin routes (PROT; ENT marked)
```
/admin                     T1   PROT
/admin/members             T2   PROT
/admin/members/:id         T3   PROT
/admin/roles               T4   PROT
/admin/roles/:id           T5   PROT
/admin/branding            T6   PROT
/admin/domains             T7   PROT (custom domain: ENT branding.custom_domain.enable)
/admin/config              T8   PROT
/admin/feature-flags       T9   PROT
/admin/entitlements        T10  PROT (read-only)
/admin/competency          T11  PROT
/admin/certificates/templates T12 PROT (ENT certification.enable)
/admin/certificates        T13  PROT (ENT certification.enable)
/admin/gamification        T14  PROT (ENT gamification.enable)
/admin/notifications/templates T15 PROT
/admin/automation          T16  PROT
/admin/workflows           T17  PROT
/admin/locales             T18  PROT
/admin/extensions          T19  PROT
/admin/readiness-policy    T20  PROT
/admin/analytics           T21  PROT (ENT analytics.dashboard.view)
/admin/audit               T22  PROT
/admin/exports             T23  PROT (ENT data.export.enable [always-on])
/admin/deletion-requests   T24  PROT
```

### Platform routes (PLAT; reason-bound + audited)
```
/platform                       P1  PLAT
/platform/tenants/new           P2  PLAT
/platform/tenants/:id           P3  PLAT
/platform/feature-flags         P4  PLAT
/platform/catalog               P5  PLAT
/platform/audit                 P6  PLAT
/platform/support               P7  PLAT
/platform/eventing              P8  PLAT
```

**Protected route count:** all learner/instructor/moderator/admin routes (membership gate non-bypassable). **Public:** 9. **Entitlement-protected:** certificates, gamification (achievements/leaderboards/hall-of-fame), community (community/spaces/posts/hall-of-fame/moderation), analytics (studio + admin), custom domains. **Platform:** 8 (separate DB role, never reachable from a tenant session).

---

# 4. ACTOR MAPPING (screens per actor)

| Screen group | Anonymous | Learner | Instructor | Moderator | Tenant Admin | Platform |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Auth / public (A1–A10) | ✅ | (entry) | (entry) | (entry) | (entry) | — |
| Learner app (L1–L25) | — | ✅ | reuse community/search | reuse community | reuse community/search | — |
| Studio (I1–I13) | — | — | ✅ | — | ✅ (tenant scope) | — |
| Moderation (M1–M4) | — | — | — | ✅ | ✅ (via moderate/space.manage) | — |
| Admin console (T1–T24) | — | — | — | — | ✅ | — |
| Review & Approvals (S1) | — | — | ✅ (rel) | ✅ (mod wf) | ✅ | — |
| Platform (P1–P8) | — | — | — | — | — | ✅ |

> A user can hold multiple tenant roles (union of permissions). Screen *visibility* in nav is driven by held permissions; screen *access* is enforced server-side in `can()`. No screen is shown to an actor lacking its primary permission.

---

# 5. SCREEN CONSOLIDATION ANALYSIS

### Screens correctly MERGED (and why)
1. **Member Detail (T3) = membership + profile + role assignment + permission overrides.** All four operate on one `membership` and its `member_profiles`/`user_roles`/`permission_overrides` rows; splitting them forces context-switching for one mental object. Override management folds in here rather than a separate `/admin/overrides`.
2. **Branding & Theme (T6) = one screen, two tables.** Permission Matrix §4.4 deliberately gives branding and theme **one authority boundary** (`branding.*`). Separate screens would imply separate governance that the model explicitly rejects.
3. **Certificate Templates (T12) ⊃ no separate "template editor" screen;** the editor is the detail state of T12. **Issued Certificates (T13)** is separate because it is a *different resource* (`certificates`, with issue/revoke) under different permissions (`certificate.issue/revoke` vs `certificate_template.manage`).
4. **Admin reuses Studio authoring screens (I2–I9)** at tenant scope instead of duplicate `/admin/courses`, `/admin/assessments`, etc. `can()` grants admin ownership/relationship bypass within-tenant (audited), so the *same* screen serves both — preventing screen explosion.
5. **Diagnostic is authored inside Assessment Builder (I8)** as `assessment_type=diagnostic`/`readiness_review`. No separate "diagnostic builder" — it is generic assessment configuration (the no-fork resolution).
6. **Appeals, Report-content, Enrollment-manage, Search-reindex** are modals/actions inside their parent screens, not standalone screens.
7. **Public + authenticated Diagnostic** share the same runner component (A2/A11), differing only in auth state and the identity-gate insertion point.

### Screens that must NOT be merged (and why)
1. **Tenant Admin Dashboard (T1) ≠ Platform Tenant List (P1).** Different scope, different DB role, different isolation guarantees. Merging would breach the absolute platform/tenant separation (Matrix §1.8/§10) — a structural security violation, not a UX choice.
2. **Competency & Readiness learner view (L12) ≠ Progress Dashboard (L13).** L12 is the *current band + CTA decision surface*; L13 is *trajectory over time*. Different APIs (`/me/competency` + `/readiness-policy` + CTA vs `/me/competency/history` + history). Different jobs-to-be-done.
3. **Diagnostic (L11) ≠ Readiness (L12).** Diagnostic is a re-takeable *intake assessment* that produces a *starting* band; Readiness is the *ongoing demonstrated-signal* surface. The model explicitly forbids the diagnostic alone setting Challenge Ready.
4. **Studio Analytics (I13) ≠ Admin Analytics (T21).** Same entitlement, different scope (relationship-bound instructor data vs whole-tenant). The relationship constraint in `can()` makes them genuinely different result sets.
5. **Moderation Queue (M1) ≠ Review & Approvals (S1).** Moderation acts on community content (`moderation_cases`); S1 acts on publish/issue workflow transitions (`workflow_transitions`). Different permissions (`community.moderate` vs `workflow.transition.act`) and different objects.
6. **Configuration (T8) ≠ Feature Flags (T9) ≠ Entitlements (T10).** Config is tenant-authored settings; flags are operational toggles (tenant-overridable subset); entitlements are **platform-granted, read-only to tenant**. Conflating them invites the exact "self-elevate entitlement" bug the model forbids.

---

# 6. FUNDEDBEYOND MAPPING (every flagship as configuration on generic engines — proof of no fork)

| FundedBeyond feature | Screen(s) | Generic Atlas engines + tables it rides | Permissions/APIs (generic) | FB-owned tables | Fork? |
|---|---|---|---|---|---|
| **Free Trading Diagnostic** | A2/A3/A4 (anon), L11 (auth) | Assessment (`assessments` type=`diagnostic`, `attempts`, `attempt_answers`) → Competency (`competency_signals`→`competency_scores`) | `diagnostic.start`, `attempt.*`, `competency.score.read`; `/public/diagnostic/*`, `/diagnostic/*` | `diagnostic_sessions` (session/anon-merge state only) | **No** — diagnostic *is* an assessment attempt; scoring is generic signal emission |
| **Swipe Learning** | L10 (learner), I7/I6 (authoring) | Item registry (`item_types.swipe`, seeded global), `item_collections` (swipe deck), `practice_sessions`/`practice_responses`, `srs_state` → Competency via outbox | `item.*`, `item_collection.manage`, `practice.start`; `/items`, `/item-collections`, `/practice-sessions/*`, `/me/srs/due` | none | **No** — `swipe` is a registered item-type renderer (extensibility), not an Assessment-core edit (resolves Inversions 1 & 3) |
| **Challenge Readiness** | L12 (learner), T20 (policy admin) | Competency composite (`composite_readiness_state`, `competency_bands`) + Learning-Path band gates; outbound CTA only | `competency.score.read`, `readiness_policy.*`; `/me/competency`, `/readiness-policy`, `/cta/attribution-token` | `readiness_policies` (thin CTA policy), `attribution_tokens` (outbound tokens) | **No** — readiness is generic scoring output; CTA is an attributed redirect, never checkout. *Simulated review depth & Challenge Readiness Center = Phase 2 (excluded here)* |
| **Trader Career Roadmap** | L5/L6 (learner), I9 (authoring) | Learning Path (`learning_paths`, `path_steps`, `path_step_gates` gate_type=`competency_band`, `path_enrollments`, `path_step_progress`) | `learning_path.*`, `enrollment.create`, `progress.read`; `/learning-paths/*` | none | **No** — band gates read `composite_readiness_state` via the generic gate type |
| **Hall of Fame** | L20 (learner) | Community recognition space (`community_spaces`/`posts`) + Gamification (`leaderboard_definitions`/`leaderboard_snapshots`) + Certification (verifiable creds) | `post.read`, `leaderboard.read`; `/spaces/:id/posts`, `/leaderboards/:id`, `/public/verify/:id` | none | **No** — pure read projection over generic surfaces; *funded-status verification is inbound = Phase 2/3 (excluded)* |

**Proof of no platform fork (P0/P1):** every FB screen above resolves to (a) generic Atlas permissions from Matrix §4, (b) generic Atlas APIs from Inventory §3, and (c) generic Atlas tables from DB Design §1.1 — with only **three** FB app-layer tables (`diagnostic_sessions`, `readiness_policies`, `attribution_tokens`) that store app state and **do not alter any generic engine** (DB Design §3.5). FundedBeyond uses the five seeded tenant roles unchanged; **no FB-specific role, permission, table, or platform code exists.** This closes Architecture Review C3 (the inversion) at the screen layer.

---

# 7. SECURITY REVIEW (per actor)

> Cross-cutting (all actors): membership gate is load-bearing and non-bypassable; host wins over JWT tenant claim; RLS backstops `can()`; every irreversible/sensitive action writes an append-only hash-chained `audit_entries` row in the same transaction (Matrix §13, Inventory §1.10). Error semantics never reveal cross-tenant existence (uniform `403`/empty, never `404`-by-id).

### Anonymous
- **High-risk screens:** Public Diagnostic (A2 — unauthenticated *write*), Login (A6), Signup (A7), Invitation Accept (A9).
- **Sensitive actions / dangerous workflows:** anonymous diagnostic write (highest-abuse surface); anonymous→account merge.
- **MFA:** n/a (no session) — but Login issues an MFA challenge for admin principals.
- **Audit:** invitation accept audited (`identity.membership.*`); login family audited.
- **Confirmation/abuse controls:** tightest per-IP-hash rate-limit bucket; `ip_hash`/`user_agent_hash` only (never raw IP/device); single-use merge token; certificate verify returns minimal projection with no admin privilege.

### Learner
- **High-risk screens:** Attempt Runner (L8 — integrity-sensitive), Readiness (L12 — outbound CTA + legal copy), Settings (L25 — own-data deletion request).
- **Sensitive actions:** attempt submit (idempotent, server-authoritative timing, L1 proctoring capture); deletion-request (own data); attributed-CTA mint.
- **Dangerous workflow:** offline swipe signals must be **re-validated server-side** before touching the readiness gate (Architecture Review §119) — the gate exists in P1.
- **MFA:** not required for learner. **Audit:** deletion-request, attribution-token mint are audited.
- **Confirmation:** submit-attempt confirm; deletion-request confirm; CTA redirect confirm. IDOR: every own-resource read (`/attempts/:id`, `/me/*`, `/certificates`) ownership-checked inside `can()`.

### Instructor
- **High-risk screens:** Assessment Builder (I8 — defines scoring/proctoring), Grading Detail (I11 — score changes), Course/Path Publish (I3/I9 — gated).
- **Sensitive actions:** grade changes (audited `assessment.graded`); publish (routed through S1 human gate); certificate issuance (relationship + workflow gated, audited `credential.issued`).
- **Dangerous workflows:** publish without review where tenant requires it → blocked by `workflow.transition.act` gate.
- **MFA:** not mandated by role; recommended if instructor also holds elevated grants. **Audit:** delete/publish/grade/issue all audited.
- **Confirmation:** publish/submit-for-review; finalize-grade; delete (course/item/assessment/path). Ownership/relationship enforced inside `can()` (cannot edit/grade content they don't own/teach).

### Moderator
- **High-risk screens:** Case Detail (M2 — content takedown), Appeals Review (M3).
- **Sensitive actions:** hide/lock/delete content (moderate path audited `community.moderation.decided`); appeal decisions.
- **MFA:** not mandated. **Audit:** moderation decisions and moderate-path deletes are audited; PII in reports minimized.
- **Confirmation:** decision confirm; moderator may **action** but not rewrite another user's content (Matrix §6).

### Tenant Admin (owner / admin)
- **High-risk screens:** Roles/Role Editor (T4/T5 — privilege grants), Member Detail (T3 — role assignment), Deletion Requests (T24 — irreversible), Data Exports (T23 — bulk PII egress), Readiness Policy (T20 — legal copy), Competency & Scoring (T11 — sensitive config), Configuration (T8), Branding publish (T6).
- **Sensitive actions:** role create/edit/assign/revoke (no-grant-up, owner rank-guard, audited); permission overrides; entitlement is **read-only** (cannot self-elevate); deletion processing; export run; scoring-config publish; branding/config publish.
- **Dangerous workflows:** member removal (owner-guard: cannot remove `owner`); deletion processing (irreversible, two-step); bulk export (noisy-neighbor budgeted, signed download).
- **MFA:** **required for admin/owner** before production traffic (Matrix §8.3 condition 4) — step-up on entry to People/Roles/Data-Rights sections.
- **Audit:** all of role/override/membership/branding/config/entitlement-read-denied/export/deletion/scoring-publish actions audited.
- **Confirmation:** every destructive/irreversible control (delete role, revoke admin, remove member, process deletion, run export, publish config/scoring) requires explicit confirm; owner-only controls visibly gated.

### Platform Super Admin
- **High-risk screens:** every platform screen (cross-tenant capable). Provision (P2), Tenant Detail lifecycle + entitlements (P3), Global Catalog (P5), Support Sessions (P7), Dead-Letter replay (P8).
- **Sensitive actions:** tenant create/suspend/resume/archive; entitlement grant/modify (writes `entitlement_grant_history`); catalogue edits; opening a tenant support session (reason + time-boxed); event replay.
- **Dangerous workflows:** any cross-tenant data access — only via `withPlatformScope()` on `atlas_platform`, **reason ≥10 chars**, with `platform.scope.enter`/`exit` audit on every action.
- **MFA:** **required for all platform principals.** No standing tenant-data access; per-incident only.
- **Audit:** every platform action audited (non-negotiable, CI-enforced gate 6/10). A tenant session can never reach these routes; a tenant request attempting to set `app.platform_scope` is rejected.

---

# 8. SCREEN COUNT ANALYSIS

### Totals
| Metric | Count |
|---|---|
| **Total distinct screens** | **84** |
| — Anonymous | 10 (A1–A10) |
| — Learner | 25 (L1–L25) |
| — Instructor | 13 (I1–I13) |
| — Moderator | 4 (M1–M4) |
| — Shared workflow | 1 (S1) |
| — Tenant Admin | 24 (T1–T24) |
| — Platform | 8 (P1–P8) |
| **Total top-level routes** | **~78** (see §3; excludes modals & system states) |
| Public routes | 9 |
| Entitlement-protected routes | ~13 |
| Platform routes | 8 |

> Screens reused across actors (Studio I2–I9 by admin; community L17–L20 by all; M1–M4 by admin) are **counted once**. Modals/drawers/actions (consent, confirms, appeals, reason-prompts, search-reindex, enrollment-manage) are **not** counted as screens.

### MVP vs Nice-to-Have vs Deferred (within P0/P1)
**MVP — required for the Phase 1 exit criterion** (visitor diagnoses → path → streak → assess → readiness rises → attributed CTA; second tenant provisions; export works):
A1, A2–A4, A5, A6, A7, A9 · L1–L14, L17–L18, L22, L23, L24, L25 · I1–I12 · S1 · T1–T13, T16–T17, T19, T20, T22, T23, T24 · P1–P8.

**Nice-to-have within P0/P1 (ship if time allows; not exit-blocking):**
L15 Achievements, L16 Leaderboards, L19 Post Thread (can launch with flat feed), L20 Hall of Fame, L21 Resource Library, A8 Password Reset (Supabase default UI acceptable initially), A10 styled notice, M4 (admin can manage spaces), T14 Gamification config, T15 Notification Templates (system defaults acceptable first), T18 Locales (single-locale launch), T21 Analytics (basic counts on T1 suffice initially), I13 Studio Analytics.

**Deferred OUT of P0/P1 (Phase 2+ — explicitly NOT built now):**
Full Challenge Readiness Center + simulated review (P2), Live/Webinar/Event centers (P2), Challenge Groups / Funded Trader Groups / Funded Trader Program (inbound integration, P2/P3), Referral & Affiliate Education Centers (Integration 27, P2/P4), Commerce/checkout/billing/subscription screens (P2), inbound challenge handshake + conversion-attribution dashboards (P2), Proctoring L2/L3 admin/report screens (P3), Website Builder / page CMS (P2), Mobile-specific app screens (P3), Marketplace + third-party plugin SDK screens (P4), AI generation/coach screens (P4), Platform Analytics & Platform Billing consoles (no P0/P1 API).

---

# 9. CTO REVIEW

### 9.1 Missing screens (added here that the category prompts implied but were under-specified)
- **Review & Approvals (S1)** — the human publish/issue gate (`workflow.transition.act`) is load-bearing for *every* publish in Phase 1A yet wasn't an obvious "screen." Added.
- **Tenant Unavailable / Suspended notice (A10)** — required by the tenant-state gate (503/404 with admin-login path); easy to forget.
- **Issued Certificates (T13)** distinct from Certificate Templates — different permissions/resource.
- **Eventing / Dead-Letter Ops (P8)** — the only surface for `outbox dead-letter replay`; operationally required in Phase 0.
- **Provisioning Saga view** (tab of P3) — needed to operate `provisioning_jobs`.

### 9.2 Duplicate screens — eliminated
- No separate `/admin/courses|assessments|paths` — admin reuses Studio (I2–I9) at tenant scope.
- No separate permission-override screen — folded into Member Detail (T3).
- No separate diagnostic/readiness-review builder — they are assessment types in I8.
- No separate "theme" screen — merged into Branding & Theme (T6) per the shared authority boundary.

### 9.3 Overengineered screens — prevented
- **No Website Builder / page CMS.** DB Design §1.1 has **no `site_pages` tables** (Engine 6 is Phase 2). Public landing (A1) is config/branding-rendered via `/public/landing/:slug` — not an authorable CMS. Building a page builder now is scope creep.
- **No notification preference center.** No `notification_preferences` table in P0/P1; only inbox + mark-read (`/me/notifications`). A preferences screen would require a table that doesn't exist → rejected (L23 is inbox only).
- **No standalone Proctoring admin/report screens.** P0/P1 Permission Matrix defines **no `proctoring.*` permission**; L1 proctoring is a consent step + signal capture inside the Attempt Runner (L8), with the timeline attached read-only inside Grading Detail (I11). A separate proctoring console would need permissions/APIs that don't exist → rejected.
- **No per-program screens (Beginner/Intermediate/Advanced/etc. Modules 4–10).** These are *content* (courses/learning paths), rendered by L3/L6 — not bespoke screens.
- **No Platform Analytics / Platform Billing / System Config consoles.** No backing P0/P1 permission or API → rejected (the category list named them as examples; they are correctly deferred).

### 9.4 Screens that should be deferred (in PRDs but not P0/P1)
Full Challenge Readiness Center + simulated review, Live/Webinar/Event, Challenge/Funded-Trader Groups & Program, Referral/Affiliate Education Centers, all Commerce/checkout/billing, inbound conversion-attribution dashboards, Proctoring L2/L3, Mobile app screens, Marketplace/plugin-SDK, AI screens. All map to Phase 2–4 in the Corrected Roadmap / DB Design §2 / Inventory §13.3 and carry no P0/P1 permission, API, or table.

### 9.5 Screens implied by PRDs that the authorization model does NOT support in P0/P1 (honest flags)
1. **Anonymous public-community browsing (FB Module 15 "readable pre-signup").** The §8.4 public allow-list does **not** include community read; `community.space.read`/`post.read` are membership- *and* entitlement-gated. → In P0/P1 the public community must either require signup or be deferred. **Flagged for product decision; not built as an anonymous screen here.**
2. **Live "Hall of Fame snippet / funded counts" on the public landing.** Live HoF data needs community/gamification entitlement + membership. The landing (A1) can show **config-driven/cached** trust proof only; a live feed is account-gated. **Built as config copy, not a live anonymous feed.**
3. **Diagnostic "trend vs prior diagnostics" for anonymous users (FB §6.5).** Trend requires persisted identity; anonymous users see a single scorecard. Trend appears only post-account (L13). **Correct as-is; noted.**

### 9.6 Final Approval Verdict
**APPROVED for wireframing — conditional.**

This inventory sits cleanly on the four binding documents, **invents no feature, engine, permission, entitlement, table, or API**, prevents screen explosion (84 distinct screens via aggressive, principled reuse), keeps platform screens physically and structurally isolated from tenant screens, expresses **every** FundedBeyond flagship as configuration on generic engines with zero fork, and routes every protected surface through the membership-gate → entitlement → `can()` pipeline with the human-approval gate (S1) explicitly surfaced.

**Conditions carried into wireframing/build:**
1. **No screen renders before its authorization is declared.** Each screen's primary permission, entitlement, and (for owned/related resources) `resourceLoader` must match the API Inventory entry it consumes; a screen consuming an undeclared route is a defect.
2. **Phase 0 correctness gate holds.** No Phase 1A/1B screen is wired until the transaction-pooling RLS/IDOR + membership-gate harness is green (Inventory §13.4 / Matrix §18).
3. **Admin & platform MFA + audit operational** before T-series and P-series screens ship to production.
4. **Entitlement-gated screens degrade consistently** to `ENTITLEMENT_REQUIRED`/upgrade-prompt (never feature-existence leakage) — community, certificates, gamification, advanced analytics, custom domains.
5. **Offline swipe re-validation gate** is present before swipe signals reach readiness (L10 → L12).
6. **Legal copy for the readiness→CTA framing** (T20) reviewed before L12's attributed CTA goes live.

**Exact next document to produce:** **USER FLOWS & JOURNEY MAPS v1 (Phase 0 + 1A + 1B)** — the step-by-step traversal of these screens for each canonical journey (visitor→diagnostic→account→path→swipe→assess→readiness→attributed CTA; instructor authoring→review→publish; admin provisioning-adjacent config; platform provision→entitle→support), binding each step to the screen IDs and API calls defined here. No screen architecture revisiting required.

---
*Atlas LMS Screen Inventory v1 — implementation-ready. Sources of truth: Atlas LMS Master PRD v3.0, FundedBeyond Academy Master PRD v1.0, Architecture Review Report, Dependency Analysis & Corrected Roadmap, Atlas LMS Database Design v2 (Phase 0+1), Atlas Permission Matrix v1, Atlas API Inventory v1. No product redesigned; no engine/permission/table/entitlement invented; Phase 0 + Phase 1A + Phase 1B only.*
