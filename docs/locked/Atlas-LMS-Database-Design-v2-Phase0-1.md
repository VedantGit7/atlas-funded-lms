# Atlas LMS — Database Design v2
## Phase 0 + Phase 1 Physical Implementation Design

**Role:** Principal SaaS Architect · Principal Database Architect · Principal Security Architect · CTO  
**Stack target:** PostgreSQL + Prisma + Supabase Auth + Vercel/serverless + transaction-mode pooling + Redis/Upstash + worker/queue tier  
**Status:** Implementation-ready design, conditional approval  
**Scope:** Phase 0 foundation and Phase 1 FundedBeyond Academy MVP on generic Atlas engines only

---

## 0. CTO Summary

Database Architecture v1 is architecturally sound, but it deliberately stopped before Prisma schema, physical DDL, RLS SQL, migrations, and CI enforcement. This Database Design v2 is the implementation bridge.

The design below does **not** redesign Atlas. It converts the approved architecture into a concrete Phase 0 + Phase 1 schema plan with explicit table ownership, Prisma models, raw PostgreSQL requirements, RLS design, transaction-local tenant context, append-only rules, indexes, idempotency constraints, seed data, migration order, and isolation test gates.

**Brutal CTO position:**

- Phase 0 is not a feature phase. It is an isolation-correctness phase.
- Phase 1 must not blindly ship all 40 engines.
- FundedBeyond Diagnostic, Readiness, and Swipe must not create platform forks.
- The Assessment Item-Type Registry and Competency & Scoring Engine are first-party generic Atlas Phase 1 capabilities.
- Commerce checkout, live learning, marketplace, AI, L2/L3 proctoring, mobile white-label builds, full plugin sandbox, and inbound challenge conversion events are deferred.
- Any query path that depends on session-level `SET app.tenant_id` is unsafe and must fail review.

---

## 1. Final Phase 0 + Phase 1 Table Inventory

Legend:

- **GLOBAL:** no `tenant_id`, platform-owned.
- **TENANT:** must carry `tenant_id`, must have RLS.
- **APPEND:** insert-only; carries `tenant_id` if tenant-related; no update/delete.
- **DERIVED:** rebuildable projection/read model.
- **P0:** Phase 0.
- **P1:** Phase 1.

### 1.1 Included tables

| Phase | Context | Table | Scope | Owner | Why included |
|---|---|---|---|---|---|
| P0 | PC-1 Tenancy & Provisioning | `tenants` | GLOBAL | Tenancy | Root tenant aggregate. |
| P0 | PC-1 | `tenant_domains` | TENANT | Tenancy | Host → tenant resolution. |
| P0/P1 | PC-4 Branding/Config | `tenant_branding` | TENANT | Config/Branding | Tenant white-label identity. |
| P0/P1 | PC-4 | `tenant_theme` | TENANT | Config/Branding | Runtime design tokens. |
| P0 | PC-4 | `tenant_config` | TENANT | Config | Versioned tenant runtime configuration. |
| P1 | PC-4 | `tenant_branding_version` | APPEND | Config/Branding | Branding history/auditability. |
| P1 | PC-4 | `tenant_theme_version` | APPEND | Config/Branding | Theme history/auditability. |
| P0 | PC-4 | `tenant_config_version` | APPEND | Config | Config history/auditability. |
| P0/P1 | PC-1 | `provisioning_jobs` | TENANT | Provisioning | Idempotent tenant setup. |
| P0 | PC-2 Identity | `auth_principals` | GLOBAL | Identity | Supabase Auth bridge. |
| P0 | PC-2 | `memberships` | TENANT | Identity | Load-bearing tenant membership gate. |
| P0/P1 | PC-2 | `member_profiles` | TENANT | Identity | Per-tenant profile/privacy boundary. |
| P0 | PC-3 Access | `permissions` | GLOBAL | Access | Permission catalogue. |
| P0 | PC-3 | `permission_bundles` | GLOBAL | Access | Built-in permission bundles. |
| P0 | PC-3 | `roles` | TENANT | Access | Tenant roles. |
| P0 | PC-3 | `role_permissions` | TENANT | Access | Role-permission mapping. |
| P0 | PC-3 | `user_roles` | TENANT | Access | Membership-role assignment. |
| P0 | PC-3 | `permission_overrides` | TENANT | Access | Explicit grants/denies. |
| P0 | PC-4 Config | `feature_flags` | GLOBAL | Config | Global flag catalogue/defaults. |
| P0 | PC-4 | `feature_flag_overrides` | TENANT | Config | Tenant flag overrides. |
| P0 | PC-4 | `entitlements` | TENANT | Config | Central entitlement enforcement source. |
| P0 | PC-4 | `entitlement_grant_history` | APPEND | Config | Audited entitlement history. |
| P0 | PC-14 Eventing | `outbox_events` | APPEND | Eventing | Canonical event pipeline. |
| P0 | PC-14 | `event_deliveries` | APPEND/DERIVED | Eventing | Delivery attempts/state. |
| P0 | PC-14 | `dead_letter_events` | APPEND | Eventing | Failed event handling. |
| P1 | PC-14 Notification | `notification_templates` | TENANT | Eventing/Notification | Email/in-app template config. |
| P1 | PC-14 Notification | `notification_dispatches` | APPEND | Eventing/Notification | Idempotent sends. |
| P1 | PC-14 Search | `search_index_entries` | TENANT/DERIVED | Eventing/Search | Tenant-scoped search index. |
| P0 | PC-16 Audit | `audit_entries` | APPEND | Audit | Tamper-evident audit log. |
| P0 | PC-16 | `secret_refs` | TENANT | Audit/Compliance | Reference-only secrets, no plaintext. |
| P1 | PC-16 | `export_jobs` | TENANT | Audit/Compliance | Tenant data export. |
| P1 | PC-16 | `deletion_requests` | TENANT | Audit/Compliance | GDPR/delete workflow. |
| P1 | PC-5 Learning | `courses` | TENANT | Learning | Course root. |
| P1 | PC-5 | `course_modules` | TENANT | Learning | Course sections. |
| P1 | PC-5 | `lessons` | TENANT | Learning | Lesson content. |
| P1 | PC-5 | `lesson_assets` | TENANT | Learning | R2/video/provider references. |
| P1 | PC-5 | `enrollments` | TENANT | Learning | Learner enrollment. |
| P1 | PC-5 | `lesson_progress` | TENANT | Learning | Progress tracking. |
| P1 | PC-5 | `learning_paths` | TENANT | Learning | Roadmaps/programs. |
| P1 | PC-5 | `path_steps` | TENANT | Learning | Path structure. |
| P1 | PC-5 | `path_step_gates` | TENANT | Learning | Generic stage gates. |
| P1 | PC-5 | `path_enrollments` | TENANT | Learning | User path enrollment. |
| P1 | PC-5 | `path_step_progress` | TENANT | Learning | Path progress. |
| P1 | PC-6 Assessment | `item_types` | GLOBAL | Assessment | Pluggable item-type registry. |
| P1 | PC-6 | `items` | TENANT | Assessment | Question/card bank. |
| P1 | PC-6 | `item_options` | TENANT | Assessment | Options/answers. |
| P1 | PC-6 | `item_dimension_weights` | TENANT | Assessment | Generic dimension tagging. |
| P1 | PC-6 | `item_collections` | TENANT | Assessment | Decks/quizzes/practice sets. |
| P1 | PC-6 | `item_collection_items` | TENANT | Assessment | Collection composition. |
| P1 | PC-6 | `assessments` | TENANT | Assessment | Quizzes/exams/diagnostics. |
| P1 | PC-6 | `assessment_items` | TENANT | Assessment | Assessment composition. |
| P1 | PC-6 | `attempts` | TENANT | Assessment | Attempt header/state. |
| P1 | PC-6 | `attempt_answers` | APPEND | Assessment | Attempt responses. |
| P1 | PC-6 | `grading_tasks` | TENANT | Assessment | Subjective/manual grading. |
| P1 | PC-6 | `practice_sessions` | TENANT | Assessment | Swipe/practice session header. |
| P1 | PC-6 | `practice_responses` | APPEND | Assessment | Swipe/practice responses. |
| P1 | PC-6 | `srs_state` | TENANT | Assessment | Spaced repetition state. |
| P1 | PC-7 Competency | `competency_dimensions` | TENANT | Scoring | TA/PSY/RISK/DISC/CR and generic dimensions. |
| P1 | PC-7 | `scoring_profiles` | TENANT | Scoring | Scoring profile root. |
| P1 | PC-7 | `scoring_config_versions` | APPEND | Scoring | Versioned scoring rules. |
| P1 | PC-7 | `competency_bands` | TENANT | Scoring | Band thresholds/labels. |
| P1 | PC-7 | `signal_sources` | TENANT | Scoring | Allowed signal-source catalogue. |
| P1 | PC-7 | `competency_signals` | APPEND | Scoring | Demonstrated signal store. |
| P1 | PC-7 | `competency_scores` | TENANT/DERIVED | Scoring | Current score projection. |
| P1 | PC-7 | `composite_readiness_state` | TENANT/DERIVED | Scoring | Generic composite output. |
| P1 | PC-7 | `competency_score_snapshots` | APPEND | Scoring | Trajectory snapshots. |
| P1 | PC-8 Credentialing | `certificate_templates` | TENANT | Credentialing | Certificate template config. |
| P1 | PC-8 | `certificates` | TENANT | Credentialing | Issued credential. |
| P1 | PC-8 | `credential_verifications` | APPEND | Credentialing | Public verification events. |
| P1 | PC-9 Engagement | `gamification_profiles` | TENANT | Engagement | Per-membership XP profile. |
| P1 | PC-9 | `point_ledger` | APPEND | Engagement | XP/points ledger. |
| P1 | PC-9 | `badges` | TENANT | Engagement | Badge definitions. |
| P1 | PC-9 | `badge_awards` | TENANT | Engagement | Badge grants. |
| P1 | PC-9 | `streak_states` | TENANT | Engagement | Current streak. |
| P1 | PC-9 | `streak_freezes` | TENANT | Engagement | Freeze inventory/usage. |
| P1 | PC-9 | `leaderboard_definitions` | TENANT | Engagement | Leaderboard config. |
| P1 | PC-9 | `leaderboard_snapshots` | TENANT/DERIVED | Engagement | Read-optimized snapshots. |
| P1 | PC-10 Integrity | `exam_security_policies` | TENANT | Integrity | L1 security policy. |
| P1 | PC-10 | `proctoring_sessions` | TENANT | Integrity | L1 session root. |
| P1 | PC-10 | `proctoring_events` | APPEND | Integrity | L1 tab/blur/fullscreen events. |
| P1 | PC-10 | `proctoring_reports` | TENANT/DERIVED | Integrity | L1 report summary. |
| P1 | PC-11 Community | `community_spaces` | TENANT | Community | Spaces/groups. |
| P1 | PC-11 | `group_memberships` | TENANT | Community | Space membership. |
| P1 | PC-11 | `posts` | TENANT | Community | Posts. |
| P1 | PC-11 | `comments` | TENANT | Community | Comments. |
| P1 | PC-11 | `reactions` | TENANT | Community | Reactions. |
| P1 | PC-11 | `mentions` | TENANT | Community | Mentions. |
| P1 | PC-11 | `moderation_cases` | TENANT | Moderation | Moderation queue. |
| P1 | PC-11 | `moderation_decisions` | APPEND | Moderation | Decision history. |
| P1 | PC-11 | `appeals` | TENANT | Moderation | Appeals. |
| P1 | PC-15 Analytics | `analytics_rollups` | TENANT/DERIVED | Analytics | Generic rollups. |
| P1 | PC-15 | `funnel_daily_rollups` | TENANT/DERIVED | Analytics | Funnel daily metrics. |
| P1 | PC-15 | `item_statistics` | TENANT/DERIVED | Analytics | Assessment item statistics. |
| P1 | PC-15 | `materialized_view_registry` | GLOBAL | Analytics | MV refresh registry. |
| P1 | PC-17 Orchestration | `automation_rules` | TENANT | Orchestration | Event-driven rules. |
| P1 | PC-17 | `automation_runs` | APPEND | Orchestration | Idempotent rule runs. |
| P1 | PC-17 | `workflow_definitions` | TENANT | Orchestration | Review/publish workflows. |
| P1 | PC-17 | `workflow_transitions` | APPEND | Orchestration | Human approvals/audit trail. |
| P1 | PC-17 | `locale_resources` | TENANT | Orchestration | Locale strings/settings. |
| P1 | PC-18 Extensibility | `extension_points` | GLOBAL | Extensibility | First-party extension points. |
| P1 | PC-18 | `extension_registrations` | TENANT | Extensibility | Tenant/first-party registration. |
| P1 | FB-1 Diagnostic | `diagnostic_sessions` | TENANT | FB app layer | Anonymous→identified diagnostic session. |
| P1 | FB-2 Readiness | `readiness_policies` | TENANT | FB app layer | Thin readiness CTA policy config. |
| P1 | FB-5 Attribution | `attribution_tokens` | TENANT | FB app layer | Outbound attributed CTA tokens. |

---

## 2. Tables Explicitly Excluded from Phase 0 + Phase 1

These are **not deleted from the product vision**. They are deferred to prevent overengineering and avoid building risk-heavy systems before they are needed.

| Deferred capability/table family | Earliest phase | Reason |
|---|---:|---|
| `products`, `orders`, `payments`, `refunds`, `subscriptions`, `subscription_mandates`, `coupons`, `coupon_redemptions`, `tax_rules`, `invoices`, `revenue_ledger`, `billing_reconciliation`, full SaaS billing ledger | P2 | FundedBeyond Academy v1 does not sell challenges or process challenge payments. Entitlements exist in P0/P1; commerce depth can wait. |
| `payment_provider_accounts` | P2 unless tenant monetization is pulled forward | Secrets and provider onboarding create compliance and operational surface area. Not required for the outbound-CTA Academy MVP. |
| `integration_endpoints`, `inbound_webhook_receipts`, full inbound `challenge.*` handshake | P2 | P1 only needs outbound attributed CTA. Inbound purchase/pass/funded reconciliation is Phase 2. |
| `inbound_conversion_events`, `conversion_attributions` | P2 | Requires signed inbound integration and identity resolution window. Not P1-critical. |
| `live_sessions`, `webinars`, `webinar_registrations`, `events`, `event_registrations` | P2/P3 | Not part of the P1 diagnostic→practice→assessment→readiness loop. |
| Proctoring L2/L3 media/biometric tables | P3 | Legal/biometric risk. P1 ships L1 deterministic event logging only. |
| White-label mobile build tables / push credential tables | P3 | Dedicated app builds and push credentials should not block P1. |
| Plugin marketplace tables: `plugins`, `plugin_installs`, `marketplace_listings`, seller/payout tables | P4 | Full third-party plugin sandbox is not needed. Only first-party extension points ship now. |
| `ai_generations`, AI provider tables, AI review artifacts | P4 | AI must be human-gated and can wait until workflow is mature. |
| Multi-region routing / dedicated-tenant physical isolation tables | P5 | Shared DB is acceptable for early scale if instrumented and tested. |

---

## 3. Bounded Context Ownership Rules

1. Each table has exactly one authoritative writer: the owning context above.
2. Cross-context reads go through service interfaces or events, not direct SQL imports.
3. Cross-context hard FKs are allowed only inside the same bounded context or for foundational references (`tenant_id`, `membership_id`) where the coupling is intentional.
4. Application code must not import Prisma model helpers from another context’s repository folder.
5. FundedBeyond tables are **app-layer state**, not platform forks. `diagnostic_sessions`, `readiness_policies`, and `attribution_tokens` can exist because they do not alter the generic Atlas engines.

Unsafe and rejected:

- `learning` code reading `assessment.attempts` directly for scoring.
- `assessment` code writing `competency_scores` directly instead of emitting signals.
- `fb_app` code adding FundedBeyond-specific columns to generic platform tables.
- Raw SQL joins across contexts in request handlers except approved read models/materialized views.

---

## 4. Prisma Schema Design

### 4.1 Prisma implementation posture

Prisma is used for table/column definitions and normal CRUD. Prisma is **not** used as the source of truth for:

- RLS policies.
- RLS grants.
- Partial indexes.
- Partitioning.
- Hash-chain audit triggers.
- Append-only enforcement triggers.
- `set_config()` transaction-local tenant context.
- Advanced constraints using expressions.

Those are implemented through versioned raw SQL migrations committed beside Prisma migrations.

### 4.2 Prisma schema conventions

- UUIDs are application-generated UUIDv7 strings.
- Snake_case Prisma fields are used intentionally to mirror DB columns and avoid mapping noise.
- Tenant-scoped tables carry `tenant_id`.
- Append-only tables use `occurred_at`, `recorded_at`, `dispatched_at`, or equivalent instead of `updated_at`/`deleted_at`.
- JSONB fields must be validated with Zod at the application boundary.
- Money fields are `BigInt` minor units + ISO currency. P0/P1 avoids money except future-safe placeholders.

### 4.3 Prisma schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum TenantState { PROVISIONING ACTIVE SUSPENDED ARCHIVED DELETED }
enum DomainStatus { PENDING ACTIVE FAILED DISABLED }
enum MembershipStatus { INVITED ACTIVE SUSPENDED REMOVED }
enum PublishStatus { DRAFT REVIEW PUBLISHED ARCHIVED }
enum AttemptStatus { STARTED SUBMITTED GRADED ABANDONED VOIDED }
enum DispatchStatus { QUEUED SENT FAILED CANCELLED }
enum JobStatus { QUEUED RUNNING SUCCEEDED FAILED CANCELLED }
enum Severity { INFO LOW MEDIUM HIGH CRITICAL }
enum Visibility { PRIVATE TENANT PUBLIC UNLISTED }
enum ModerationStatus { OPEN REVIEWING ACTIONED REJECTED CLOSED }
enum EntityStatus { ACTIVE INACTIVE ARCHIVED }

model Tenant {
  id                     String      @id @db.Uuid
  slug                   String      @unique
  legal_name             String?
  display_name           String
  state                  TenantState @default(PROVISIONING)
  default_locale         String      @default("en")
  default_timezone       String      @default("UTC")
  statement_timeout_ms   Int         @default(5000)
  query_budget_json      Json?
  created_at             DateTime    @default(now()) @db.Timestamptz(6)
  updated_at             DateTime    @updatedAt @db.Timestamptz(6)
  deleted_at             DateTime?   @db.Timestamptz(6)

  @@map("tenants")
}

model TenantDomain {
  id                String       @id @db.Uuid
  tenant_id         String       @db.Uuid
  hostname          String       @unique
  type              String       // atlas_subdomain | custom_domain
  status            DomainStatus @default(PENDING)
  is_primary        Boolean      @default(false)
  verification_json Json?
  created_at        DateTime     @default(now()) @db.Timestamptz(6)
  updated_at        DateTime     @updatedAt @db.Timestamptz(6)
  deleted_at        DateTime?    @db.Timestamptz(6)

  @@index([tenant_id, status])
  @@map("tenant_domains")
}

model TenantBranding {
  id                 String   @id @db.Uuid
  tenant_id          String   @unique @db.Uuid
  display_name       String
  logo_light_key     String?
  logo_dark_key      String?
  favicon_key        String?
  support_email      String?
  social_links_json  Json?
  legal_footer_text  String?
  current_version_id String?  @db.Uuid
  created_at         DateTime @default(now()) @db.Timestamptz(6)
  updated_at         DateTime @updatedAt @db.Timestamptz(6)

  @@map("tenant_branding")
}

model TenantTheme {
  id                  String   @id @db.Uuid
  tenant_id           String   @unique @db.Uuid
  primary_color       String
  secondary_color     String?
  accent_color        String?
  font_family         String?
  token_json          Json
  current_version_id  String?  @db.Uuid
  created_at          DateTime @default(now()) @db.Timestamptz(6)
  updated_at          DateTime @updatedAt @db.Timestamptz(6)

  @@map("tenant_theme")
}

model TenantConfig {
  id                  String   @id @db.Uuid
  tenant_id           String   @unique @db.Uuid
  config_json         Json
  current_version_id  String?  @db.Uuid
  created_at          DateTime @default(now()) @db.Timestamptz(6)
  updated_at          DateTime @updatedAt @db.Timestamptz(6)

  @@map("tenant_config")
}

model TenantBrandingVersion {
  id           String   @id @db.Uuid
  tenant_id    String   @db.Uuid
  version      Int
  snapshot_json Json
  created_by_membership_id String? @db.Uuid
  created_at   DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, version])
  @@index([tenant_id, created_at])
  @@map("tenant_branding_version")
}

model TenantThemeVersion {
  id           String   @id @db.Uuid
  tenant_id    String   @db.Uuid
  version      Int
  snapshot_json Json
  created_by_membership_id String? @db.Uuid
  created_at   DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, version])
  @@index([tenant_id, created_at])
  @@map("tenant_theme_version")
}

model TenantConfigVersion {
  id           String   @id @db.Uuid
  tenant_id    String   @db.Uuid
  version      Int
  snapshot_json Json
  created_by_membership_id String? @db.Uuid
  created_at   DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, version])
  @@index([tenant_id, created_at])
  @@map("tenant_config_version")
}

model ProvisioningJob {
  id              String    @id @db.Uuid
  tenant_id       String    @db.Uuid
  idempotency_key String
  status          JobStatus @default(QUEUED)
  step_key        String?
  request_json    Json
  result_json     Json?
  error_json      Json?
  created_at      DateTime  @default(now()) @db.Timestamptz(6)
  updated_at      DateTime  @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, idempotency_key])
  @@index([tenant_id, status, created_at])
  @@map("provisioning_jobs")
}

model AuthPrincipal {
  id                String   @id @db.Uuid
  supabase_user_id  String   @unique @db.Uuid
  email             String   @unique
  email_normalized  String   @unique
  global_status     String   @default("active")
  mfa_enabled       Boolean  @default(false)
  last_login_at     DateTime? @db.Timestamptz(6)
  created_at        DateTime @default(now()) @db.Timestamptz(6)
  updated_at        DateTime @updatedAt @db.Timestamptz(6)

  @@map("auth_principals")
}

model Membership {
  id                String           @id @db.Uuid
  tenant_id         String           @db.Uuid
  auth_principal_id String           @db.Uuid
  status            MembershipStatus @default(INVITED)
  joined_at         DateTime?        @db.Timestamptz(6)
  suspended_at      DateTime?        @db.Timestamptz(6)
  removed_at        DateTime?        @db.Timestamptz(6)
  created_at        DateTime         @default(now()) @db.Timestamptz(6)
  updated_at        DateTime         @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, auth_principal_id])
  @@index([tenant_id, status])
  @@index([auth_principal_id])
  @@map("memberships")
}

model MemberProfile {
  id             String   @id @db.Uuid
  tenant_id      String   @db.Uuid
  membership_id  String   @unique @db.Uuid
  display_name   String?
  avatar_key     String?
  bio            String?
  metadata_json  Json?
  created_at     DateTime @default(now()) @db.Timestamptz(6)
  updated_at     DateTime @updatedAt @db.Timestamptz(6)
  deleted_at     DateTime? @db.Timestamptz(6)

  @@index([tenant_id, display_name])
  @@map("member_profiles")
}

model Permission {
  id          String   @id @db.Uuid
  key         String   @unique
  description String?
  created_at  DateTime @default(now()) @db.Timestamptz(6)

  @@map("permissions")
}

model PermissionBundle {
  id          String   @id @db.Uuid
  key         String   @unique
  name        String
  permissions Json
  created_at  DateTime @default(now()) @db.Timestamptz(6)

  @@map("permission_bundles")
}

model Role {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  key         String
  name        String
  is_system   Boolean  @default(false)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)
  deleted_at  DateTime? @db.Timestamptz(6)

  @@index([tenant_id, key])
  @@map("roles")
}

model RolePermission {
  id             String   @id @db.Uuid
  tenant_id      String   @db.Uuid
  role_id        String   @db.Uuid
  permission_key String
  created_at     DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, role_id, permission_key])
  @@index([tenant_id, permission_key])
  @@map("role_permissions")
}

model UserRole {
  id             String   @id @db.Uuid
  tenant_id      String   @db.Uuid
  membership_id  String   @db.Uuid
  role_id        String   @db.Uuid
  assigned_by_membership_id String? @db.Uuid
  created_at     DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, membership_id, role_id])
  @@index([tenant_id, role_id])
  @@map("user_roles")
}

model PermissionOverride {
  id             String   @id @db.Uuid
  tenant_id      String   @db.Uuid
  membership_id  String   @db.Uuid
  permission_key String
  effect         String   // allow | deny
  reason         String?
  expires_at     DateTime? @db.Timestamptz(6)
  created_at     DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, membership_id, permission_key])
  @@index([tenant_id, permission_key, effect])
  @@map("permission_overrides")
}

model FeatureFlag {
  id            String   @id @db.Uuid
  key           String   @unique
  default_value Json
  description   String?
  created_at    DateTime @default(now()) @db.Timestamptz(6)
  updated_at    DateTime @updatedAt @db.Timestamptz(6)

  @@map("feature_flags")
}

model FeatureFlagOverride {
  id              String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  feature_flag_id String   @db.Uuid
  value_json      Json
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, feature_flag_id])
  @@map("feature_flag_overrides")
}

model Entitlement {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  key         String
  value_json  Json
  source      String   // plan | manual | promotion | system
  starts_at   DateTime @default(now()) @db.Timestamptz(6)
  expires_at  DateTime? @db.Timestamptz(6)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, key])
  @@index([tenant_id, key, expires_at])
  @@map("entitlements")
}

model EntitlementGrantHistory {
  id             String   @id @db.Uuid
  tenant_id      String   @db.Uuid
  entitlement_key String
  old_value_json Json?
  new_value_json Json
  changed_by_membership_id String? @db.Uuid
  reason         String?
  occurred_at    DateTime @default(now()) @db.Timestamptz(6)

  @@index([tenant_id, entitlement_key, occurred_at])
  @@map("entitlement_grant_history")
}

model OutboxEvent {
  id              String   @id @db.Uuid
  tenant_id        String?  @db.Uuid
  event_type       String
  aggregate_type   String
  aggregate_id     String
  idempotency_key  String?
  payload_json     Json
  metadata_json    Json?
  occurred_at      DateTime @default(now()) @db.Timestamptz(6)
  available_at     DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, idempotency_key])
  @@index([tenant_id, event_type, occurred_at])
  @@index([available_at])
  @@map("outbox_events")
}

model EventDelivery {
  id               String   @id @db.Uuid
  tenant_id         String?  @db.Uuid
  outbox_event_id   String   @db.Uuid
  destination_key   String
  status            DispatchStatus @default(QUEUED)
  attempt_count     Int      @default(0)
  last_attempt_at   DateTime? @db.Timestamptz(6)
  next_attempt_at   DateTime? @db.Timestamptz(6)
  response_json     Json?
  created_at        DateTime @default(now()) @db.Timestamptz(6)

  @@unique([outbox_event_id, destination_key])
  @@index([tenant_id, status, next_attempt_at])
  @@map("event_deliveries")
}

model DeadLetterEvent {
  id               String   @id @db.Uuid
  tenant_id         String?  @db.Uuid
  outbox_event_id   String   @db.Uuid
  destination_key   String?
  error_json        Json
  failed_at         DateTime @default(now()) @db.Timestamptz(6)

  @@index([tenant_id, failed_at])
  @@map("dead_letter_events")
}

model NotificationTemplate {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  key         String
  channel     String   // email | in_app
  locale      String   @default("en")
  subject     String?
  body        String
  variables_json Json?
  status      EntityStatus @default(ACTIVE)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, key, channel, locale])
  @@map("notification_templates")
}

model NotificationDispatch {
  id              String   @id @db.Uuid
  tenant_id        String   @db.Uuid
  membership_id    String?  @db.Uuid
  channel          String
  template_key     String?
  destination      String?
  idempotency_key  String
  status           DispatchStatus @default(QUEUED)
  payload_json     Json
  error_json       Json?
  created_at       DateTime @default(now()) @db.Timestamptz(6)
  sent_at          DateTime? @db.Timestamptz(6)

  @@unique([tenant_id, idempotency_key])
  @@index([tenant_id, membership_id, created_at])
  @@index([tenant_id, status, created_at])
  @@map("notification_dispatches")
}

model SearchIndexEntry {
  id              String   @id @db.Uuid
  tenant_id        String   @db.Uuid
  source_context   String
  source_type      String
  source_id        String   @db.Uuid
  title            String
  body             String?
  visibility       Visibility @default(TENANT)
  access_json      Json?
  vector_ref       String?
  updated_at       DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, source_context, source_type, source_id])
  @@index([tenant_id, source_type])
  @@map("search_index_entries")
}

model AuditEntry {
  id                String   @id @db.Uuid
  tenant_id          String?  @db.Uuid
  actor_membership_id String? @db.Uuid
  actor_principal_id String?  @db.Uuid
  action             String
  target_type        String
  target_id          String?
  request_id         String?
  ip_hash            String?
  user_agent_hash    String?
  before_json        Json?
  after_json         Json?
  metadata_json      Json?
  previous_hash      String?
  entry_hash         String
  occurred_at        DateTime @default(now()) @db.Timestamptz(6)

  @@index([tenant_id, occurred_at])
  @@index([tenant_id, action, occurred_at])
  @@map("audit_entries")
}

model SecretRef {
  id            String   @id @db.Uuid
  tenant_id      String   @db.Uuid
  key            String
  provider       String   // vault/kms provider
  external_ref   String
  purpose        String
  rotation_due_at DateTime? @db.Timestamptz(6)
  created_at     DateTime @default(now()) @db.Timestamptz(6)
  updated_at     DateTime @updatedAt @db.Timestamptz(6)
  deleted_at     DateTime? @db.Timestamptz(6)

  @@unique([tenant_id, key])
  @@map("secret_refs")
}

model ExportJob {
  id              String   @id @db.Uuid
  tenant_id        String   @db.Uuid
  requested_by_membership_id String @db.Uuid
  status           JobStatus @default(QUEUED)
  scope_json       Json
  r2_object_key    String?
  error_json       Json?
  expires_at       DateTime? @db.Timestamptz(6)
  created_at       DateTime @default(now()) @db.Timestamptz(6)
  updated_at       DateTime @updatedAt @db.Timestamptz(6)

  @@index([tenant_id, status, created_at])
  @@map("export_jobs")
}

model DeletionRequest {
  id              String   @id @db.Uuid
  tenant_id        String   @db.Uuid
  requested_by_membership_id String? @db.Uuid
  target_type      String
  target_id        String
  status           JobStatus @default(QUEUED)
  reason           String?
  scheduled_at     DateTime? @db.Timestamptz(6)
  completed_at     DateTime? @db.Timestamptz(6)
  created_at       DateTime @default(now()) @db.Timestamptz(6)
  updated_at       DateTime @updatedAt @db.Timestamptz(6)

  @@index([tenant_id, target_type, target_id])
  @@map("deletion_requests")
}

model Course {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  slug        String
  title       String
  description String?
  status      PublishStatus @default(DRAFT)
  metadata_json Json?
  created_by_membership_id String? @db.Uuid
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)
  deleted_at  DateTime? @db.Timestamptz(6)

  @@unique([tenant_id, slug])
  @@index([tenant_id, status, updated_at])
  @@map("courses")
}

model CourseModule {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  course_id   String   @db.Uuid
  title       String
  position    Int
  status      PublishStatus @default(DRAFT)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)
  deleted_at  DateTime? @db.Timestamptz(6)

  @@unique([tenant_id, course_id, position])
  @@index([tenant_id, course_id])
  @@map("course_modules")
}

model Lesson {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  module_id   String   @db.Uuid
  slug        String
  title       String
  content_json Json?
  video_provider String?
  video_url      String?
  duration_seconds Int?
  position    Int
  status      PublishStatus @default(DRAFT)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)
  deleted_at  DateTime? @db.Timestamptz(6)

  @@unique([tenant_id, module_id, position])
  @@index([tenant_id, slug])
  @@index([tenant_id, status])
  @@map("lessons")
}

model LessonAsset {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  lesson_id   String   @db.Uuid
  asset_type  String
  provider    String
  object_key_or_url String
  metadata_json Json?
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  deleted_at  DateTime? @db.Timestamptz(6)

  @@index([tenant_id, lesson_id])
  @@map("lesson_assets")
}

model Enrollment {
  id            String   @id @db.Uuid
  tenant_id      String   @db.Uuid
  course_id      String   @db.Uuid
  membership_id  String   @db.Uuid
  status         String   @default("active")
  enrolled_at    DateTime @default(now()) @db.Timestamptz(6)
  completed_at   DateTime? @db.Timestamptz(6)

  @@unique([tenant_id, course_id, membership_id])
  @@index([tenant_id, membership_id, status])
  @@map("enrollments")
}

model LessonProgress {
  id            String   @id @db.Uuid
  tenant_id      String   @db.Uuid
  lesson_id      String   @db.Uuid
  membership_id  String   @db.Uuid
  status         String   @default("not_started")
  progress_pct   Int      @default(0)
  last_seen_at   DateTime? @db.Timestamptz(6)
  completed_at   DateTime? @db.Timestamptz(6)
  updated_at     DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, lesson_id, membership_id])
  @@index([tenant_id, membership_id, updated_at])
  @@map("lesson_progress")
}

model LearningPath {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  slug        String
  title       String
  description String?
  status      PublishStatus @default(DRAFT)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)
  deleted_at  DateTime? @db.Timestamptz(6)

  @@unique([tenant_id, slug])
  @@index([tenant_id, status])
  @@map("learning_paths")
}

model PathStep {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  path_id     String   @db.Uuid
  step_type   String   // course | assessment | certificate | external
  ref_id      String?
  title       String
  position    Int
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, path_id, position])
  @@index([tenant_id, path_id])
  @@map("path_steps")
}

model PathStepGate {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  path_step_id String  @db.Uuid
  gate_type   String   // completion | score | competency_band | manual_approval
  config_json Json
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@index([tenant_id, path_step_id])
  @@map("path_step_gates")
}

model PathEnrollment {
  id            String   @id @db.Uuid
  tenant_id      String   @db.Uuid
  path_id        String   @db.Uuid
  membership_id  String   @db.Uuid
  status         String   @default("active")
  enrolled_at    DateTime @default(now()) @db.Timestamptz(6)
  completed_at   DateTime? @db.Timestamptz(6)

  @@unique([tenant_id, path_id, membership_id])
  @@index([tenant_id, membership_id, status])
  @@map("path_enrollments")
}

model PathStepProgress {
  id            String   @id @db.Uuid
  tenant_id      String   @db.Uuid
  path_step_id   String   @db.Uuid
  membership_id  String   @db.Uuid
  status         String   @default("locked")
  completed_at   DateTime? @db.Timestamptz(6)
  updated_at     DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, path_step_id, membership_id])
  @@index([tenant_id, membership_id, updated_at])
  @@map("path_step_progress")
}

model ItemType {
  id              String   @id @db.Uuid
  key             String   @unique
  name            String
  schema_json     Json
  grading_json    Json?
  renderer_key    String
  is_builtin      Boolean  @default(true)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @updatedAt @db.Timestamptz(6)

  @@map("item_types")
}

model Item {
  id              String   @id @db.Uuid
  tenant_id        String   @db.Uuid
  item_type_key    String
  stem_json        Json
  explanation_json Json?
  difficulty       Int?
  status           PublishStatus @default(DRAFT)
  tags             String[]
  created_by_membership_id String? @db.Uuid
  created_at       DateTime @default(now()) @db.Timestamptz(6)
  updated_at       DateTime @updatedAt @db.Timestamptz(6)
  deleted_at       DateTime? @db.Timestamptz(6)

  @@index([tenant_id, item_type_key, status])
  @@index([tenant_id, tags], type: Gin)
  @@map("items")
}

model ItemOption {
  id           String   @id @db.Uuid
  tenant_id    String   @db.Uuid
  item_id      String   @db.Uuid
  option_json  Json
  is_correct   Boolean?
  position     Int
  created_at   DateTime @default(now()) @db.Timestamptz(6)
  updated_at   DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, item_id, position])
  @@index([tenant_id, item_id])
  @@map("item_options")
}

model ItemDimensionWeight {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  item_id         String   @db.Uuid
  dimension_id    String   @db.Uuid
  weight          Decimal  @db.Decimal(8,4)
  created_at      DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, item_id, dimension_id])
  @@index([tenant_id, dimension_id])
  @@map("item_dimension_weights")
}

model ItemCollection {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  slug        String
  title       String
  collection_type String // deck | quiz_bank | practice_set
  status      PublishStatus @default(DRAFT)
  metadata_json Json?
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)
  deleted_at  DateTime? @db.Timestamptz(6)

  @@unique([tenant_id, slug])
  @@index([tenant_id, collection_type, status])
  @@map("item_collections")
}

model ItemCollectionItem {
  id            String   @id @db.Uuid
  tenant_id      String   @db.Uuid
  collection_id  String   @db.Uuid
  item_id        String   @db.Uuid
  position       Int
  weight         Decimal? @db.Decimal(8,4)
  created_at     DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, collection_id, item_id])
  @@unique([tenant_id, collection_id, position])
  @@map("item_collection_items")
}

model Assessment {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  slug        String
  title       String
  assessment_type String // quiz | exam | diagnostic | readiness_review
  status      PublishStatus @default(DRAFT)
  config_json Json
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)
  deleted_at  DateTime? @db.Timestamptz(6)

  @@unique([tenant_id, slug])
  @@index([tenant_id, assessment_type, status])
  @@map("assessments")
}

model AssessmentItem {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  assessment_id   String   @db.Uuid
  item_id         String   @db.Uuid
  position        Int
  points          Decimal  @db.Decimal(10,2)
  config_json     Json?
  created_at      DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, assessment_id, item_id])
  @@unique([tenant_id, assessment_id, position])
  @@map("assessment_items")
}

model Attempt {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  assessment_id   String   @db.Uuid
  membership_id   String   @db.Uuid
  status          AttemptStatus @default(STARTED)
  started_at      DateTime @default(now()) @db.Timestamptz(6)
  submitted_at    DateTime? @db.Timestamptz(6)
  graded_at       DateTime? @db.Timestamptz(6)
  score_pct       Decimal? @db.Decimal(8,4)
  metadata_json   Json?
  idempotency_key String?

  @@unique([tenant_id, idempotency_key])
  @@index([tenant_id, assessment_id, membership_id, started_at])
  @@index([tenant_id, membership_id, status])
  @@map("attempts")
}

model AttemptAnswer {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  attempt_id      String   @db.Uuid
  assessment_item_id String @db.Uuid
  answer_json     Json
  is_correct      Boolean?
  points_awarded  Decimal? @db.Decimal(10,2)
  occurred_at     DateTime @default(now()) @db.Timestamptz(6)
  idempotency_key String

  @@unique([tenant_id, idempotency_key])
  @@unique([tenant_id, attempt_id, assessment_item_id])
  @@index([tenant_id, attempt_id])
  @@map("attempt_answers")
}

model GradingTask {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  attempt_id      String   @db.Uuid
  assigned_to_membership_id String? @db.Uuid
  status          String   @default("open")
  rubric_json     Json?
  result_json     Json?
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @updatedAt @db.Timestamptz(6)

  @@index([tenant_id, status, created_at])
  @@index([tenant_id, assigned_to_membership_id, status])
  @@map("grading_tasks")
}

model PracticeSession {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  membership_id   String   @db.Uuid
  collection_id   String?  @db.Uuid
  session_type    String   // swipe | drill | review
  status          String   @default("started")
  started_at      DateTime @default(now()) @db.Timestamptz(6)
  completed_at    DateTime? @db.Timestamptz(6)
  summary_json    Json?
  idempotency_key String?

  @@unique([tenant_id, idempotency_key])
  @@index([tenant_id, membership_id, started_at])
  @@map("practice_sessions")
}

model PracticeResponse {
  id              String   @id @db.Uuid
  tenant_id        String   @db.Uuid
  practice_session_id String @db.Uuid
  membership_id    String   @db.Uuid
  item_id          String   @db.Uuid
  response_json    Json
  is_correct       Boolean?
  latency_ms       Int?
  occurred_at      DateTime @default(now()) @db.Timestamptz(6)
  idempotency_key  String

  @@unique([tenant_id, idempotency_key])
  @@index([tenant_id, membership_id, occurred_at])
  @@index([tenant_id, item_id, occurred_at])
  @@map("practice_responses")
}

model SrsState {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  membership_id   String   @db.Uuid
  item_id         String   @db.Uuid
  ease_factor     Decimal  @db.Decimal(8,4)
  interval_days   Int
  due_at          DateTime @db.Timestamptz(6)
  updated_at      DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, membership_id, item_id])
  @@index([tenant_id, membership_id, due_at])
  @@map("srs_state")
}

model CompetencyDimension {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  key         String
  name        String
  description String?
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, key])
  @@map("competency_dimensions")
}

model ScoringProfile {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  key         String
  name        String
  status      EntityStatus @default(ACTIVE)
  active_config_version_id String? @db.Uuid
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, key])
  @@map("scoring_profiles")
}

model ScoringConfigVersion {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  scoring_profile_id String @db.Uuid
  version     Int
  config_json Json
  activated_at DateTime? @db.Timestamptz(6)
  created_by_membership_id String? @db.Uuid
  created_at  DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, scoring_profile_id, version])
  @@index([tenant_id, scoring_profile_id, activated_at])
  @@map("scoring_config_versions")
}

model CompetencyBand {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  scoring_profile_id String @db.Uuid
  key         String
  label       String
  min_score   Decimal  @db.Decimal(8,4)
  max_score   Decimal  @db.Decimal(8,4)
  sort_order  Int
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, scoring_profile_id, key])
  @@map("competency_bands")
}

model SignalSource {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  key         String
  source_context String
  config_json Json?
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, key])
  @@map("signal_sources")
}

model CompetencySignal {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  membership_id   String   @db.Uuid
  dimension_id    String   @db.Uuid
  signal_source_key String
  source_event_id String?  @db.Uuid
  raw_score        Decimal @db.Decimal(10,4)
  weight           Decimal @db.Decimal(10,4)
  metadata_json    Json?
  occurred_at      DateTime @default(now()) @db.Timestamptz(6)
  idempotency_key  String

  @@unique([tenant_id, idempotency_key])
  @@index([tenant_id, membership_id, dimension_id, occurred_at])
  @@index([tenant_id, source_event_id])
  @@map("competency_signals")
}

model CompetencyScore {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  membership_id   String   @db.Uuid
  dimension_id    String   @db.Uuid
  scoring_profile_id String @db.Uuid
  score           Decimal  @db.Decimal(10,4)
  band_key        String?
  calculated_at   DateTime @default(now()) @db.Timestamptz(6)
  config_version_id String @db.Uuid

  @@unique([tenant_id, membership_id, dimension_id, scoring_profile_id])
  @@index([tenant_id, dimension_id, band_key])
  @@map("competency_scores")
}

model CompositeReadinessState {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  membership_id   String   @db.Uuid
  scoring_profile_id String @db.Uuid
  composite_key   String
  score           Decimal  @db.Decimal(10,4)
  band_key        String
  hard_gates_json Json?
  calculated_at   DateTime @default(now()) @db.Timestamptz(6)
  config_version_id String @db.Uuid

  @@unique([tenant_id, membership_id, scoring_profile_id, composite_key])
  @@index([tenant_id, composite_key, band_key])
  @@map("composite_readiness_state")
}

model CompetencyScoreSnapshot {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  membership_id   String   @db.Uuid
  scoring_profile_id String @db.Uuid
  snapshot_json   Json
  occurred_at     DateTime @default(now()) @db.Timestamptz(6)

  @@index([tenant_id, membership_id, occurred_at])
  @@map("competency_score_snapshots")
}

model CertificateTemplate {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  key         String
  name        String
  template_json Json
  status      PublishStatus @default(DRAFT)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)
  deleted_at  DateTime? @db.Timestamptz(6)

  @@unique([tenant_id, key])
  @@map("certificate_templates")
}

model Certificate {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  template_id     String   @db.Uuid
  membership_id   String   @db.Uuid
  credential_id   String   @unique
  status          String   @default("issued")
  issued_at       DateTime @default(now()) @db.Timestamptz(6)
  revoked_at      DateTime? @db.Timestamptz(6)
  r2_object_key   String?
  metadata_json   Json?

  @@index([tenant_id, membership_id, issued_at])
  @@index([tenant_id, template_id, status])
  @@map("certificates")
}

model CredentialVerification {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  certificate_id  String   @db.Uuid
  ip_hash         String?
  user_agent_hash String?
  occurred_at     DateTime @default(now()) @db.Timestamptz(6)

  @@index([tenant_id, certificate_id, occurred_at])
  @@map("credential_verifications")
}

model GamificationProfile {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  membership_id   String   @db.Uuid
  xp_total        Int      @default(0)
  level_key       String?
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, membership_id])
  @@index([tenant_id, xp_total])
  @@map("gamification_profiles")
}

model PointLedger {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  membership_id   String   @db.Uuid
  points          Int
  reason_key      String
  source_event_id String?  @db.Uuid
  idempotency_key String
  metadata_json   Json?
  occurred_at     DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, idempotency_key])
  @@index([tenant_id, membership_id, occurred_at])
  @@map("point_ledger")
}

model Badge {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  key         String
  name        String
  icon_key    String?
  criteria_json Json
  status      EntityStatus @default(ACTIVE)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, key])
  @@map("badges")
}

model BadgeAward {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  badge_id        String   @db.Uuid
  membership_id   String   @db.Uuid
  awarded_at      DateTime @default(now()) @db.Timestamptz(6)
  source_event_id String?  @db.Uuid

  @@unique([tenant_id, badge_id, membership_id])
  @@index([tenant_id, membership_id, awarded_at])
  @@map("badge_awards")
}

model StreakState {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  membership_id   String   @db.Uuid
  streak_key      String
  current_count   Int      @default(0)
  longest_count   Int      @default(0)
  last_activity_date DateTime? @db.Date
  updated_at      DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, membership_id, streak_key])
  @@map("streak_states")
}

model StreakFreeze {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  membership_id   String   @db.Uuid
  streak_key      String
  status          String   @default("available")
  used_for_date   DateTime? @db.Date
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @updatedAt @db.Timestamptz(6)

  @@index([tenant_id, membership_id, streak_key, status])
  @@map("streak_freezes")
}

model LeaderboardDefinition {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  key         String
  name        String
  metric_key  String
  window_key  String
  config_json Json?
  status      EntityStatus @default(ACTIVE)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, key])
  @@map("leaderboard_definitions")
}

model LeaderboardSnapshot {
  id              String   @id @db.Uuid
  tenant_id        String   @db.Uuid
  leaderboard_id   String   @db.Uuid
  period_key       String
  snapshot_json    Json
  calculated_at    DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, leaderboard_id, period_key])
  @@index([tenant_id, leaderboard_id, calculated_at])
  @@map("leaderboard_snapshots")
}

model ExamSecurityPolicy {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  key         String
  config_json Json
  status      EntityStatus @default(ACTIVE)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, key])
  @@map("exam_security_policies")
}

model ProctoringSession {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  attempt_id      String   @db.Uuid
  membership_id   String   @db.Uuid
  policy_id       String?  @db.Uuid
  status          String   @default("active")
  started_at      DateTime @default(now()) @db.Timestamptz(6)
  ended_at        DateTime? @db.Timestamptz(6)
  summary_json    Json?

  @@unique([tenant_id, attempt_id])
  @@index([tenant_id, membership_id, started_at])
  @@map("proctoring_sessions")
}

model ProctoringEvent {
  id              String   @id @db.Uuid
  tenant_id        String   @db.Uuid
  proctoring_session_id String @db.Uuid
  event_type       String
  severity         Severity @default(INFO)
  metadata_json    Json?
  occurred_at      DateTime @default(now()) @db.Timestamptz(6)
  idempotency_key  String?

  @@unique([tenant_id, idempotency_key])
  @@index([tenant_id, proctoring_session_id, occurred_at])
  @@map("proctoring_events")
}

model ProctoringReport {
  id              String   @id @db.Uuid
  tenant_id        String   @db.Uuid
  proctoring_session_id String @unique @db.Uuid
  risk_score       Decimal? @db.Decimal(8,4)
  report_json      Json
  generated_at     DateTime @default(now()) @db.Timestamptz(6)

  @@index([tenant_id, generated_at])
  @@map("proctoring_reports")
}

model CommunitySpace {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  slug        String
  name        String
  visibility  Visibility @default(TENANT)
  config_json Json?
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)
  deleted_at  DateTime? @db.Timestamptz(6)

  @@unique([tenant_id, slug])
  @@index([tenant_id, visibility])
  @@map("community_spaces")
}

model GroupMembership {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  space_id        String   @db.Uuid
  membership_id   String   @db.Uuid
  role_key        String   @default("member")
  joined_at       DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, space_id, membership_id])
  @@index([tenant_id, membership_id])
  @@map("group_memberships")
}

model Post {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  space_id        String   @db.Uuid
  author_membership_id String @db.Uuid
  title           String?
  body_json       Json
  status          String   @default("published")
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @updatedAt @db.Timestamptz(6)
  deleted_at      DateTime? @db.Timestamptz(6)

  @@index([tenant_id, space_id, created_at])
  @@index([tenant_id, author_membership_id, created_at])
  @@map("posts")
}

model Comment {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  post_id         String   @db.Uuid
  parent_comment_id String? @db.Uuid
  author_membership_id String @db.Uuid
  body_json       Json
  status          String   @default("published")
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @updatedAt @db.Timestamptz(6)
  deleted_at      DateTime? @db.Timestamptz(6)

  @@index([tenant_id, post_id, created_at])
  @@map("comments")
}

model Reaction {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  membership_id   String   @db.Uuid
  target_type     String
  target_id       String   @db.Uuid
  reaction_key    String
  created_at      DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, membership_id, target_type, target_id, reaction_key])
  @@index([tenant_id, target_type, target_id])
  @@map("reactions")
}

model Mention {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  mentioned_membership_id String @db.Uuid
  source_type     String
  source_id       String   @db.Uuid
  created_at      DateTime @default(now()) @db.Timestamptz(6)

  @@index([tenant_id, mentioned_membership_id, created_at])
  @@map("mentions")
}

model ModerationCase {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  target_type     String
  target_id       String   @db.Uuid
  status          ModerationStatus @default(OPEN)
  reason_key      String?
  opened_by_membership_id String? @db.Uuid
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @updatedAt @db.Timestamptz(6)

  @@index([tenant_id, status, created_at])
  @@map("moderation_cases")
}

model ModerationDecision {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  moderation_case_id String @db.Uuid
  decided_by_membership_id String? @db.Uuid
  decision_key    String
  decision_json   Json?
  occurred_at     DateTime @default(now()) @db.Timestamptz(6)

  @@index([tenant_id, moderation_case_id, occurred_at])
  @@map("moderation_decisions")
}

model Appeal {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  moderation_case_id String @db.Uuid
  submitted_by_membership_id String @db.Uuid
  status          String   @default("open")
  body            String
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @updatedAt @db.Timestamptz(6)

  @@index([tenant_id, status, created_at])
  @@map("appeals")
}

model AnalyticsRollup {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  rollup_key  String
  subject_type String
  subject_id  String?
  period_start DateTime @db.Timestamptz(6)
  period_end   DateTime @db.Timestamptz(6)
  metrics_json Json
  calculated_at DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, rollup_key, subject_type, subject_id, period_start])
  @@index([tenant_id, rollup_key, period_start])
  @@map("analytics_rollups")
}

model FunnelDailyRollup {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  funnel_key  String
  stage_key   String
  day         DateTime @db.Date
  count       Int      @default(0)
  metrics_json Json?
  calculated_at DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, funnel_key, stage_key, day])
  @@index([tenant_id, funnel_key, day])
  @@map("funnel_daily_rollups")
}

model ItemStatistic {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  item_id     String   @db.Uuid
  window_key  String
  attempts_count Int   @default(0)
  correct_count  Int   @default(0)
  avg_latency_ms Int?
  metrics_json Json?
  calculated_at DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, item_id, window_key])
  @@index([tenant_id, calculated_at])
  @@map("item_statistics")
}

model MaterializedViewRegistry {
  id           String   @id @db.Uuid
  view_name    String   @unique
  owner_context String
  refresh_policy_json Json
  last_refresh_at DateTime? @db.Timestamptz(6)
  created_at   DateTime @default(now()) @db.Timestamptz(6)
  updated_at   DateTime @updatedAt @db.Timestamptz(6)

  @@map("materialized_view_registry")
}

model AutomationRule {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  key         String
  trigger_event_type String
  condition_json Json?
  action_json    Json
  status      EntityStatus @default(ACTIVE)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, key])
  @@index([tenant_id, trigger_event_type, status])
  @@map("automation_rules")
}

model AutomationRun {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  automation_rule_id String @db.Uuid
  source_event_id String   @db.Uuid
  status          JobStatus @default(QUEUED)
  result_json     Json?
  occurred_at     DateTime @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, automation_rule_id, source_event_id])
  @@index([tenant_id, status, occurred_at])
  @@map("automation_runs")
}

model WorkflowDefinition {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  key         String
  name        String
  definition_json Json
  status      EntityStatus @default(ACTIVE)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, key])
  @@map("workflow_definitions")
}

model WorkflowTransition {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  workflow_definition_id String @db.Uuid
  target_type     String
  target_id       String   @db.Uuid
  from_state      String
  to_state        String
  actor_membership_id String @db.Uuid
  reason          String?
  metadata_json   Json?
  occurred_at     DateTime @default(now()) @db.Timestamptz(6)

  @@index([tenant_id, target_type, target_id, occurred_at])
  @@index([tenant_id, actor_membership_id, occurred_at])
  @@map("workflow_transitions")
}

model LocaleResource {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  locale      String
  key         String
  value       String
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, locale, key])
  @@map("locale_resources")
}

model ExtensionPoint {
  id          String   @id @db.Uuid
  key         String   @unique
  point_type  String   // server_hook | ui_slot | item_type_renderer
  schema_json Json
  status      EntityStatus @default(ACTIVE)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@map("extension_points")
}

model ExtensionRegistration {
  id                 String   @id @db.Uuid
  tenant_id           String   @db.Uuid
  extension_point_key String
  registration_key    String
  config_json         Json
  status              EntityStatus @default(ACTIVE)
  created_at          DateTime @default(now()) @db.Timestamptz(6)
  updated_at          DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, extension_point_key, registration_key])
  @@map("extension_registrations")
}

model DiagnosticSession {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  anonymous_id    String?
  membership_id   String?  @db.Uuid
  assessment_id   String?  @db.Uuid
  attempt_id      String?  @db.Uuid
  status          String   @default("started")
  ip_hash         String?
  user_agent_hash String?
  started_at      DateTime @default(now()) @db.Timestamptz(6)
  completed_at    DateTime? @db.Timestamptz(6)
  merge_json      Json?
  metadata_json   Json?

  @@index([tenant_id, anonymous_id, started_at])
  @@index([tenant_id, membership_id, started_at])
  @@map("diagnostic_sessions")
}

model ReadinessPolicy {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  key         String
  scoring_profile_id String @db.Uuid
  cta_policy_json Json
  legal_copy_json Json?
  status      EntityStatus @default(ACTIVE)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([tenant_id, key])
  @@map("readiness_policies")
}

model AttributionToken {
  id             String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  membership_id   String?  @db.Uuid
  anonymous_id    String?
  token_hash      String   @unique
  destination_url String
  source_surface  String
  readiness_band_key String?
  metadata_json   Json?
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  expires_at      DateTime @db.Timestamptz(6)
  consumed_at     DateTime? @db.Timestamptz(6)

  @@index([tenant_id, membership_id, created_at])
  @@index([tenant_id, anonymous_id, created_at])
  @@map("attribution_tokens")
}
```

---

## 5. PostgreSQL DDL Design Notes Where Prisma Is Insufficient

### 5.1 Required extensions and roles

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE ROLE atlas_app NOINHERIT;
CREATE ROLE atlas_worker NOINHERIT;
CREATE ROLE atlas_platform NOINHERIT;
```

Use separate credentials/Prisma clients:

- `atlas_app`: normal tenant request traffic.
- `atlas_worker`: background jobs; still tenant-scoped unless running approved platform jobs.
- `atlas_platform`: Super Admin platform-scope operations only.

### 5.2 RLS helper functions

```sql
CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.current_actor_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.actor_membership_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.is_platform_scope()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.platform_scope', true) = 'true';
$$;
```

### 5.3 Tenant table RLS template

For every tenant-scoped table:

```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table_name> FORCE ROW LEVEL SECURITY;

CREATE POLICY <table_name>_tenant_isolation
ON <table_name>
FOR ALL
TO atlas_app, atlas_worker
USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY <table_name>_platform_scope
ON <table_name>
FOR ALL
TO atlas_platform
USING (true)
WITH CHECK (true);
```

**Important:** `atlas_platform` must not be used by normal tenant routes. The application must not set `app.platform_scope = true` while connected as `atlas_app`. Platform scope is a separate operational capability, not a boolean any request can flip.

### 5.4 Global table policy

Global catalogue tables are not tenant-RLS tables. Use grants instead:

```sql
GRANT SELECT ON permissions, permission_bundles, feature_flags, item_types, extension_points TO atlas_app, atlas_worker;
REVOKE INSERT, UPDATE, DELETE ON permissions, permission_bundles, feature_flags, item_types, extension_points FROM atlas_app;
```

### 5.5 Partial unique indexes for soft-delete tables

Prisma cannot express partial unique indexes safely. Create raw SQL:

```sql
CREATE UNIQUE INDEX roles_tenant_key_active_uq
ON roles (tenant_id, key)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX courses_tenant_slug_active_uq
ON courses (tenant_id, slug)
WHERE deleted_at IS NULL;
```

Apply the same pattern to soft-deletable slug/key tables.

### 5.6 Append-only enforcement trigger

```sql
CREATE OR REPLACE FUNCTION app.reject_update_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'append-only table % cannot be updated or deleted', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER audit_entries_append_only
BEFORE UPDATE OR DELETE ON audit_entries
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();
```

Apply to all append-only tables listed in Section 13.

### 5.7 Hash-chain audit trigger

`audit_entries.entry_hash` must be generated from:

- previous hash for same tenant/global stream,
- tenant_id,
- actor,
- action,
- target,
- payload hashes,
- occurred_at.

Hash-chain trigger must run in DB or a trusted worker, not in untrusted client code.

### 5.8 Partition creation

Prisma cannot create partitioned parents/children. Use SQL migrations:

```sql
CREATE TABLE outbox_events (
  LIKE outbox_events_template INCLUDING ALL
) PARTITION BY RANGE (occurred_at);

CREATE TABLE outbox_events_2026_06
PARTITION OF outbox_events
FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
```

Partitions must inherit RLS or have RLS explicitly applied and tested.

---

## 6. RLS Policy Design for Every Tenant-Scoped Table

### 6.1 RLS coverage groups

Apply the tenant policy template to:

- Tenancy/config: `tenant_domains`, `tenant_branding`, `tenant_theme`, `tenant_config`, version tables, `provisioning_jobs`.
- Identity/access: `memberships`, `member_profiles`, `roles`, `role_permissions`, `user_roles`, `permission_overrides`.
- Config: `feature_flag_overrides`, `entitlements`, `entitlement_grant_history`.
- Event/audit if tenant-bound: `outbox_events`, `event_deliveries`, `dead_letter_events`, `notification_templates`, `notification_dispatches`, `search_index_entries`, `audit_entries`, `secret_refs`, `export_jobs`, `deletion_requests`.
- Learning: all learning tables.
- Assessment: all tenant assessment tables except global `item_types`.
- Competency: all scoring tables.
- Credentialing: all credentialing tables.
- Engagement: all gamification tables.
- Integrity: all L1 integrity tables.
- Community/moderation: all community/moderation tables.
- Analytics: tenant rollup tables.
- Orchestration: tenant orchestration tables.
- Extensibility: `extension_registrations`; not global `extension_points`.
- FB app: all FB app tables.

### 6.2 Special RLS cases

#### `tenants`

`tenants` is global. Normal tenant code should not query it directly except through a tenant-resolution service/cache. Platform code uses `atlas_platform`.

#### `auth_principals`

`auth_principals` is global because Supabase Auth identity is global. It is not directly exposed in tenant APIs. Tenant APIs access the user through `memberships` and `member_profiles` only.

#### `memberships`

Tenant RLS applies. Membership lookup is allowed only after the request tenant is resolved from host/domain and `app.tenant_id` is set. This prevents a user authenticated in Tenant A from being treated as active in Tenant B simply because the JWT exists.

#### Public certificate verification

Public credential verification must not use tenant-admin privileges. It should resolve by `credential_id`, verify status, then expose a minimal public projection. Log `credential_verifications` with tenant_id.

#### Anonymous diagnostic

Anonymous diagnostic is allowed for public tenant surfaces. It still runs with `tenant_id` set from the host. It stores `anonymous_id`, `ip_hash`, and `user_agent_hash`, not raw IP/device fingerprint.

---

## 7. Transaction-Scoped Tenant Context Implementation Pattern

### 7.1 Required Prisma wrapper

All request-scoped database work must run through a helper similar to:

```ts
export async function withTenantTx<T>(ctx: TenantRequestContext, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  if (!ctx.tenantId) throw new Error('Missing tenant context');
  if (!ctx.actorMembershipId && !ctx.allowAnonymousTenantRead) throw new Error('Missing membership context');

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('app.tenant_id', ${ctx.tenantId}, true)`;
    await tx.$executeRaw`select set_config('app.actor_membership_id', ${ctx.actorMembershipId ?? ''}, true)`;
    await tx.$executeRaw`select set_config('app.request_id', ${ctx.requestId}, true)`;

    return fn(tx);
  });
}
```

### 7.2 Mandatory rules

- Use `set_config('app.tenant_id', tenantId, true)` inside the transaction.
- Do **not** use session-level `SET app.tenant_id = ...`.
- Do **not** run Prisma calls outside `withTenantTx` in request handlers.
- Do **not** pass client-supplied `tenant_id` into writes.
- Do **not** use Supabase service role for tenant request data access.
- `$queryRaw` is allowed only inside the transaction wrapper and only with a tenant assertion or approved platform scope.

### 7.3 Why this matters

Vercel/serverless plus transaction-mode pooling means connection reuse is not safe for session-local state. Transaction-local GUC is the only acceptable pattern for RLS in this stack.

---

## 8. Super Admin Platform-Scope Escape Hatch Design

### 8.1 Design

Super Admin access uses:

1. A separate `atlas_platform` database role/client.
2. A `withPlatformScope()` application wrapper.
3. Mandatory permission check: `platform.*` permission.
4. Mandatory audit entry before and after the action.
5. Required reason string for sensitive operations.
6. No reuse of platform-scope transaction clients in tenant code.

### 8.2 Platform wrapper

```ts
export async function withPlatformScope<T>(ctx: PlatformContext, reason: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  assertSuperAdmin(ctx);
  if (!reason || reason.length < 10) throw new Error('Platform-scope reason required');

  return platformPrisma.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('app.platform_scope', 'true', true)`;
    await tx.$executeRaw`select set_config('app.actor_principal_id', ${ctx.principalId}, true)`;
    await writeAudit(tx, { action: 'platform.scope.enter', reason });
    const result = await fn(tx);
    await writeAudit(tx, { action: 'platform.scope.exit', reason });
    return result;
  });
}
```

### 8.3 Unsafe patterns rejected

- A tenant request setting `app.platform_scope = true`.
- Platform support querying tenant data without reason/audit.
- Sharing the platform Prisma client with normal API routes.
- Building Super Admin screens by disabling RLS globally.

---

## 9. Membership-Gate Enforcement Model

### 9.1 Request flow

1. Resolve tenant from custom domain/subdomain.
2. Validate tenant state.
3. Resolve Supabase principal from JWT if present.
4. Find `memberships` row for `(tenant_id, auth_principal_id)`.
5. Require `memberships.status = ACTIVE` for non-public routes.
6. Set transaction-local `app.tenant_id` and `app.actor_membership_id`.
7. Run permission and entitlement checks.
8. Execute DB work.

### 9.2 Public route exceptions

Allowed without active membership:

- Public academy landing pages.
- Public/free diagnostic start.
- Public certificate verification.
- Login/signup flow.

Even these must resolve `tenant_id` from host and run tenant-scoped RLS where tenant data is accessed.

### 9.3 Identity decision

Use **global auth principal + per-tenant membership/profile** for Phase 0/1. This matches Supabase Auth and reduces auth complexity. Privacy and blast-radius mitigations:

- Do not expose global user IDs to tenant APIs.
- Per-tenant `member_profiles` own display name/avatar/bio.
- Admin MFA required.
- Redis-backed session revocation list.
- Audit login, membership changes, role changes, and platform-scope support access.

This is acceptable for Phase 0/1 but must be documented as a deliberate tradeoff.

---

## 10. Permission and Entitlement Dependency Points

### 10.1 Permission checks

Every protected action calls:

```ts
can(actor, permissionKey, resourceRef, tenantContext)
```

`can()` must include:

- active membership check,
- role permissions,
- permission overrides,
- ownership/relationship resolver,
- tenant state check,
- audit for sensitive denies/allows where required.

### 10.2 Entitlement checks

Every paid/premium/limited capability calls:

```ts
enforceEntitlement(tenantId, entitlementKey, usageContext)
```

Examples:

- `lms.course.create`
- `assessment.diagnostic.enable`
- `competency.profile.create`
- `branding.custom_domain.enable`
- `community.private_spaces.enable`
- `analytics.dashboard.view`
- `export.run`

Entitlements are never checked by plan name. Plan names are presentation; entitlement rows are the gate.

---

## 11. Index Strategy Per Hot Path

### 11.1 Tenant resolution

- `tenant_domains(hostname) UNIQUE`
- `tenant_domains(tenant_id, status)`
- `tenants(slug) UNIQUE`

### 11.2 Membership/auth

- `auth_principals(supabase_user_id) UNIQUE`
- `auth_principals(email_normalized) UNIQUE`
- `memberships(tenant_id, auth_principal_id) UNIQUE`
- `memberships(auth_principal_id)`
- `memberships(tenant_id, status)`

### 11.3 RBAC

- `roles(tenant_id, key) WHERE deleted_at IS NULL UNIQUE`
- `role_permissions(tenant_id, role_id, permission_key) UNIQUE`
- `user_roles(tenant_id, membership_id, role_id) UNIQUE`
- `permission_overrides(tenant_id, membership_id, permission_key) UNIQUE`

### 11.4 Content browsing

- `courses(tenant_id, slug) WHERE deleted_at IS NULL UNIQUE`
- `courses(tenant_id, status, updated_at)`
- `course_modules(tenant_id, course_id, position)`
- `lessons(tenant_id, module_id, position)`
- `lesson_progress(tenant_id, membership_id, updated_at)`

### 11.5 Learning path dashboard

- `learning_paths(tenant_id, slug) WHERE deleted_at IS NULL UNIQUE`
- `path_steps(tenant_id, path_id, position)`
- `path_step_progress(tenant_id, membership_id, updated_at)`

### 11.6 Assessment and diagnostic

- `assessments(tenant_id, slug) UNIQUE`
- `assessments(tenant_id, assessment_type, status)`
- `items(tenant_id, item_type_key, status)`
- `item_dimension_weights(tenant_id, dimension_id)`
- `attempts(tenant_id, assessment_id, membership_id, started_at)`
- `attempt_answers(tenant_id, attempt_id)`

### 11.7 Swipe/practice loop

- `item_collections(tenant_id, collection_type, status)`
- `practice_sessions(tenant_id, membership_id, started_at)`
- `practice_responses(tenant_id, membership_id, occurred_at)`
- `srs_state(tenant_id, membership_id, due_at)`

### 11.8 Scoring/readiness

- `competency_signals(tenant_id, membership_id, dimension_id, occurred_at)`
- `competency_scores(tenant_id, membership_id, dimension_id, scoring_profile_id) UNIQUE`
- `composite_readiness_state(tenant_id, membership_id, scoring_profile_id, composite_key) UNIQUE`
- `competency_score_snapshots(tenant_id, membership_id, occurred_at)`

### 11.9 Community feed

- `community_spaces(tenant_id, slug) UNIQUE`
- `group_memberships(tenant_id, space_id, membership_id) UNIQUE`
- `posts(tenant_id, space_id, created_at)`
- `comments(tenant_id, post_id, created_at)`
- `reactions(tenant_id, target_type, target_id)`

Feeds and leaderboards should use Redis hot paths; Postgres remains source of truth.

### 11.10 Event/audit

- `outbox_events(available_at)`
- `outbox_events(tenant_id, event_type, occurred_at)`
- `notification_dispatches(tenant_id, status, created_at)`
- `audit_entries(tenant_id, occurred_at)`
- `audit_entries(tenant_id, action, occurred_at)`

---

## 12. Unique Constraints and Idempotency Constraints

Mandatory unique/idempotency constraints:

- `tenant_domains.hostname` unique.
- `auth_principals.supabase_user_id` unique.
- `auth_principals.email_normalized` unique.
- `memberships(tenant_id, auth_principal_id)` unique.
- `roles(tenant_id, key)` active unique via partial index.
- `entitlements(tenant_id, key)` unique.
- `outbox_events(tenant_id, idempotency_key)` unique when idempotency key exists.
- `event_deliveries(outbox_event_id, destination_key)` unique.
- `notification_dispatches(tenant_id, idempotency_key)` unique.
- `provisioning_jobs(tenant_id, idempotency_key)` unique.
- `courses(tenant_id, slug)` active unique.
- `learning_paths(tenant_id, slug)` active unique.
- `assessments(tenant_id, slug)` unique.
- `attempt_answers(tenant_id, attempt_id, assessment_item_id)` unique.
- `practice_responses(tenant_id, idempotency_key)` unique.
- `competency_signals(tenant_id, idempotency_key)` unique.
- `point_ledger(tenant_id, idempotency_key)` unique.
- `badge_awards(tenant_id, badge_id, membership_id)` unique.
- `certificates.credential_id` globally unique.
- `attribution_tokens.token_hash` globally unique.

---

## 13. Append-Only Table Rules

Append-only tables:

- `tenant_branding_version`
- `tenant_theme_version`
- `tenant_config_version`
- `entitlement_grant_history`
- `outbox_events`
- `event_deliveries` except status may be modeled as insert-per-attempt if strict append-only is required
- `dead_letter_events`
- `audit_entries`
- `attempt_answers`
- `practice_responses`
- `scoring_config_versions`
- `competency_signals`
- `competency_score_snapshots`
- `credential_verifications`
- `point_ledger`
- `proctoring_events`
- `moderation_decisions`
- `automation_runs`
- `workflow_transitions`
- `notification_dispatches` if immutable dispatch records are required

Rules:

1. No UPDATE.
2. No DELETE.
3. No soft delete.
4. Corrections are compensating entries.
5. Application writes through service functions only.
6. DB triggers reject mutation.
7. Retention policies are partition detach/archive, not row delete.

---

## 14. Partitioning Strategy for High-Volume Append-Only Tables

Partition monthly by `occurred_at` or equivalent timestamp:

- `outbox_events`
- `audit_entries`
- `practice_responses`
- `competency_signals`
- `competency_score_snapshots`
- `point_ledger`
- `proctoring_events`
- `credential_verifications`
- `notification_dispatches`
- `automation_runs`
- `workflow_transitions`

Partitioning rules:

- Pre-create next 3 months via scheduled migration/job.
- Each partition must have RLS enabled/forced or inherited and verified.
- Each partition must have local indexes matching hot paths.
- Old partitions may be archived to cheaper storage after retention period.
- No table reaches tens of millions of rows unpartitioned.

Retention recommendations:

| Table | Hot retention | Archive |
|---|---:|---:|
| `proctoring_events` L1 | 90–180 days | R2 archive if legally needed |
| `practice_responses` | 12 months hot | archive after 12–24 months |
| `competency_signals` | 24 months hot | long-term archive because scoring replay value |
| `audit_entries` | 24 months hot | long-term compliance archive |
| `outbox_events` | 30–90 days hot | archive delivered events |
| `point_ledger` | 12 months hot | archive after 24 months |

---

## 15. Soft-Delete Rules

Soft delete is allowed only where user recovery, admin undo, or content lifecycle requires it.

Soft-delete tables:

- `tenants`
- `tenant_domains`
- `member_profiles`
- `roles`
- `courses`
- `course_modules`
- `lessons`
- `lesson_assets`
- `learning_paths`
- `items`
- `item_collections`
- `certificate_templates`
- `community_spaces`
- `posts`
- `comments`
- `secret_refs`

No soft delete for:

- append-only records,
- audit records,
- ledgers,
- scoring signals,
- attempts/answers,
- membership history.

Memberships use `status`, `removed_at`, and audit history instead of soft delete.

---

## 16. Audit Log Schema

`audit_entries` is append-only, partitioned monthly, hash-chained, and insert-only.

Minimum actions that must audit:

- login/security events,
- membership create/suspend/remove,
- role/permission/override changes,
- entitlement changes,
- tenant lifecycle changes,
- branding/domain changes,
- content publish/unpublish/delete,
- assessment grading and grade changes,
- certificate issue/revoke,
- export/delete jobs,
- platform-scope access,
- proctoring report generation,
- readiness policy changes,
- outbound attribution CTA generation.

Audit payload must include actor, tenant, action, target, before/after where appropriate, request ID, IP/user-agent hash, and reason for privileged actions.

---

## 17. Outbox/Eventing Schema

### 17.1 Event envelope

Every event must carry:

- `event_id`
- `tenant_id` nullable only for platform-global events
- `event_type`
- `aggregate_type`
- `aggregate_id`
- `actor_membership_id` where applicable
- `occurred_at`
- `schema_version`
- `payload_json`
- `metadata_json`
- `idempotency_key`

### 17.2 Required Phase 0/1 events

- `tenant.created`
- `tenant.state_changed`
- `membership.created`
- `membership.status_changed`
- `role.assigned`
- `permission.changed`
- `entitlement.changed`
- `course.published`
- `lesson.completed`
- `path.step_completed`
- `assessment.started`
- `assessment.submitted`
- `assessment.graded`
- `practice.session_completed`
- `competency.signal_recorded`
- `competency.score_changed`
- `readiness.band_changed`
- `certificate.issued`
- `badge.awarded`
- `streak.updated`
- `community.post_created`
- `moderation.case_opened`
- `notification.queued`
- `export.requested`
- `attribution.token_created`

### 17.3 Delivery

Outbox insert happens in the same transaction as the source write. A worker relays to:

- notification dispatch,
- analytics/PostHog,
- search indexing,
- competency projection workers,
- future webhook integrations.

No feature should write directly to analytics as a parallel event collector.

---

## 18. Seed Data Requirements

### 18.1 Global seed data

- Built-in permissions.
- Permission bundles.
- Global feature flags.
- Built-in item types:
  - `mcq`
  - `true_false`
  - `fill_blank`
  - `short_answer`
  - `essay`
  - `file_upload`
  - `scenario`
  - `swipe`
- Extension points:
  - `assessment.item_type.renderer`
  - `assessment.item_graded`
  - `learning.lesson_completed`
  - `workflow.review_required`
  - `notification.template_resolver`
- Materialized view registry defaults.

### 18.2 Per-tenant provisioning seed data

For every tenant:

- Tenant branding/theme/config defaults.
- Default roles:
  - owner
  - admin
  - instructor
  - moderator
  - learner
- Default entitlements for selected plan.
- Default notification templates.
- Default workflow definitions.
- Default community spaces if enabled.
- Default gamification profile creation rule.

### 18.3 FundedBeyond Tenant #1 seed data

- Tenant domain: `academy.fundedbeyond.com`.
- Competency dimensions:
  - `TA` Technical Analysis
  - `PSY` Psychology
  - `RISK` Risk Management
  - `DISC` Discipline
  - `CR` Challenge Readiness
- Scoring profile: `fb_challenge_readiness_v1`.
- Bands: `beginner`, `developing`, `nearly_ready`, `ready`, `advanced`.
- Diagnostic assessment shell using generic `assessments`.
- Swipe deck shells using `item_collections` and `item_type_key = swipe`.
- Readiness policy row with legal CTA copy.
- Learning paths for beginner/intermediate roadmap.
- Core certificate templates: Foundations, Risk, Psychology.

---

## 19. Migration Order

1. Create schemas/extensions/roles.
2. Create global tables: `tenants`, `auth_principals`, `permissions`, `permission_bundles`, `feature_flags`, `item_types`, `extension_points`, `materialized_view_registry`.
3. Create tenant-scoped foundation tables: domains, config, identity, memberships, access, entitlements.
4. Create RLS helper functions.
5. Enable/force RLS on every tenant table created so far.
6. Create audit/outbox tables and append-only triggers.
7. Create eventing worker tables.
8. Seed global catalogues.
9. Create Phase 1 learning tables.
10. Create Phase 1 assessment and item-registry tables.
11. Create Phase 1 competency/scoring tables.
12. Create Phase 1 credentialing/engagement/integrity/community tables.
13. Create Phase 1 notification/search/analytics/orchestration/extensibility tables.
14. Create FB app-layer tables.
15. Add partial indexes and partitioned child tables.
16. Run RLS/IDOR test matrix in staging.
17. Provision FundedBeyond Tenant #1 through provisioning saga, not migration.
18. Run second-tenant provisioning smoke test.

---

## 20. CI Checks That Must Fail Unsafe Schema Changes

CI must fail if:

1. A new non-global table lacks `tenant_id`.
2. A tenant table lacks RLS enable/force migration.
3. A tenant table lacks a `tenant_id`-leading index.
4. An append-only table has `updated_at`, `deleted_at`, or no append-only trigger.
5. A raw SQL migration contains session-level `SET app.tenant_id`.
6. Application code uses Prisma outside `withTenantTx` for tenant routes.
7. `$queryRaw` appears outside approved wrappers.
8. A table in one bounded context is imported directly by another context.
9. A migration creates a cross-context FK not on the allowlist.
10. A partitioned table lacks RLS tests on partitions.
11. A soft-delete table has a non-partial uniqueness constraint that blocks re-creation after soft delete.
12. Any money column uses float/decimal without minor-unit design.
13. Prisma drift exists between schema and DB.
14. A platform-scope route lacks audit.
15. A new event producer does not write through the outbox.
16. A new tenant-facing endpoint has no IDOR test.

---

## 21. Test Plan

### 21.1 Tenant isolation tests

Create Tenant A and Tenant B with identical-looking data IDs where possible. Test:

- Tenant A cannot read Tenant B courses.
- Tenant A cannot read Tenant B memberships.
- Tenant A cannot submit Tenant B assessment.
- Tenant A cannot view Tenant B scores.
- Tenant A cannot search Tenant B content.
- Tenant A cannot view Tenant B community posts.
- Tenant A cannot verify private Tenant B certificates via tenant APIs.

### 21.2 RLS direct-query tests

Using `atlas_app` role:

- Query without `app.tenant_id` returns zero rows or errors.
- Query with Tenant A GUC returns only Tenant A.
- Query with Tenant B GUC returns only Tenant B.
- Insert with mismatched `tenant_id` fails.
- Update with mismatched `tenant_id` fails.
- Delete across tenant fails.

### 21.3 Raw-query bypass tests

Write intentional unsafe raw queries:

```sql
SELECT * FROM courses;
SELECT * FROM memberships WHERE id = '<other-tenant-membership-id>';
UPDATE courses SET title = 'bad';
```

Expected result: RLS blocks or tenant-filters them.

### 21.4 Transaction pooling tests

Run tests against production-like transaction-mode pooler:

1. Execute Tenant A transaction setting `app.tenant_id = A` via `set_config(..., true)`.
2. Execute Tenant B transaction immediately after.
3. Parallelize A/B requests at high concurrency.
4. Verify no stale tenant GUC leaks.
5. Verify queries outside transaction do not see prior tenant context.

This is a Phase 0 exit gate.

### 21.5 Membership gate tests

- Valid JWT but no membership in host tenant → 403.
- Suspended membership → 403.
- Removed membership → 403.
- Host tenant differs from JWT tenant claim → membership gate wins.
- Public diagnostic route works without membership but only under host tenant.

### 21.6 Platform scope tests

- Tenant role cannot use platform Prisma client.
- Super Admin route writes `platform.scope.enter` and `platform.scope.exit` audit entries.
- Missing reason fails.
- Platform query succeeds only with `atlas_platform` role.

### 21.7 Append-only tests

- UPDATE/DELETE on append-only table fails.
- Compensating records work.
- Partition RLS works for current and previous month.

---

## 22. Known Risks and Tradeoffs

### 22.1 RLS + Prisma complexity

This is more complex than simple app-level tenant filtering. It is justified because tenant isolation is Atlas’s #1 invariant. The cost is stricter engineering discipline and wrapper enforcement.

### 22.2 Global identity tradeoff

Global Supabase identity with per-tenant memberships is practical for Phase 0/1, but it creates a wider account-takeover blast radius. Mitigate with MFA for admins, session revocation, audit, and per-tenant profile isolation.

### 22.3 Scoring engine adds upfront complexity

The Competency & Scoring Engine is additional Phase 1 work, but without it FundedBeyond either forks Atlas or loses its flagship readiness/smart diagnostic loop. This complexity is necessary, not optional.

### 22.4 Excluding commerce is intentional

FundedBeyond Academy v1 does not process challenge payments. Building commerce checkout now would increase compliance and payment-provider risk without unlocking the MVP loop.

### 22.5 Single shared Postgres remains a shared-fate risk

Acceptable for early tenants if statement timeouts, tenant-leading indexes, partitioning, and migration canaries are enforced. Not acceptable to pretend it scales forever.

### 22.6 Direct cross-context reads are tempting and unsafe

The schema makes some joins easy. Architecture must still prevent service-boundary violations. CI import rules and code review must enforce this.

---

## 23. Final CTO Approval Verdict

### Verdict: **Approved with conditions**

**Approved for Phase 0 implementation immediately.**  
**Phase 1 implementation is approved only after Phase 0 isolation gates pass under transaction-mode pooling.**

This design is implementation-ready enough to begin Phase 0 migrations, RLS harness, Prisma schema baseline, and CI enforcement. It is not approved for feature development until tenant isolation is proven on the real deployment topology.

### Conditions before development

1. Build the transaction-pooled RLS test harness first.
2. Enforce `withTenantTx()` and ban tenant Prisma access outside it.
3. Implement raw SQL migrations for RLS, append-only triggers, partial indexes, partitioning, grants, and audit hash-chain.
4. Provision FundedBeyond through the tenant provisioning saga, not one-off SQL.
5. Seed the generic item-type registry and Competency & Scoring Engine before building Diagnostic/Swipe/Readiness UI.
6. Keep commerce checkout, live learning, inbound conversion events, marketplace, AI, L2/L3 proctoring, and mobile builds out of Phase 1.
7. Complete legal review for readiness CTA wording before public launch.
8. Run the second-tenant smoke test before declaring FundedBeyond Phase 1 complete.

### Exact next document to produce

**Next document:** `Phase 0 Database Migration Pack + Tenant-Isolation Test Harness Specification v1`

This should include:

- exact Prisma migration files,
- exact SQL migration files for RLS/grants/partitions/triggers,
- the `withTenantTx()` implementation contract,
- the RLS/IDOR/transaction-pooling test suite,
- CI checks and failure examples,
- local/staging/prod migration execution order.

