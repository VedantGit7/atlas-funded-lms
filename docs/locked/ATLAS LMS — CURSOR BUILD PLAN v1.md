## **ATLAS LMS — CURSOR BUILD PLAN v1** 

## **Phase 0 + Phase 1A + Phase 1B** 

**Status:** Official implementation execution plan 

**Scope:** Build execution only 

**Binding Rule:** No redesign. No new screens. No new APIs. No new permissions. No new workflows. No new entities. No architecture changes. 

**Primary Users:** Cursor, Claude Code, GitHub Copilot, Frontend Engineers, Backend Engineers, QA Engineers, DevOps Engineers, CTO 

## **1. Executive Summary** 

This build plan converts the locked Atlas LMS artifacts into the final implementation sequence for engineering execution. 

It defines: 

- what gets built; 

- the exact order of build; 

- owner responsibility; 

- hard dependencies; 

- acceptance criteria; 

- release gates; 

- Cursor and Claude Code working rules; 

- QA and validation gates. 

Atlas LMS must be built dependency-first. 

The execution strategy is: 

1. Build repository, CI, database, RLS, tenant context, and security spine first. 

2. Build tenant resolution, Supabase Auth bridge, ACTIVE membership gate, permission system, entitlement gate, audit, and outbox before product features. 

3. Build provisioning, branding, domains, storage, and configuration before learner/instructor surfaces. 

4. Build core learning loop before engagement features. 

5. Build assessment, item registry, competency, readiness, diagnostic, and swipe through generic Atlas engines only. 

6. Build FundedBeyond Academy as Tenant #1 configuration only. 

7. Validate with a second smoke-test tenant before launch. 

Critical path: 

```
Repository + CI
```

```
  ↓
```

1 

```
Database + RLS + withTenantTx
  ↓
Tenant Resolution
  ↓
Auth + Membership Gate
  ↓
Permissions + Entitlements + can()
  ↓
Audit + Outbox
  ↓
Provisioning + Branding + Storage
  ↓
Courses + Lessons + Progress
  ↓
Workflow + Item Registry + Assessment
  ↓
Competency + Readiness + CTA
  ↓
Diagnostic + Swipe + Gamification
  ↓
Certificates + Notifications + Automation
  ↓
Community + Moderation + Search + Analytics
  ↓
Consoles + Data Rights
  ↓
FundedBeyond Config + Second Tenant Validation + Production Launch
```

## **2. Development Principles** 

## **2.1 Build foundations first** 

No learner, instructor, admin, community, diagnostic, readiness, swipe, analytics, or FundedBeyond feature may be implemented until the foundation gates are green. 

## **2.2 No feature before security** 

Feature routes must not exist before: 

- route metadata exists; 

- Zod schemas exist; 

- auth lifecycle exists; 

- permission enforcement exists; 

- entitlement enforcement exists where required; • tenant isolation tests pass. 

2 

## **2.3 No feature before tenant isolation** 

Every tenant-facing table must be RLS-protected before product screens consume it. 

Required proof: 

- `tenant_id` exists where required; 

- RLS is enabled; 

- `withTenantTx()` uses transaction-local `set_config(..., true)` ; 

- • host wins over JWT claims; 

- client-supplied `tenant_id` is rejected or ignored; • cross-tenant IDOR tests pass. 

## **2.4 No UI before API contract** 

Every screen must map to: 

- approved Screen ID; 

- approved route; 

- approved API endpoint; 

- approved permission; 

- approved entitlement where applicable; 

- approved error/empty/loading/denied states. 

## **2.5 No API before database support** 

No endpoint is implemented until: 

- required tables exist; 

- required indexes exist; 

- RLS exists; 

- append-only/idempotency/audit constraints exist where required; • seed data exists where required. 

## **2.6 No merge without tests** 

Every PR must include the applicable test layer: 

- unit; • integration; 

- authorization; 

- tenant isolation; • E2E; 

- worker; 

- RLS; 

- migration validation. 

## **2.7 No merge without audit compliance** 

Sensitive mutations are invalid unless audit is written in the same transaction. 

3 

Sensitive areas include: 

- tenant lifecycle; 

- membership changes; 

- role changes; 

- permission overrides; 

- entitlement changes; 

- branding/domain changes; 

- publish/unpublish/delete; 

- grading; • certificate issue/revoke; 

- moderation decisions; 

- readiness policy changes; 

- attribution token creation; 

- exports/deletion requests; 

- platform support access. 

## **3. Repository Bootstrap Plan** 

## **Step 1 — Create repository** 

Checklist: 

- Create GitHub repository: `atlas-lms` . • Enable protected main branch. • Enable required PR reviews. • Enable CODEOWNERS. • Add `/docs/locked` for approved artifacts. • Add `/docs/engineering` for build notes. • Add `/docs/runbooks` for operational runbooks. • Add `/tests` root. • Add `.github/workflows` . • Add `.env.example` with placeholders only. 

Acceptance criteria: 

- Repository exists. • Branch protection active. • No secrets committed. • Locked artifacts are referenced, not modified. 

## **Step 2 — Configure pnpm** 

Checklist: 

- Add `pnpm-workspace.yaml` . • Configure root `package.json` . • Add workspace scripts: 

4 

• `dev` ; • `build` ; • `lint` ; • `typecheck` ; • `test` ; • `test:unit` ; • `test:integration` ; • `test:authorization` ; • `test:tenant-isolation` ; • `test:e2e` ; • `db:migrate` ; • `db:seed` ; • `ci` . 

Acceptance criteria: 

• `pnpm install` succeeds. • Workspace resolves app and packages. • CI can run all root scripts. 

## **Step 3 — Configure TypeScript** 

Checklist: 

- Add `tsconfig.base.json` . 

- Add strict TypeScript. 

- Add path aliases only for approved package boundaries. • Configure no implicit any. • Configure no unchecked indexed access where practical. • Configure typecheck for all packages. 

Acceptance criteria: 

- `pnpm typecheck` passes. 

- • Unsafe imports fail CI where configured. • No package imports repositories from UI. 

## **Step 4 — Configure ESLint** 

Checklist: 

- Add `eslint.config.mjs` . 

- Enforce import boundaries. 

- 

- Block direct Prisma import outside approved DB/repository layers. • Block frontend-to-repository imports. 

- Block platform code import into tenant modules. 

- 

- Block tenant-specific branch patterns. 

- 

- Block route files without metadata. 

- 

5 

Acceptance criteria: 

- `pnpm lint` passes. 

- • CI fails forbidden imports. 

- CI fails FundedBeyond hardcoded platform branch. 

## **Step 5 — Configure Prettier** 

Checklist: 

- Add `prettier.config.js` . 

- Add format script. 

- Add check-only format CI step. 

Acceptance criteria: 

- `pnpm format:check` passes. 

- • Formatting does not modify locked docs unless intentionally edited. 

## **Step 6 — Configure Husky** 

Checklist: 

- Pre-commit: • lint staged files; • typecheck affected packages where possible; • prevent `.env` commit. • Pre-push: • unit tests; • route metadata check; • Prisma boundary check. 

Acceptance criteria: 

- Unsafe commits blocked locally. • CI remains source of truth. 

## **Step 7 — Configure CI** 

Required jobs: 

1. install; 

2. lint; 

3. format check; 

4. typecheck; 

5. unit tests; 

6. integration tests; 

7. authorization tests; 

8. tenant isolation tests; 

9. RLS tests; 

10. migration validation; 

6 

11. route metadata check; 

12. Prisma boundary check; 

13. audit compliance check; 

14. outbox compliance check; 

15. forbidden-scope check; 

16. build; 

17. secret scan; 

18. dependency scan. 

Acceptance criteria: 

- Pull request cannot merge unless all required jobs pass. 

- Phase 1 feature PRs blocked until Phase 0 gates pass. 

- CI blocks new APIs/screens/permissions/tables outside locked artifacts. 

## **Step 8 — Configure Vercel** 

Checklist: 

- Create dev, staging, and production project/environment separation. 

- Connect GitHub repository. 

- Configure pnpm build. 

- Configure preview deployments. 

- Configure protected production deploys. 

- Configure environment variables by environment. 

- Configure Sentry release upload. 

- Document rollback procedure. 

Acceptance criteria: 

- Preview deploy works. 

- Production deploy requires approval. 

- Production secrets unavailable to preview branches. 

## **Step 9 — Configure Cloudflare** 

Checklist: 

- Configure DNS. 

- Configure WAF. 

- 

- Configure bot protection. 

- 

- Configure rate-limit edge assists. 

- 

- Configure `academy.fundedbeyond.com` . 

- 

- Configure platform domain. 

- 

- Configure future tenant domain onboarding runbook. • Configure private R2 bucket. 

Acceptance criteria: 

- Platform host resolves separately. 

- Tenant host resolves to app. 

7 

- Cloudflare does not replace app authorization. • Protected assets are never public-bucket exposed. 

## **Step 10 — Configure Monitoring** 

Checklist: 

- Configure Sentry. 

- Configure PostHog. 

- Configure Better Stack. 

- Configure structured logs. 

- Configure request ID propagation. 

- Configure worker heartbeat. 

- Configure uptime checks. 

- Configure alert routing. 

- Configure error budgets. 

- Configure release dashboards. 

Acceptance criteria: 

- Request ID visible across API logs, Sentry, and Better Stack. • Worker failures alert. 

- Tenant-domain failures alert. 

- No PII/secrets in logs. 

## **4. Sprint 0 Execution Plan** 

## **Goal** 

Establish codebase, CI, database baseline, RLS, transaction-local tenant context, and test harness. 

No product feature UI is accepted in Sprint 0. 

## **Deliverables** 

- Repository bootstrap. 

- Monorepo/package structure. 

- Next.js baseline. 

- Prisma baseline. 

- Initial migrations. 

- RLS SQL harness. 

- 

- `withTenantTx()` . 

- 

- `withPlatformScope()` . 

- Seed skeleton. 

- 

- CI foundation. 

- 

- Tenant isolation test harness. 

- 

8 

## **Dependencies** 

- Locked tech stack. • Database Design v2 table inventory. • Permission Matrix. 

- Technical Architecture Package. 

## **Implementation order** 

1. Repository bootstrap. 

2. Package boundaries. 

3. CI baseline. 

4. Prisma baseline. 

5. Raw SQL migration framework. 

6. Global tables. 

7. Tenant tables foundation. 

8. RLS helper functions. 

9. `withTenantTx()` . 

10. `withPlatformScope()` . 

11. Seed skeleton. 

12. IDOR/RLS tests. 

13. Health endpoint. 14. Basic observability wiring. 

## **Acceptance criteria** 

- Repo builds. • CI runs. • Prisma migration applies locally/staging. • RLS active on tenant tables. 

- `withTenantTx()` uses transaction-local tenant context. 

- • Direct Prisma access outside wrapper fails CI. • Representative cross-tenant read/write attempts fail. 

- No product screens are wired. 

## **5. Phase 1A Execution Plan** 

## **Goal** 

Deliver the core learning loop on secure Atlas foundations. 

Core loop: 

```
Account
```

```
  → Dashboard
```

```
  → Catalog
```

```
  → Course Detail
```

9 

- `→ Lesson` 

- `→ Progress` 

- `→ Assessment` 

- `→ Result` 

- `→ Competency/Readiness projection` 

## **Deliverables** 

- Branding/theme/domain runtime. 

- Course engine. • Lesson engine. • Progress tracking. • Learning path engine. • Workflow gate. 

- Item registry. • Question bank. • Assessment engine. 

- Attempt engine. 

- Grading tasks. 

- Competency and scoring engine. 

- Readiness policy foundation. • Certificates foundation. 

- Instructor Studio core screens. 

- Learner core screens. 

## **Dependencies** 

- Sprint 0 isolation gates. • Tenant resolution. • Auth/membership. • Permission and entitlement spine. • Audit/outbox. • Storage foundation. 

## **Build order** 

1. Branding/theme config. 2. Course CRUD. 3. Lesson CRUD and lesson player. 4. Progress writes. 5. Enrollment. 6. Learning paths and gates. 7. Workflow S1. 8. Item registry. 9. Question bank. 10. Assessments. 11. Attempts and answers. 12. Grading. 13. Competency dimensions. 14. Scoring profiles. 

10 

15. Competency signals/scores. 

16. Readiness policy read/config. 

17. Certificates/template/issue/verify. 

18. Learner and instructor screen integration. 

## **Acceptance criteria** 

- Learner can enroll in course. 

- Learner can complete a lesson. 

- Progress is persisted tenant-safely. 

- Instructor can create course/lesson/assessment. 

- Publish flows pass through approved workflow. 

- Assessment attempt can start, answer, submit, and show result. 

- Competency projections update through approved pipeline. 

- Certificate verification exposes minimal public projection. 

- No FundedBeyond-specific code branch exists. 

## **6. Phase 1B Execution Plan** 

## **Goal** 

Deliver engagement, app-layer, community, moderation, search, analytics, automation/locales/ extensions, data rights, FundedBeyond Tenant #1 configuration, and launch readiness. 

## **Deliverables** 

- Public diagnostic. 

- Diagnostic identity gate. 

- Diagnostic result. 

- Swipe/practice sessions. • Gamification. 

- Notifications. 

- Automation/locales/first-party extension registration. 

- Community. 

- Moderation. 

- Search. 

- Analytics/read projections. 

- Data export and deletion workflows. 

- Tenant admin console. 

- Platform console. 

- FundedBeyond configuration. 

- Second-tenant smoke test. 

- Production readiness validation. 

## **Dependencies** 

- Phase 1A core learning loop. 

- Item registry. 

11 

- Competency/scoring. 

- Readiness policy. 

- Audit/outbox workers. 

- Entitlement gates. 

- Legal approval for readiness/CTA copy. 

## **Build order** 

1. Public diagnostic runner. 

2. Diagnostic anonymous result. 

3. Signup/merge path. 4. Swipe/practice engine. 

5. Competency signal integration. 

6. Gamification profiles/ledger/streaks/badges/leaderboards. 7. Notification templates/dispatch/inbox. 

8. Automation/locales/extension registry. 

9. Community spaces/posts/comments. 

10. Moderation reports/cases/actions. 

11. Search index and query. 

12. Analytics projections. 

13. Data rights export/deletion. 

14. Tenant admin console completion. 

15. Platform console completion. 16. FundedBeyond tenant seed/config. 

17. Second tenant seed/config. 

18. Full regression and launch gate. 

## **Acceptance criteria** 

- Visitor can run diagnostic. 

- Visitor can create account and merge diagnostic where approved. 

- Learner can swipe/practice. 

- Swipe signals update competency through generic engine. 

- Readiness CTA produces attributed outbound token only. 

- Community is membership/entitlement-gated. 

- Moderation queue works. 

- Search is tenant-scoped. 

- Analytics uses projections, not raw high-volume tables. 

- Data export uses background job. 

- FundedBeyond launches without fork. 

- Second tenant provisions without code change. 

12 

## **7. Sprint-by-Sprint Build Matrix** 

|Sprint|Features|APIs|||Screens|Permissions|Database Tables|Dependencies<br>Defnition of<br>Done|
|---|---|---|---|---|---|---|---|---|
|Sprint<br>0|Repo, CI, DB<br>baseline, RLS,<br>transaction<br>context|Health,<br>internal<br>outbox<br>skeleton|||A10 shell<br>only|Metadata/<br>default-deny<br>framework|tenants, tenant_domains,<br>audit/outbox baseline,<br>access seed skeleton|Locked<br>artifacts<br>CI green,<br>RLS harness<br>green, no<br>product UI|
|Sprint<br>1|Tenant<br>resolution,<br>auth,<br>membership,<br>roles,<br>`can()`|public auth,<br>invitations,<br>`me` ,<br>members,<br>roles||`/`|A6-A9, L24,<br>T2-T5<br>skeleton|pub,<br>membership._,_<br>_role._, profle.*|auth_principals,<br>memberships,<br>member_profles,<br>permissions, roles,<br>role_permissions,<br>user_roles|Sprint 0<br>ACTIVE<br>membership<br>gate works;<br>default deny<br>green|
|Sprint<br>2|Entitlements,<br>audit, outbox,<br>provisioning,<br>branding,<br>domains,<br>storage|entitlements,<br>audit,<br>branding,<br>theme,<br>domains,<br>platform<br>tenant APIs|||T1, T6-T10,<br>T22, P1-P8<br>foundation|entitlement._,_<br>_audit._, branding._,_<br>_domain._,<br>platform.*|entitlements,<br>entitlement_grant_history,<br>tenant_branding,<br>tenant_theme,<br>provisioning_jobs,<br>secret_refs|Sprint 1<br>Provision<br>tenant;<br>audit<br>sensitive<br>changes;<br>outbox<br>writes|
|||courses,||||||Cr l|
||Courses,|lessons,|||||courses, course_modules,|ouse oop<br>|
|Sprint<br>3|lessons,<br>enrollment,<br>progress|lesson<br>assets,<br>enrollments,|||L1-L4, I1-I4|course._,_<br>_enrollment._,<br>progress.*|lessons, lesson_assets,<br>enrollments,<br>lesson_progress|Sprint 2<br>works:<br>enroll→<br>lesson→<br>comlete|
|||progress||||||p|
|||workfows,|||||||
||Workfow, item|items, item|||||workfow_templates,|Attempt|
|Sprint<br>4|registry,<br>assessments,<br>attempts,|collections,<br>assessments,<br>attempts,|||L7-L9, I5-<br>I8, S1|workfow._, item._,<br>assessment._,_<br>_attempt._|workfow_instances,<br>item_types, items,<br>assessments, attempts,|Sprint 3<br>lifecycle and<br>workfow<br>publish gate|
||grading|grading|||||grading_tasks|work|
|||tasks|||||||
|Sprint<br>5|Learning<br>paths,<br>competency,<br>readiness, CTA<br>token|learning<br>paths,<br>competency,<br>readiness<br>policy, CTA<br>token|||L5-L6, L11-<br>L13, I9,<br>T20|learning_path._,_<br>_competency._,<br>readiness_policy.*|learning_paths,<br>path_steps,<br>competency_dimensions,<br>scoring_profles,<br>competency_scores,<br>readiness state,<br>attribution_tokens|Sprint 4<br>Roadmap +<br>readiness<br>projection<br>works|



13 

|Sprint|Features|APIs|Screens|Permissions|Database Tables|Dependencies<br>Defnition of<br>Done|
|---|---|---|---|---|---|---|
|||public|||practice_sessions,||
|Sprint<br>6|Public<br>diagnostic,<br>swipe/practice,<br>gamifcation|diagnostic,<br>practice<br>sessions,<br>SRS,|A1-A4, L10,<br>L14-L16,<br>T14|diagnostic.start,<br>practice._,_<br>_gamifcation._|practice_responses,<br>srs_state,<br>gamifcation_profles,<br>point_ledger, badges,|Sprint 5<br>Diagnostic +<br>swipe + XP<br>loop works|
|||gamifcation|||streaks, leaderboards||
|Sprint<br>7|Certifcates,<br>notifcations,<br>automation/<br>locales|certifcates,<br>verifcation,<br>notifcations,<br>automation,<br>locales|A5, L15,<br>L23, T15,<br>T18|certifcate._,_<br>_notifcation._,<br>automation._,_<br>_locale._|certifcate_templates,<br>certifcates,<br>credential_verifcations,<br>notifcation_templates,<br>notifcation_dispatches,<br>automation_rules, locales|Sprint 6<br>Certifcate<br>verify +<br>notifcation<br>inbox works|
||||||community_spaces, posts,|Communit|
|Sprint<br>8|Community,<br>moderation,<br>search,<br>analytics|community,<br>moderation,<br>search,<br>analytics|L17-L22,<br>M1-M4,<br>I13, T21|community._,_<br>_post._, comment._,_<br>_moderation._,<br>search._, analytics._|comments,<br>moderation_reports,<br>moderation_cases,<br>search_index_entries,|Sprint 7<br>y<br>gated;<br>moderation<br>and search<br>tenant-safe|
||||||analytics projections||
|||admin||||Admin/<br>lf|
|Sprint<br>9|Consoles and<br>data rights|console APIs,<br>platform<br>APIs, export/|T1-T24, P1-<br>P8, S1<br>completion|admin/platform/<br>data_rights/audit|export_jobs,<br>deletion_requests, all<br>console-read models|Sprint 8<br>patorm<br>screens<br>integrated;<br>exorts|
|||delete||||p<br>work|
||Observability,||A1-A10, L1-|||Full|
|Sprint<br>10|FundedBeyond<br>confg, second<br>tenant, release|all P0/P1<br>APIs<br>regression|L25, I1-I13,<br>M1-M4, T1-<br>T24, S1,|all approved<br>groups|all P0/P1 tables|Sprint 9<br>regression<br>green;<br>launch|
||hardening||P1-P8|||approved|



## **8. Database Implementation Order** 

## **Migration 001 — PostgreSQL extensions and base functions** 

Build: 

- UUID generation support. 

- timestamp helpers. 

- tenant context helper functions. 

- audit hash helper. 

- common updated-at trigger function. 

14 

Why: 

- All later migrations depend on common database utilities. 

## **Migration 002 — Global tenancy tables** 

Build: 

- `tenants` ; 

- `tenant_domains` . 

Why: 

- Host-based tenant resolution is the root of all tenant-safe behavior. 

## **Migration 003 — Identity and membership tables** 

Build: 

- `auth_principals` ; 

- • `memberships` ; 

- `member_profiles` . 

Why: 

- Auth alone is not enough; protected access depends on ACTIVE membership. 

## **Migration 004 — Access control catalogue** 

Build: 

- `permissions` ; 

- • `permission_bundles` ; • `roles` ; • `role_permissions` ; • `user_roles` ; 

- `permission_overrides` . 

Why: 

- No route can be protected until permissions and roles exist. 

## **Migration 005 — Configuration and entitlements** 

Build: 

- `tenant_config` ; 

- `tenant_config_version` ; 

- 

- 

- `feature_flags` ; 

- `feature_flag_overrides` ; 

15 

• `entitlements` ; 

• `entitlement_grant_history` . 

Why: 

- Entitlement must run before permission where applicable. 

## **Migration 006 — Audit and secrets** 

Build: 

- `audit_entries` ; 

- `secret_refs` ; 

- append-only protections; 

- audit hash-chain trigger. 

Why: 

- Sensitive mutations become valid only after audit support exists. 

## **Migration 007 — Outbox/eventing** 

Build: 

- `outbox_events` ; 

- `event_deliveries` ; 

- 

- `dead_letter_events` . 

Why: 

- Side effects, workers, notifications, analytics, and projections require outbox. 

## **Migration 008 — Provisioning, branding, theme, domains** 

Build: 

- `provisioning_jobs` ; 

- `tenant_branding` ; 

- `tenant_theme` ; 

- `tenant_branding_version` ; 

- `tenant_theme_version` . 

Why: 

- Tenants and white-label runtime must exist before public/learner screens render. 

## **Migration 009 — Storage references** 

Build: 

- storage reference patterns through approved learning/config tables; 

- 

16 

- R2 object reference columns where defined; • no self-hosted video tables. 

Why: 

- Lessons and branding assets need R2 references before UI. 

## **Migration 010 — Learning core** 

Build: 

- `courses` ; 

- `course_modules` ; 

- `lessons` ; 

- `lesson_assets` ; 

- `enrollments` ; 

- `lesson_progress` . 

Why: 

- Course/lesson/progress is the first learner feature dependency. 

## **Migration 011 — Workflow** 

Build: 

- workflow templates; • workflow instances; • workflow transitions. 

Why: 

- Publish/review/issue/moderate gates must be explicit before content goes live. 

## **Migration 012 — Learning paths** 

Build: 

- `learning_paths` ; 

- `path_steps` ; 

- `path_step_gates` ; 

- 

- 

- `path_enrollments` ; 

- `path_step_progress` . 

Why: 

- FundedBeyond roadmap must be generic learning-path configuration. 

17 

## **Migration 013 — Item registry and question bank** 

Build: 

- `item_types` ; 

- `items` ; 

- `item_options` ; 

- `item_dimension_weights` ; 

- `item_collections` ; 

- `item_collection_items` . 

Why: 

- Swipe and diagnostic must ride generic item-type registry, not a fork. 

## **Migration 014 — Assessment and attempts** 

Build: 

- `assessments` ; 

- • `assessment_items` ; 

- `attempts` ; 

- `attempt_answers` ; 

- `grading_tasks` . 

Why: 

- Assessments depend on item registry and workflow. 

## **Migration 015 — Practice/swipe/SRS** 

Build: 

- `practice_sessions` ; 

- • `practice_responses` ; 

- `srs_state` . 

Why: 

- Swipe is practice on generic assessment/item infrastructure. 

## **Migration 016 — Competency and scoring** 

Build: 

- `competency_dimensions` ; 

- 

- 

- 

- 

- `scoring_profiles` ; 

- `scoring_config_versions` ; 

- `competency_bands` ; 

- `signal_sources` ; 

18 

- `competency_signals` ; 

- • `competency_scores` ; • `composite_readiness_state` ; 

- `competency_score_snapshots` . 

Why: 

- Diagnostic/readiness value depends on generic scoring. 

## **Migration 017 — Readiness and attribution** 

Build: 

- approved readiness policy tables/config; • `attribution_tokens` . 

Why: 

- Readiness CTA is outbound attributed redirect only. 

## **Migration 018 — Certificates** 

Build: 

- `certificate_templates` ; 

- • `certificates` ; • `credential_verifications` . 

Why: 

- Verification must be public minimal projection; issue/revoke needs audit. 

## **Migration 019 — Gamification** 

Build: 

- `gamification_profiles` ; 

- • `point_ledger` ; • `badges` ; • `badge_awards` ; • `streak_states` ; • `streak_freezes` ; • `leaderboard_definitions` ; • `leaderboard_snapshots` . 

Why: 

- Engagement depends on completion/practice/assessment events. 

19 

## **Migration 020 — Notifications** 

Build: 

- `notification_templates` ; 

• `notification_dispatches` . 

Why: 

- Notifications are event-driven and should not block user requests. 

## **Migration 021 — Community and moderation** 

Build: 

- `community_spaces` ; 

- posts/comments/reactions tables as approved; 

- `moderation_reports` ; 

- `moderation_cases` ; 

- • moderation action tables. 

Why: 

- Community must be membership and entitlement gated; moderation must be auditable. 

## **Migration 022 — Search and analytics projections** 

Build: 

- `search_index_entries` ; 

- approved analytics projection/read-model tables. 

Why: 

- Search and dashboards must not query raw high-volume tables directly. 

## **Migration 023 — Automation, locales, first-party extension registration** 

Build: 

- approved automation tables; 

- approved locale tables; 

- approved first-party extension registration tables. 

Why: 

- These configure generic Atlas behavior without plugin marketplace/sandbox. 

20 

## **Migration 024 — Data rights** 

Build: 

- `export_jobs` ; 

- `deletion_requests` . 

Why: 

- Tenant data rights must be operational before launch. 

## **Migration 025 — Indexes, partitions, grants, RLS hardening** 

Build: 

- tenant-leading indexes; • partial indexes; • append-only constraints; • partition policies; • RLS policies; • grants; 

- `atlas_platform` role isolation. 

Why: 

- Performance and isolation must be hardened before production. 

## **Migration dependency graph** 

```
001 base
 ↓
002 tenancy
 ↓
003 identity/membership
 ↓
004 access
 ↓
005 config/entitlements
 ↓
006 audit
 ↓
007 outbox
 ↓
008 provisioning/branding
 ↓
009 storage refs
 ↓
010 learning
 ↓
011 workflow
```

21 

```
 ↓
012 learning paths
 ↓
013 item registry
 ↓
014 assessment
 ↓
015 practice/swipe
 ↓
016 competency/scoring
 ↓
017 readiness/CTA
 ↓
018 certificates
 ↓
019 gamification
 ↓
020 notifications
 ↓
021 community/moderation
 ↓
022 search/analytics
 ↓
023 automation/locales/extensions
 ↓
024 data rights
 ↓
025 hardening
```

## **9. API Implementation Order** 

## **9.1 Public APIs** 

Build order: 

1. `GET /api/v1/public/landing/:slug` 

2. `POST /api/v1/public/auth/signup` 

3. `POST /api/v1/public/auth/login` 

4. Supabase password reset flow integration 

5. `POST /api/v1/public/invitations/accept` 

6. `GET /api/v1/public/verify/:credentialId` 

7. `POST /api/v1/public/diagnostic/start` 

8. `GET /api/v1/public/diagnostic/:anonId/result` 

Dependency: 

22 

```
Tenant resolution
  ↓
public route metadata
  ↓
rate limiting
  ↓
safe tenant public projection
```

## **9.2 Auth APIs** 

Build order: 

1. session extraction; 

2. principal bridge; 

3. `/api/v1/me` ; 

4. `/api/v1/me/profile` ; 

5. invitation acceptance; 

6. membership state handling; 

7. session revocation/MFA enforcement for admin/platform where required. 

Dependency: 

```
Tenant resolution
  ↓
Supabase Auth
  ↓
auth_principals
  ↓
memberships
  ↓
member_profiles
```

## **9.3 Tenant APIs** 

Build order: 

1. branding/theme/config read; 

2. tenant config; 

3. domains; 

4. entitlements; 

5. feature flags; 

6. audit; 

7. data export/deletion. 

Dependency: 

23 

```
withTenantTx
  ↓
membership gate
  ↓
entitlement gate
  ↓
can()
  ↓
audit where sensitive
```

## **9.4 Instructor APIs** 

Build order: 

1. courses; 

2. lessons; 

3. lesson assets; 

4. learning paths; 

5. item/question bank; 

6. assessments; 

7. grading tasks; 8. workflow transitions; 

9. certificates/templates; 

10. analytics read models. 

Dependency: 

```
course ownership/relationship
  ↓
workflow
  ↓
audit
  ↓
outbox
```

## **9.5 Admin APIs** 

Build order: 

1. members; 

2. roles; 

3. permission overrides; 

4. branding/theme/domains; 

5. entitlements read; 

6. notification templates; 

7. automation/locales; 

8. community configuration; 

9. moderation management; 

24 

10. analytics; 11. audit; 12. data rights. 

Dependency: 

```
admin membership
  ↓
role/permission check
  ↓
entitlement where required
  ↓
audit for sensitive mutation
```

## **9.6 Platform APIs** 

Build order: 

1. platform auth/role assertion; 

2. reason-bound scope; 

3. tenant list/detail; 4. tenant create/provision; 5. tenant lifecycle; 6. tenant domains; 7. entitlement grants; 

8. platform audit; 

9. provisioning jobs; 

10. dead-letter/outbox review where approved. 

Dependency: 

```
Supabase Auth
  ↓
platform role
  ↓
reason-bound withPlatformScope()
  ↓
canPlatform()
  ↓
audit
```

## **10. Frontend Build Order** 

## **10.1 Layouts** 

1. Root layout. 

25 

2. Public route group. 3. Auth route group. 4. Learner route group. 5. Studio route group. 6. Moderation route group. 7. Tenant admin route group. 

8. Platform route group. 

## **10.2 Shells** 

1. `PublicSiteShell` 

2. `AuthShell` 

3. `LearnerShell` 4. `StudioShell` 

5. `ModerationShell` 6. `TenantAdminShell` 

7. `PlatformConsoleShell` 

## **10.3 Navigation** 

1. Public header. 2. Auth navigation. 3. Learner sidebar/mobile nav. 4. Studio nav. 5. Moderation nav. 6. Admin nav. 7. Platform nav. 8. Permission/entitlement-aware navigation projections. 

## **10.4 Authentication** 

1. Login. 2. Signup. 3. Password reset. 4. Invitation acceptance. 5. Profile. 6. Session denial states. 7. Membership denial states. 

## **10.5 Course UI** 

1. Course catalog. 2. Course detail. 3. Enrollment. 4. Lesson player. 5. Progress cards. 6. Course manager. 7. Course builder. 

8. Lesson editor. 

26 

## **10.6 Assessment UI** 

1. Item builder. 2. Item collection builder. 3. Assessment list. 4. Assessment detail. 

5. Assessment builder. 6. Attempt runner. 7. Attempt result. 8. Grading queue. 9. Grading task detail. 

## **10.7 Community UI** 

1. Community landing. 2. Spaces. 3. Feed. 4. Thread. 5. Comments. 6. Reports. 7. Moderation queue. 8. Case detail. 

## **10.8 Readiness UI** 

1. Competency summary. 2. Readiness band. 3. Readiness policy display. 4. CTA prominence logic. 5. Attribution token action. 6. Legal-safe copy. 

## **10.9 Swipe UI** 

1. Practice session start. 2. Swipe runner. 3. Response capture. 4. Offline-safe UI state. 5. Server re-validation. 6. Completion result. 

7. Streak/XP feedback. 

## **10.10 Admin UI** 

1. Admin dashboard. 

2. Members. 

3. Roles. 

4. Permission overrides. 

5. Branding. 

6. Theme. 

27 

7. Domains. 

8. Entitlements. 

9. Automation. 

10. Locales. 11. Audit. 

12. Data rights. 

13. Readiness policy. 

## **10.11 Platform UI** 

1. Platform login gate. 2. Platform dashboard. 

3. Tenant list. 

4. Tenant detail. 

5. Provisioning jobs. 

6. Entitlement grants. 

7. Platform audit. 8. Support/reason-bound action flows. 

## **Frontend dependency graph** 

```
Design system primitives
  ↓
Shells
  ↓
Route gates
  ↓
Navigation projections
  ↓
API client
  ↓
Auth screens
  ↓
Learner core
  ↓
Instructor core
  ↓
Admin/platform
  ↓
Engagement/app-layer
  ↓
Regression
```

28 

## **11. Backend Build Order** 

## **Exact order** 

1. Tenant resolution. 2. Tenant state gate. 3. Request ID/context builder. 4. Supabase Auth bridge. 5. Principal loader. 6. Membership gate. 7. `withTenantTx()` . 8. `withPlatformScope()` . 9. Entitlement service. 10. Permission catalogue. 11. `can()` engine. 12. Ownership predicates. 13. Relationship predicates. 14. Route metadata wrapper. 15. Zod schemas. 16. Error envelope. 17. Repository base layer. 18. Service layer conventions. 19. Audit writer. 20. Outbox writer. 21. Idempotency helper. 22. Rate limiting. 23. Storage helpers. 24. Workers. 25. Domain modules. 

## **Domain module order** 

1. tenancy/provisioning; 2. identity/membership; 3. access control; 4. config/branding/entitlements; 5. audit/eventing; 6. storage; 7. learning; 8. lessons; 9. learning paths; 10. workflow; 11. item registry; 12. assessment; 13. practice/swipe; 14. competency/scoring; 15. readiness; 16. certificates; 17. gamification; 18. notifications; 

29 

19. community; 

20. moderation; 

21. search; 

22. analytics; 

23. automation/locales/extensions; 

24. data rights; 

25. platform. 

## **Backend dependency graph** 

```
Context builder
  ↓
Tenant resolution
  ↓
Auth + membership
  ↓
withTenantTx
  ↓
Entitlements
  ↓
can()
  ↓
Resource loaders
  ↓
Services
  ↓
Repositories
  ↓
Audit + outbox
  ↓
Workers
  ↓
Domain APIs
```

## **12. Infrastructure Build Order** 

## **Exact order** 

1. GitHub repository. 

2. Branch protection. 

3. CODEOWNERS. 

4. GitHub Actions CI. 

5. Secret scanning. 

6. Dependency scanning. 

7. Vercel dev/staging/prod projects. 

8. Cloudflare DNS/WAF/rate limits. 

9. PostgreSQL dev/staging/prod. 

30 

10. Supabase Auth projects. 11. Cloudflare R2 buckets. 

12. Sentry. 13. PostHog. 

14. Better Stack. 

15. Worker runtime/cron secrets. 16. Migration runbooks. 17. Backup configuration. 18. Restore drill. 

19. Rollback runbook. 

20. Production release runbook. 

21. Tenant onboarding runbook. 

22. Incident runbook. 

## **Infrastructure dependency graph** 

```
GitHub
  ↓
CI/CD
  ↓
Vercel
  ↓
Postgres + Supabase
  ↓
Cloudflare DNS/WAF
  ↓
R2
  ↓
Monitoring
  ↓
Backups
  ↓
Runbooks
  ↓
Production gate
```

## **13. Testing Execution Plan** 

## **13.1 Unit tests** 

Start: Sprint 0. 

Coverage: 

- Zod schemas; 

- utility functions; 

- route metadata helpers; 

31 

- tenant resolution helpers; 

- permission predicates; 

- entitlement helpers; 

- audit hash helpers; 

- idempotency helpers; 

- UI primitives. 

Required before merge: 

- every new helper; 

- every new service method; 

- every new mapper. 

## **13.2 Integration tests** 

Start: Sprint 0 for health/db; Sprint 1 for auth/membership; every API thereafter. 

Coverage: 

- route success paths; 

- route error envelopes; 

- Zod failure; 

- idempotency replay; 

- audit writes; 

- outbox writes; 

- worker processing. 

## **13.3 Authorization tests** 

Start: Sprint 1. 

Coverage: 

- role allow/deny; 

- owner/admin/instructor/learner contrasts; 

- permission overrides; 

- ownership denial; 

- relationship denial; 

- entitlement denial; 

- platform scope denial. 

## **13.4 Tenant isolation tests** 

Start: Sprint 0. 

Coverage: 

- Tenant A cannot read Tenant B resource by ID. 

- Tenant A cannot update Tenant B resource by ID. 

- Host wins over JWT. 

32 

• No client-supplied `tenant_id` . • RLS denies direct unsafe access. • Cache/query keys do not leak tenant data. 

## **13.5 E2E tests** 

Start: Sprint 1 for auth; expand per sprint. 

Required journeys: 

1. visitor → signup/login; 2. invite → active membership; 3. learner → course → lesson → progress; 4. learner → assessment → result; 

5. learner → readiness → CTA; 

6. visitor → diagnostic → account; 

7. learner → swipe → readiness signal; 8. instructor → author → review → publish; 

9. admin → invite member → assign role; 

10. moderator → report → case → action; 11. platform → provision tenant; 

12. second tenant smoke test. 

## **13.6 Worker tests** 

Start: Sprint 2. 

Coverage: 

- outbox dispatch; • notification dispatch; 

- analytics projection update; 

- competency update; 

- readiness update; 

- export generation; 

- retry/dead-letter. 

## **13.7 RLS tests** 

Start: Sprint 0. 

Coverage: 

- every tenant table; 

- representative append-only tables; 

- platform role boundary; 

- transaction pooling behavior; 

- `set_config(..., true)` behavior; 

- direct SQL denial without context. 

33 

## **14. Feature Implementation Sequence** 

1. Courses — depends on tenant/authz/storage. 

2. Lessons — depends on courses/storage/progress. 

3. Learning Paths — depends on courses, assessments, competency gates. 

4. Assessments — depends on item registry/workflow. 

5. Question Bank — depends on item types and dimensions. 

6. Competency — depends on assessment/practice signals. 

7. Readiness — depends on competency projections and readiness policy. 

8. Swipe Learning — depends on item registry, practice sessions, competency signals. 

9. Certificates — depends on course/assessment completion and workflow. 

10. Community — depends on membership, entitlement, moderation. 

11. Notifications — depends on outbox and templates. 

12. Analytics — depends on domain events/projections. 

13. Administration — depends on membership, roles, entitlements, audit. 

14. Platform — depends on platform scope, provisioning, audit. 

Dependency chain: 

```
Learning content
  ↓
Assessment/practice
  ↓
Competency signals
  ↓
Readiness
  ↓
CTA attribution
```

FundedBeyond-specific features must use: 

- tenant branding; 

- tenant theme; 

- tenant config; 

- item types; 

- scoring dimensions; 

- readiness policy; 

- learning paths; 

- content; 

- community configuration; 

- certificate templates; 

- workflow configuration. 

No feature may use FundedBeyond-specific code branches. 

34 

## **15. Cursor Development Workflow** 

## **15.1 How Cursor should work** 

Cursor must work story-by-story. 

Before generating code, Cursor must identify: 

- approved story/sprint; 

- approved screen IDs; 

- approved APIs; 

- approved permissions; 

- approved tables; 

- route metadata; 

- entitlement requirements; 

- audit requirements; 

- outbox requirements; 

- test requirements. 

## **15.2 Prompt structure** 

Every Cursor prompt must include: 

```
Context:
- Atlas LMS locked artifacts are source of truth.
- Do not create new screens/APIs/permissions/tables/workflows.
- Implement only [story/module].
```

```
Build:
- Files to create/edit:
- Approved APIs:
- Approved tables:
- Approved permissions:
- Required gates:
- Required tests:
Constraints:
- No Prisma outside withTenantTx.
- No client-supplied tenant_id.
- No UI authorization as source of truth.
- No FundedBeyond code branch.
- Same-transaction audit where required.
- Outbox for side effects.
```

```
Output:
- Code only.
- Tests included.
- No scope additions.
```

35 

## **15.3 Branch strategy** 

Format: 

```
feature/ATL-STORY-000-short-name
fix/ATL-STORY-000-short-name
test/ATL-STORY-000-short-name
infra/ATL-STORY-000-short-name
```

Rules: 

- one story per branch; 

- one bounded context per PR where possible; 

- no mixed redesign/refactor PRs; 

- no schema change without migration and RLS review. 

## **15.4 Commit strategy** 

Format: 

```
ATL-STORY-000: implement tenant resolver
ATL-STORY-000: add RLS tests
ATL-STORY-000: wire audit writer
```

Rules: 

- commits must be traceable; 

- no “misc changes”; 

- no generated code without review. 

## **15.5 Review strategy** 

Every PR review checks: 

- approved scope only; 

- route metadata; 

- Zod validation; 

- 

- `withTenantTx` ; 

- `can()` ; 

- entitlement order; 

- audit/outbox; 

- tests; 

- tenant isolation; 

- no hardcoded tenant logic; 

- no new API/screen/table/permission. 

36 

## **15.6 Testing strategy** 

Cursor-generated code must include tests in the same PR. 

Required minimum: 

- unit tests for helpers; 

- integration tests for route/service; 

- authorization tests for protected routes; 

- tenant isolation tests for tenant resources; 

- E2E tests for user-facing screens. 

## **15.7 Definition of completion** 

A Cursor task is complete only when: 

- code compiles; 

- tests pass; 

- CI passes; 

- route metadata exists; 

- audit/outbox obligations met; 

- no forbidden scope added; 

- PR description maps to locked artifacts. 

## **16. Claude Code Workflow** 

## **16.1 Database generation** 

Claude Code may generate: 

- Prisma models matching Database Design v2; 

- raw SQL migrations; 

- RLS policies; 

- indexes; 

- grants; 

- append-only triggers; • seed files; 

- migration tests. 

Claude Code must not: 

- add tables; 

- rename approved tables; 

- remove RLS; 

- use session-level tenant `SET` ; 

- generate unsafe destructive migration without review. 

37 

## **16.2 Backend generation** 

Claude Code may generate: 

- route wrappers; 

- route metadata; • Zod schemas; • resource loaders; • service functions; 

- repositories; • audit writers; • outbox events; • workers; 

- tests. 

Claude Code must not: 

• add unapproved APIs; • put authorization in route handlers; 

• bypass `can()` ; • use Prisma outside wrappers; • send email inline; • create FundedBeyond-specific modules. 

## **16.3 Frontend generation** 

Claude Code may generate: 

- approved App Router pages; 

- shells; • forms; • tables; 

- loading/error/empty/denied states; 

- API client calls; 

- E2E tests. 

Claude Code must not: 

- create unapproved routes/screens; • invent UI flows; • fetch Prisma directly; • trust client permissions; • expose hidden admin data; 

- hardcode tenant branding/copy. 

## **16.4 Infrastructure generation** 

Claude Code may generate: 

- GitHub Actions YAML; 

- CI validation scripts; 

38 

- `.env.example` ; 

- • monitoring config docs; 

- runbook drafts; 

- migration validation scripts; • smoke scripts. 

Claude Code must not: 

- include real secrets; • create provider-specific manual steps without runbook; • skip rollback behavior; 

- bypass production approvals. 

## **16.5 Safe workflow** 

1. Ask Claude Code to generate one bounded artifact. 

2. Review generated diff. 

3. Run local tests. 

4. Run CI. 

5. Review security gates. 

6. Merge only if locked artifacts are preserved. 

## **17. AI Coding Rules** 

## **17.1 Allowed patterns** 

- Route handlers as HTTP transport only. 

- Server Actions as wrappers around same service path. • Zod at every boundary. 

- `withTenantTx` for tenant data. 

- 

- `withPlatformScope` for platform actions. 

- 

- `can()` for permissions. 

- 

- `enforceEntitlement()` before `can()` . 

- 

- Audit in same transaction. 

- • Outbox for side effects. 

- Cursor pagination. 

- Read projections for dashboards. 

- R2 references for assets. 

- Provider references for video. • Tenant config for customization. 

## **17.2 Forbidden patterns** 

- New APIs. 

- New screens. 

- New permissions. 

- New entities. 

- New workflows. 

39 

• FundedBeyond code fork. • `if tenant.slug === 'fundedbeyond'` . • Client-supplied `tenant_id` . • Direct Prisma in UI. • Direct Prisma outside wrappers. • Authorization in frontend. • Session-level tenant `SET` . • Public R2 access for protected assets. • Direct email send inside route. • Unbounded dashboard query. • Offset pagination. • Hardcoded secrets. • Raw PII in logs. • Commerce checkout. • Challenge purchase/pass/funded inbound events. • Native mobile build endpoints. • Live/webinar. • AI coach. • Marketplace/plugin sandbox. 

## **17.3 Required validations** 

- Typecheck. • Lint. • Zod validation. • Route metadata validation. • Permission validation. • Entitlement validation. • RLS validation. • Audit validation. • Outbox validation. • Tenant isolation validation. 

- CI forbidden-scope validation. 

## **17.4 Required documentation** 

Each PR must document: 

- story ID; • approved screens; • approved APIs; • approved tables; • approved permissions; 

- tests added; 

- audit/outbox decision; • migration impact; • rollback notes if applicable. 

## **17.5 Required review points** 

- security; 

40 

- tenant isolation; 

- authorization; 

- data model; 

- API contract; 

- frontend gate-before-render; 

- observability; 

- operations; 

- QA coverage. 

## **18. QA Execution Plan** 

## **18.1 Sprint validation** 

QA validates per sprint: 

Sprint 0: 

- CI; • migration; • RLS; • transaction pooling; • no direct Prisma; • cross-tenant denial. 

Sprint 1: 

- auth; • signup/login/reset; • invite acceptance; • membership states; • permission deny states. 

Sprint 2: 

- entitlements; • audit; • outbox; • provisioning; • branding; • domains; • storage. 

Sprint 3: 

- courses; 

- lessons; 

- enrollment; 

- progress. 

41 

Sprint 4: 

- workflow; • item registry; 

- assessments; 

- attempts; • grading. 

Sprint 5: 

- learning paths; • competency; • readiness; • CTA. 

Sprint 6: 

- diagnostic; • swipe; • gamification. 

Sprint 7: 

- certificates; • notifications; • automation/locales. 

Sprint 8: 

- community; • moderation; • search; • analytics. 

Sprint 9: 

- admin console; • platform console; • data rights. 

Sprint 10: 

- full regression; • FundedBeyond; 

- second tenant; 

- production readiness. 

## **18.2 What blocks release** 

- Tenant isolation failure. 

- RLS failure. 

- Missing route metadata. 

42 

- Missing permission check. 

- Missing entitlement check where required. 

- Missing audit for sensitive mutation. • Missing outbox for side effect. 

- Cross-tenant data leak. 

- Unapproved API/screen/table/permission. • FundedBeyond fork. 

- Readiness/CTA legal copy not approved. 

- Second tenant smoke test failure. 

- Production secrets/logging issue. 

## **18.3 What can be deferred** 

Only if already marked nice-to-have within P0/P1: 

- styled A10 beyond safe notice; 

- A8 custom UI if Supabase default acceptable; 

- advanced leaderboards; 

- Hall of Fame enhancement; 

- advanced analytics depth; 

- single-locale launch instead of locales UI depth; 

- flat community feed instead of deep thread UX if approved. 

## **18.4 Release gates** 

- Unit tests green. 

- Integration tests green. 

- Authorization tests green. 

- Tenant isolation tests green. 

- RLS tests green. 

- E2E smoke green. 

- Migration rehearsal complete. 

- Monitoring configured. 

- Backup/restore drill complete. 

- Legal copy approved. 

- CTO approval recorded. 

## **18.5 Smoke tests** 

- Public landing loads. 

- Login works. 

- Signup works. 

- Invite acceptance works. 

- Learner dashboard loads. 

- Course catalog loads. 

- Lesson complete works. 

- Assessment submit works. 

- Swipe complete works. 

- Readiness CTA mints token. 

- Certificate verify works. 

- Community gate works. 

43 

- Admin dashboard works. 

- Platform dashboard works. 

- Tenant unavailable notice works. 

- Second tenant works. 

## **18.6 Tenant isolation tests** 

Matrix: 

```
Tenant A user → Tenant A resource = allow if permission passes
Tenant A user → Tenant B resource = deny/404 safe
Tenant B host + Tenant A JWT = Tenant B context; no Tenant A access
No membership = protected deny
INVITED = only invite acceptance
SUSPENDED = protected deny
REMOVED = protected deny
Platform support = reason-bound + audited only
```

## **19. Release Readiness Plan** 

## **19.1 Alpha readiness** 

Checklist: 

- repo stable; 

- CI green; 

- DB migrations apply; 

- RLS green; 

- auth/membership working; 

- basic learning loop working; 

- internal test tenants seeded. 

## **19.2 Internal readiness** 

Checklist: 

- instructor flow works; 

- admin flow works; 

- platform provisioning works; 

- audit visible; 

- outbox workers running; 

- monitoring active; 

- QA regression started. 

44 

## **19.3 FundedBeyond readiness** 

Checklist: 

- FundedBeyond tenant provisioned through approved provisioning; • `academy.fundedbeyond.com` configured; 

- branding/theme/config loaded from tenant data; • readiness policy configured; 

- scoring dimensions configured; 

- diagnostic content configured; 

- swipe decks configured; 

- learning paths configured; 

- certificates configured; 

- community configured; 

- no code fork; 

- legal copy approved. 

## **19.4 Production readiness** 

Checklist: 

- production Vercel configured; 

- Cloudflare configured; 

- Supabase production configured; 

- Postgres production configured; 

- R2 production bucket configured; 

- env vars configured; 

- secrets restricted; 

- backups enabled; 

- restore drill complete; 

- rollback tested; 

- monitoring/alerts tested; 

- smoke tests green. 

## **19.5 Launch readiness** 

Checklist: 

- full regression green; 

- second tenant smoke test green; 

- tenant isolation after restore green; 

- public routes work; 

- protected routes gate correctly; 

- platform routes isolated; 

- error rates acceptable; 

- CTO approval recorded; 

- launch runbook ready; 

- incident owner assigned. 

45 

## **20. Definition of Done** 

## **20.1 Database task** 

Done when: 

- migration exists; 

- Prisma model updated if applicable; 

- raw SQL included where needed; 

- RLS policy exists; 

- indexes exist; 

- append-only/idempotency constraints exist where required; 

- seed updated where required; 

- migration tests pass; 

- rollback/recovery note exists. 

## **20.2 Backend task** 

Done when: 

- route metadata exists; 

- Zod schemas exist; 

- service/repository separation preserved; 

- 

- `withTenantTx` used; 

- `can()` used; 

- entitlement checked before permission where required; 

- audit written where required; 

- outbox event written where required; 

- tests pass. 

## **20.3 Frontend task** 

Done when: 

- approved Screen ID implemented; 

- approved API used; 

- no protected render before gate; 

- loading/empty/error/denied states exist; 

- forms validate with Zod; 

- accessibility checks pass; 

- no hardcoded tenant logic; 

- E2E updated where relevant. 

## **20.4 Infrastructure task** 

Done when: 

- config committed without secrets; 

- environment separation preserved; 

46 

- runbook updated; 

- rollback documented; 

- monitoring updated where needed; 

- smoke script exists where relevant; 

- production mutation requires approval. 

## **20.5 Feature task** 

Done when: 

- DB, backend, frontend, tests, audit, outbox, observability, and docs are complete; • acceptance criteria met; 

- no forbidden scope added. 

## **20.6 Sprint task** 

Done when: 

- all sprint stories pass; • demo flow works; • QA signoff done; • regressions fixed or explicitly blocked; • CTO accepts sprint gate. 

## **20.7 Release task** 

Done when: 

- all launch gates pass; 

- second tenant smoke test passes; 

- monitoring active; 

- rollback ready; 

- CTO approval recorded. 

## **21. Engineering Metrics** 

## **21.1 Velocity tracking** 

Track: 

- committed story points; 

- completed story points; 

- carryover; 

- blocked stories; 

- defect rework; 

- unplanned scope requests. 

47 

Rule: 

- Scope creep is rejected unless it maps to locked artifact correction. 

## **21.2 Bug tracking** 

Severity: 

- P0: tenant/security/data loss/release blocker; 

- P1: broken critical journey; 

- P2: degraded feature; • P3: UI/edge case; • P4: polish. 

Release blocker: 

- any P0; 

- unresolved P1 in launch-critical journey. 

## **21.3 Coverage targets** 

Minimum gates: 

- auth/authorization/db/security modules: 90% meaningful coverage; 

- domain services: 80% meaningful coverage; 

- UI primitives/patterns: key states covered; 

- 

- every protected API: authorization tests; 

- every tenant table: RLS test; 

- every launch journey: E2E smoke. 

## **21.4 Latency targets** 

Engineering targets for Phase 0/1: 

- public read p95: under 500 ms server time where cached/projection-backed; 

- protected read p95: under 800 ms server time; 

- protected mutation p95: under 1200 ms excluding external provider latency; • dashboard reads: projection-backed only; 

- exports: async job, not request/response. 

## **21.5 Error targets** 

Launch gates: 

- no known tenant isolation error; 

- 

- no known authorization bypass; 

- 

- no known unaudited sensitive mutation; 

- 

- production 5xx below agreed release threshold during smoke; • worker dead-letter queue empty or explained before launch. 

48 

## **21.6 Quality gates** 

- CI green. 

- No forbidden scope. 

- No direct Prisma breach. 

- No route metadata gap. 

- No missing Zod. 

- No missing audit/outbox. 

- No cross-tenant leakage. 

- No hardcoded tenant branch. 

## **22. Risk Register** 

|Risk|Type|Impact|Mitigation|Mitigation||
|---|---|---|---|---|---|
|RLS/transaction pooling<br>defect|Technical/<br>Security|Critical|Build Sprint 0 harness before features|||
|Direct Prisma access|Technical/<br>Security|Critical|CI import guard and code review|||
|Missing route metadata|Security|Critical|CI route|metadata check||
|Authorization drift|Security|Critical|`can()`|as only decision point||
|Entitlement bypass|Tenant/Revenue|High|`enforceEntitlement()` <br>`can()`||before|
|FundedBeyond fork|Product/<br>Architecture|Critical|confguration-only review gate|||
|Diagnostic/readiness<br>advice risk|Legal/<br>Operational|High|educational copy and legal review|||
|Outbox worker failure|Operational|High|retries, dead-letter, alerting|||
|Analytics raw-query<br>overload|Technical|Medium|projections only|||
|Storage leak|Security|High|signed access; private R2|||
|Secrets exposure|Security|Critical|secret scanning and provider stores|||
|Production rollback gap|Deployment|High|Vercel rollback runbook and migration<br>strategy|||
|Second tenant failure|Tenant|Critical|smoke-test tenant before launch|||
|QA overload in Sprints<br>9-10|Operational|High|QA starts in Sprint 0|||
|Scope creep|Delivery|Critical|locked artifact compliance gate|||



49 

## **23. Build Timeline** 

## **Phase 0** 

Sprints: 

- Sprint 0; • Sprint 1; • Sprint 2. 

Milestones: 

- repository ready; • CI ready; • RLS ready; • tenant resolution ready; • auth/membership ready; • permission/entitlement ready; 

- audit/outbox ready; • provisioning/branding/storage ready. 

Critical path: 

```
DB/RLS → tenant resolution → auth/membership → can()/entitlement → audit/
outbox
```

## **Phase 1A** 

Sprints: 

- Sprint 3; • Sprint 4; • Sprint 5. 

Milestones: 

- course loop; 

- lesson/progress; 

- workflow; 

- item registry; 

- assessment; 

- grading; 

- learning paths; 

- competency; 

- readiness foundation; 

- certificates foundation. 

Critical path: 

50 

```
Learning → Assessment → Competency → Readiness
```

## **Phase 1B** 

Sprints: 

- Sprint 6; • Sprint 7; • Sprint 8; • Sprint 9; • Sprint 10. 

Milestones: 

- diagnostic; • swipe; • gamification; • notifications; • automation/locales; • community; • moderation; • search; • analytics; • admin/platform consoles; • data rights; • FundedBeyond launch config; • second tenant validation; • production readiness. 

Critical path: 

```
Diagnostic/Swipe → Engagement → Community/Analytics → Consoles → Release
```

## **24. Development Team Responsibilities** 

## **24.1 Frontend Engineer** 

Owns: 

- App Router pages; 

- shells; 

- design-system implementation; 

- screen composition; 

- forms; • tables; 

- runners; 

51 

- loading/empty/error/denied states; 

- accessibility; 

- frontend tests; 

- E2E assistance. 

Phase focus: 

- Phase 0: shells and auth UI. • Phase 1A: learner/instructor core. • Phase 1B: community/admin/platform polish and app-layer screens. 

## **24.2 Backend Engineer** 

Owns: 

- database access boundary; 

- route wrappers; 

- services; 

- repositories; 

- authorization integration; 

- audit/outbox; 

- workers; 

- API integration tests; 

- tenant isolation. 

Phase focus: 

- Phase 0: DB/RLS/authz. • Phase 1A: learning/assessment/scoring. • Phase 1B: diagnostic/swipe/community/analytics/workers. 

## **24.3 Full Stack Engineer** 

Owns: 

- feature integration; 

- server loaders; 

- Server Actions wrappers; 

- API client integration; 

- workflow-heavy surfaces; 

- E2E-critical paths; 

- bug fixing across frontend/backend. 

Phase focus: 

- Phase 0: bootstrap support. • Phase 1A: core learning loop. • Phase 1B: launch journeys. 

52 

## **24.4 QA Engineer** 

Owns: 

- test matrix; 

- IDOR tests; 

- authorization tests; 

- E2E journeys; 

- regression testing; 

- release validation; 

- bug triage. 

Phase focus: 

- Starts tenant/security matrix in Sprint 0. • Peaks during Sprints 9-10. 

## **24.5 DevOps Engineer** 

Owns: 

- GitHub Actions; • Vercel; • Cloudflare; • Supabase; • Postgres operations; • R2; • monitoring; • backups; • runbooks; • release/rollback. 

Phase focus: 

- Phase 0 infrastructure. 

- Phase 1 deployment hardening. 

- Launch readiness. 

## **24.6 CTO** 

Owns: 

- scope control; 

- architecture compliance; 

- security gates; 

- production approval; 

- release go/no-go; 

- exception review. 

53 

## **25. Final Validation** 

## **25.1 PRD Compliance** 

PASS — This build plan implements only Atlas LMS Phase 0 + Phase 1A + Phase 1B and FundedBeyond Academy Tenant #1 behavior already approved. 

## **25.2 Database Compliance** 

PASS — Uses only approved P0/P1 database tables and enforces RLS, transaction-local tenant context, append-only audit/event patterns, idempotency, indexes, and seed discipline. 

## **25.3 API Compliance** 

PASS — Uses only approved `/api/v1/**` , `/api/v1/public/**` , `/api/v1/platform/**` , and approved internal outbox surfaces. No new APIs are introduced. 

## **25.4 Permission Compliance** 

PASS — Preserves default deny, ACTIVE membership gate, entitlement before permission, `can()` as only authorization decision point, ownership/relationship inside `can()` , and platform scope isolation. 

## **25.5 Screen Compliance** 

PASS — Implements only approved screen families: 

- A1-A10; 

- L1-L25; 

- I1-I13; 

- M1-M4; • T1-T24; 

- S1; • P1-P8. 

No new screens are introduced. 

## **25.6 Technical Architecture Compliance** 

PASS — Preserves monorepo, bounded contexts, service/repository separation, API-first design, Zod validation, request IDs, observability, audit/outbox, and CI enforcement. 

## **25.7 Frontend Architecture Compliance** 

PASS — Preserves server-first rendering, gate-before-render, approved route groups, design-system components, permission display hints only, and no FundedBeyond frontend fork. 

54 

## **25.8 Backend Architecture Compliance** 

PASS — Preserves route metadata, request lifecycle, `withTenantTx` , `withPlatformScope` , service modules, repositories, audit, outbox, workers, and approved API-only implementation. 

## **25.9 DevOps Architecture Compliance** 

PASS — Preserves Vercel, Cloudflare, PostgreSQL, Supabase Auth, R2, Sentry, PostHog, Better Stack, CI/ CD gates, backups, rollback, and runbooks. 

## **25.10 Build Readiness Assessment** 

Atlas LMS is ready for implementation if and only if: 

1. Sprint 0 isolation gates are treated as non-negotiable. 

2. Cursor and Claude Code are constrained to locked artifacts. 

3. CI blocks forbidden patterns. 

4. QA starts from Sprint 0. 

- FundedBeyond remains Tenant #1 configuration only. 

5. 

6. Second-tenant smoke test is required before launch. 

## **25.11 CTO Approval Verdict** 

## **Verdict: APPROVED FOR CURSOR / CLAUDE CODE / ENGINEERING EXECUTION — CONDITIONAL.** 

Approval conditions: 

1. No Phase 1 feature work before Phase 0 isolation gates pass. 

- No PR may add unapproved API, screen, permission, table, workflow, or entity. 

2. 

3. Every protected route must declare metadata. 

4. Every tenant DB access must use `withTenantTx()` . 

5. Every sensitive mutation must write same-transaction audit. 

- Every side effect must use outbox. 

6. 

7. Every protected UI must gate before render. 

- Every FundedBeyond behavior must be configuration, not code fork. 

8. 

9. Legal review must approve readiness/CTA copy before public launch. 

10. Second-tenant smoke test must pass before production launch. 

Final position: 

Atlas LMS can now move from architecture to implementation. Cursor, Claude Code, GitHub Copilot, frontend engineers, backend engineers, QA, and DevOps must follow this build plan exactly. 

55 

