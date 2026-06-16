# Atlas LMS — Master PRD v3.0

**Multi-Tenant White-Label LMS SaaS Platform** \xc2\xb7 Single-document compilation of all volumes.

---

# Volume 0 — Overview & Index

> **Multi-Tenant White-Label Learning Management SaaS Platform**
> Official source-of-truth product & architecture specification.
> Status: **Locked Foundations / Living Document**. Last revised: this release.

---

## 0.1 How to read this document

This PRD is split into **14 volumes**. It is written to be consumed by humans *and* by coding agents (Claude Code, Cursor). When an agent is asked to implement a feature, it should:

1. Read **Volume 3 (System Architecture)** and **Volume 4 (Database Architecture)** first — they are binding contracts.
2. Read the relevant engine spec in **Volume 2 (Functional Requirements)**.
3. Honour every **Acceptance Criterion** in **Volume 14** for the surface being built.
4. Never violate the **Non-Negotiables** (§0.4). They are invariants, not preferences.

| Vol | Title | Primary audience | Depth in this release |
|-----|-------|------------------|------------------------|
| 1 | Product & Business | Founders, Investors, PM | Full |
| 2 | Functional Requirements (40 engines) | PM, Eng, Agents | Full template; foundational engines deep |
| 3 | System Architecture | Architects, Eng | Full |
| 4 | Database Architecture | DB Architect, Eng | Full (Prisma schema) |
| 5 | Security & Proctoring | Security, Eng | Full |
| 6 | Commerce & Payments | PM, Eng | Full |
| 7 | Mobile Architecture | Mobile Eng | Full |
| 8 | SaaS Platform | PM, Eng | Full |
| 9 | Marketplace | PM, Eng | Spec-level |
| 10 | AI Layer | PM, Eng | Spec-level (future phases) |
| 11 | DevOps & Infrastructure | DevOps, Eng | Full |
| 12 | Testing Standards | QA, Eng | Full |
| 13 | Roadmap | Founders, PM | Full |
| 14 | Acceptance Criteria | QA, Agents | Full |

---

## 0.2 Product summary

**Atlas LMS** is a multi-tenant, white-label learning infrastructure platform. A single deployment serves many independent **tenants** (academies, coaches, bootcamps, corporates, certification bodies), each with their own branding, custom domain, users, content, commerce, community, and eventually their own mobile app — all on one shared backend and codebase.

The first tenant is **FundedBeyond Academy** (a trading academy). FundedBeyond is treated as *tenant #1*, never as a special case in code. Anything built for FundedBeyond must be expressible as tenant configuration, feature flags, and theme — not as hardcoded logic.

**Competitive frame:** LearnWorlds, Kajabi, Thinkific, Teachable, Learnyst, Circle, Skool, TalentLMS. Atlas differentiates on (a) true white-label including mobile, (b) provider-agnostic commerce with deep India coverage, (c) enterprise proctoring and assessment integrity, and (d) an AI layer gated behind mandatory human approval.

---

## 0.3 Locked technology stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend | Next.js API Routes + Server Actions |
| Database | PostgreSQL (single shared database) |
| ORM | Prisma |
| Auth | Supabase Auth |
| Object storage | Cloudflare R2 |
| Hosting | Vercel |
| Edge / CDN / WAF | Cloudflare |
| Mobile | React Native + Expo (single codebase, per-tenant branding) |
| Validation | Zod (every boundary) |
| Monitoring | Sentry (errors), PostHog (product analytics), Better Stack (uptime/logs) |
| Video | **Not self-hosted** — YouTube Unlisted, Vimeo, Bunny Stream (store `video_provider` + `video_url`) |

---

## 0.4 Non-negotiables (system invariants)

These are enforced in code, schema, and review. A change that breaks one of these is a blocking defect.

1. **Tenant isolation is absolute.** Every business row carries `tenant_id`. No query crosses tenants except explicit Super Admin / platform paths. Enforced at three layers: PostgreSQL Row-Level Security, a Prisma tenant-scoping extension, and request-context guards.
2. **No hardcoded payment provider.** All commerce flows through a `PaymentProvider` abstraction. "Stripe" never appears in business logic.
3. **No self-hosted video.** Only provider references are stored.
4. **AI never auto-publishes.** AI output is always a *draft* requiring human approval.
5. **White-label first.** No tenant name, logo, colour, or domain is hardcoded. Branding is data.
6. **API first.** Every capability exposed to UI is reachable via a documented, versioned, authorized API.
7. **Validate at every boundary** with Zod. Untrusted input is never trusted.
8. **Audit the irreversible.** Auth events, permission changes, payments, grading, publishing, exports, and admin actions are written to an append-only audit log.
9. **Least privilege.** Default deny in RBAC; permissions are granted, never assumed.
10. **Tenant data is the tenant's.** Full export must always be possible.

---

## 0.5 Glossary

- **Platform / Super Admin** — Atlas operator. Cross-tenant. The only role above tenants.
- **Tenant** — An isolated customer organization (an academy/business).
- **Tenant Admin** — Owner/administrator within a tenant.
- **Engine** — A bounded functional subsystem (40 total; see Vol 2).
- **Surface** — A user-facing area (web app, admin, mobile app, public site).
- **Entitlement** — What a tenant's SaaS plan permits (seats, engines, limits).
- **Feature Flag** — A runtime on/off (or variant) toggle, scoped platform-wide or per-tenant.

See `01-product-and-business.md` to begin.


---

# Volume 1 — Product & Business

## 1.1 Vision

Build the **white-label learning infrastructure layer** for the internet: the system a company adopts when it wants to run a branded academy — web, mobile, commerce, community, assessment, certification — without building any of it. Atlas is to online learning what Shopify is to commerce: the tenant owns the brand and the audience; Atlas owns the infrastructure.

## 1.2 Problem statement

Course creators and training organizations are forced to choose between:

- **All-in-one hosted tools** (Kajabi, Teachable, Thinkific) — fast to start, but the creator rents the platform, gets weak data ownership, limited extensibility, no real white-label mobile, and shallow assessment/proctoring.
- **Building custom** — full control, but 12–24 months and a permanent engineering cost centre.

There is no platform that is simultaneously: truly white-label (including native mobile), enterprise-grade on assessment integrity, provider-agnostic on payments with first-class India support, data-portable, and extensible via plugins. Atlas occupies that gap.

## 1.3 Target customers (tenant archetypes)

| Archetype | Example | Primary engines they live in |
|-----------|---------|------------------------------|
| Trading / finance academy | FundedBeyond Academy | LMS, Assessment, Community, Live, Payments, Proctoring |
| Independent coach | 1:1 / cohort coach | LMS, Live, Community, Subscriptions |
| Certification provider | Industry cert body | Assessment, Proctoring, Certification, Audit |
| Corporate L&D | Internal training org | LMS, Learning Paths, Analytics, SSO, Reporting |
| Educational institution | College / school | LMS, Assessment, Live, Localization |
| Bootcamp | Cohort-based course | Learning Paths, Community, Live, Assignments |
| Content creator | Solo creator | Website Builder, Memberships, Community |

The platform must not optimize so hard for FundedBeyond that other archetypes become second-class. FundedBeyond's needs map to **configuration of generic engines**.

## 1.4 Initial tenant: FundedBeyond Academy

FundedBeyond is the launch design partner. It exercises the full critical path: paid courses, cohort/live sessions, graded assessments with proctoring, certificates, and a private community. Its requirements drive **Phase 1** scope but are implemented as tenant configuration. Acceptance for Phase 1 = FundedBeyond can run end-to-end on Atlas with zero FundedBeyond-specific code branches.

## 1.5 Value proposition by stakeholder

- **Tenant owner:** Launch a fully branded academy (web + mobile) in days; own your users, data, and payments; sell globally and in India natively.
- **Instructor:** Author courses (optionally AI-assisted), run live sessions, grade with integrity tooling, see learner analytics.
- **Learner:** One coherent branded experience across web and mobile; clear paths; verifiable certificates; community.
- **Atlas (platform):** Recurring SaaS revenue + optional revenue share on tenant commerce + marketplace take rate.

## 1.6 Business model

Three stacked revenue lines:

1. **SaaS subscription (primary).** Tenants pay Atlas per plan tier (seats / entitlements / limits). Governed by the SaaS Billing Engine (Vol 8).
2. **Revenue share (optional).** On a configurable basis, Atlas takes a percentage of tenant commerce processed through Atlas (Revenue Sharing Engine, Vol 6/8).
3. **Marketplace take rate (future).** A percentage on plugin/template/course sales in the Atlas marketplace (Vol 9).

> Atlas never becomes the merchant of record for tenant sales by default. Tenants connect their own payment-provider accounts; Atlas orchestrates. Revenue share is computed and invoiced separately, not skimmed at the gateway, unless a platform-managed payments mode is explicitly enabled.

## 1.7 Plan tiers (illustrative, configured in SaaS Billing Engine)

| Tier | Intended buyer | Representative entitlements |
|------|----------------|------------------------------|
| Starter | Solo creator/coach | 1 admin, core LMS, community (native), 1 payment provider, Atlas-subdomain |
| Growth | Scaling academy | Custom domain, multiple instructors, subscriptions, basic analytics, L1 proctoring |
| Pro | Established academy | White-label web, learning paths, full analytics, L2 proctoring, integrations |
| Enterprise | Corporate / institution | SSO, white-label mobile app, L3 proctoring, custom roles, audit export, SLA, revenue share negotiable |

Tiers are *data* (entitlement sets), never hardcoded gates. Every gate reads from the Entitlement + Feature Flag engines.

## 1.8 Success metrics (North Stars)

- **Platform:** Active tenants; net revenue retention; gross margin; tenant time-to-launch.
- **Per-tenant health:** Active learners, course completion rate, assessment pass rate, community DAU/MAU, churn.
- **Reliability:** p95 API latency, uptime, error budget burn (Vol 11).
- **Integrity:** Proctoring violation rate, dispute rate, certificate verification volume.

## 1.9 Competitive positioning

| Capability | Kajabi/Teachable/Thinkific | Circle/Skool | TalentLMS | **Atlas** |
|------------|---------------------------|--------------|-----------|-----------|
| White-label web | Partial | Partial | Yes | **Yes** |
| White-label native mobile | No / limited | No | Limited | **Yes (per-tenant app)** |
| Provider-agnostic payments + India | No | No | Limited | **Yes** |
| Enterprise proctoring (L1–L3) | No | No | Partial | **Yes** |
| Data export / ownership | Partial | Partial | Partial | **Full** |
| Plugin/extension model | Limited | Limited | Limited | **Yes** |
| Community (native + external) | Partial | Native only | Partial | **Both** |

## 1.10 Constraints & assumptions

- Single shared PostgreSQL DB with strict `tenant_id` isolation (not DB-per-tenant) — chosen for operational simplicity and cost at the platform's scale stage; revisited only if a tenant's compliance demands physical isolation (handled via an Enterprise "dedicated" deployment variant, future).
- Video is never hosted by Atlas — removes the largest cost and compliance surface.
- Vercel + Cloudflare + Supabase + R2 are the locked operational substrate.
- AI features are **future phases** and always human-gated.

## 1.11 Out of scope (v3.0)

- Atlas acting as merchant-of-record for all tenants by default.
- Self-hosted video transcoding/streaming.
- Fully autonomous AI publishing.
- DB-per-tenant physical isolation as the default.


---

# Volume 2 — Functional Requirements (The 40 Engines)

Atlas is composed of **40 engines** — bounded subsystems with clear contracts. They are grouped into nine domains. Engines communicate through typed service interfaces and the event bus (Vol 3), never by reaching into each other's tables.

### Engine spec template

Every engine below is specified with:

- **Purpose** — why it exists.
- **Objectives** — measurable goals.
- **Functional Requirements (FR)** — what it must do.
- **Non-Functional Requirements (NFR)** — quality bars.
- **User Stories** — `As a <role>, I want <goal> so that <benefit>`.
- **User Flows** — key step sequences.
- **Permissions** — required RBAC permissions.
- **Database** — owned tables (canonical schema in Vol 4).
- **API** — representative endpoints.
- **Security** — engine-specific controls.
- **Analytics** — events/metrics emitted.
- **Acceptance Criteria (AC)** — done means this (full list in Vol 14).

### Engine index

| # | Engine | Domain |
|---|--------|--------|
| 1 | Multi-Tenant | Foundation |
| 2 | White Label | Foundation |
| 3 | Role & Permission | Foundation |
| 4 | Feature Flag | Foundation |
| 5 | Tenant Configuration | Foundation |
| 6 | Website Builder | Presentation |
| 7 | Theme | Presentation |
| 8 | Domain Management | Presentation |
| 9 | LMS | Learning |
| 10 | Learning Path | Learning |
| 11 | Assessment | Learning |
| 12 | Certification | Learning |
| 13 | Gamification | Learning |
| 14 | Proctoring | Integrity |
| 15 | Exam Security | Integrity |
| 16 | Community | Community |
| 17 | Content Moderation | Community |
| 18 | Live Learning | Live |
| 19 | Webinar | Live |
| 20 | Event Management | Live |
| 21 | Payment Integration | Commerce |
| 22 | Subscription | Commerce |
| 23 | Coupon | Commerce |
| 24 | Tax | Commerce |
| 25 | Invoice | Commerce |
| 26 | Notification & Communication | Platform Services |
| 27 | Integration | Platform Services |
| 28 | Search | Platform Services |
| 29 | Enterprise Analytics | Platform Services |
| 30 | Audit Logging | Platform Services |
| 31 | Automation | Orchestration |
| 32 | Workflow | Orchestration |
| 33 | Localization | Orchestration |
| 34 | Plugin / Extension | Extensibility |
| 35 | Marketplace | Extensibility |
| 36 | Revenue Sharing | SaaS |
| 37 | SaaS Billing | SaaS |
| 38 | Tenant Provisioning | SaaS |
| 39 | Mobile White Label | SaaS |
| 40 | AI Layer | Intelligence |

---

# Domain A — Foundation

## Engine 1 — Multi-Tenant Engine

**Purpose.** Guarantee that every piece of data, request, and side-effect belongs to exactly one tenant and is invisible to all others. This is the engine the entire platform's correctness rests on.

**Objectives.**
- Zero cross-tenant data leakage (target: provably none; verified by automated tests + RLS).
- Tenant context resolved on every request in <2ms overhead.
- Adding a new tenant requires no schema or code change (Provisioning Engine handles data).

**Functional Requirements.**
- FR1. Resolve tenant from request context: custom domain → subdomain → JWT `tenant_id` claim → (admin) explicit header, in that precedence.
- FR2. Inject an immutable `tenantContext` into the request lifecycle; all data access derives `tenant_id` from it, never from client-supplied body fields.
- FR3. Every business table has a non-null `tenant_id` FK to `tenants`.
- FR4. Enforce isolation at three layers: (a) PostgreSQL Row-Level Security policies keyed on a session GUC `app.tenant_id`; (b) a Prisma client extension that auto-injects `where: { tenantId }` and rejects writes lacking it; (c) request guards that 403 if resolved tenant ≠ resource tenant.
- FR5. Provide an explicit, audited `withPlatformScope()` escape hatch usable only by Super Admin paths.
- FR6. Tenant lifecycle states: `provisioning → active → suspended → archived → deleted`. Suspended tenants reject all non-admin traffic.

**Non-Functional.**
- Isolation correctness is a release-blocking invariant. Any test proving leakage stops the release.
- Tenant resolution must be cacheable at the edge (domain→tenant map) with <60s propagation.

**User Stories.**
- As a **tenant admin**, I want certainty that no other academy can ever see my learners, so that I can trust the platform with my business.
- As a **super admin**, I want to operate across tenants for support, so that I can help without tenants helping themselves to each other's data.

**User Flows.**
- *Request resolution:* incoming request → edge resolves host→tenant → middleware sets `tenantContext` + DB GUC → handler runs scoped → response.
- *Suspension:* Super Admin suspends tenant → flag flips → edge cache invalidated → tenant traffic 503s with branded notice; admin login still allowed to settle billing.

**Permissions.** `platform.tenant.read`, `platform.tenant.manage` (Super Admin only). No tenant role can read another tenant.

**Database.** Owns `tenants`. Referenced by every business table via `tenant_id`. (Vol 4.)

**API.**
- `GET /api/platform/tenants` (Super Admin) — list/manage.
- `POST /api/platform/tenants` — create (delegates to Provisioning).
- `PATCH /api/platform/tenants/:id/state` — lifecycle transition.

**Security.** RLS is the last line of defence even if application code is wrong. The GUC is set from server-trusted context only — never from a header a client can spoof. Penetration tests must include cross-tenant IDOR attempts.

**Analytics.** Emits `tenant.created`, `tenant.state_changed`. Per-tenant request counts feed SaaS metering.

**Acceptance Criteria.** See Vol 14 §AC-1. Headline: an authenticated user of tenant A receives 404/403 for every resource of tenant B across every endpoint, and RLS independently blocks the same even with a deliberately mis-scoped query.

---

## Engine 2 — White Label Engine

**Purpose.** Make brand identity (name, logo, colours, typography, copy, domain, emails, mobile app) a property of tenant data, so one codebase renders as N distinct products.

**Objectives.**
- A tenant can fully rebrand web + email + mobile with zero deploys.
- No Atlas branding visible to a white-labelled tenant's end users (on qualifying plans).

**Functional Requirements.**
- FR1. Store a `tenant_branding` record: display name, logo (light/dark), favicon, primary/secondary/accent colours, font family, hero copy, legal/footer text, support email, social links — all in R2 (assets) + DB (tokens).
- FR2. Resolve branding at the edge alongside tenant resolution; expose as a typed `branding` object to web, email templates, and mobile config.
- FR3. Email "from" name/address, transactional template header/footer, and certificate templates inherit branding.
- FR4. "Powered by Atlas" footer is shown/hidden by entitlement (`whiteLabel.removeAtlasBranding`).
- FR5. Branding changes are versioned and auditable; preview-before-publish supported.

**Non-Functional.** Branding fetch adds <5ms; assets served from Cloudflare CDN; broken/missing assets fall back to tenant defaults, never to Atlas branding on white-label plans.

**User Stories.** As a **tenant admin**, I want to upload my logo and pick my colours and have them appear everywhere instantly, so that the academy feels like *my* product.

**User Flows.** Admin → Branding settings → edit tokens / upload assets → live preview → publish → edge cache invalidated → all surfaces reflect change.

**Permissions.** `tenant.branding.read`, `tenant.branding.manage`.

**Database.** `tenant_branding`, `tenant_branding_version`.

**API.** `GET/PUT /api/tenant/branding`, `POST /api/tenant/branding/assets` (R2 signed upload), `POST /api/tenant/branding/publish`.

**Security.** Asset uploads validated for type/size; SVG sanitized; signed R2 URLs; XSS-safe injection of brand copy.

**Analytics.** `branding.updated`, `branding.published`.

**Acceptance Criteria.** Vol 14 §AC-2. Two tenants on the same deployment render with entirely distinct brand identity with no code difference.

---

## Engine 3 — Role & Permission Engine (RBAC)

**Purpose.** Decide, for every action, whether the actor is allowed — with granular, tenant-scoped, extensible roles and a default-deny posture.

**Objectives.**
- Every protected action checks a named permission.
- Tenants can define custom roles from a permission catalogue.
- Permission checks are <1ms (in-memory after load).

**Functional Requirements.**
- FR1. **Permissions** are namespaced strings: `domain.resource.action` (e.g., `lms.course.publish`, `assessment.attempt.grade`). The catalogue is code-defined and versioned.
- FR2. **System roles:** platform `super_admin`; tenant `admin`, `instructor`, `student`, `moderator`. Each maps to a default permission set.
- FR3. **Custom roles:** a tenant admin composes a role from any subset of the catalogue (bounded by entitlement). Custom roles are tenant-scoped.
- FR4. A user has one or more role assignments *per tenant*; effective permissions = union, minus explicit denials.
- FR5. Resource-level scoping: e.g., an instructor's `lms.course.edit` applies only to courses they own/are assigned, enforced by ownership checks layered on the permission.
- FR6. Default deny: absence of a grant = denied.
- FR7. Permission changes are audited.

**Non-Functional.** Authorization must be centralized in one `can(actor, permission, resource?)` function used everywhere — no ad-hoc role string comparisons in business code. Misuse is a review-blocking defect.

**User Stories.**
- As a **tenant admin**, I want to create a "Teaching Assistant" role that can grade but not publish, so that I can delegate safely.
- As a **developer**, I want a single `can()` API, so that authorization is consistent and testable.

**User Flows.** Admin → Roles → New role → name + pick permissions → save → assign to users.

**Permissions.** `tenant.role.read`, `tenant.role.manage`, `tenant.member.assign_role`.

**Database.** `roles`, `permissions` (catalogue, may be seeded constant), `role_permissions`, `user_roles`, `permission_overrides`.

**API.** `GET /api/tenant/roles`, `POST /api/tenant/roles`, `PUT /api/tenant/roles/:id`, `POST /api/tenant/members/:userId/roles`.

**Security.** Privilege escalation guard: a user can never grant a permission they don't themselves hold (no "grant-up"). Super Admin scope strictly separated from tenant scope.

**Analytics.** `role.created`, `role.assigned`, `permission.denied` (for anomaly detection).

**Acceptance Criteria.** Vol 14 §AC-3. Default-deny verified; custom role grading-without-publish works; grant-up blocked.

---

## Engine 4 — Feature Flag Engine

**Purpose.** Toggle features and variants at runtime, scoped platform-wide, per-tenant, per-plan, or per-user, decoupling deploy from release.

**Objectives.** Ship dark; enable per tenant; roll back instantly without deploy; gate entitlements.

**Functional Requirements.**
- FR1. Flag types: boolean, multivariate, and percentage rollout.
- FR2. Scopes & precedence: user override > tenant override > plan default > platform default.
- FR3. Entitlement flags (derived from SaaS plan) are read-only to tenants; operational flags can be tenant-toggled if permitted.
- FR4. Evaluation is deterministic and cached; SDK on web, server, and mobile.
- FR5. Changes are audited; kill-switch flags documented for incident response.

**Non-Functional.** Flag eval <1ms; safe default if flag store unreachable (fail to documented default, usually "off").

**User Stories.** As **platform eng**, I want to enable "L3 proctoring" for one enterprise tenant only, so that I can pilot safely.

**Permissions.** `platform.flag.manage`, `tenant.flag.read`, `tenant.flag.toggle` (subset).

**Database.** `feature_flags`, `feature_flag_overrides`.

**API.** `GET /api/flags` (resolved for context), platform CRUD under `/api/platform/flags`.

**Security.** Entitlement flags cannot be self-elevated by tenants. Flag changes audited.

**Analytics.** `flag.evaluated` (sampled), `flag.changed`.

**Acceptance Criteria.** Vol 14 §AC-4.

---

## Engine 5 — Tenant Configuration Engine

**Purpose.** Hold all per-tenant settings that aren't branding, roles, or flags: locale defaults, commerce config, proctoring level, integrations, notification preferences, policy text.

**Objectives.** One typed, validated, versioned config object per tenant; safe to read everywhere; safe to change without deploy.

**Functional Requirements.**
- FR1. Namespaced config sections (`commerce`, `proctoring`, `community`, `notifications`, `localization`, `integrations`, `security`).
- FR2. Each section validated by a Zod schema; invalid config rejected.
- FR3. Config is versioned; rollback supported; effective config resolved with platform defaults underlay.
- FR4. Sensitive values (API keys, secrets) stored encrypted / referenced from a secrets vault, never in plaintext config.

**Non-Functional.** Config read is cached; change propagation <60s.

**Permissions.** `tenant.config.read`, `tenant.config.manage` (section-scoped).

**Database.** `tenant_config`, `tenant_config_version`, `tenant_secrets` (encrypted/ref).

**API.** `GET/PUT /api/tenant/config/:section`.

**Security.** Secrets encrypted at rest (envelope encryption); access audited; never returned in plaintext to the client (write-only / masked).

**Analytics.** `config.updated`.

**Acceptance Criteria.** Vol 14 §AC-5.

---

# Domain B — Presentation

## Engine 6 — Website Builder Engine

**Purpose.** Let tenants build public marketing/landing/sales pages (and a course catalogue) without code, on their own domain and brand.

**Objectives.** Tenant can publish a multi-page branded site; pages are fast (SSR/ISR) and SEO-correct.

**Functional Requirements.**
- FR1. Page model: pages composed of typed **blocks** (hero, features, pricing, testimonials, FAQ, CTA, course grid, instructor bio, rich text, embed).
- FR2. Drag/reorder blocks; edit block content; per-block visibility.
- FR3. Draft/publish workflow with preview URL; published pages rendered via Next.js ISR.
- FR4. SEO: per-page title/description/OG image/canonical; sitemap; structured data for courses.
- FR5. Pages inherit Theme (Engine 7) and Branding (Engine 2).

**Non-Functional.** Published pages p95 TTFB target met via ISR + CDN; accessible (WCAG AA) block components.

**Permissions.** `site.page.read`, `site.page.manage`, `site.page.publish`.

**Database.** `site_pages`, `site_page_blocks`, `site_page_version`.

**API.** `GET/POST/PUT /api/tenant/site/pages`, `POST .../publish`.

**Security.** Block content sanitized; embeds allow-listed; no arbitrary script injection.

**Analytics.** Page views, CTA clicks, catalogue→checkout funnel (PostHog).

**Acceptance Criteria.** Vol 14 §AC-6.

---

## Engine 7 — Theme Engine

**Purpose.** Provide design tokens and component theming that turn branding into a coherent visual system across all surfaces.

**Functional Requirements.**
- FR1. Token set: colour scales (derived from brand primary), radius, spacing, font, shadow, dark/light mode.
- FR2. shadcn/ui components consume tokens via CSS variables; tenant theme = a token override layer.
- FR3. A small number of curated "presets" plus custom token editing (entitlement-gated).
- FR4. Themes versioned; preview before apply.

**NFR.** Theme application is build-free (CSS variables at runtime); no per-tenant CSS bundles.

**Permissions.** `tenant.theme.read`, `tenant.theme.manage`.

**Database.** `tenant_theme`, `tenant_theme_version`.

**API.** `GET/PUT /api/tenant/theme`.

**Security.** Token values validated (no CSS injection via token strings).

**Analytics.** `theme.updated`.

**Acceptance Criteria.** Vol 14 §AC-7.

---

## Engine 8 — Domain Management Engine

**Purpose.** Map tenants to subdomains and custom domains with automated TLS, via Cloudflare + Vercel.

**Functional Requirements.**
- FR1. Each tenant gets `*.atlas` subdomain by default.
- FR2. Custom domain (entitlement-gated): tenant adds domain → system shows DNS records → verifies → provisions TLS (Vercel/Cloudflare) → activates → updates edge host→tenant map.
- FR3. Domain states: `pending → verifying → active → error`. Health re-checked periodically.
- FR4. One primary domain per tenant; redirects for aliases.

**NFR.** TLS issuance automated; host→tenant map propagates to edge <60s.

**Permissions.** `tenant.domain.read`, `tenant.domain.manage`.

**Database.** `tenant_domains`.

**API.** `GET/POST /api/tenant/domains`, `POST .../:id/verify`.

**Security.** Domain ownership verified before activation (prevents host takeover / tenant spoofing). No two tenants can claim the same active domain.

**Analytics.** `domain.added`, `domain.verified`, `domain.failed`.

**Acceptance Criteria.** Vol 14 §AC-8.

---

*(Continued in `02-functional-requirements-part2.md` — Learning, Integrity, Community, Live, Commerce domains.)*


---

# Volume 2 (cont.) — Functional Requirements, Part 2

Continues the engine catalogue. Template as defined in Part 1.

---

# Domain C — Learning

## Engine 9 — LMS Engine

**Purpose.** The core content model and delivery: courses → modules → lessons, enrollment, progress, and consumption across web and mobile. This is the heart of the product.

**Objectives.**
- Authors can structure and publish courses with mixed content (video reference, text, file, embed, quiz).
- Learners progress is tracked accurately and resumes anywhere.
- Drip/scheduling and prerequisites supported.

**Functional Requirements.**
- FR1. **Content hierarchy:** `Course → Module (Section) → Lesson`. Lessons have a `type`: `video | text | pdf | embed | quiz | assignment | live`. Video lessons store `video_provider` + `video_url` only (no hosting).
- FR2. **Authoring:** create/edit/reorder courses, modules, lessons; rich text; attach R2 files; set thumbnails; set pricing reference (links to Commerce).
- FR3. **Publishing:** draft → review (optional Workflow Engine) → published → archived. Only published, entitled content is learner-visible.
- FR4. **Enrollment:** free, paid (via Commerce), invite, or auto (via Learning Path / Automation). Enrollment is tenant-scoped and access-controlled.
- FR5. **Progress:** per-lesson completion (manual mark, video threshold %, quiz pass); course % derived; resume position; last-accessed.
- FR6. **Access rules:** drip by date or by days-since-enroll; prerequisite lessons/modules; sequential vs free navigation.
- FR7. **Content protection:** lesson access checked server-side on every fetch; signed URLs for R2 files; video provider privacy (unlisted/signed embeds).

**Non-Functional.** Lesson load p95 fast; progress writes are idempotent and offline-tolerant (mobile syncs). Authoring autosaves.

**User Stories.**
- As an **instructor**, I want to build a course from modules and lessons and publish it, so that learners can take it.
- As a **learner**, I want my progress saved and resumable on any device, so that I never lose my place.
- As an **admin**, I want paid courses locked until purchase, so that revenue is protected.

**User Flows.**
- *Author:* New course → add modules → add lessons (pick type, add content) → set access/pricing → publish.
- *Learn:* Browse/enroll → open course → consume lessons → progress tracked → completion triggers Automation (certificate, next path step).

**Permissions.** `lms.course.read`, `lms.course.create`, `lms.course.edit` (ownership-scoped), `lms.course.publish`, `lms.enrollment.manage`, `lms.progress.read`.

**Database.** `courses`, `modules`, `lessons`, `lesson_assets`, `enrollments`, `lesson_progress`. (Vol 4.)

**API.**
- `GET/POST /api/tenant/courses`, `PUT /api/tenant/courses/:id`, `POST .../publish`.
- `GET /api/tenant/courses/:id/lessons/:lessonId` (access-checked).
- `POST /api/tenant/enrollments`, `POST /api/tenant/progress`.

**Security.** Every content fetch authorizes enrollment + publish state + tenant. No client-trusted "isUnlocked" flags. Signed, expiring asset URLs.

**Analytics.** `course.published`, `lesson.started/completed`, `course.completed`, drop-off per lesson, time-on-lesson.

**Acceptance Criteria.** Vol 14 §AC-9.

---

## Engine 10 — Learning Path Engine

**Purpose.** Sequence multiple courses/assessments into guided programs (tracks, curricula, cohorts) with prerequisites and milestones.

**Functional Requirements.**
- FR1. A **Path** = ordered steps; a step references a course, assessment, live session, or sub-path.
- FR2. Completion rules per step; gating (must complete step N to unlock N+1) or open.
- FR3. Cohort support: a path can run as a scheduled cohort with start/end and shared community.
- FR4. Progress rolls up across steps; path completion can trigger certification.

**NFR.** Path progress derived consistently from underlying engine progress; no double source of truth.

**Permissions.** `path.read`, `path.manage`, `path.enroll`.

**Database.** `learning_paths`, `path_steps`, `path_enrollments`, `path_step_progress`.

**API.** `GET/POST /api/tenant/paths`, `POST .../enroll`.

**Security.** Step unlock enforced server-side.

**Analytics.** Path enrollment, step completion, path completion, time-to-complete.

**Acceptance Criteria.** Vol 14 §AC-10.

---

## Engine 11 — Assessment Engine

**Purpose.** Author and deliver quizzes/exams/assignments with question banks, scoring, attempts, and integration with Proctoring.

**Objectives.** Reliable, fair, cheat-resistant assessment with rich item types and defensible scoring.

**Functional Requirements.**
- FR1. **Item types:** MCQ (single/multi), true/false, fill-blank, short answer, long answer (manual graded), matching, ordering, code (future), file-upload assignment.
- FR2. **Question banks** per tenant; tags/difficulty; reuse across assessments; randomized selection (N from pool).
- FR3. **Assessment config:** time limit, attempts allowed, pass mark, question/option shuffling, navigation mode, show-answers policy, weightage.
- FR4. **Attempts:** start → answer → submit (or auto-submit on timeout); server-authoritative timing; autosave per answer; resume on disconnect within window.
- FR5. **Scoring:** auto-grade objective items; route subjective items to grader queue; final score = weighted sum; pass/fail computed.
- FR6. **Proctoring hook:** assessment may require Proctoring level 1–3 (Engine 14); violations attach to the attempt; risk score surfaced to grader.
- FR7. **Review & analytics:** per-item statistics (difficulty, discrimination), learner review (policy-bound).

**Non-Functional.** Timing is server-side and tamper-resistant; autosave guarantees no lost answers on crash; large pools paginate; grading queue scales.

**User Stories.**
- As an **instructor**, I want a question bank and randomized exams, so that cheating by sharing answers is harder.
- As a **learner**, I want my answers saved continuously, so that a dropped connection doesn't cost me.
- As a **grader**, I want subjective answers queued with the learner's proctoring risk, so that I can grade fairly and flag integrity issues.

**User Flows.**
- *Author:* Create assessment → add/select items → configure rules → set proctoring level → publish.
- *Take:* Start (proctoring pre-checks) → answer (autosave) → submit/auto-submit → objective auto-scored → subjective queued → result released per policy.
- *Grade:* Grader opens queue → reviews answer + proctoring timeline → scores → feedback → finalize.

**Permissions.** `assessment.read`, `assessment.author`, `assessment.publish`, `assessment.attempt.take`, `assessment.attempt.grade`, `assessment.bank.manage`.

**Database.** `assessments`, `questions`, `question_options`, `assessment_questions`, `attempts`, `attempt_answers`, `grading_tasks`. (Vol 4.)

**API.**
- `POST /api/tenant/assessments`, `POST .../publish`.
- `POST /api/tenant/assessments/:id/attempts` (start), `PATCH .../attempts/:aid/answers` (autosave), `POST .../attempts/:aid/submit`.
- `GET /api/tenant/grading/queue`, `POST /api/tenant/grading/:taskId`.

**Security.** Correct answers never sent to the client before grading; timing/score computed server-side; attempt mutation authorized to the attempt owner; grading authorized to graders only; all scoring changes audited.

**Analytics.** Attempt start/submit, pass rate, item difficulty/discrimination, average time, abandonment.

**Acceptance Criteria.** Vol 14 §AC-11.

---

## Engine 12 — Certification Engine

**Purpose.** Issue verifiable, branded certificates on completion of courses/paths/assessments, with public verification.

**Functional Requirements.**
- FR1. **Templates:** branded certificate templates (R2-stored design + dynamic fields: learner, course, date, score, credential ID).
- FR2. **Issuance:** triggered by Automation (e.g., course completed + assessment passed); generates a PDF + a record.
- FR3. **Credential ID & verification:** each certificate has a unique, tamper-evident ID and a public verification URL/QR confirming authenticity (tenant-branded).
- FR4. **Revocation:** certificates can be revoked (with reason); verification reflects status.
- FR5. **Expiry/renewal:** optional validity period and renewal flow.

**NFR.** Verification endpoint is public, cached, and discloses only minimal necessary info (privacy-aware).

**Permissions.** `cert.template.manage`, `cert.issue`, `cert.revoke`, `cert.read`.

**Database.** `certificate_templates`, `certificates`.

**API.** `POST /api/tenant/certificates` (issue), `POST .../:id/revoke`, public `GET /verify/:credentialId`.

**Security.** Credential IDs unguessable; PDFs stored in R2 with signed access for the owner; public verify reveals authenticity, not PII beyond what's necessary.

**Analytics.** Certificates issued, verified, revoked.

**Acceptance Criteria.** Vol 14 §AC-12.

---

## Engine 13 — Gamification Engine

**Purpose.** Drive engagement via points, badges, levels, streaks, and leaderboards — tenant-configurable.

**Functional Requirements.**
- FR1. **Points** awarded on configurable events (lesson complete, assessment pass, post, streak).
- FR2. **Badges** with rules; **levels** from cumulative points; **streaks** for daily activity.
- FR3. **Leaderboards** (cohort/course/tenant), with privacy controls and time windows.
- FR4. Rules are tenant-config; can be disabled entirely.

**NFR.** Point awards idempotent (no double-award on retries); leaderboards computed efficiently.

**Permissions.** `gamification.config.manage`, `gamification.read`.

**Database.** `point_rules`, `point_ledger`, `badges`, `user_badges`, `leaderboards`.

**API.** `GET /api/tenant/gamification/me`, `GET .../leaderboard`, config under admin.

**Security.** Points are server-awarded only; ledger append-only; anti-abuse limits.

**Analytics.** Engagement lift, badge distribution, streak retention.

**Acceptance Criteria.** Vol 14 §AC-13.

---

# Domain D — Integrity

## Engine 14 — Proctoring Engine

**Purpose.** Detect and record integrity violations during assessments across three escalating levels, producing violations, a timeline, and a risk report.

**Objectives.** Deter and evidence cheating with proportionate, privacy-respecting monitoring; give graders defensible signals; minimize false positives.

**Functional Requirements.**
- FR1. **Level 1 (browser integrity, client signals, server-recorded):** tab-switch/visibility change, window blur, fullscreen exit, copy/paste, right-click, devtools-open heuristic. Each event timestamped against the attempt.
- FR2. **Level 2 (media monitoring):** webcam face detection (on-device), multiple-face detection, face-absent detection, microphone activity/voice presence. Periodic snapshots/heuristics; raw media handling governed by consent + retention policy.
- FR3. **Level 3 (identity & AI):** pre-exam identity verification (ID + face match), AI risk scoring aggregating signals, behavioural analysis (gaze/movement patterns). *Phased; entitlement + consent gated.*
- FR4. **Outputs:** a violation list, a chronological **timeline**, and a computed **risk score + report** attached to the attempt and surfaced to graders.
- FR5. **Configuration:** per-assessment level; thresholds tenant-configurable; graceful degradation if a signal is unavailable (recorded, not blocking, unless policy requires).
- FR6. **Consent & transparency:** learner is informed and consents to the active level before starting; data retention windows enforced.

**Non-Functional.** Client signal capture must not break the exam if a sensor is denied (degrade + record); media processing favours on-device to limit PII transfer; storage of biometric-adjacent data is minimized, encrypted, and time-bounded.

**User Stories.**
- As a **certification provider**, I want L2/L3 proctoring on high-stakes exams, so that credentials are trustworthy.
- As a **learner**, I want clear disclosure of what's monitored and for how long, so that I can consent informedly.
- As a **grader**, I want a violation timeline and risk score, so that I can adjudicate fairly rather than guess.

**User Flows.**
- *Pre-exam:* consent screen → device/permission checks → (L3) identity verification → start.
- *During:* signals streamed/buffered → recorded against attempt → live flags for severe events.
- *Post:* risk report generated → attached to attempt → grader reviews → outcome (accept / flag / void) → audited.

**Permissions.** `proctoring.config.manage`, `proctoring.report.read`, `proctoring.attempt.review`.

**Database.** `proctoring_sessions`, `proctoring_events`, `proctoring_reports`, `identity_verifications` (L3). Media artifacts in R2 with strict retention.

**API.** `POST /api/tenant/proctoring/sessions`, `POST .../events` (batched), `GET .../reports/:attemptId`.

**Security.** Explicit consent recorded; biometric/media data encrypted at rest, access-restricted, retention-limited, and excluded from general analytics; compliance posture (GDPR/biometric laws) tracked in Vol 5. Risk scores are decision-support, not automatic punishment.

**Analytics.** Violation rates by type, false-positive review outcomes, risk-score distribution, dispute rate.

**Acceptance Criteria.** Vol 14 §AC-14.

---

## Engine 15 — Exam Security Engine

**Purpose.** Harden the exam delivery channel itself (distinct from behavioural proctoring): secure delivery, anti-tamper, lockdown, and content protection.

**Functional Requirements.**
- FR1. Server-authoritative timing & state; no client-trusted score/time.
- FR2. Question/option shuffling and per-attempt randomization to reduce sharing value.
- FR3. Optional "secure mode": fullscreen-enforced, copy/paste blocked, navigation locked, single active session per attempt.
- FR4. One-attempt-at-a-time concurrency lock; detect concurrent sessions for same user/attempt.
- FR5. Rate-limit and anomaly-detect attempt APIs; sign attempt tokens.

**NFR.** Tamper attempts are detected and recorded, not silently ignored.

**Permissions.** Inherited via Assessment; `exam.security.config`.

**Database.** Extends `attempts` (session token, lock state, anomaly flags).

**API.** Hooks within attempt lifecycle endpoints.

**Security.** Defence in depth with Proctoring; assumes the client is hostile.

**Analytics.** Tamper/anomaly counts, secure-mode adoption.

**Acceptance Criteria.** Vol 14 §AC-15.

---

# Domain E — Community

## Engine 16 — Community Engine

**Purpose.** Native community: spaces, posts, comments, reactions, mentions, groups — public or private, tenant-scoped — plus bridges to external platforms.

**Functional Requirements.**
- FR1. **Spaces** (forums/feeds), **posts**, threaded **comments**, **reactions**, **@mentions**, **groups** (membership-gated spaces).
- FR2. Visibility: public (catalogue-visible) vs private (members/enrolled only).
- FR3. Feed (chronological + pinned); follow/notify on mentions and replies (via Notification Engine).
- FR4. Media in posts via R2 (validated/scanned).
- FR5. **External integrations:** link/sync to Discord, Telegram, Slack (and future WhatsApp) — e.g., role-gated invites, cross-post/announce (handled with Integration Engine).

**NFR.** Feeds paginate efficiently; mention/notify is async; community scales per tenant.

**Permissions.** `community.read`, `community.post`, `community.comment`, `community.moderate`, `community.space.manage`.

**Database.** `community_spaces`, `posts`, `comments`, `reactions`, `community_groups`, `group_members`.

**API.** `GET/POST /api/tenant/community/spaces/:id/posts`, comments/reactions sub-resources.

**Security.** Private space access checked server-side per request; uploads scanned; external bridges use scoped, revocable tokens.

**Analytics.** DAU/MAU, posts/comments, reaction rate, top contributors.

**Acceptance Criteria.** Vol 14 §AC-16.

---

## Engine 17 — Content Moderation Engine

**Purpose.** Keep community safe and on-policy via reporting, queues, automated filtering, and moderator actions.

**Functional Requirements.**
- FR1. User **reporting** of posts/comments/users with reasons.
- FR2. Moderation **queue** for moderators; actions: hide, delete, warn, mute, ban (tenant-scoped).
- FR3. Automated pre-filters: profanity/keyword lists, spam heuristics, link/attachment scanning; optional AI classification (future, human-confirmed).
- FR4. Audit trail of all moderation actions; appeal path.

**NFR.** Moderation actions are reversible where appropriate and always audited.

**Permissions.** `community.moderate`, `moderation.queue.read`, `moderation.action`.

**Database.** `content_reports`, `moderation_actions`, `moderation_rules`.

**API.** `POST /api/tenant/reports`, `GET /api/tenant/moderation/queue`, `POST .../actions`.

**Security.** Moderator powers tenant-scoped; bans enforced at access checks; PII in reports minimized.

**Analytics.** Report volume, time-to-action, action mix, repeat-offender rate.

**Acceptance Criteria.** Vol 14 §AC-17.

---

# Domain F — Live

## Engine 18 — Live Learning Engine

**Purpose.** Schedule and run live/cohort sessions, integrating external video conferencing (Zoom/Meet/etc.) with attendance and recordings (recordings stored as provider references).

**Functional Requirements.**
- FR1. Schedule sessions tied to a course/path/cohort; calendar + reminders (Notification Engine).
- FR2. Provider-agnostic conferencing link (Zoom/Meet/etc.) via Integration Engine; join gated by enrollment.
- FR3. Attendance capture (join/leave); session recording reference (provider URL) attached as a lesson afterwards.
- FR4. Time-zone-aware scheduling (Localization Engine).

**NFR.** Reminders reliable; join links protected (not publicly shareable beyond entitled users).

**Permissions.** `live.session.manage`, `live.session.join`, `live.attendance.read`.

**Database.** `live_sessions`, `session_attendance`.

**API.** `POST /api/tenant/live/sessions`, `POST .../:id/join` (returns gated link), `GET .../attendance`.

**Security.** Join authorization server-side; links time-boxed; recordings access-controlled.

**Analytics.** Attendance rate, live→completion correlation.

**Acceptance Criteria.** Vol 14 §AC-18.

---

## Engine 19 — Webinar Engine

**Purpose.** One-to-many broadcast events (lead-gen webinars, masterclasses), optionally public, with registration funnels.

**Functional Requirements.**
- FR1. Public/registration landing (via Website Builder) → registrants captured → reminders → join.
- FR2. Live or simulated-live (scheduled replay) modes; replay/recording reference.
- FR3. Registrant → learner conversion handoff (Automation): post-webinar offers/enrollment.
- FR4. Capacity/limits per entitlement.

**NFR.** Registration scalable; reminders timely.

**Permissions.** `webinar.manage`, `webinar.register`.

**Database.** `webinars`, `webinar_registrations`.

**API.** `POST /api/tenant/webinars`, public `POST .../:id/register`.

**Security.** Registration anti-bot; PII consent captured.

**Analytics.** Registration→attendance→conversion funnel.

**Acceptance Criteria.** Vol 14 §AC-19.

---

## Engine 20 — Event Management Engine

**Purpose.** Manage broader events (multi-session, ticketed, agenda-based) beyond a single live/webinar instance.

**Functional Requirements.**
- FR1. Event = agenda of sessions, speakers, ticket types (free/paid via Commerce), capacity.
- FR2. Registration/ticketing; check-in; per-session attendance.
- FR3. Event landing pages (Website Builder); calendar export.

**NFR.** Handles paid ticketing through the same provider-agnostic Commerce layer.

**Permissions.** `event.manage`, `event.register`, `event.checkin`.

**Database.** `events`, `event_sessions`, `event_tickets`, `event_registrations`.

**API.** `POST /api/tenant/events`, `POST .../:id/register`, `POST .../checkin`.

**Security.** Ticket validation; capacity enforced server-side.

**Analytics.** Sales, attendance, session popularity.

**Acceptance Criteria.** Vol 14 §AC-20.

---

# Domain G — Commerce (engines 21–25)

> Commerce is specified in depth in **Volume 6**. Summarized here for the engine catalogue.

## Engine 21 — Payment Integration Engine
**Purpose.** Provider-agnostic payment orchestration. Supports one-time, memberships, subscriptions, installments, refunds across Stripe/PayPal/Paddle/LemonSqueezy (global) and Razorpay/Cashfree/PayU/PhonePe Business/CCAvenue (India), plus future crypto (Coinbase Commerce/NOWPayments). **Never hardcodes a provider** — all flows go through a `PaymentProvider` interface (Vol 6 §6.2). Owns `orders`, `payments`, `payment_provider_accounts`, `refunds`. Webhooks normalized to internal events. **AC:** Vol 14 §AC-21.

## Engine 22 — Subscription Engine
**Purpose.** Recurring access: memberships, plans, billing cycles, trials, dunning, upgrades/downgrades, proration. Provider-agnostic. Owns `subscriptions`, `subscription_plans`. **AC:** §AC-22.

## Engine 23 — Coupon Engine
**Purpose.** Discounts: percentage/fixed, time/usage-limited, per-product/plan, stacking rules, referral codes. Owns `coupons`, `coupon_redemptions`. Validated server-side at checkout. **AC:** §AC-23.

## Engine 24 — Tax Engine
**Purpose.** Compute applicable tax (GST/VAT/sales tax) by jurisdiction; tenant tax config; inclusive/exclusive pricing; tax on invoices. Pluggable tax-rate source. Owns `tax_rules`, `tax_records`. **AC:** §AC-24.

## Engine 25 — Invoice Engine
**Purpose.** Generate branded, compliant invoices/receipts (R2 PDFs) for every transaction; sequential numbering per tenant; credit notes for refunds. Owns `invoices`. **AC:** §AC-25.

---

*(Continued in `02-functional-requirements-part3.md` — Platform Services, Orchestration, Extensibility, SaaS, AI.)*


---

# Volume 2 (cont.) — Functional Requirements, Part 3

Continues the engine catalogue (engines 26–40). Template as in Part 1.

---

# Domain H — Platform Services

## Engine 26 — Notification & Communication Engine

**Purpose.** Deliver the right message on the right channel: email, push (mobile/web), in-app, SMS, WhatsApp, Telegram — template-driven, branded, preference-aware, tenant-scoped.

**Objectives.** Reliable multi-channel delivery; tenant-branded; user-controllable preferences; auditable.

**Functional Requirements.**
- FR1. **Channels:** email (transactional via provider), push (Expo/FCM/APNs), in-app notifications, SMS, WhatsApp, Telegram. Channel adapters behind a common `NotificationChannel` interface (provider-agnostic, mirrors payment pattern).
- FR2. **Templates** per event, per channel, per locale; branded header/footer/sender (White Label Engine); variables validated.
- FR3. **Preferences:** per-user, per-category opt-in/out; respect unsubscribe and quiet hours; mandatory transactional vs optional marketing distinction.
- FR4. **Triggering:** events from any engine (e.g., `course.completed`, `payment.failed`) enqueue notifications via Automation/event bus; async, retried, idempotent.
- FR5. **Delivery tracking:** queued/sent/delivered/failed/opened where supported; dead-letter for failures.

**Non-Functional.** Async + retried with backoff; idempotent (no duplicate sends on retry); per-tenant rate limits; provider failover for email.

**User Stories.** As a **learner**, I want to control which notifications I get and on which channel, so that I'm informed but not spammed. As an **admin**, I want branded emails from my domain, so that learners trust them.

**User Flows.** Engine emits event → Automation maps to notification(s) → preferences/quiet-hours applied → channel adapter sends → status tracked → failures retried/dead-lettered.

**Permissions.** `notification.template.manage`, `notification.send` (system), `notification.preferences.manage` (self).

**Database.** `notification_templates`, `notifications`, `notification_preferences`, `notification_deliveries`.

**API.** `GET/PUT /api/me/notification-preferences`, admin template CRUD, internal send service.

**Security.** No PII in logs; sender domains verified (SPF/DKIM/DMARC); WhatsApp/SMS opt-in compliance; unsubscribe honoured.

**Analytics.** Send/delivery/open rates, channel mix, opt-out rate.

**Acceptance Criteria.** Vol 14 §AC-26.

---

## Engine 27 — Integration Engine

**Purpose.** Connect Atlas to external systems via Zapier, Make, native CRM integrations, webhooks (outbound), and a public API (inbound) — securely and per-tenant.

**Functional Requirements.**
- FR1. **Outbound webhooks:** tenant subscribes endpoints to events; signed payloads (HMAC); retries with backoff; delivery log.
- FR2. **Inbound API:** scoped API keys per tenant (least-privilege), rate-limited, versioned.
- FR3. **Zapier/Make:** triggers (events) and actions (create enrollment, issue cert, etc.) exposed.
- FR4. **CRM/connectors:** pluggable connector interface; OAuth where applicable; secrets vaulted.
- FR5. Integration registry per tenant; enable/disable; health/status.

**NFR.** Webhook delivery reliable and observable; secrets never exposed; connectors isolated.

**Permissions.** `integration.manage`, `apikey.manage`, `webhook.manage`.

**Database.** `integrations`, `webhook_subscriptions`, `webhook_deliveries`, `api_keys`.

**API.** `POST /api/tenant/webhooks`, `POST /api/tenant/api-keys`, public versioned API surface.

**Security.** Signed webhooks; scoped, rotatable, revocable keys; OAuth tokens vaulted; SSRF protection on outbound calls; per-key rate limits.

**Analytics.** Webhook success/failure, API usage by key, top integrations.

**Acceptance Criteria.** Vol 14 §AC-27.

---

## Engine 28 — Search Engine

**Purpose.** Fast, tenant-scoped search across courses, lessons, community, users, and content, with relevance and filters.

**Functional Requirements.**
- FR1. Index courses/lessons/posts/users per tenant; incremental updates on writes.
- FR2. Full-text + filters (type, tag, status); typo tolerance; relevance ranking.
- FR3. Permission-aware results (never return content the user can't access).
- FR4. Implementation: PostgreSQL full-text search to start (tsvector + GIN), with an adapter boundary allowing a dedicated search service later without API change.

**NFR.** Query p95 fast; index lag bounded; scoped strictly by tenant.

**Permissions.** Inherits resource read permissions; results filtered post-authorization.

**Database.** Search vectors on indexed tables; optional `search_documents` projection.

**API.** `GET /api/tenant/search?q=...&type=...`.

**Security.** Results filtered by tenant + access; no leakage of unpublished/locked content.

**Analytics.** Query volume, zero-result rate, click-through.

**Acceptance Criteria.** Vol 14 §AC-28.

---

## Engine 29 — Enterprise Analytics Engine

**Purpose.** Provide dashboards and reports for students, instructors, tenants, revenue, assessments, communities, and the SaaS platform — with export.

**Functional Requirements.**
- FR1. **Audiences/scopes:** learner (my progress), instructor (my courses/learners), tenant admin (whole-tenant), super admin (platform). Each scope strictly bounded.
- FR2. **Domains:** learning (completion, time, drop-off), assessment (pass rates, item stats), revenue (MRR, sales, refunds, by product), community (engagement), proctoring (integrity), platform (tenant health, churn).
- FR3. Event pipeline: engines emit canonical events → stored → aggregated; PostHog for product analytics, internal warehouse/materialized views for reporting.
- FR4. Custom date ranges, segments, cohorts; CSV/export; scheduled reports (Automation).
- FR5. Foundations for AI Analytics (Engine 40) — clean event taxonomy.

**NFR.** Dashboards load fast via pre-aggregation/materialized views; heavy reporting offloaded from OLTP; tenant-scoped.

**Permissions.** `analytics.self`, `analytics.instructor`, `analytics.tenant`, `analytics.platform`.

**Database.** `analytics_events`, materialized aggregates; PostHog external.

**API.** `GET /api/tenant/analytics/:domain`, export endpoints.

**Security.** Strict scope enforcement (no cross-tenant aggregation except platform scope); PII-aware exports.

**Analytics.** (Meta) usage of analytics itself.

**Acceptance Criteria.** Vol 14 §AC-29.

---

## Engine 30 — Audit Logging Engine

**Purpose.** Maintain an append-only, tamper-evident record of security- and integrity-relevant actions for forensics, compliance, and dispute resolution.

**Functional Requirements.**
- FR1. Log: auth events, permission/role changes, payments/refunds, grading changes, publish/unpublish, exports, admin actions, config/secret changes, proctoring decisions, tenant lifecycle.
- FR2. Each entry: tenant, actor, action, target, before/after (where applicable), IP/UA, timestamp, request ID.
- FR3. Append-only (no update/delete via app); retention policy per compliance; queryable by admins (scoped) and super admin (platform).
- FR4. Exportable for compliance evidence.

**NFR.** Writing audit logs must not block the critical path (async where safe) but must be guaranteed for irreversible actions (durable). Integrity-protected (hash chaining optional).

**Permissions.** `audit.read` (tenant-scoped), `platform.audit.read`.

**Database.** `audit_logs` (append-only; partitioned by time/tenant).

**API.** `GET /api/tenant/audit`, `GET /api/platform/audit`.

**Security.** Immutable; access tightly controlled; no sensitive raw secrets in logs (masked).

**Analytics.** Audit volume by action; anomaly detection feed.

**Acceptance Criteria.** Vol 14 §AC-30.

---

# Domain I — Orchestration

## Engine 31 — Automation Engine

**Purpose.** Event-condition-action rules: *IF something happens AND conditions THEN do actions* — the connective tissue between engines.

**Functional Requirements.**
- FR1. **Triggers:** any canonical platform event (`course.completed`, `payment.failed`, `enrollment.created`, `assessment.passed`, …).
- FR2. **Conditions:** filters on event/context (tenant, course, score, plan).
- FR3. **Actions:** issue certificate, enroll in path, send notification, add to group, tag user, call webhook, grant points, etc.
- FR4. Tenant-authored rules in a guided builder; system-provided defaults (e.g., "course completed → issue certificate"); enable/disable; execution log.
- FR5. Idempotent, retried, observable execution.

**NFR.** Rules evaluate async off the event bus; failures retried/dead-lettered; no infinite loops (cycle guards).

**User Stories.** As an **admin**, I want "IF course completed THEN issue certificate" and "IF payment failed THEN send reminder", so that operations run themselves.

**Permissions.** `automation.manage`, `automation.read`.

**Database.** `automation_rules`, `automation_runs`.

**API.** `POST /api/tenant/automations`, `GET .../runs`.

**Security.** Actions execute with system authority but constrained to the rule's tenant; webhook actions SSRF-guarded.

**Analytics.** Rule fire counts, success/failure, time saved.

**Acceptance Criteria.** Vol 14 §AC-31.

---

## Engine 32 — Workflow Engine

**Purpose.** Multi-step human approval workflows (stateful), e.g., course review: Instructor → Reviewer → Admin → Publish. Distinct from Automation (rules) — Workflow models *processes with human steps and states*.

**Functional Requirements.**
- FR1. Define workflow templates: ordered stages, assignees/roles per stage, transitions (approve/reject/return), SLAs.
- FR2. Instances track current stage, history, comments, decisions.
- FR3. Notifications on assignment/decision (Notification Engine).
- FR4. Used by: course publishing review, certificate issuance approval (where required), content moderation escalation, AI-content human approval (mandatory).

**NFR.** Auditable state transitions; no stage skipped without permission.

**User Stories.** As a **reviewer**, I want courses routed to me for approval before publish, so that quality is controlled. As an **admin**, I must approve AI-generated content before it goes live (non-negotiable).

**Permissions.** `workflow.manage`, stage-specific action permissions.

**Database.** `workflows`, `workflow_stages`, `workflow_instances`, `workflow_transitions`.

**API.** `POST /api/tenant/workflows`, `POST .../instances/:id/transition`.

**Security.** Transition authorization enforced; full audit trail.

**Analytics.** Cycle time per stage, approval/rejection rates, bottlenecks.

**Acceptance Criteria.** Vol 14 §AC-32.

---

## Engine 33 — Localization Engine

**Purpose.** Multi-language UI/content, regional settings, currency and date/number formatting — per tenant and per user.

**Functional Requirements.**
- FR1. UI i18n (message catalogues) with tenant-overridable strings; locale fallback chain.
- FR2. Content localization: courses/lessons can have locale variants (future-friendly schema).
- FR3. Regional settings: timezone, currency display, date/number formats, first-day-of-week.
- FR4. Right-to-left support; locale auto-detection with user override.

**NFR.** Locale resolution cached; missing translations fall back gracefully.

**Permissions.** `localization.manage`, user self locale.

**Database.** `locales`, `translations`, locale fields on content; user `locale` preference.

**API.** `GET /api/tenant/locales`, translation management endpoints.

**Security.** Translation inputs sanitized.

**Analytics.** Locale distribution, missing-translation hotspots.

**Acceptance Criteria.** Vol 14 §AC-33.

---

# Domain J — Extensibility

## Engine 34 — Plugin / Extension Engine

**Purpose.** Allow first-party and (later) third-party extensions to add capability without core changes — AI Tutor, Marketplace add-ons, Affiliate System, Advanced Proctoring, Custom Reports.

**Functional Requirements.**
- FR1. **Extension points / hooks:** documented events and slots (server hooks on lifecycle events; UI extension slots) that plugins subscribe to.
- FR2. **Plugin manifest:** declares permissions, hooks, settings, entitlements; installed per tenant.
- FR3. **Isolation & safety:** plugins run with declared, least-privilege scopes; sandboxed; cannot bypass tenant isolation or RBAC.
- FR4. **Lifecycle:** install/enable/configure/disable/uninstall per tenant; versioning.
- FR5. First-party plugins ship first; third-party SDK is a later phase with review/signing.

**NFR.** A misbehaving plugin cannot crash core or leak across tenants; plugin failures isolated.

**Permissions.** `plugin.manage`, `plugin.configure`.

**Database.** `plugins`, `tenant_plugins`, `plugin_settings`.

**API.** `GET /api/tenant/plugins`, install/configure endpoints; plugin SDK contract (future).

**Security.** Strict permission scoping; signed/reviewed third-party plugins; sandboxing; no raw DB access (only typed service APIs).

**Analytics.** Install rates, plugin usage, errors.

**Acceptance Criteria.** Vol 14 §AC-34.

---

## Engine 35 — Marketplace Engine

**Purpose.** A catalogue where tenants discover/install plugins, themes, and templates — and (future) creators sell courses/templates — with Atlas taking a configurable take rate. Detailed in **Volume 9**.

**Functional Requirements (summary).**
- FR1. Listings (plugins/themes/templates/courses-future), categories, search, ratings/reviews.
- FR2. Install/purchase flow via Commerce; revenue split via Revenue Sharing Engine.
- FR3. Submission + review/approval workflow for sellers; payout tracking.

**Permissions.** `marketplace.browse`, `marketplace.install`, `marketplace.sell`, `platform.marketplace.review`.

**Database.** `marketplace_listings`, `marketplace_purchases`, `marketplace_reviews`. (Vol 9.)

**Security.** Reviewed/signed artifacts; no execution of unreviewed third-party code on core.

**Acceptance Criteria.** Vol 14 §AC-35.

---

# Domain K — SaaS

## Engine 36 — Revenue Sharing Engine

**Purpose.** Compute and track money split between Atlas, tenants, and (future) marketplace sellers/affiliates. Detailed in **Volume 6/8**.

**Functional Requirements (summary).**
- FR1. Configurable split rules (platform %, tenant %, seller %, affiliate %) per context.
- FR2. Ledger of accrued shares per transaction; payout batches; reconciliation.
- FR3. Reporting/statements per party.

**Permissions.** `revenue.config`, `revenue.read`, `platform.payouts.manage`.

**Database.** `revenue_splits`, `revenue_ledger`, `payouts`.

**Security.** Financial integrity: append-only ledger, reconciliation, audit.

**Acceptance Criteria.** Vol 14 §AC-36.

---

## Engine 37 — SaaS Billing Engine

**Purpose.** Bill *tenants* for their Atlas subscription: plans, entitlements, seats, usage metering, upgrades, dunning. Detailed in **Volume 8**.

**Functional Requirements (summary).**
- FR1. Plan catalogue → entitlement sets → Feature Flag/Entitlement integration.
- FR2. Tenant subscription lifecycle (trial/active/past_due/canceled); proration; seat counting; usage metering (e.g., active learners, storage).
- FR3. Dunning + suspension on non-payment (ties to Tenant lifecycle).
- FR4. Provider-agnostic for Atlas's own billing too.

**Permissions.** `platform.billing.manage`, `tenant.billing.read`.

**Database.** `saas_plans`, `tenant_subscriptions`, `usage_records`, `entitlements`.

**Security.** Entitlement source of truth for gating; non-self-elevatable.

**Acceptance Criteria.** Vol 14 §AC-37.

---

## Engine 38 — Tenant Provisioning Engine

**Purpose.** Create and tear down tenants reliably: from signup → fully usable tenant (and reverse), with no manual steps.

**Functional Requirements.**
- FR1. **Provision:** create tenant record → seed default roles/permissions, default config, default branding/theme, default subdomain, owner admin user, sample content (optional) → set state `active`. Idempotent and transactional (or saga with compensation).
- FR2. **De-provision:** suspend → archive → (after retention) delete, with export offered first (Data Ownership).
- FR3. **Clone/template:** provision from a template tenant (useful for resellers).
- FR4. Observable provisioning steps; failures recoverable.

**NFR.** Provisioning completes within seconds; partial failures don't leave half-tenants (compensating transactions).

**Permissions.** `platform.tenant.provision`.

**Database.** `tenants`, `provisioning_jobs`.

**API.** `POST /api/platform/tenants` (provision), lifecycle endpoints.

**Security.** Only platform/automated signup can provision; provisioning audited.

**Analytics.** Time-to-provision, success rate, churn (de-provision).

**Acceptance Criteria.** Vol 14 §AC-38.

---

## Engine 39 — Mobile White Label Engine

**Purpose.** Deliver per-tenant branded mobile apps from one React Native/Expo codebase + backend. Detailed in **Volume 7**.

**Functional Requirements (summary).**
- FR1. Runtime branding: app fetches tenant branding/theme/config and renders accordingly (for tenants on a shared "Atlas" app or a tenant-selected experience).
- FR2. Dedicated white-label builds (entitlement-gated): custom app name, icon, splash, bundle ID, store listing — produced via parameterized Expo build pipeline (EAS) per tenant.
- FR3. Push notification registration per tenant; deep links; offline content caching.

**Permissions.** `mobile.config.manage`.

**Database.** `mobile_app_configs`.

**Security.** Per-tenant push credentials isolated; API auth identical to web; certificate pinning.

**Acceptance Criteria.** Vol 14 §AC-39.

---

# Domain L — Intelligence

## Engine 40 — AI Layer

**Purpose.** Optional, human-gated intelligence across authoring, learning support, analytics, recommendations, and proctoring. Detailed in **Volume 10**. **Future phases only.**

**Functional Requirements (summary).**
- FR1. **AI Course/Module/Lesson/Quiz/Path Generator:** produces **drafts** only; output enters the Workflow Engine for **mandatory human approval** before publish (non-negotiable invariant).
- FR2. **AI Learning Assistant (tutor):** answers learner questions grounded in the tenant's course content (RAG), with guardrails and citations; never fabricates certificates/grades.
- FR3. **AI Analytics & Recommendations:** surfaces insights (at-risk learners, next-best content) as suggestions.
- FR4. **AI Proctoring:** risk scoring/behavioural analysis as decision-support for humans (Engine 14 L3), never automatic punishment.
- FR5. All AI features are entitlement- and flag-gated, tenant-opt-in, with cost controls and content provenance labelling.

**NFR.** AI calls are rate-limited and cost-budgeted per tenant; outputs labelled as AI-generated; PII handling and data-retention controls for AI providers documented; graceful fallback when AI unavailable.

**Permissions.** `ai.generate`, `ai.review` (approval), `ai.configure`.

**Database.** `ai_generations` (draft + status + reviewer), `ai_usage`.

**Security.** No auto-publish; tenant data not used to train third-party models without explicit consent; prompt-injection defenses on the tutor; cost abuse limits.

**Analytics.** Generation volume, approval/rejection rates, tutor usage, recommendation lift.

**Acceptance Criteria.** Vol 14 §AC-40 — headline: no AI artifact reaches a published state without a recorded human approval transition.

---

## Cross-engine event taxonomy (canonical)

These events flow on the bus and drive Automation, Notifications, Analytics, and Audit:

`tenant.*`, `branding.*`, `role.*`, `flag.*`, `course.published`, `lesson.completed`, `course.completed`, `path.completed`, `assessment.passed/failed`, `attempt.submitted`, `proctoring.violation`, `certificate.issued/revoked`, `enrollment.created`, `order.paid`, `payment.failed`, `subscription.renewed/canceled`, `post.created`, `report.created`, `live.session.scheduled`, `ai.generation.created`, `workflow.transitioned`.

Each event carries `{ tenantId, actorId?, entity, entityId, occurredAt, payload }` and is the contract between engines.


---

# Volume 3 — System Architecture

This volume is a **binding contract**. Engine specs (Vol 2) describe *what*; this describes *how the system is shaped*. Implementations must conform.

## 3.1 Architectural style

Atlas is a **modular monolith on the edge**: a single Next.js (App Router) application deployed on Vercel, internally organized into the 40 engines as **bounded modules** with explicit service interfaces, fronted by Cloudflare, backed by a single PostgreSQL database (Supabase-hosted or managed Postgres), R2 for objects, and an internal event bus for async work.

We choose a modular monolith (not microservices) deliberately: it matches the team stage, keeps tenant isolation enforceable in one place, and avoids distributed-systems cost. Module boundaries are strict so that engines *could* be extracted later if scale demands.

```
                         ┌─────────────────────────────┐
        End users  ───▶  │      Cloudflare (Edge)      │  WAF, DDoS, CDN, rate-limit,
   (web + mobile)        │  host→tenant + branding map │  host routing, caching
                         └──────────────┬──────────────┘
                                        │
                         ┌──────────────▼──────────────┐
                         │     Vercel · Next.js App     │
                         │  ┌────────────────────────┐  │
                         │  │  Middleware: resolve    │  │  tenantContext, auth,
                         │  │  tenant + auth + flags  │  │  entitlements, locale
                         │  └───────────┬────────────┘  │
                         │   Server Actions / API Routes │
                         │   ┌──────── Engine modules ──┐ │
                         │   │ Foundation · Learning ·  │ │  each engine = service
                         │   │ Commerce · Community ·   │ │  interface + handlers
                         │   │ Integrity · SaaS · AI …  │ │
                         │   └───────────┬──────────────┘ │
                         └───────┬───────┼────────────────┘
                                 │       │
            ┌────────────────────┘       └───────────────┬───────────────┐
            ▼                                            ▼               ▼
   ┌──────────────────┐   ┌───────────────────┐  ┌──────────────┐ ┌─────────────┐
   │  PostgreSQL      │   │  Event Bus / Queue │  │ Cloudflare R2│ │  External   │
   │  (Prisma + RLS)  │   │ (async jobs, retry)│  │  (objects)   │ │  providers  │
   │  single shared DB│   └─────────┬─────────┘  └──────────────┘ │ pay/video/  │
   └──────────────────┘             │                              │ conf/AI/etc │
                            Workers: notifications,                 └─────────────┘
                            automation, webhooks,
                            analytics rollups, AI jobs
```

## 3.2 Request lifecycle (the most important diagram)

1. **Edge (Cloudflare):** TLS, WAF, DDoS, rate-limit, cache; resolves `host → tenant` and attaches branding hints; routes to Vercel.
2. **Middleware (Next.js):** resolves **tenant context** (host/subdomain/JWT), validates **Supabase Auth** session, loads **entitlements + feature flags + locale**, sets the PostgreSQL session GUC `app.tenant_id`. Rejects suspended tenants.
3. **Handler (Server Action / API Route):** validates input with **Zod**, runs **`can(actor, permission, resource)`** authorization, executes engine logic through the engine's service interface.
4. **Data access (Prisma):** the tenant-scoping extension injects `tenant_id`; **RLS** independently enforces isolation.
5. **Side effects:** the handler emits **canonical events** to the bus; synchronous response returns to the user; async workers handle notifications, automations, webhooks, analytics, AI.
6. **Observability:** Sentry captures errors, PostHog captures product events, Better Stack tracks uptime/logs; audit log records irreversible actions.

> Invariant: tenant scoping, authentication, and authorization are applied **before** any business logic, in a centralized, non-bypassable path.

## 3.3 Module (engine) contract

Each engine module exposes:

- A **service interface** (typed functions) — the only way other engines call it.
- **Event publishers/subscribers** — canonical events (Vol 2 taxonomy).
- **Owned tables** — only this engine writes them; others read via the service, not the DB.
- **Zod schemas** — for all external input.
- **Permission constants** — its slice of the RBAC catalogue.

Forbidden: one engine importing another engine's Prisma models directly, or reading another engine's tables. Cross-engine reads go through the service interface or events. This keeps boundaries extractable.

## 3.4 Provider-abstraction pattern (used everywhere external)

A recurring pattern decouples Atlas from third parties. Each external concern defines an interface; concrete adapters implement it; a registry/factory selects the adapter from tenant config. Applied to:

- **Payments** (`PaymentProvider`) — Stripe/Razorpay/… (Vol 6).
- **Notifications** (`NotificationChannel`) — email/SMS/WhatsApp/push/Telegram.
- **Video** (`VideoProvider`) — YouTube/Vimeo/Bunny (reference-only).
- **Conferencing** (`ConferenceProvider`) — Zoom/Meet/….
- **AI** (`AIProvider`) — model vendors.
- **Tax**, **Search**, **Storage** similarly behind interfaces.

Business logic depends only on the interface. Swapping a provider is a config change, never a code rewrite. This is enforced in review: provider SDK imports are confined to adapter files.

## 3.5 Tenant isolation architecture (defence in depth)

| Layer | Mechanism | Guarantee |
|-------|-----------|-----------|
| Edge | host→tenant map | Correct tenant resolved before app logic |
| Middleware | `tenantContext` + GUC | App always knows the active tenant |
| Prisma | tenant-scoping extension | Auto-injects `tenant_id`; rejects unscoped writes |
| PostgreSQL | Row-Level Security | DB blocks cross-tenant rows even if app is buggy |
| Authorization | `can()` + ownership | Action-level least privilege |
| Audit | append-only log | Every cross-cutting/irreversible action recorded |

The platform escape hatch (`withPlatformScope`) is the *only* sanctioned cross-tenant path, available solely to Super Admin code, always audited.

## 3.6 Async processing & event bus

- **Why async:** notifications, automations, webhooks, analytics rollups, AI generation, certificate PDF rendering, and search indexing must not block user requests.
- **Mechanism:** a durable queue (e.g., a Postgres-backed job table or a managed queue) with workers (Vercel cron/functions or a dedicated worker runtime). Each job is **idempotent**, **retried with backoff**, and **dead-lettered** on repeated failure.
- **Event bus:** engines publish canonical events; subscribers (Automation, Notification, Analytics, Audit, Search) react. Delivery is at-least-once; consumers are idempotent.

## 3.7 Caching strategy

- **Edge cache (Cloudflare):** public site pages (ISR), static assets, host→tenant/branding map (<60s invalidation).
- **App cache:** entitlements, flags, config, branding per tenant (short TTL + explicit invalidation on change).
- **DB:** materialized views for analytics; indexed reads for hot paths.
- Cache keys are always tenant-scoped to prevent cross-tenant bleed.

## 3.8 API design standards

- **Surfaces:** internal Server Actions (web/mobile RSC) + versioned REST API (`/api/v1/...`) for integrations/mobile/public.
- **Conventions:** resource-oriented; tenant implicit from context (never a client body field for scoping); pagination via cursor; consistent error envelope `{ error: { code, message, details } }`.
- **Versioning:** URL-versioned public API; additive changes preferred; deprecations announced.
- **Validation:** every endpoint validates with Zod at the boundary.
- **Auth:** session (Supabase) for first-party; scoped API keys for integrations; all authorized via `can()`.
- **Rate limiting:** per IP, per user, per API key, per tenant (Cloudflare + app-level).
- **Idempotency:** mutating public endpoints accept idempotency keys (esp. payments).

## 3.9 Scalability approach

- **Stateless app tier** on Vercel scales horizontally; all state in Postgres/R2/queue.
- **Read scaling:** read replicas + materialized views for analytics; cache hot config.
- **Write hot spots** (progress, events) batched/queued; idempotent.
- **Storage** offloaded to R2; video offloaded entirely to providers (largest scale concern removed by design).
- **Tenant growth:** new tenants = data, not infrastructure. A future "dedicated deployment" variant exists for tenants requiring physical isolation, reusing the same codebase.
- **Extraction path:** if a single engine (e.g., Proctoring media, Search, Analytics) becomes a bottleneck, its strict module boundary lets it be lifted into a separate service behind the same interface.

## 3.10 Environments & boundaries

`local → preview (per-PR on Vercel) → staging → production`. Secrets per environment in a vault (never in repo). Data never flows prod→lower without anonymization. (Detail in Vol 11.)

## 3.11 Technology rationale (brief)

- **Next.js + Vercel:** unified frontend/backend, edge middleware ideal for tenant resolution, ISR for tenant marketing sites.
- **PostgreSQL + Prisma + RLS:** relational integrity for a complex domain; RLS gives DB-enforced isolation; Prisma extension centralizes scoping.
- **Supabase Auth:** managed auth (MFA, providers) without building it; JWT carries tenant claim.
- **Cloudflare:** WAF/DDoS/CDN/edge logic in one layer.
- **R2:** S3-compatible, egress-free object storage for documents/certificates/media.
- **Expo/React Native:** one mobile codebase, per-tenant branded builds via EAS.
- **Zod everywhere:** runtime safety at every untrusted boundary.

## 3.12 Failure & resilience

- External provider outages degrade gracefully (queue + retry; user-facing fallback messaging).
- Circuit breakers around third-party calls.
- No single third party is on the critical correctness path for tenant isolation or auth.
- DR and backups in Vol 11.


---

# Volume 4 — Database Architecture

Binding contract. Single shared **PostgreSQL** database, **Prisma** ORM, **Row-Level Security** for isolation.

## 4.1 Principles

1. **Every business table carries `tenant_id`** (non-null FK to `tenants`), except a handful of truly global tables (`tenants`, platform `users` identity mapping, platform `feature_flags` defaults, `saas_plans`, the permission catalogue).
2. **RLS on every tenant table**, policy `tenant_id = current_setting('app.tenant_id')::uuid`.
3. **UUID primary keys** (`@id @default(uuid())`), `created_at`/`updated_at` on every table, soft-delete (`deleted_at`) where recovery matters.
4. **Money** stored as integer minor units + ISO currency code (never floats).
5. **Append-only** tables (`audit_logs`, `*_ledger`, `point_ledger`) never updated/deleted by the app.
6. **Indexes:** composite `(tenant_id, <hot column>)` on every frequent query path. `tenant_id` leads every multi-tenant index.
7. **JSONB** for flexible/extensible config (validated by Zod at the app boundary), not as an escape from proper columns for queryable data.

## 4.2 Isolation enforcement (the three layers, at the DB level)

**Prisma client extension (app):**
```ts
// Pseudocode — every model query auto-scoped to tenantContext.tenantId
prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const tenantId = getTenantContext()?.tenantId;
        if (TENANT_MODELS.has(model)) {
          if (isRead(operation)) args.where = { ...args.where, tenantId };
          if (isWrite(operation) && !args.data?.tenantId && tenantId)
            args.data = { ...args.data, tenantId };
          if (TENANT_MODELS.has(model) && !tenantId && !isPlatformScope())
            throw new Error("Tenant context required");
        }
        return query(args);
      },
    },
  },
});
```

**PostgreSQL RLS (database, last line of defence):**
```sql
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON courses
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
-- repeated for every tenant table; app sets:  SET app.tenant_id = '<uuid>';
```
The GUC is set per request from server-trusted tenant context, never from client input.

## 4.3 Core Prisma schema (representative)

> This is the canonical schema for foundational + learning + assessment + commerce cores. Remaining engines follow the identical pattern (every model has `tenantId`, timestamps, indexes). Treat this as the seed schema to extend.

```prisma
// ───────────────────────── Foundation ─────────────────────────
model Tenant {
  id          String   @id @default(uuid())
  slug        String   @unique            // subdomain
  name        String
  state       TenantState @default(PROVISIONING)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  branding    TenantBranding?
  theme       TenantTheme?
  config      TenantConfig?
  domains     TenantDomain[]
  users       UserTenant[]
  roles       Role[]
  subscription TenantSubscription?
}

enum TenantState { PROVISIONING ACTIVE SUSPENDED ARCHIVED DELETED }

model User {                              // platform-global identity (maps to Supabase Auth user)
  id          String   @id                // = Supabase auth uid
  email       String   @unique
  createdAt   DateTime @default(now())
  tenants     UserTenant[]
}

model UserTenant {                        // membership of a user in a tenant
  id          String   @id @default(uuid())
  tenantId    String
  userId      String
  displayName String?
  locale      String?
  status      MemberStatus @default(ACTIVE)
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  user        User     @relation(fields: [userId], references: [id])
  roles       UserRole[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([tenantId, userId])
  @@index([tenantId])
}

enum MemberStatus { ACTIVE INVITED SUSPENDED BANNED }

model TenantBranding {
  id        String  @id @default(uuid())
  tenantId  String  @unique
  displayName String
  logoUrl   String?
  faviconUrl String?
  colorPrimary String?
  colorSecondary String?
  colorAccent String?
  fontFamily String?
  copy      Json?                          // hero/footer/legal text
  tenant    Tenant @relation(fields: [tenantId], references: [id])
  updatedAt DateTime @updatedAt
}

model TenantTheme { id String @id @default(uuid()) tenantId String @unique tokens Json tenant Tenant @relation(fields:[tenantId],references:[id]) updatedAt DateTime @updatedAt }
model TenantConfig { id String @id @default(uuid()) tenantId String @unique sections Json tenant Tenant @relation(fields:[tenantId],references:[id]) updatedAt DateTime @updatedAt }

model TenantDomain {
  id        String  @id @default(uuid())
  tenantId  String
  domain    String  @unique
  isPrimary Boolean @default(false)
  state     DomainState @default(PENDING)
  tenant    Tenant  @relation(fields: [tenantId], references: [id])
  @@index([tenantId])
}
enum DomainState { PENDING VERIFYING ACTIVE ERROR }

// ───────────────────────── RBAC ─────────────────────────
model Role {
  id        String  @id @default(uuid())
  tenantId  String?                         // null = system/platform role template
  key       String                          // 'admin','instructor', custom...
  name      String
  isSystem  Boolean @default(false)
  tenant    Tenant? @relation(fields: [tenantId], references: [id])
  permissions RolePermission[]
  users     UserRole[]
  @@unique([tenantId, key])
  @@index([tenantId])
}
model Permission { key String @id  description String }   // catalogue (global)
model RolePermission { roleId String permissionKey String @@id([roleId, permissionKey]) }
model UserRole {
  id String @id @default(uuid())
  tenantId String
  userTenantId String
  roleId String
  userTenant UserTenant @relation(fields:[userTenantId], references:[id])
  @@unique([userTenantId, roleId])
  @@index([tenantId])
}

// ───────────────────────── Flags / Entitlements ─────────────────────────
model FeatureFlag { key String @id  type String  defaultValue Json }
model FeatureFlagOverride {
  id String @id @default(uuid())
  flagKey String  tenantId String?  userId String?  value Json
  @@index([tenantId])
}
model Entitlement { id String @id @default(uuid()) tenantId String key String value Json @@unique([tenantId,key]) @@index([tenantId]) }

// ───────────────────────── LMS ─────────────────────────
model Course {
  id        String  @id @default(uuid())
  tenantId  String
  title     String
  slug      String
  description String?
  status    PublishStatus @default(DRAFT)
  thumbnailUrl String?
  priceRef  String?                         // links to Commerce product
  ownerId   String?                         // instructor
  modules   Module[]
  enrollments Enrollment[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  @@unique([tenantId, slug])
  @@index([tenantId, status])
}
enum PublishStatus { DRAFT IN_REVIEW PUBLISHED ARCHIVED }

model Module {
  id String @id @default(uuid())
  tenantId String  courseId String  title String  position Int
  course Course @relation(fields:[courseId], references:[id])
  lessons Lesson[]
  @@index([tenantId, courseId])
}
model Lesson {
  id String @id @default(uuid())
  tenantId String  moduleId String  title String  position Int
  type LessonType
  videoProvider VideoProvider?               // when type=VIDEO
  videoUrl String?                           // provider reference only — never hosted
  body Json?                                 // rich text / config
  module Module @relation(fields:[moduleId], references:[id])
  assets LessonAsset[]
  @@index([tenantId, moduleId])
}
enum LessonType { VIDEO TEXT PDF EMBED QUIZ ASSIGNMENT LIVE }
enum VideoProvider { YOUTUBE VIMEO BUNNY }

model LessonAsset { id String @id @default(uuid()) tenantId String lessonId String r2Key String filename String mime String size Int @@index([tenantId, lessonId]) }

model Enrollment {
  id String @id @default(uuid())
  tenantId String  courseId String  userId String
  source EnrollSource @default(MANUAL)
  status EnrollStatus @default(ACTIVE)
  course Course @relation(fields:[courseId], references:[id])
  progress LessonProgress[]
  createdAt DateTime @default(now())
  @@unique([tenantId, courseId, userId])
  @@index([tenantId, userId])
}
enum EnrollSource { FREE PAID INVITE AUTO MANUAL }
enum EnrollStatus { ACTIVE COMPLETED REVOKED EXPIRED }

model LessonProgress {
  id String @id @default(uuid())
  tenantId String enrollmentId String lessonId String
  completed Boolean @default(false)
  positionSec Int?  completedAt DateTime?
  enrollment Enrollment @relation(fields:[enrollmentId], references:[id])
  @@unique([tenantId, enrollmentId, lessonId])
  @@index([tenantId, enrollmentId])
}

// ───────────────────────── Assessment ─────────────────────────
model Assessment {
  id String @id @default(uuid())
  tenantId String  title String  status PublishStatus @default(DRAFT)
  timeLimitSec Int?  attemptsAllowed Int @default(1)  passMark Int @default(60)
  shuffle Boolean @default(true)
  proctoringLevel Int @default(0)            // 0..3
  questions AssessmentQuestion[]
  attempts Attempt[]
  @@index([tenantId, status])
}
model Question {
  id String @id @default(uuid())
  tenantId String  type QuestionType  prompt String  options Json?  answer Json?  // answer never sent to client pre-grade
  difficulty Int?  tags String[]
  @@index([tenantId])
}
enum QuestionType { MCQ_SINGLE MCQ_MULTI TRUE_FALSE FILL_BLANK SHORT LONG MATCH ORDER FILE }
model AssessmentQuestion { id String @id @default(uuid()) tenantId String assessmentId String questionId String weight Int @default(1) position Int @@index([tenantId, assessmentId]) }

model Attempt {
  id String @id @default(uuid())
  tenantId String  assessmentId String  userId String
  state AttemptState @default(IN_PROGRESS)
  startedAt DateTime @default(now())  submittedAt DateTime?
  score Int?  passed Boolean?
  sessionToken String?  riskScore Int?
  assessment Assessment @relation(fields:[assessmentId], references:[id])
  answers AttemptAnswer[]
  @@index([tenantId, userId])
  @@index([tenantId, assessmentId])
}
enum AttemptState { IN_PROGRESS SUBMITTED GRADING GRADED VOIDED }
model AttemptAnswer { id String @id @default(uuid()) tenantId String attemptId String questionId String response Json score Int? @@unique([tenantId, attemptId, questionId]) }
model GradingTask { id String @id @default(uuid()) tenantId String attemptId String questionId String status String @default("PENDING") graderId String? @@index([tenantId, status]) }

// ───────────────────────── Proctoring ─────────────────────────
model ProctoringSession { id String @id @default(uuid()) tenantId String attemptId String userId String level Int consentAt DateTime @@index([tenantId, attemptId]) }
model ProctoringEvent { id String @id @default(uuid()) tenantId String sessionId String type String severity Int at DateTime @default(now()) meta Json? @@index([tenantId, sessionId]) }
model ProctoringReport { id String @id @default(uuid()) tenantId String attemptId String @unique riskScore Int summary Json createdAt DateTime @default(now()) }

// ───────────────────────── Certification ─────────────────────────
model CertificateTemplate { id String @id @default(uuid()) tenantId String name String design Json @@index([tenantId]) }
model Certificate {
  id String @id @default(uuid())
  tenantId String  userId String  templateId String
  credentialId String @unique                // public, unguessable
  courseId String?  pathId String?  score Int?
  r2Key String                               // PDF in R2
  status CertStatus @default(ISSUED)
  issuedAt DateTime @default(now())  revokedAt DateTime?  revokeReason String?
  @@index([tenantId, userId])
}
enum CertStatus { ISSUED REVOKED EXPIRED }

// ───────────────────────── Commerce ─────────────────────────
model Product { id String @id @default(uuid()) tenantId String name String kind ProductKind priceMinor Int currency String @@index([tenantId]) }
enum ProductKind { COURSE PATH MEMBERSHIP EVENT BUNDLE }
model PaymentProviderAccount { id String @id @default(uuid()) tenantId String provider String credentialsRef String enabled Boolean @default(true) @@unique([tenantId, provider]) }
model Order {
  id String @id @default(uuid())
  tenantId String  userId String  productId String
  amountMinor Int  currency String  status OrderStatus @default(PENDING)
  provider String  providerRef String?  idempotencyKey String @unique
  createdAt DateTime @default(now())
  payments Payment[]
  @@index([tenantId, userId])
  @@index([tenantId, status])
}
enum OrderStatus { PENDING PAID FAILED REFUNDED PARTIALLY_REFUNDED }
model Payment { id String @id @default(uuid()) tenantId String orderId String provider String providerRef String amountMinor Int currency String status String raw Json? createdAt DateTime @default(now()) @@index([tenantId, orderId]) }
model Refund { id String @id @default(uuid()) tenantId String paymentId String amountMinor Int reason String? providerRef String? createdAt DateTime @default(now()) @@index([tenantId]) }
model Subscription { id String @id @default(uuid()) tenantId String userId String planId String provider String providerRef String status String currentPeriodEnd DateTime? @@index([tenantId, userId]) }
model Coupon { id String @id @default(uuid()) tenantId String code String kind String value Int maxUses Int? usedCount Int @default(0) expiresAt DateTime? @@unique([tenantId, code]) }
model Invoice { id String @id @default(uuid()) tenantId String orderId String number String r2Key String createdAt DateTime @default(now()) @@unique([tenantId, number]) }

// ───────────────────────── SaaS billing ─────────────────────────
model SaasPlan { id String @id @default(uuid()) key String @unique name String priceMinor Int currency String entitlements Json }
model TenantSubscription { id String @id @default(uuid()) tenantId String @unique planKey String status String provider String providerRef String currentPeriodEnd DateTime? }
model UsageRecord { id String @id @default(uuid()) tenantId String metric String value Int periodStart DateTime periodEnd DateTime @@index([tenantId, metric]) }

// ───────────────────────── Cross-cutting ─────────────────────────
model AuditLog {                              // append-only
  id String @id @default(uuid())
  tenantId String?  actorId String?  action String  target String?
  before Json?  after Json?  ip String?  ua String?  requestId String?
  at DateTime @default(now())
  @@index([tenantId, at])
  @@index([tenantId, action])
}
model AnalyticsEvent { id String @id @default(uuid()) tenantId String name String entity String? entityId String? actorId String? payload Json at DateTime @default(now()) @@index([tenantId, name, at]) }
model OutboxJob { id String @id @default(uuid()) tenantId String? type String payload Json status String @default("PENDING") attempts Int @default(0) runAt DateTime @default(now()) @@index([status, runAt]) }
```

> Community, Live, Webinar, Event, Notification, Integration, Workflow, Automation, Gamification, Localization, Plugin, Marketplace, Revenue, Mobile and AI tables follow the same conventions (`tenantId` + timestamps + `(tenantId, …)` indexes + RLS). They are omitted here for length but are non-optional; extend this schema file with them per their Vol 2 specs.

## 4.4 Indexing & performance

- Lead every multi-tenant index with `tenant_id`.
- Hot paths get composite indexes: `enrollments(tenant_id,user_id)`, `lesson_progress(tenant_id,enrollment_id)`, `orders(tenant_id,status)`, `audit_logs(tenant_id,at)`, `analytics_events(tenant_id,name,at)`.
- Full-text: `tsvector` GIN indexes on `courses`, `lessons`, `posts` for the Search Engine.
- Partition large append-only tables (`audit_logs`, `analytics_events`) by month.

## 4.5 Migrations

- Prisma Migrate; every migration reviewed; forward-only in prod with explicit rollbacks scripted.
- RLS policies and partition setup live in versioned SQL migrations alongside Prisma migrations.
- Zero-downtime pattern: additive change → backfill → switch reads → drop old (expand/contract).

## 4.6 Data ownership & export

Every tenant can export: users, courses/modules/lessons, assessments, attempts, certificates, communities, analytics, and full course structure — as machine-readable JSON/CSV bundles generated by an async export job (R2 download link, audited). Export is a first-class, always-available capability (Vol 8 §8.x), not a support ticket.

## 4.7 Backups & retention

- Automated daily backups + point-in-time recovery (managed Postgres/Supabase).
- R2 object versioning for documents/certificates.
- Retention windows: audit (long, compliance-driven), proctoring media (short, minimized), analytics (configurable). (Vol 5 / Vol 11.)


---

# Volume 5 — Security & Proctoring

Security is a non-negotiable invariant (README §0.4). This volume defines the platform-wide security architecture and the proctoring/exam-integrity stack.

## 5.1 Security model overview

Atlas assumes a hostile network and hostile clients. Trust is established server-side per request and never inherited from client claims. Defence in depth: edge → app → data, with audit beneath all of it.

## 5.2 Authentication

- **Provider:** Supabase Auth. Methods: email/password, magic link, OAuth providers, and (Enterprise) SSO/SAML/OIDC.
- **Sessions:** short-lived access JWT + refresh; tokens carry `sub` (user) and the active `tenant_id` claim; rotation on refresh; revocation on logout/role change.
- **MFA:** TOTP and (optional) WebAuthn; required for Super Admin and tenant Admin by policy; tenant-configurable for other roles.
- **Account security:** password policy, breach-list checks, brute-force lockout (with Cloudflare rate-limit), suspicious-login alerts, device/session management.

## 5.3 Authorization (RBAC)

- Central `can(actor, permission, resource?)` gate (Engine 3). Default deny.
- Permissions are namespaced (`domain.resource.action`); roles compose permissions; ownership checks layer on resource scope.
- No "grant-up": users cannot grant permissions they lack. Super Admin scope is strictly separated from tenant scope.
- Every protected route/action references a named permission; ungated mutations are review-blocking defects.

## 5.4 Tenant isolation (security view)

The three-layer model (edge map, Prisma scoping, Postgres RLS) plus `can()` and audit (Vol 3 §3.5, Vol 4 §4.2). Security testing **must** include cross-tenant IDOR attempts on every resource. RLS is validated independently of the app layer.

## 5.5 API security

- Zod validation at every boundary; reject unknown fields; strict types.
- Output encoding / no reflected untrusted HTML; CSP headers; SQL via Prisma (no string-built queries).
- Scoped, rotatable, revocable API keys for integrations; least-privilege scopes; per-key rate limits.
- Idempotency keys on payment-mutating endpoints.
- SSRF protection on all outbound (webhooks, integrations): allow-lists, blocked internal ranges, DNS rebinding guard.
- CSRF protection for cookie-based flows; SameSite cookies; CORS allow-list per tenant domain.

## 5.6 Database security

- RLS on all tenant tables; least-privilege DB roles (app role cannot disable RLS).
- Secrets/credentials (payment, integration, push) stored via envelope encryption / secrets vault, referenced not inlined; never returned in plaintext to clients.
- PII minimization; encryption at rest (managed); TLS in transit everywhere.
- Backups encrypted; access to prod DB audited and MFA-gated.

## 5.7 Edge & network security (Cloudflare)

- **WAF** with managed + custom rules (OWASP categories).
- **DDoS protection** (L3/4/7) at the edge.
- **Rate limiting** per IP/user/key/tenant; bot management on public endpoints (signup, login, registration).
- **TLS** enforced; HSTS; modern ciphers.
- **Bot/abuse** controls on auth and payment endpoints.

## 5.8 Secrets management

- Per-environment secrets in a vault (Vercel env + secret store); never in repo or client bundles.
- Rotation policy; access audited; tenant-level integration secrets isolated per tenant.

## 5.9 Audit logging (security view)

Append-only `audit_logs` (Engine 30) capture auth, permission/role changes, payments/refunds, grading changes, publish actions, exports, admin actions, config/secret changes, proctoring decisions, and tenant lifecycle — with actor, target, before/after, IP/UA, request ID. Immutable; tightly access-controlled; exportable for compliance.

## 5.10 Incident response

- **Severity tiers** (SEV1–SEV3) with defined response times and on-call (Vol 11 alerting).
- **Playbooks:** suspected data leak / cross-tenant access, credential compromise, payment fraud, DDoS, provider outage, data-deletion request.
- **Containment → eradication → recovery → post-mortem** with blameless retrospectives and action items.
- **Breach notification** process aligned to GDPR/contractual timelines.
- Kill-switch feature flags documented for rapid mitigation.

## 5.11 Disaster recovery (security/availability)

- RPO/RTO targets defined per data class (Vol 11): financial/audit data lowest RPO.
- PITR for Postgres; R2 versioning; tested restore drills.
- Multi-region considerations for edge; documented failover for critical providers.

## 5.12 Compliance readiness (future, designed-for-now)

- **GDPR:** lawful basis tracking, consent capture (esp. proctoring/marketing), data subject rights (access/export/delete), data processing records, DPA with sub-processors, data residency options (Enterprise).
- **SOC 2:** control mapping (access, change management, monitoring, incident response) — the audit log, RBAC, CI/CD controls, and IR playbooks are the evidence base.
- **ISO 27001:** ISMS scaffolding — risk register, policies, asset inventory.
- Designed-in now (audit, least privilege, encryption, retention), formal certification is a roadmap item (Vol 13).

## 5.13 Privacy & data minimization

- Collect only what's needed; proctoring media minimized, on-device-first, encrypted, time-bounded, and excluded from analytics.
- PII never in logs; masked in audit before/after where sensitive.
- Per-tenant data isolation extends to backups, exports, and analytics.

---

## 5.14 Proctoring & Exam-Integrity stack (detail)

Combines **Proctoring Engine (14)** — behavioural detection — and **Exam Security Engine (15)** — channel hardening. Goal: defensible integrity with proportionate, consented monitoring and minimal false positives.

### 5.14.1 Levels

**Level 1 — Browser/behaviour signals (server-recorded):**
tab switch / visibility change, window blur, fullscreen exit, copy/paste, right-click, devtools heuristic. Each timestamped against the attempt. Lightweight, no media, broadly acceptable.

**Level 2 — Media monitoring (consented):**
webcam face detection, multiple-face detection, face-absent detection, microphone/voice presence. On-device processing preferred; periodic snapshots/heuristics; raw media governed by consent + short retention.

**Level 3 — Identity & AI (consented, entitlement-gated, phased):**
pre-exam identity verification (ID + face match), AI risk scoring aggregating all signals, behavioural/gaze analysis. Decision-support for humans only.

### 5.14.2 Outputs

For each attempt: a **violation list**, a chronological **timeline**, and a computed **risk score + report**, attached to the attempt and surfaced to graders. Outcomes (accept / flag / void) are human decisions, recorded in audit.

### 5.14.3 Exam channel hardening (Engine 15)

Server-authoritative timing/scoring; per-attempt question/option randomization; optional secure mode (fullscreen-enforced, copy/paste blocked, nav locked); single-active-session concurrency lock; signed attempt tokens; anomaly detection + rate-limiting on attempt APIs. The client is assumed hostile: no score/time is ever trusted from it.

### 5.14.4 Integrity, consent & fairness

- Explicit, recorded **consent** to the active level before any monitored exam.
- Transparent disclosure of what's captured and retention period.
- Graceful degradation: a denied/absent sensor is recorded, not silently failing the learner, unless policy mandates a block (then clearly communicated).
- **Appeals:** learners can dispute flags; graders/admins adjudicate with the timeline as evidence; outcomes audited.
- Risk scores never auto-punish — a human always decides.

### 5.14.5 Data handling for proctoring

Biometric-adjacent and media data: encrypted at rest, access-restricted to authorized reviewers, retention-limited, excluded from general analytics/AI training, and subject to deletion on request — tracked against GDPR/biometric-law obligations (§5.12).

### 5.14.6 Acceptance (headline)

No high-stakes attempt is finalized without its proctoring report available to a grader; secure mode demonstrably blocks the named vectors; consent is recorded; and a deliberately tampered client (altered timer/score) is rejected server-side and flagged. (Vol 14 §AC-14/15.)


---

# Volume 6 — Commerce & Payments

Binding contract for all money movement. **Invariant: no payment provider is ever hardcoded.** Every flow goes through the `PaymentProvider` abstraction.

## 6.1 Goals

- Sell one-time products, memberships, subscriptions, installments — globally and in India natively.
- Support coupons, refunds, tax, invoicing, and revenue sharing.
- Swap or add a provider with a config change, never a rewrite.
- Be the merchant orchestrator, not (by default) the merchant of record for tenant sales — tenants connect their own provider accounts.

## 6.2 Provider abstraction (the core contract)

```ts
interface PaymentProvider {
  readonly key: string;                       // 'stripe' | 'razorpay' | ...
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  capture(ref: string): Promise<PaymentResult>;
  refund(input: RefundInput): Promise<RefundResult>;
  createSubscription?(input: SubInput): Promise<SubResult>;
  cancelSubscription?(ref: string): Promise<void>;
  verifyWebhook(req: RawRequest): WebhookEvent;  // normalizes to internal event
}
```

- A **registry** resolves the active provider(s) from `PaymentProviderAccount` (per tenant).
- Business logic depends only on `PaymentProvider`. Provider SDK imports are confined to adapter files (enforced in review).
- Webhooks are **normalized** into canonical internal events (`order.paid`, `payment.failed`, `subscription.renewed`, `refund.succeeded`) before any business logic runs.

## 6.3 Supported providers

| Scope | Providers |
|-------|-----------|
| Global | Stripe, PayPal, Paddle, LemonSqueezy |
| India | Razorpay, Cashfree, PayU, PhonePe Business, CCAvenue |
| Future / crypto | Coinbase Commerce, NOWPayments |

Each is an adapter implementing `PaymentProvider`. A tenant enables one or more; checkout picks the appropriate one by buyer region/config. (Paddle/LemonSqueezy are merchant-of-record providers — modeled so their tax handling is respected.)

## 6.4 Order & payment lifecycle

```
Buyer → checkout (idempotencyKey) → Order(PENDING)
   → provider checkout session → buyer pays
   → provider webhook → verifyWebhook() → normalize
   → Order(PAID) + Payment record → emit order.paid
   → entitlement granted (enrollment / membership / access)
   → Invoice generated (Engine 25) + Revenue split accrued (Engine 36)
```

- **Idempotency** everywhere: duplicate webhooks/clicks never double-charge or double-grant. `Order.idempotencyKey` is unique; webhook processing is idempotent on provider ref.
- **Reconciliation:** periodic job reconciles internal orders vs provider state; mismatches alerted.
- **Failure:** `payment.failed` → Automation (e.g., reminder/dunning).

## 6.5 Subscriptions & memberships (Engine 22)

- Plans with cycles (monthly/annual), trials, proration on upgrade/downgrade, dunning on failed renewal, grace periods, cancellation (immediate/period-end).
- Membership access = subscription status gates content/community access (checked server-side).
- Provider-agnostic: provider subscription refs stored; internal state is source of truth for access.

## 6.6 Installments

- Split a purchase into scheduled charges; access policy configurable (full access vs unlock-as-paid); missed installment → dunning + access policy enforcement.

## 6.7 Coupons (Engine 23)

- Percentage/fixed; per-product/plan; usage- and time-limited; stacking rules; referral codes.
- **Validated server-side at checkout** (never trust client-applied discounts); redemption recorded; abuse-limited.

## 6.8 Tax (Engine 24)

- Tenant tax config per jurisdiction; GST/VAT/sales tax; inclusive vs exclusive pricing; tax lines on invoices.
- Pluggable tax-rate source (interface), so a tax service can be added without changing checkout.
- MoR providers (Paddle/LemonSqueezy) handle tax themselves — modeled accordingly to avoid double-taxing.

## 6.9 Invoicing (Engine 25)

- Branded (White Label), compliant invoice/receipt PDF for every transaction; **sequential per-tenant numbering**; stored in R2 with owner-signed access; credit notes for refunds; emailed via Notification Engine.

## 6.10 Refunds

- Full/partial via provider adapter; `Order` status transitions (`REFUNDED`/`PARTIALLY_REFUNDED`); credit note issued; revenue split reversed; audited.

## 6.11 Revenue sharing (Engine 36)

- Configurable splits (platform %, tenant %, marketplace seller %, affiliate %) per transaction context.
- **Append-only revenue ledger** accrues each party's share at `order.paid`; payout batches reconcile and disburse; statements per party.
- Two operating modes:
  1. **Tenant-connected accounts (default):** tenant receives funds directly; Atlas invoices revenue share separately (SaaS Billing).
  2. **Platform-managed payments (optional/Enterprise):** Atlas processes and splits at settlement (where provider supports connected accounts/split payments).

## 6.12 Security (commerce-specific)

- Idempotency keys; signed/verified webhooks; provider secrets vaulted per tenant; no card data touches Atlas (provider-hosted checkout / tokenization); PCI scope minimized by design.
- All financial mutations audited; ledgers append-only; reconciliation jobs detect drift.
- Rate-limit and fraud-signal checkout/refund endpoints.

## 6.13 Analytics (commerce)

Sales, MRR/ARR, refunds, churn, ARPU, conversion (catalogue→checkout→paid), coupon impact, revenue by product/provider/region — feeding Enterprise Analytics (Engine 29).

## 6.14 Acceptance (headline)

A purchase completes end-to-end through at least two different providers (e.g., Stripe + Razorpay) with **identical business code**, duplicate webhooks never double-grant, refunds reverse access + revenue split, invoices are sequential and branded, and no provider name appears in business logic. (Vol 14 §AC-21..25, §AC-36.)


---

# Volume 7 — Mobile Architecture

Locked: **React Native + Expo**, single codebase, single shared backend, per-tenant branding layer; white-label apps per tenant (custom name/icon/splash/branding).

## 7.1 Goals

- One codebase serves all tenants.
- Tenants on qualifying plans get a **dedicated branded app** (own name, icon, splash, bundle ID, store listing).
- The mobile app consumes the **same versioned API and auth** as web — no separate backend.

## 7.2 Two delivery models

1. **Branding-at-runtime (shared app / lower tiers):** a single "Atlas" app where a user selects/enters their academy; the app fetches that tenant's branding/theme/config and renders accordingly. Fast path; no store submission per tenant.
2. **Dedicated white-label build (entitlement-gated):** a per-tenant binary produced by a **parameterized Expo/EAS build pipeline**: app name, icon, splash, bundle ID/package name, and default tenant baked in; published to the tenant's (or Atlas-managed) App Store / Play Console listing.

Both run the same source; the difference is build-time configuration + store presence.

## 7.3 Architecture

```
React Native (Expo) app
 ├─ Branding/Theme layer  ← fetched from tenant config (same tokens as web Theme Engine)
 ├─ Auth (Supabase)       ← same JWT + tenant claim as web
 ├─ API client            ← versioned REST /api/v1 (same as integrations)
 ├─ Offline cache         ← course content + progress (sync on reconnect)
 ├─ Push (Expo Notifications → FCM/APNs)  ← per-tenant credentials
 └─ Deep links            ← course/lesson/community/cert routes
```

- **Shared contracts:** the mobile client uses the same Zod-validated API schemas and the same auth/entitlement model as web. No mobile-only privilege paths.
- **Branding parity:** the Theme Engine tokens drive both web and mobile, so a brand change reflects on both.

## 7.4 Build & release pipeline (EAS)

- Parameterized config (`app.config.ts`) reads tenant build params (name/icon/splash/bundleId) from a build manifest.
- EAS Build produces per-tenant binaries; EAS Submit handles store submission; OTA updates (Expo Updates) push JS changes without full store re-review (within store policy).
- A **Mobile App Config** record (`mobile_app_configs`) per tenant stores branding/build metadata (Engine 39).

## 7.5 Offline & sync

- Cache enrolled course structure + downloaded lesson references + progress locally.
- Progress writes are **idempotent** and queued offline, synced on reconnect (server is source of truth; conflicts resolved last-write-wins on per-lesson granularity, with completion monotonic).
- Video remains provider-hosted (YouTube/Vimeo/Bunny) — the app embeds/plays via provider SDKs; no media hosted by Atlas.

## 7.6 Push notifications

- Per-tenant push credentials isolated (separate FCM/APNs keys per dedicated app); Expo push tokens registered against `UserTenant`.
- Notifications routed via the Notification Engine (Engine 26) with the `push` channel adapter; preferences and quiet hours respected.

## 7.7 Security (mobile)

- Same auth/authorization as web; tokens stored in secure storage (Keychain/Keystore).
- Certificate pinning to API/edge; jailbreak/root detection (advisory).
- No secrets in the bundle; provider keys never shipped to client.
- Proctoring on mobile (where supported) uses on-device media processing with the same consent/retention rules (Vol 5).

## 7.8 Analytics (mobile)

PostHog mobile SDK for product analytics; crash/error via Sentry RN; events mirror web taxonomy so cross-surface funnels work.

## 7.9 Acceptance (headline)

Two tenants render as two visually distinct apps from one codebase; a learner can log in, consume a course offline, sync progress, and receive a branded push — all against the shared backend, with no tenant-specific code branch and no hosted video. (Vol 14 §AC-39.)


---

# Volume 8 — SaaS Platform

How Atlas operates *as a SaaS*: tenant lifecycle, entitlements, Atlas's own billing, super-admin operations, and data ownership.

## 8.1 Tenant lifecycle

`provisioning → active → suspended → archived → deleted`, owned by the Tenant Provisioning Engine (38) and Multi-Tenant Engine (1).

- **Signup → provision:** self-serve signup or super-admin creation triggers provisioning (seed roles/permissions, default config/branding/theme, subdomain, owner admin, optional sample content) — idempotent, transactional/saga, observable. Time-to-active: seconds.
- **Active:** normal operation, gated by entitlements.
- **Suspended:** non-payment or policy; non-admin traffic blocked with branded notice; admin can settle billing.
- **Archived → deleted:** after retention; **export offered first** (data ownership); deletion is irreversible and audited.

## 8.2 Entitlements & plans

- **SaaS plans** (`saas_plans`) define **entitlement sets**: enabled engines, limits (seats, active learners, storage, proctoring level, custom roles, white-label web/mobile, API access, integrations).
- Entitlements are the **single source of truth for gating**, surfaced through the Feature Flag/Entitlement engines. Gating logic never hardcodes plan names; it reads entitlements.
- Tenants cannot self-elevate entitlements; only billing changes or super-admin grants alter them.

### Representative entitlement keys
`engine.<name>.enabled`, `limit.seats`, `limit.activeLearners`, `limit.storageGb`, `proctoring.maxLevel`, `whiteLabel.web`, `whiteLabel.mobile`, `whiteLabel.removeAtlasBranding`, `roles.custom`, `api.enabled`, `integrations.enabled`, `domains.custom`.

## 8.3 SaaS Billing Engine (37)

- Atlas bills tenants via the **same provider-agnostic** payment layer (Vol 6).
- Lifecycle: `trialing → active → past_due → canceled`; proration; seat counting; **usage metering** (active learners, storage, API volume) via `usage_records`.
- **Dunning** on failed renewal → reminders (Automation/Notification) → suspension on exhaustion (ties to tenant lifecycle).
- Plan changes update entitlements immediately (with proration).

## 8.4 Revenue sharing (interaction)

Per Vol 6 §6.11 — Atlas's cut of tenant commerce is computed by the Revenue Sharing Engine (36) and either invoiced separately (default, connected accounts) or settled at the gateway (platform-managed mode).

## 8.5 Super-admin platform operations

- Cross-tenant console (the **only** sanctioned cross-tenant scope, audited): tenant list/health, lifecycle actions, plan/entitlement management, feature-flag rollout, platform analytics, platform audit log, impersonation-for-support (explicitly consented/audited).
- Strict separation of super-admin permissions from tenant permissions (no leakage in either direction).

## 8.6 Platform analytics

Tenant health (activation, active learners, completion, revenue, churn risk), net revenue retention, gross margin, time-to-launch, error-budget burn — feeding business decisions (Engine 29, platform scope).

## 8.7 Data ownership & export (first-class)

A locked product principle: tenants own their data and can always export it.

- **Exportable:** users, courses/modules/lessons, assessments + attempts, certificates, communities, analytics, full course structure.
- **Mechanism:** async export job → machine-readable JSON/CSV bundle → R2 signed download → audited. Available on demand from tenant admin, and automatically offered at archive/delete.
- **Import** (roadmap): structured import for migration *from* competitors and *between* Atlas tenants/templates.

## 8.8 Multi-region / dedicated (future)

For tenants with residency/compliance needs, a **dedicated deployment** variant reuses the same codebase with an isolated DB/region. Default remains shared-DB multi-tenant. (Roadmap, Vol 13.)

## 8.9 Acceptance (headline)

A new tenant self-provisions to active in seconds with sane defaults; entitlements gate every premium engine without hardcoded plan checks; non-payment suspends correctly after dunning; and a tenant can export its entire dataset on demand. (Vol 14 §AC-37/38, §AC-5.)


---

# Volume 9 — Marketplace  &  Volume 10 — AI Layer

These volumes are **spec-level** (later phases). They are designed-for now so the core doesn't have to change when they ship.

---

# Volume 9 — Marketplace

## 9.1 Purpose
A catalogue where tenants discover and install **plugins, themes, and templates**, and (future) where creators **sell courses/templates**, with Atlas taking a configurable take rate via Revenue Sharing.

## 9.2 Scope (phased)
- **Phase A:** first-party plugins/themes/templates, installable per tenant.
- **Phase B:** third-party sellers with submission → review/approval → publish.
- **Phase C:** course/template sales between tenants/creators.

## 9.3 Functional requirements
- Listings (type, category, media, description, price), search/browse, ratings & reviews.
- Install/purchase via Commerce (Vol 6); entitlement-aware; one-click install per tenant (Plugin Engine, Engine 34).
- Seller onboarding, payout accounts, statements; **revenue split** via Engine 36.
- Submission + **review/approval workflow** (Workflow Engine) with signing of third-party artifacts.
- Versioning, update notifications, rollback.

## 9.4 Permissions
`marketplace.browse`, `marketplace.install`, `marketplace.sell`, `platform.marketplace.review`.

## 9.5 Database
`marketplace_listings`, `marketplace_versions`, `marketplace_purchases`, `marketplace_reviews`, `seller_accounts`, `payouts` (shared with Engine 36).

## 9.6 Security
- No execution of unreviewed third-party code on core; plugins sandboxed with least-privilege scopes (Engine 34); signed artifacts; review gate before publish.
- Purchases idempotent; payouts reconciled against an append-only ledger.

## 9.7 Analytics
Listing views, install/purchase conversion, top sellers, review sentiment, refund/dispute rate.

## 9.8 Acceptance
A tenant can browse, purchase, and install a marketplace item; revenue splits correctly across platform/seller; third-party items pass review before going live; uninstall is clean. (Vol 14 §AC-35.)

---

# Volume 10 — AI Layer

**Invariant: AI never auto-publishes. Every generated artifact requires recorded human approval (Workflow Engine) before it can reach a published state.** All AI is entitlement- and flag-gated, tenant-opt-in, cost-controlled.

## 10.1 Capabilities (phased, future)
1. **AI Course/Module/Lesson/Quiz/Learning-Path Generator** — produces **drafts** that enter the review workflow. Output is labelled AI-generated.
2. **AI Learning Assistant (tutor)** — RAG over the tenant's own course content; answers with citations; guardrailed; cannot issue grades/certificates or reveal exam answers.
3. **AI Analytics** — narrative insights, at-risk-learner detection, anomaly surfacing — as suggestions for humans.
4. **AI Recommendations** — next-best content/path, personalized to the learner.
5. **AI Proctoring** — risk scoring/behavioural analysis as **decision-support** for graders (Engine 14 L3); never auto-punishes.

## 10.2 Architecture
- `AIProvider` abstraction (mirrors payment/notification pattern) — model vendor is swappable via config.
- Generation jobs run async (outbox/workers); results stored as `ai_generations` with status `draft → in_review → approved/rejected`.
- RAG pipeline indexes tenant content (tenant-scoped vector store); strict tenant isolation on retrieval.
- Cost metering per tenant (`ai_usage`) with budgets and rate limits.

## 10.3 Permissions
`ai.generate`, `ai.review` (approval authority), `ai.configure`.

## 10.4 Database
`ai_generations` (type, input, output draft, status, reviewerId, decisionAt), `ai_usage` (tokens/cost per tenant), vector index references.

## 10.5 Security & governance
- **No auto-publish** (enforced by Workflow gate; verified in AC).
- Tenant data not used to train third-party models without explicit consent; provider data-retention terms documented.
- Prompt-injection defenses on the tutor (content/instruction separation, tool allow-listing).
- Outputs provenance-labelled; PII handling controls; cost-abuse limits.
- Proctoring AI outputs are advisory only; humans decide.

## 10.6 Analytics
Generation volume, approval/rejection rates and reasons, tutor usage/resolution, recommendation lift, AI cost per tenant.

## 10.7 Acceptance
No AI artifact reaches `published` without a recorded human approval transition; tutor answers are grounded in the tenant's content and refuse out-of-scope/exam-answer requests; AI cost is metered and capped per tenant; tenant isolation holds on RAG retrieval. (Vol 14 §AC-40.)


---

# Volume 11 — DevOps & Infrastructure

## 11.1 Environments

| Env | Purpose | Data |
|-----|---------|------|
| local | developer machines | seeded/synthetic |
| preview | per-PR ephemeral (Vercel) | synthetic |
| staging | pre-prod integration | anonymized/synthetic |
| production | live | real |

- Strict isolation of secrets and databases per environment.
- Prod data never flows to lower environments without anonymization.
- Every environment has its own provider sandbox keys (payments, etc.).

## 11.2 CI/CD

- **Pipeline (per PR):** install → typecheck → lint → unit tests → build → integration tests → preview deploy → E2E (critical paths) → security checks (dependency audit, secret scan) → require green + review to merge.
- **Deploy:** Vercel auto-deploys `main` to production; preview deploys per PR. Database migrations gated behind a controlled step (expand/contract, never destructive in one shot).
- **Mobile:** EAS Build/Submit pipelines; OTA updates for JS-only changes.
- **Quality gates:** tests + typecheck + lint + critical E2E must pass; coverage thresholds on critical modules (auth, tenancy, payments).

## 11.3 Branching strategy

- Trunk-based with short-lived feature branches; PRs required; protected `main`.
- Conventional commits; semantic PR titles; linked to issues/specs.
- Release tags; changelog generated.

## 11.4 Deployment strategy

- Vercel immutable deployments + instant rollback (promote previous).
- **Feature flags decouple deploy from release** (dark launch, per-tenant enable, kill-switch).
- Zero-downtime DB migrations via expand/contract; backfills as background jobs.
- Edge config (host→tenant/branding) propagates <60s.

## 11.5 Monitoring & observability

- **Sentry:** error tracking (web + mobile + server), release health, alerting on error spikes.
- **PostHog:** product analytics, funnels, feature-flag experimentation.
- **Better Stack:** uptime monitoring, log management, status page.
- **Custom metrics:** p95 latency, queue depth/lag, webhook success, payment success, provisioning time, tenant request volume (metering).
- Dashboards per critical path; tenant-scoped where relevant.

## 11.6 Alerting & on-call

- Severity tiers SEV1–SEV3 with response-time targets; on-call rotation; escalation policy.
- Alert sources: uptime, error rate, latency SLO burn, queue backlog, payment failure spike, security anomalies (cross-tenant access attempts, auth anomalies).
- Runbooks linked from alerts.

## 11.7 Backup strategy

- **Postgres:** automated daily backups + point-in-time recovery (managed/Supabase). Encrypted.
- **R2:** object versioning for documents/certificates/media.
- **Config/secrets:** versioned in vault; recoverable.
- Restore drills performed and documented on a schedule.

## 11.8 Disaster recovery

- **RPO/RTO by data class:** financial/audit (tightest RPO), learning content (moderate), proctoring media (short retention, acceptable loss within policy).
- DR runbook: DB restore (PITR), edge/app redeploy (stateless), provider failover (email/payment secondary where available).
- Documented failover for critical third parties; no single provider on the tenant-isolation/auth critical path.

## 11.9 Infrastructure security ops

- Least-privilege cloud/DB roles; MFA on all admin consoles; access audited.
- Dependency scanning + SBOM; secret scanning in CI; periodic pen-tests (incl. cross-tenant IDOR).
- WAF/DDoS/rate-limit managed at Cloudflare (Vol 5).

## 11.10 Cost & scaling ops

- Video offloaded to providers (largest cost removed); R2 egress-free storage; serverless scales with load.
- Per-tenant usage metering informs SaaS billing and capacity planning.
- Async/batch hot writes; read replicas + materialized views for analytics at scale.

## 11.11 Acceptance (headline)

A change ships through CI with all gates green, deploys with instant-rollback capability, is observable in Sentry/PostHog/Better Stack, can be released per-tenant via flags, and the platform can restore from backup within RTO in a drill. (Vol 14 §AC-DevOps.)


---

# Volume 12 — Testing Standards

> Source-of-truth testing strategy for Atlas LMS. Testing is not a phase; it is a property of every change. The pyramid is wide at the base (fast unit tests), focused in the middle (integration around real boundaries), and deliberately thin but ruthless at the top (E2E on revenue- and integrity-critical journeys). Two concerns — **tenant isolation** and **payment correctness** — are treated as first-class, non-negotiable test domains and gate every merge.

---

## 12.1 Principles

- **Test the contract, not the implementation.** Zod schemas (Vol 3) define the boundary; tests assert behaviour against the schema and the public API surface, so internal refactors don't shatter the suite.
- **Tenant isolation is a test domain, not an assumption.** Every data-access path is assumed leaky until a test proves it scoped. Cross-tenant access tests are mandatory and run in CI (Vol 11 gate).
- **Money is sacred.** Payment paths are tested against idempotency, double-grant, webhook replay, and provider-swap invariance before any provider goes live.
- **Determinism.** No test depends on wall-clock time, network flakiness, real third-party calls, or test-ordering. Time is injected; providers are faked at the abstraction seam.
- **Critical modules carry higher coverage bars** (auth, tenancy, payments, proctoring scoring). Coverage is a floor on critical code, not a vanity metric platform-wide.
- **A bug fixed is a test added.** Every production defect lands with a regression test reproducing it.

---

## 12.2 Test pyramid & ownership

| Layer | Scope | Tooling (reference) | Runs | Owner |
|-------|-------|---------------------|------|-------|
| Unit | Pure functions, Zod schemas, provider adapters, permission checks, scoring logic | Vitest/Jest | Every push (fast) | Engineer of the module |
| Integration | Module against real Postgres (scoped Prisma + RLS), event bus, server actions/API routes | Vitest + ephemeral Postgres (Testcontainers/Supabase branch) | Every push | Engineer of the module |
| E2E | Full user journeys across UI + API + DB on revenue/integrity-critical flows | Playwright | Pre-merge + nightly | Feature team |
| Security | IDOR/cross-tenant, authz, RLS, secrets, injection | Custom suites + SAST/dependency/secret scan | Every push (fast checks) + scheduled (deep) | Security + module owner |
| Load/perf | Throughput, latency budgets, hot-path soak | k6/Artillery | Pre-release + scheduled | Platform |
| Domain suites | Proctoring, Payments | Dedicated harnesses (below) | Pre-merge on touch + nightly | Domain owner |

**Coverage floors (CI-enforced):** auth & tenancy ≥ 95% line/branch; payment engine & provider adapters ≥ 95%; proctoring risk-scoring ≥ 90%; assessment grading ≥ 90%; platform default ≥ 80%. Merges failing a floor on touched critical code are blocked.

---

## 12.3 Unit testing

**Targets.** Provider adapters (Payment, Video, AI, Notification, Storage) against their interface contracts; Zod schemas (valid/invalid/edge); permission resolution (`domain.resource.action`, role inheritance, custom roles); pricing/tax/coupon math (integer minor units, rounding, currency); proctoring signal→event mapping and risk weighting; certification eligibility rules; gamification point/streak rules.

**Standards.**
- Every Zod schema has a table-driven test: representative valid object, each required-field omission, each type violation, boundary values (min/max length, numeric ranges, enum exhaustiveness).
- Money math is tested in **integer minor units only**; assert no float appears in any monetary path. Rounding rules tested per currency.
- Provider adapters are tested against a **shared adapter conformance suite** (one suite, run per adapter) so every payment provider must satisfy identical behavioural assertions — the spine of provider-agnosticism (Vol 6, §AC-21..25).
- Permissions: assert **default-deny** — an action with no granting permission is denied; a custom role with a subset grants exactly that subset.

---

## 12.4 Integration testing

Runs against a **real ephemeral Postgres** with the Prisma scoping extension and RLS policies applied — never a mock DB — because tenant isolation correctness is an emergent property of the real engine, extension, and policies together.

**Mandatory integration scenarios.**
- **Scoped persistence:** writes stamp `tenant_id` from `tenantContext`, never from request body; a body-supplied `tenant_id` is ignored/rejected.
- **RLS enforcement:** with tenant A's context, a raw query for tenant B's row returns nothing even if the Prisma layer were bypassed (defence-in-depth proof).
- **Event bus / outbox:** a state change enqueues the canonical event (Vol 2 taxonomy); the consumer (e.g. *course.completed → certificate.issue*) fires exactly once; outbox guarantees at-least-once with idempotent consumers.
- **Server actions / API routes:** authz runs before handler; Zod validates at the boundary; error envelope shape is consistent (Vol 3 API standards).
- **Workflow engine:** a course moves Instructor → Reviewer → Admin → Published; AI-generated artifacts cannot reach Published without a human approval transition (Vol 2 Workflow; §AC-32, §AC-40).
- **Migrations:** expand/contract migration applies forward and the contract step is safe against the prior app version (no read/write of dropped columns mid-deploy).

---

## 12.5 End-to-end testing

E2E is intentionally narrow — only journeys where failure costs money, trust, or integrity. Each runs on seeded multi-tenant data across at least two tenants to keep isolation honest in the browser.

**Critical journeys.**
1. Student signs up on a tenant's white-label domain → enrolls → consumes lesson (video provider embed) → progress persists.
2. Purchase journey end-to-end on a **faked provider**: checkout → payment success webhook → enrollment/entitlement granted exactly once → invoice generated.
3. Purchase **failure/abandonment**: no entitlement granted; reminder automation queued (Vol 2 Automation).
4. Assessment with **L1 proctoring**: tab-switch/blur/copy events recorded → attempt submitted → graded → violations on timeline → certificate issued only if eligible.
5. Instructor authoring → submits for review → reviewer/admin approve via Workflow → publish → appears for students.
6. Admin white-labels a tenant (branding/theme/domain) → student-facing surface reflects branding; no other tenant affected.
7. Tenant data **export** produces a complete archive of the documented entities (Vol 8 data ownership).

**Standards.** Stable `data-testid` selectors; no fixed sleeps (await conditions); third parties faked at the seam (payment/video/email); every E2E asserts a **negative tenant** (the action must not affect or be visible to tenant B).

---

## 12.6 Security testing

Security tests are partly inline (fast, every push) and partly scheduled/deep (Vol 5, Vol 11).

**Mandatory automated checks.**
- **Cross-tenant IDOR matrix:** for every tenant-scoped resource, attempt read/update/delete with a valid session from another tenant; expected result is 404/403 **and** an RLS block — never a leak (§AC-1). This matrix is generated from the resource registry so new resources are covered by default.
- **AuthZ matrix:** for each role (Super Admin, Admin, Instructor, Student, Moderator, representative custom role) × sensitive action, assert allow/deny against the permission spec; default-deny verified.
- **Input boundary:** Zod rejection of malformed/oversized/injection payloads; no unvalidated path reaches the DB.
- **Secrets & supply chain:** secret scanning blocks committed credentials; dependency/SBOM scan blocks known-vuln packages; SAST on PRs.
- **Webhook authenticity:** payment/integration webhooks with bad/absent signatures are rejected; replayed webhooks are idempotent (links to 12.7).
- **Session/auth:** MFA enforcement where required, token expiry/refresh, SSO mapping to correct tenant.

**Scheduled/deep.** Periodic penetration testing including cross-tenant escalation; proctoring media access-control review; DR/restore validation (Vol 11).

---

## 12.7 Payment testing

Payments get a dedicated harness because the platform is provider-agnostic and money errors are unforgivable.

**Provider-agnostic conformance.** The shared adapter conformance suite (12.3) runs against **every** provider adapter — Stripe, PayPal, Paddle, LemonSqueezy, Razorpay, Cashfree, PayU, PhonePe Business, CCAvenue, and future Coinbase Commerce/NOWPayments — asserting identical outcomes for: create-order, capture, webhook verification, refund, subscription create/cancel, and installment scheduling. Adding a provider = passing this suite, no call-site changes (§AC-21..25, §AC-37).

**Mandatory cases.**
- **Idempotency:** the same payment webhook delivered N times grants entitlement **once**, writes one payment record, one invoice (§AC-21).
- **Double-grant prevention:** concurrent success callbacks race-tested; exactly one enrollment/entitlement results.
- **Webhook replay & out-of-order:** late/duplicate/out-of-order provider events converge to correct final state.
- **Refund path:** refund reverses entitlement per policy, writes audit + credit note, never deletes financial history (append-only, Vol 6).
- **Subscriptions/memberships:** renewal, dunning on failed charge (Automation reminder), cancellation, proration.
- **Installments:** schedule generation, partial-payment state, default handling.
- **Coupons & tax:** stacking rules, validity windows, per-currency tax computation in minor units; totals reconcile to the penny.
- **Revenue sharing:** connected-account split and platform-managed ledger both reconcile; tenant payout equals collected minus platform fee minus provider fee (Vol 6/Vol 8).
- **Currency & rounding:** all assertions in integer minor units; no floating-point in any monetary assertion.

**Sandbox vs fake.** Adapter logic is unit-tested against fakes for determinism; a scheduled **provider-sandbox** suite runs real sandbox calls per provider to catch contract drift, isolated from the deterministic pre-merge gate.

---

## 12.8 Proctoring testing

Proctoring spans deterministic signal handling and probabilistic scoring; both are tested, but with different oracles.

- **L1 (deterministic):** simulated tab switch, window blur, fullscreen exit, copy/paste each produce the correct violation event with correct timestamp on the attempt timeline; ordering preserved; no event lost on reconnect (§AC-14).
- **L2 (media monitoring):** with recorded/synthetic frames, assert face-present, no-face, and multiple-face produce the expected flags; microphone-activity flag fires on injected audio energy; absence of media degrades gracefully (no false hard-fail).
- **L3 (risk scoring):** **golden-fixture** approach — curated attempt fixtures (clean, mild, egregious) must land in expected risk bands; weighting changes are caught by snapshot diffs of risk output. Scoring is tested as a pure function (replayable, deterministic given inputs).
- **Fairness/robustness:** no-camera/degraded-network sessions don't auto-fail; flags are advisory inputs to human review, asserted by tests that a flag never auto-revokes a certificate without the configured human/automation gate (Vol 5 fairness).
- **Reporting:** violations → timeline → risk report renders the recorded events faithfully; data-retention/expiry honoured (proctoring media TTL).

---

## 12.9 Load & performance testing

- **Targets (illustrative budgets, tuned per release):** tenant-resolution overhead < ~2ms; p95 API latency within documented budget under nominal concurrency; assessment submission and payment-webhook handling sustain peak exam/launch bursts without queue collapse.
- **Hot paths soak-tested:** lesson/progress writes, assessment submission storms (cohort all-submit), webhook bursts, search queries, analytics reads (served from replicas/materialized views, not hot path).
- **Scalability assertions:** serverless scales horizontally; DB connection pooling holds under burst; async/outbox absorbs write spikes; no N+1 on list endpoints.
- **Regression:** performance budgets tracked release-over-release; significant regressions block release (Vol 11 gate).

---

## 12.10 Test data & environments

- **Seed factory** produces ≥ 2 fully-populated tenants with overlapping IDs to surface isolation bugs; every suite that touches tenant-scoped data uses multi-tenant seed.
- **Ephemeral DB per integration run** (branch/container), migrated to head with RLS applied; torn down after.
- **Faked third parties** at the abstraction seam for determinism; **scheduled sandbox** suites exercise real provider/video/email contracts out-of-band.
- **No production data in tests**; synthetic PII only; proctoring fixtures are synthetic.
- Environments and CI gates are defined in Vol 11 (§AC-DevOps).

---

## 12.11 CI gates (summary)

A merge is blocked unless: unit + integration green; cross-tenant IDOR matrix green; authz matrix green; payment idempotency/conformance green on touched payment code; coverage floors met on touched critical modules; SAST/secret/dependency scans clean; E2E critical journeys green pre-merge; performance budgets not regressed beyond threshold on release.

## 12.12 Acceptance (headline)

The suite provably prevents cross-tenant access (IDOR matrix + RLS), proves payment correctness across **every** provider via one conformance suite with idempotency and no double-grant, proves AI artifacts cannot publish without human approval, exercises proctoring L1–L3 against deterministic and golden fixtures, and gates every merge in CI with enforced coverage floors on critical modules. (Vol 14 §AC-DevOps, §AC-1, §AC-21..25, §AC-40.)


---

# Volume 13 — Roadmap

> Build order for Atlas LMS. The roadmap is sequenced by **dependency and risk**, not by feature glamour. The load-bearing isolation/identity/payment spine is built and hardened first; everything else composes on top. The guiding milestone for Phase 1 is singular and concrete: **FundedBeyond Academy runs its entire business end-to-end on generic, multi-tenant engines** — no FundedBeyond-specific code anywhere. If a second tenant could not be provisioned onto the same code the day Phase 1 ships, Phase 1 is not done.

---

## 13.1 Sequencing principles

- **Foundation before features.** Multi-tenancy, RBAC, and tenant resolution are the substrate; nothing ships until they're real and tested (Vol 2 Domain A, Vol 4, Vol 5).
- **Generic, never bespoke.** FundedBeyond is the *first tenant*, not a special case. Every Phase 1 capability is built as a tenant-agnostic engine. White-label and config carry all tenant difference.
- **Revenue path early.** Provider-agnostic payments land in Phase 1 so the platform can transact from day one — but through the abstraction (Vol 6), never a hardcoded provider.
- **Integrity staged by cost/complexity.** Proctoring L1 (cheap, deterministic) ships in Phase 1; L2/L3 (media, AI scoring) follow once core exam flows are proven.
- **Defer what compounds risk without early value.** Marketplace, AI generation, white-label mobile builds, and formal compliance certification are deliberately later — each is valuable but none blocks FundedBeyond going live.
- **Every phase ships behind flags** (Vol 2 Feature Flag), so deploy ≠ release and tenants adopt capability progressively.

---

## 13.2 Phase 0 — Platform Foundation (pre-tenant)

**Goal:** the substrate exists and is provably isolated before any product feature.

- Repo, environments (local/preview/staging/prod), CI/CD with security/coverage gates (Vol 11, Vol 12).
- **Multi-Tenant Engine** (Engine 1): tenant resolution (domain→subdomain→JWT), `tenantContext`, Prisma scoping extension, **Postgres RLS** policies (Vol 4 three-layer isolation).
- **Role & Permission Engine** (Engine 3): `domain.resource.action`, default roles, custom roles, default-deny.
- **Supabase Auth** integration, sessions, MFA scaffolding (Vol 5).
- **Audit Logging** (Engine 30) and the **event/outbox bus** (Vol 2 taxonomy, Vol 3) from the start — retrofitting auditability is far costlier.
- **Tenant Configuration** (Engine 5) + **Feature Flag** (Engine 4).
- **Exit criteria:** cross-tenant IDOR matrix green; RLS blocks raw cross-tenant reads; CI gates enforced (§AC-1, §AC-3, §AC-DevOps).

---

## 13.3 Phase 1 — FundedBeyond Live on Generic Engines (MVP)

**Goal & milestone:** FundedBeyond Academy operates its full learning business on Atlas, on engines that any future tenant could use unchanged.

**Foundation & presentation**
- White Label Engine (2), Theme Engine (7), Domain Management (8) — branded student-facing surface on a custom domain.
- Tenant Provisioning (38) — enough to stand up a tenant (including a hypothetical second one) without code changes.

**Learning core**
- LMS Engine (9): courses/modules/lessons, enrollment, progress; video via provider (YouTube/Vimeo/Bunny) — `video_provider` + `video_url`, no self-hosting.
- Assessment Engine (11): quizzes/exams, grading, attempts.
- Certification Engine (12): eligibility → issue → verifiable certificate (R2-stored).
- Learning Path (10): ordering/prerequisites (can be lightweight initially).

**Integrity (entry level)**
- Proctoring Engine (14) **Level 1 only**: tab switch, window blur, fullscreen, copy/paste → violations + timeline. Exam Security (15) basics.

**Commerce**
- Payment Integration (21) via **PaymentProvider abstraction** with the first live provider(s) appropriate to FundedBeyond (incl. India set if needed) — abstraction proven by passing the conformance suite (Vol 12 §12.7).
- Coupon (23), Invoice (25), Subscription (22) as needed for FundedBeyond's model; Tax (24) where applicable.

**Community & engagement**
- Community Engine (16) native (posts/comments/reactions/mentions/groups); Content Moderation (17) baseline.
- Notification & Communication (26): email + in-app at minimum.
- Gamification (13) baseline if it serves FundedBeyond's engagement.

**Platform services**
- Search (28) over courses/content; Enterprise Analytics (29) baseline dashboards (students/instructors/revenue); Automation (31) for core rules (e.g. *completion → certificate*, *payment failed → reminder*); Workflow (32) for course review → publish.
- **Data export** (Vol 8) available from day one (data-ownership non-negotiable).

**Exit criteria:** FundedBeyond runs signup→learn→assess→certify→pay→community end-to-end; all E2E critical journeys green (Vol 12 §12.5); a second test tenant provisions cleanly on the same code; full export works.

---

## 13.4 Phase 2 — Multi-Tenant Hardening & Self-Serve

**Goal:** prove the multi-tenant promise with real second tenants and reduce operational load.

- **SaaS Billing (37)** + entitlements/plan tiers fully wired; **Revenue Sharing (36)** (connected-accounts default, platform-managed ledger option).
- **Tenant Provisioning (38)** self-serve/automated; super-admin operations console.
- **Website Builder (6)** for tenant-built marketing/landing surfaces.
- **Localization (33)**: multi-language, currency/date formatting, regional settings.
- **Integration Engine (27)**: webhooks, Zapier/Make, CRM; external community bridges (Discord/Telegram/Slack).
- **Notification** expands to push/SMS/WhatsApp/Telegram channels.
- **Live Learning (18)/Webinar (19)/Event Management (20)** as tenant demand warrants.
- Broaden payment provider coverage by adding adapters (each must pass the conformance suite).
- **Exit criteria:** ≥ N paying tenants on self-serve billing; per-tenant entitlement enforcement; revenue-share reconciliation correct (§AC-36, §AC-37, §AC-38).

---

## 13.5 Phase 3 — Integrity & Mobile Depth

**Goal:** premium integrity and branded mobile presence.

- **Proctoring L2** (face present/absent, multiple-face, microphone) then **L3** (identity verification, AI risk scoring, behavioral analysis) — staged, with fairness/consent safeguards (Vol 5).
- **Mobile White Label (39)**: from runtime-branding shared app to **dedicated per-tenant EAS builds** (custom name/icon/splash) on the single RN/Expo codebase + shared backend (Vol 7).
- Advanced Analytics (instructor/community/assessment depth); cohort/segment reporting.
- **Exit criteria:** L2/L3 pass deterministic + golden-fixture suites (Vol 12 §12.8); a tenant ships a branded app build through EAS; no auto-fail without human gate.

---

## 13.6 Phase 4 — Extensibility & Intelligence

**Goal:** open the platform and add AI — safely.

- **Plugin / Extension Engine (34)**: stable extension points (AI Tutor, Affiliate, Custom Reports, Advanced Proctoring).
- **Marketplace Engine (35)**: listings, install/purchase, sellers/payouts, review workflow (Vol 9).
- **AI Layer (40)**: AI Course/Module/Lesson/Quiz/Learning-Path generation, Learning Assistant, AI Analytics/Recommendations, AI Proctoring — all via **AIProvider abstraction** and **always behind mandatory human approval** through the Workflow Engine. AI never auto-publishes (§AC-40).
- **Exit criteria:** a third-party plugin installs and runs sandboxed; AI-generated artifact cannot reach Published without human approval, proven by test.

---

## 13.7 Phase 5 — Enterprise & Compliance Scale

**Goal:** enterprise-grade assurances and global scale.

- **Compliance certification readiness → certification:** GDPR processes operational, **SOC 2**, **ISO 27001** (Vol 5 readiness → audit).
- Multi-region / dedicated-tenant infrastructure options (Vol 8 future).
- Advanced DR posture, formal RPO/RTO SLAs per data class (Vol 11).
- Import tooling (migration from LearnWorlds/Kajabi/Thinkific/Teachable) to accelerate tenant onboarding.
- Future payment rails (Coinbase Commerce, NOWPayments) via existing abstraction.
- **Exit criteria:** external audit milestones met; documented multi-region capability; restore drills within RTO.

---

## 13.8 Cross-cutting tracks (continuous, every phase)

- **Security & isolation testing** never pauses; new resources auto-join the IDOR matrix (Vol 12).
- **Observability** (Sentry/PostHog/Better Stack) extended alongside each feature (Vol 11).
- **Performance budgets** tracked release-over-release.
- **Documentation/PRD** kept current as the source of truth; this PRD is living.
- **Accessibility & i18n** considered as features land, not retrofitted.

---

## 13.9 Explicitly deferred (and why)

| Capability | Deferred to | Rationale |
|------------|-------------|-----------|
| Proctoring L2/L3 | Phase 3 | Media + AI scoring complexity; L1 covers MVP integrity. |
| White-label mobile builds | Phase 3 | Dedicated EAS builds need branding pipeline maturity. |
| Marketplace | Phase 4 | Requires stable plugin contracts + payouts; not needed for FundedBeyond. |
| AI generation layer | Phase 4 | High value but must sit behind mature Workflow approval; not launch-critical. |
| SOC 2 / ISO 27001 certification | Phase 5 | Readiness built in from Phase 0; formal audit follows scale. |
| Multi-region / dedicated infra | Phase 5 | Shared-DB model serves early scale; regionalization on demand. |

## 13.10 Acceptance (headline)

The roadmap delivers FundedBeyond live on fully generic multi-tenant engines in Phase 1 with provider-agnostic payments and L1 proctoring, provisions additional tenants with zero code change, then layers self-serve SaaS billing, integrity/mobile depth, extensibility/AI (human-approval-gated), and enterprise compliance in dependency order — with isolation, security, and observability as continuous tracks throughout. (Vol 14 §AC-1, §AC-38, §AC-40, §AC-DevOps.)


---

# Volume 14 — Acceptance Criteria

> The definition of done. Each engine's spec throughout this PRD closes with an "Acceptance (headline)" that references a code here (§AC-N). This volume enumerates the concrete, testable acceptance criteria behind those codes. Criteria are written to be **verifiable** — each maps to one or more tests (Vol 12) and is binary: it passes or it doesn't. Where an engine is multi-faceted, the AC lists the load-bearing conditions, not every requirement; full behaviour lives in the engine spec (Vol 2) and its volume.

**How to read:** `[GA]` = required for the engine to be considered generally available / done. `[Phase]` notes when the criterion first becomes applicable per the roadmap (Vol 13). Unmarked criteria are GA by default.

---

## Domain A — Foundation

### §AC-1 — Multi-Tenant Engine
- Tenant is resolved on every request via precedence custom domain → subdomain → JWT `tenant_id` → (admin) explicit header; resolution overhead is within budget (~<2ms).
- All writes derive `tenant_id` from `tenantContext`, never from a client-supplied body field; a body-supplied `tenant_id` is ignored or rejected.
- **Cross-tenant access is impossible:** with tenant A's session, any read/update/delete of a tenant B resource returns 404/403 **and** is independently blocked by Postgres RLS (defence-in-depth proven by test even if the Prisma scope were bypassed).
- The cross-tenant IDOR matrix (Vol 12 §12.6) is green for every tenant-scoped resource; new resources auto-join the matrix.
- Adding a tenant requires no schema or code change.

### §AC-2 — White Label Engine
- A tenant's branding (logo, colors, name) renders on its student-facing surface; changing tenant A's branding never affects tenant B.
- All tenant-visible chrome derives from tenant config — no hardcoded "Atlas"/FundedBeyond strings in tenant surfaces.
- White-label assets are tenant-scoped in storage (R2) and access-controlled.

### §AC-3 — Role & Permission Engine
- Permissions are namespaced `domain.resource.action`; the system is **default-deny** (an action with no granting permission is refused).
- Default roles (Admin, Instructor, Student, Moderator) and the platform Super Admin resolve to exactly their specified permission sets.
- A custom role grants exactly the subset assigned — no more, no less — verified by the authz matrix (Vol 12).
- Super Admin is a platform role and cannot be impersonated from a tenant session.

### §AC-4 — Feature Flag Engine
- A capability can be enabled per-tenant without redeploy; deploy ≠ release.
- Flag evaluation is tenant-scoped and deterministic; default state is safe (off for unproven features).
- Flag changes are audited.

### §AC-5 — Tenant Configuration Engine
- Tenant config is namespaced, validated (Zod), and isolated; reading/writing config is tenant-scoped.
- Config changes take effect without code deploy and are audited.

---

## Domain B — Presentation

### §AC-6 — Website Builder Engine
- A tenant composes pages from blocks; published pages render on the tenant's domain and are isolated to that tenant.
- Draft vs published states are distinct; publishing is explicit.

### §AC-7 — Theme Engine
- Theme tokens (colors/typography/spacing) apply consistently across web and feed into mobile branding; a tenant theme change never leaks across tenants.

### §AC-8 — Domain Management Engine
- A tenant maps a custom domain/subdomain; verified domains resolve to the correct tenant via the resolution precedence (§AC-1).
- TLS is provisioned/valid; an unverified domain cannot serve tenant content.

---

## Domain C — Learning

### §AC-9 — LMS Engine
- Course → module → lesson hierarchy is tenant-scoped; enrollment grants access; progress persists per user and is accurate on resume.
- Video is referenced by `video_provider` + `video_url` only — the platform stores no video bytes; unsupported providers are rejected.
- A non-enrolled user cannot access gated lesson content.

### §AC-10 — Learning Path Engine
- Prerequisites/ordering are enforced; a learner cannot complete a path step before its prerequisites; path completion is computed correctly.

### §AC-11 — Assessment Engine
- Quizzes/exams support the specified question types; attempts are recorded; grading is correct and deterministic for objective items.
- Attempt limits, timing, and submission rules are enforced server-side (not trusting the client).

### §AC-12 — Certification Engine
- A certificate issues **only** when eligibility rules are met (e.g. required completion/score); issued certificates are stored in R2 and independently verifiable.
- Certificates are tenant-scoped; revocation is supported and audited.

### §AC-13 — Gamification Engine
- Points/streaks/badges award per defined rules deterministically; awards are idempotent (no double-award on retry) and tenant-scoped.

---

## Domain D — Integrity

### §AC-14 — Proctoring Engine
- **L1 [Phase 1]:** tab switch, window blur, fullscreen exit, copy/paste each produce a correctly timestamped violation on the attempt timeline; events survive reconnection (none lost).
- **L2 [Phase 3]:** face-present/absent, multiple-face, microphone-activity flags fire correctly on test media; absent media degrades gracefully (no false hard-fail).
- **L3 [Phase 3]:** identity verification + AI risk scoring place curated golden fixtures into expected risk bands; scoring is a deterministic pure function of inputs.
- A flag/violation is **advisory**: it never auto-revokes a certificate or auto-fails a learner without the configured human/automation gate (fairness, Vol 5).
- Proctoring media honours its retention TTL.

### §AC-15 — Exam Security Engine
- Exam delivery hardening (question/option handling, server-authoritative timing/scoring) prevents client-side tampering from altering outcomes; integrity events are auditable.

---

## Domain E — Community

### §AC-16 — Community Engine
- Public and private communities behave per visibility rules; posts/comments/reactions/mentions/groups are tenant-scoped; a private community is invisible to non-members.

### §AC-17 — Content Moderation Engine
- Reported/flagged content enters a moderation queue; moderator actions are permissioned and audited; removed content is no longer served.

---

## Domain F — Live

### §AC-18 — Live Learning Engine
- Live sessions are scheduled, access-controlled to enrolled/entitled users, and tenant-scoped; recordings (if any) follow the video-provider model.

### §AC-19 — Webinar Engine
- Registration, capacity, and access rules are enforced; attendees are tenant-scoped; reminders fire via Automation/Notification.

### §AC-20 — Event Management Engine
- Events are created/scheduled with correct timezone/localization handling; registration and access controls are enforced and audited.

---

## Domain G — Commerce

### §AC-21 — Payment Integration Engine
- **Provider-agnostic:** a purchase completes through the `PaymentProvider` abstraction with identical call-site code regardless of provider; switching providers requires no change above the adapter.
- **Idempotent:** a payment webhook delivered N times grants entitlement exactly once, writes one payment record and one invoice.
- **No double-grant:** concurrent success callbacks yield exactly one enrollment/entitlement.
- Webhooks with invalid/absent signatures are rejected; out-of-order/replayed events converge to the correct final state.
- The shared adapter conformance suite (Vol 12 §12.7) passes for every live provider.

### §AC-22 — Subscription Engine
- Subscriptions/memberships create, renew, dun on failed charge (reminder via Automation), cancel, and prorate correctly; entitlement tracks subscription state.

### §AC-23 — Coupon Engine
- Coupon validity windows, usage limits, and stacking rules are enforced server-side; an invalid/expired coupon is rejected; discount math is exact in minor units.

### §AC-24 — Tax Engine
- Tax is computed per region/rule in integer minor units; totals reconcile exactly; no floating-point appears in any monetary path.

### §AC-25 — Invoice Engine
- Every successful payment yields one invoice; invoices are immutable financial records (append-only), tenant-scoped, and exportable; refunds produce credit notes rather than deleting history.

---

## Domain H — Platform Services

### §AC-26 — Notification & Communication Engine
- Notifications dispatch via the configured channels (email/in-app [Phase 1]; push/SMS/WhatsApp/Telegram [Phase 2]) through provider abstraction; delivery is tenant-scoped; failures are retried/observable.

### §AC-27 — Integration Engine
- Outbound webhooks fire on canonical events with signed payloads; Zapier/Make/CRM and inbound integrations are tenant-scoped and permissioned; bad inbound signatures are rejected.

### §AC-28 — Search Engine
- Search returns only the requesting tenant's content; results respect access/visibility rules; indexing stays consistent with source data.

### §AC-29 — Enterprise Analytics Engine
- Dashboards for students/instructors/tenants/revenue/assessments/communities/SaaS render tenant-scoped data; analytics reads are served off replicas/materialized views (not the hot path); no cross-tenant aggregation leaks.

### §AC-30 — Audit Logging Engine
- Every irreversible/sensitive action writes an append-only audit record (actor, tenant, action, target, timestamp); audit logs are tamper-evident and tenant-scoped; cannot be deleted via normal APIs.

---

## Domain I — Orchestration

### §AC-31 — Automation Engine
- IF/THEN rules fire on canonical events (e.g. *course.completed → certificate.issue*, *payment.failed → reminder*); execution is idempotent and observable; rules are tenant-scoped.

### §AC-32 — Workflow Engine
- A course traverses Instructor → Reviewer → Admin → Published; transitions are permissioned and audited; an artifact cannot reach Published without the required human approval transition.

### §AC-33 — Localization Engine
- Multi-language content, currency formatting, date formatting, and regional settings render per tenant/user locale; money still stored/computed in minor units + ISO currency.

---

## Domain J — Extensibility

### §AC-34 — Plugin / Extension Engine [Phase 4]
- A plugin installs against stable extension points, runs sandboxed with least privilege, is tenant-scoped, and cannot break tenant isolation or access another tenant's data.

### §AC-35 — Marketplace Engine [Phase 4]
- Listings publish through a review workflow; install/purchase grants entitlement once; seller payouts reconcile; marketplace items respect tenant isolation and security review.

---

## Domain K — SaaS

### §AC-36 — Revenue Sharing Engine
- Both modes reconcile exactly: connected-account split and platform-managed ledger; tenant payout = collected − platform fee − provider fee; all amounts in minor units; ledger is auditable.

### §AC-37 — SaaS Billing Engine
- Plan tiers/entitlements are enforced per tenant; metered usage bills correctly; entitlement changes gate feature access via flags; billing runs through the same provider abstraction (no hardcoded provider).

### §AC-38 — Tenant Provisioning Engine
- A new tenant is provisioned with no schema/code change; isolation holds from creation (§AC-1); a freshly provisioned second tenant runs the same engines as FundedBeyond unchanged.

### §AC-39 — Mobile White Label Engine
- **Runtime branding [Phase 2/3]:** the shared RN/Expo app renders correct per-tenant branding against the shared backend.
- **Dedicated build [Phase 3]:** a per-tenant EAS build ships with custom name/icon/splash from the single codebase; push uses per-tenant credentials; isolation holds on mobile.

---

## Domain L — Intelligence

### §AC-40 — AI Layer [Phase 4]
- AI can generate courses/modules/lessons/quizzes/learning paths via the `AIProvider` abstraction.
- **AI never auto-publishes:** every AI-generated artifact must pass mandatory human approval through the Workflow Engine before reaching Published — proven by test that no path bypasses the approval transition.
- AI features (Assistant, Analytics, Recommendations, Proctoring scoring) are tenant-scoped; AI inputs/outputs respect data-governance and isolation.

---

## Cross-Cutting

### §AC-DevOps — DevOps, Infrastructure & Testing
- A change ships through CI only with all gates green: unit + integration, cross-tenant IDOR matrix, authz matrix, payment idempotency/conformance on touched payment code, coverage floors on touched critical modules (auth/tenancy/payments ≥95%, proctoring/assessment ≥90%, default ≥80%), SAST/secret/dependency scans, and pre-merge E2E critical journeys.
- Deploys support instant rollback; releases are decoupled from deploys via feature flags and can be enabled per-tenant.
- The platform is observable in Sentry/PostHog/Better Stack with alerting and on-call severity tiers.
- Backups (Postgres PITR + R2 versioning) exist and a restore completes within RTO in a documented drill; DR runbooks are current.
- No single third-party provider sits on the tenant-isolation/auth critical path without a documented mitigation.

---

## 14.1 Acceptance of the PRD itself

This PRD is considered a complete implementation blueprint when: all 40 engines plus DevOps have enumerated, testable acceptance criteria (above); the locked stack and ten non-negotiables (Vol 00/01) are reflected consistently across volumes; every engine spec carries the twelve required sections (Purpose, Objectives, FR, NFR, User Stories, User Flows, Permissions, Database, API, Security, Analytics, Acceptance); and the document can be handed to founders, investors, architects, developers, Claude Code, or Cursor as the single source of truth for building Atlas LMS.
