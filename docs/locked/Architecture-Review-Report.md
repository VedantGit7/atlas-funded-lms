# Architecture Review Report
### Atlas LMS (v3.0) + FundedBeyond Academy (v1.0)
**Reviewer stance:** CTO signing off a ~$100,000 build. Verdict-first, then evidence.

---

## Executive verdict

These are strong PRDs. The isolation-in-depth model, provider abstraction, append-only audit/ledgers, idempotency discipline, data-export-as-a-right, human-gated AI, and a roadmap sequenced by *risk and dependency* rather than feature glamour are all things most teams get wrong. I would not throw this away.

But I would **not release the budget against the documents as written**, because four things are true at once:

1. The platform's #1 invariant — tenant isolation — rests on a mechanism (`SET app.tenant_id` session GUC) that is **latently unsafe on the locked stack** (serverless + a connection pooler in transaction mode). This is a correctness *and* security defect, not a scale defect.
2. The launch tenant's flagship features depend on an Atlas capability that Atlas does not ship until **three phases later** — a dependency inversion that forces either a forbidden fork or a stalled launch.
3. Two headline differentiators (per-tenant **native white-label apps**, in-house **global tax**) are written as config toggles but are, in reality, policy/compliance projects that can sink the timeline.
4. The FundedBeyond product itself sits in a **regulatorily scrutinized domain** (prop-trading "challenge" funnels) and the "Readiness → go spend money" mechanic carries advice/suitability exposure that no amount of clean architecture neutralizes.

None of these are fatal. All are cheaper to fix now than after launch. The detailed area reviews below give you the *what to fix now / what can wait* split so you can re-scope Phase 0–1 before any code is written.

---

# Part 1 — Area-by-area review

For each area: **Good / Missing / Breaks at scale / Redesign now / Can wait.**

---

## 1. Multi-tenant architecture

**Good.** Three independent enforcement layers (edge host→tenant map, Prisma scoping extension, Postgres RLS) plus `can()` plus audit. `tenant_id` on every business row, default-deny, clean lifecycle states (`provisioning→active→suspended→archived→deleted`), and "new tenants = data, not infrastructure." This is more isolation rigor than 90% of seed-stage SaaS ships with.

**Missing.**
- The **transaction boundary for the RLS GUC is unspecified.** RLS reads `current_setting('app.tenant_id')` and the app does `SET app.tenant_id = '<uuid>'`. On Vercel serverless you *must* front Postgres with a pooler (Supavisor/PgBouncer) in **transaction-pooling mode** to survive connection limits. In transaction mode a *session-level* `SET` is not guaranteed to land on the same backend as the next query — and a backend may retain a *previous* tenant's GUC. That is a silent cross-tenant read/write path. The fix is `SET LOCAL` (or `set_config(..., true)`) **inside an explicit transaction wrapping every request's DB work**. As written, the platform's load-bearing invariant has a latent leak.
- The Prisma extension is a convenience, not a guarantee: `$queryRaw`, interactive `$transaction`, some `aggregate`/`groupBy`/nested-write paths, and raw SQL can bypass the auto-`where`. So the *real* guarantee is RLS — which (above) is itself fragile. The "two independent layers" can **share one failure mode** (the GUC).
- **Global identity model.** `User.email @unique` platform-wide means one human = one identity across all tenants. That is a cross-tenant correlation/privacy issue (the platform can see John is in Tenant A and Tenant B) and an account-takeover blast-radius issue. For a *white-label* platform this is a real design decision, not an implementation detail (see §4).
- No **noisy-neighbor controls**: no per-tenant statement timeouts, query budgets, or connection quotas. One tenant's runaway export/analytics query degrades everyone on the shared primary.

**Breaks at scale.** Single shared Postgres is the platform-wide write ceiling and a shared-fate surface (one bad migration hits all tenants simultaneously). RLS predicates on every query can defeat some join plans; needs explicit load testing, not assumption. The "extract an engine to its own service later" path is largely theoretical while every engine reads the same physical tables.

**Redesign now.** (a) Transaction-scoped `SET LOCAL` GUC, proven against a *pooled, production-like* DB — make this a Phase-0 exit gate, not a nice-to-have. (b) Decide global-vs-per-tenant identity now; it is the single hardest thing to change after launch.

**Can wait.** DB-per-tenant / dedicated deployments, sharding/Citus, read replicas (add when read load demands).

---

## 2. White-label architecture

**Good.** Branding as versioned data, preview-before-publish, entitlement-gated "Powered by," edge-resolved branding, **SVG sanitization** explicitly called out (a real XSS vector most people miss), shared theme tokens across web + email + mobile.

**Missing.**
- **Custom-domain TLS at scale is hand-waved.** Engine 8 doesn't name how certs are issued/renewed for N tenant domains. Vercel's per-project custom-domain model and limits are not the right tool here; **Cloudflare for SaaS / custom hostnames** is, and it isn't in the doc. Who runs ACME issuance/renewal for 10,000 domains is an unanswered operational question.
- **Email deliverability per white-label domain is absent.** "From address inherits branding" is trivial; the infrastructure behind it (per-tenant SPF/DKIM/DMARC, domain authentication with the ESP, dedicated subdomain/IP and reputation isolation so one tenant's spam doesn't tank shared-IP deliverability for all) is not.
- **Shared-cookie/CSP surface.** If tenants live on subdomains of a shared apex, cookie scoping and CSP need deliberate design — especially once the Website Builder lets tenants inject content.

**Breaks at scale.** Cert/domain automation and shared-IP email reputation are the breakers. Branding-change cache-invalidation storms across the edge if many tenants edit at once.

**Redesign now.** Pick the custom-hostname strategy (Cloudflare for SaaS) and the per-domain email-auth + reputation-isolation model. Both are foundational and painful to retrofit once tenants are live on shared infrastructure.

**Can wait.** Advanced theme editor, multiple brands per tenant.

---

## 3. SaaS architecture (Atlas-as-a-business)

**Good.** Entitlements as the single source of truth (never hardcoded plan names), idempotent provisioning saga, self-serve lifecycle, **data export as a first-class always-available capability** (genuinely differentiating and correct), usage metering for billing.

**Missing.**
- **No central entitlement-enforcement gate** analogous to `can()`. "Entitlements gate everything" but enforcement is scattered across 40 engines. Without one `enforce(entitlement, tenant)` chokepoint you get drift, bypasses, and inconsistent upgrade prompts. Entitlement enforcement deserves the same centralization as authorization.
- **Metering → billing is the classic SaaS failure point.** At-least-once event delivery + idempotent consumers is right, but billing needs a *reconciliation ledger* and an exactly-once accounting story, plus a dispute/correction path. Not described.
- **Entitlement versioning / grandfathering** when plan definitions change is not addressed.
- **Suspension blast radius.** "Suspended tenants reject non-admin traffic" must still allow: public marketing pages, **public certificate-verification URLs**, and **in-flight payment webhooks** — or you break credential verification and lose money events. Suspension needs nuance.

**Breaks at scale.** Metering event volume into the single primary; provisioning saga under signup spikes (seeding sample content per tenant is write-heavy).

**Redesign now.** Central entitlement enforcement; a billing/metering reconciliation model.

**Can wait.** Complex proration edge cases, marketplace billing.

---

## 4. Authentication architecture

**Good.** Using Supabase Auth instead of building your own (correct), MFA, enterprise SSO/SAML/OIDC, short-lived access + refresh, rotation, breach-list checks, lockout, device/session management.

**Missing / structurally muddy.**
- **Host-resolved tenant vs JWT tenant claim is underspecified and security-sensitive.** Engine 1 precedence is `custom domain → subdomain → JWT claim → header` — i.e., **host wins over the token.** So a user logged in for Tenant A who visits Tenant B's domain resolves *as Tenant B*; the only thing stopping cross-tenant action is the `UserTenant` membership lookup. That membership check is now **load-bearing on every request** and must be non-bypassable and audited — it cannot be left to "ownership checks layered on." Conversely, if `tenant_id` *is* baked into the access token, tenant-switching requires a token re-mint/exchange that Supabase Auth doesn't give you for free. The doc needs to pick one model and make the membership gate first-class.
- **Supabase Auth is a login SPOF across all tenants.** An auth outage = no tenant can log in. For an "enterprise SLA" tier that's a concentration risk. Per-tenant SAML/IdP config (each enterprise brings their own Okta/Azure AD) is exactly where this kind of build balloons — validate Supabase's multi-IdP story before promising Enterprise SSO.
- **Global identity ⇒ ATO blast radius** (see §1): one compromised account = every tenant that user belongs to.
- **Stateless-JWT revocation** "on role change" needs a denylist or short TTL acceptance; mechanism unstated (and a denylist wants the Redis you don't have yet — see §9).

**Redesign now.** Nail down host↔token tenant resolution; make the membership check a centralized, audited, non-bypassable gate; decide global-vs-per-tenant identity.

**Can wait.** WebAuthn, advanced device posture.

---

## 5. Authorization architecture

**Good.** Central `can(actor, permission, resource)`, default-deny, namespaced `domain.resource.action` permissions, **no grant-up**, custom roles bounded by entitlement, `permission_overrides`, audit on permission changes. Textbook-correct RBAC.

**Missing / will break.**
- **Ownership/relationship checks are "layered on," not centralized.** "Instructor can edit *only their* courses," "member can read *only their* private community space," "mentor scoped to *their* cohort" are relationship checks. If they live ad hoc per endpoint, that's precisely where IDOR bugs breed — on endpoint #15 someone forgets. Fold the resource/ownership/relationship check **into** `can(actor, perm, resource)` so it's impossible to authorize without it.
- **Permission cache has no home.** "<1ms in-memory after load" across a *serverless* fleet (no shared memory, cold starts) means either a DB read per request or a distributed cache — and Redis isn't in the locked stack (§9).
- **Permission-catalogue explosion.** 40 engines × resources × actions = hundreds of permissions; composing custom roles over that surface is error-prone (over-granting). No bundles/grouping described.

**Redesign now.** Make ownership/relationship part of the central authorization call. Add the permission cache substrate.

**Can wait.** Full ReBAC / policy engine (OPA/Cedar) — only if relationship complexity outgrows RBAC + ownership.

---

## 6. Mobile architecture

**Good.** Single RN/Expo codebase, same versioned API + auth as web, **no mobile-only privilege path** (good security stance), provider-hosted video, idempotent queued offline progress, per-tenant push credentials.

**Missing / will break — this is a headline risk.**
- **"Dedicated white-label native app per tenant" collides with App Store policy.** Apple **Guideline 4.3 (spam/duplicate apps)** has historically mass-rejected template/white-label clones that differ only by branding from one developer account. Your two real options each have teeth: (a) publish under each *tenant's own* developer account — kills full automation, adds heavy onboarding, you don't control signing keys; or (b) publish under Atlas's account and risk 4.3 rejection. The PRD treats "tenant's (or Atlas-managed) listing" as a toggle. It is a product-defining constraint. For **FundedBeyond specifically**, a "get funded" prop-trading app invites *extra* financial-services/gambling-adjacent scrutiny.
- **OTA (Expo Updates) policy ceiling.** Fine for fixes; using OTA to materially change features bypasses review and risks account-level penalties — across *all* your tenant apps at once.
- **Offline integrity for the FundedBeyond hero.** Offline swipe generating readiness signals that sync later is a **gaming vector** unless re-validated server-side. Offline LWW is acceptable for progress %, dangerous for anything that feeds the readiness gate.
- **Per-tenant push credentials + per-tenant binaries = real ops/cost**: N APNs keys/FCM projects, cert expiries, and every app update = N EAS rebuilds + N submissions.

**Redesign now.** Decide distribution before selling "white-label native app" as an entitlement. Realistic model: **shared app + runtime branding as the default; dedicated builds only for enterprise tenants who bring their own developer account.** Re-word the entitlement accordingly.

**Can wait.** Advanced offline sync, full deep-link matrix.

---

## 7. Analytics architecture

**Good.** Canonical event taxonomy, event bus, audience-scoped dashboards, pre-aggregation for speed, export. FundedBeyond's funnel-as-first-class with explicit events is good product thinking.

**Missing / will break.**
- **Two sources of truth.** PostHog (product) *and* internal materialized views (reporting) both fed by events = the perennial "the dashboard and PostHog disagree" problem. You want **one canonical event log (the outbox)** that *fans out* to PostHog and the warehouse, with PostHog as a consumer — not a parallel collector.
- **MV refresh on the OLTP primary** contends with transactional load. PG materialized views are a fine *start* and a guaranteed *wall* once you do per-item assessment stats, cohorts, and cross-tenant platform analytics. A columnar store (ClickHouse/BigQuery) is the eventual home; budget for the migration.
- **Cross-domain attribution is the business case and it's optimistic.** The entire FundedBeyond ROI rests on joining Academy clicks to `fundedbeyond.com` purchases via a signed token + inbound webhooks. Real-world leakage: token lost on new browser / external Safari handoff / cleared params, ad-blockers, webhook failures, join-window expiry. "If it isn't attributable it isn't done" — but 20–40% of cross-domain conversions routinely go dark. You need explicit **unattributed-conversion handling, an email/identity fallback, and a defined attribution window**. Currently absent.
- **GDPR cross-system deletion.** Deleting a user must purge/anonymize their events in *both* the warehouse and PostHog. Not described.

**Redesign now.** One canonical pipeline (outbox → PostHog + warehouse). Attribution fallback + identity resolution + window.

**Can wait.** Dedicated columnar warehouse (until PG MVs hurt), advanced multi-touch attribution.

---

## 8. Commerce architecture

**Good.** `PaymentProvider` abstraction, webhooks normalized to canonical internal events, idempotency everywhere, append-only revenue ledger + reconciliation jobs, no card data on Atlas, MoR providers modeled, sequential per-tenant invoice numbering. Strong, correct bones.

**Missing / will break.**
- **The abstraction leaks worst at subscriptions.** "Stripe + Razorpay with identical business code" holds for one-time checkout; it breaks for recurring. India's **RBI e-mandate** regime (mandate registration, max-amount caps, mandatory pre-debit notifications) is fundamentally different from Stripe subscriptions — and the interface already hedges with `createSubscription?` as *optional*. Design the subscription abstraction against the **most-constrained** provider (India e-mandate), not the easiest.
- **Tax (Engine 24) is dramatically underscoped and is a trap to build.** Global tax (US economic-nexus sales tax, EU VAT OSS, India GST + e-invoicing, digital-goods VAT) is why Stripe Tax / Avalara / Paddle exist. For a small team, **default to a Merchant-of-Record (Paddle/LemonSqueezy)** and let them own tax + liability. The PRD mentions MoR but doesn't make it the default — it should be.
- **"Platform-managed split payments" is a regulated-business decision dressed as a config flag.** Connected-accounts/split settlement pulls Atlas toward money-transmission/KYC obligations in many jurisdictions. Treat it as a compliance project, not a toggle.

**Note.** For FundedBeyond v1, commerce is *out of scope* (challenges sold externally) — good, it's off the launch-tenant critical path. But Atlas's **own SaaS billing** uses this same layer, so commerce is on Atlas's critical path from Phase 2.

**Redesign now.** Default to MoR for tax offload; design subscriptions around e-mandate constraints.

**Can wait.** Crypto rails, platform-managed split settlement.

---

## 9. Community architecture

**Good.** Native spaces/posts/comments/reactions/mentions/groups, public/private visibility, a real moderation engine (queues, appeals, audit), external bridges, media scanning.

**Missing / will break.**
- **No caching / real-time layer in the locked stack.** Feeds (fan-out), `@mention` notification fan-out, **leaderboards** (a hot read+write pattern that wants Redis sorted sets), presence, and "answer to your question" updates all want Redis + a websocket/realtime tier (Supabase Realtime exists but isn't named). Postgres-only, poll-only community will feel dead — fatal for a product explicitly chasing "Duolingo-like" daily engagement.
- **Trading-community moderation liability is materially higher than a generic LMS.** A community full of trade "signals," tips, and members giving each other financial advice creates regulated-advice and pump/scam exposure. Keyword filters + a human queue is fine for v1 volume but won't scale without ML classification, and the legal exposure is real.
- External bridges (Discord/Telegram) are ToS-fragile and token-heavy.

**Redesign now.** Add Redis + a realtime tier to the stack (it's also needed by §4 revocation, §5 permission cache, and rate limiting). Plan moderation for a financial community specifically.

**Can wait.** ML moderation, advanced feed ranking.

---

## 10. Assessment architecture

**Good.** Server-authoritative timing/scoring, autosave + resume, question banks with randomization, item statistics, subjective grading queue, proctoring hook, **correct answers never sent to client**. Security-aware and well done.

**Missing / will break.**
- **Dependency inversion (critical, cross-PRD).** FundedBeyond's flagship five-dimension scoring, recency-weighted rolling aggregates, decay, banded adaptivity, and the readiness composite are **not** "Assessment 11 configuration." They need per-dimension item tagging, weighted cross-assessment aggregation, time-decay, and a versioned scoring-config store. The PRD says these ride **Atlas Plugin/Extension Engine 34** — but **Engine 34 is Atlas Phase 4**, while the Diagnostic/Readiness engines are FundedBeyond **Phase 1–2**. So the launch tenant's differentiators depend on a platform capability that doesn't exist yet, forcing either a **forbidden fork** (violating "ride Atlas, never fork") or a **stalled launch**. This must be resolved before Phase 1.
- **Item-bank integrity for a high-stakes, money-adjacent gate.** Randomization isn't enough; you need item-exposure control and bank rotation, because a trading community *will* scrape and share the bank. The "anti-gaming" claim is currently thinner than the stakes warrant.
- **The "Readiness → spend money" mechanic is an advice/suitability liability.** Telling a user "You're prepared — here's why" and then prominently routing them to pay a challenge fee implies a performance/suitability representation. The engine's band→pass-rate validity metric is good engineering; the *framing* needs heavy disclaimers and legal review (see Part 2, Critical Risk #4).

**Redesign now.** Resolve the plugin inversion — either ship a minimal stable extension/scoring point in Atlas Phase 1, or reclassify five-dimension scoring as a **first-party generic "competency/scoring" engine** in Atlas so FundedBeyond consumes it without forking.

**Can wait.** IRT adaptivity, live-trade-data signals (correctly future).

---

## 11. Scalability architecture

**Good.** Stateless app tier, R2 offload, **video fully offloaded to providers** (removes the single biggest cost/scale problem — genuinely smart), async queue for hot writes, partitioned append-only tables, read replicas + MVs, modular boundaries for future extraction.

**Missing / will break.**
- **One Postgres primary is the platform ceiling and SPOF.** All tenant reads/writes, RLS eval, MV refresh, metering, audit, and analytics events hit it. Fine for dozens–hundreds of tenants; it is the *first* thing to break against "Shopify-scale" ambition. No shard/Citus/tenant-routing plan, and engine extraction is hard while everything shares physical tables.
- **Event-bus transport is left ambiguous** ("a Postgres-backed job table *or* a managed queue"). A Postgres job table competes with OLTP on the same primary and becomes the next bottleneck. Pick a real managed queue.
- **No real worker runtime.** "Vercel cron/functions or a dedicated worker runtime" — Vercel functions have execution-time limits that collide with large exports, certificate PDF rendering, analytics rollups, and bulk ops. You need a proper worker tier; it isn't in the stack.
- **The deep tension:** serverless forces a connection pooler → transaction-mode pooling → which **breaks the session-GUC RLS** (§1). The scaling choice and the isolation mechanism are in direct conflict. This is the single most important architectural issue in the whole document set.

**Redesign now.** Transaction-scoped GUC; a real managed queue + worker runtime; an explicit connection-pooling strategy.

**Can wait.** Sharding/Citus, columnar warehouse, multi-region.

---

## 12. Security architecture

**Good.** Hostile-client assumption, defense in depth, append-only audit, SSRF protection on outbound webhooks (often forgotten), CSRF/SameSite/CORS-per-tenant, payment idempotency, RLS as last line, cross-tenant IDOR in the pen-test plan. Mature posture on paper.

**Missing / will break.**
- The **isolation-under-pooling defect (§1) is a security finding**, not just scale.
- **Per-adapter webhook replay protection** must be explicit (timestamp + nonce window), not just signature verification — one weak adapter = financial fraud.
- **Secrets management is unspecified.** "Vercel env + secret store" is not a secrets manager (no rotation, no per-tenant isolation, broadly visible). Storing **N tenants' payment/integration credentials** is a high-value breach target and needs a concrete KMS-backed/vault design.
- **Proctoring = biometric data = regulated.** Webcam/face/ID at L2/L3 falls under GDPR Art. 9, **Illinois BIPA** (statutory damages, class-action magnet), Texas CUBI, etc. The minimization instinct is right; the consent/retention/deletion/DPA design must be airtight and legally reviewed before building. (Correctly deferred to Phase 3.)
- **The free, unauthenticated Diagnostic endpoint** (FundedBeyond's lead-gen) writes data and is a bot/abuse magnet — needs its own rate-limit/abuse model.

**Redesign now.** Concrete secrets component; transaction-scoped isolation; per-adapter replay protection.

**Can wait.** Biometric compliance (with the L2/L3 deferral), formal SOC2/ISO audit.

---

## 13. DevOps architecture

**Good.** Proper environments, strong CI gates (typecheck/lint/test/build/E2E/security scan), coverage on critical modules, expand/contract migrations, feature flags decoupling deploy from release, instant rollback, Sentry/PostHog/Better Stack, IDOR matrix in CI, restore drills, SBOM/dependency scanning.

**Missing / will break.**
- **Auto-deploy-`main`-to-prod vs gated DB migrations are in tension.** Auto-deploying app code while migrations run as a separate "controlled step" invites app/schema skew. Migration execution must be **orchestrated relative to the deploy** that depends on it; the ordering/automation isn't pinned.
- **Shared-DB migrations are shared-fate.** A bad migration hits *all* tenants at once and you can't feature-flag a schema change. Blast radius = the whole platform; expand/contract mitigates but doesn't eliminate. No schema canary discipline described.
- **No distributed tracing/APM.** Three separate tools, none ties a slow/leaky request through middleware→engine→DB→queue with `tenant_id` propagated. Debugging a tenant-specific perf or isolation issue will be painful.
- **No per-tenant cost attribution.** Gross-margin-per-tenant is a stated North Star, but only the *usage* side is metered; the *cost* side (Vercel/Supabase/R2/CF/EAS/domains/push per tenant) isn't instrumented.

**Redesign now.** Migration orchestration ordering vs deploy; `tenant_id`-propagating tracing.

**Can wait.** Full APM, cost dashboards (but start tagging spend early).

---

# Part 2 — Consolidated Risk Report

## Critical Risks (fix before code; these threaten the $100k)

**C1 — Tenant isolation is latently unsafe on the locked stack.**
Session-GUC RLS (`SET app.tenant_id`) + serverless + transaction-mode pooling can leak or break across tenants. This is the #1 invariant and it has a correctness/security hole. *Fix:* transaction-scoped `SET LOCAL`/`set_config(...,true)`, proven against a pooled production-like DB as a Phase-0 exit gate. The two "independent" isolation layers must not share the GUC failure mode.

**C2 — Single shared Postgres is the platform SPOF, scaling ceiling, and shared-fate migration surface.**
Acceptable for the early stage *if acknowledged and instrumented*; dangerous if treated as "scales forever." *Fix now:* explicit connection-pooling strategy, statement timeouts / per-tenant guards against noisy neighbors, and a written "when do we shard" trigger. Sharding itself can wait.

**C3 — Plugin dependency inversion between the two PRDs.**
FundedBeyond Phase 1–2 flagships (Diagnostic, Readiness, Swipe scoring) depend on Atlas **Engine 34 (Phase 4)**. As written, the launch tenant cannot ship without forking — violating the platform's core promise. *Fix:* promote a minimal stable extension/scoring capability into Atlas Phase 1, or make five-dimension scoring a first-party generic Atlas "competency" engine.

**C4 — Regulatory/advice exposure of the FundedBeyond model.**
An "education" product whose explicit purpose is to drive purchases of prop-trading "challenges," with a "Readiness" score that tells users they're prepared to **risk money**, sits in a heavily scrutinized space (prop-firm enforcement actions; "challenge" models are gambling-adjacent in some jurisdictions; readiness framing implies suitability/performance representation). *Fix:* legal review of the funnel, the CTA framing, and disclaimers **before** build. Budget for counsel.

**C5 — "Per-tenant native white-label app" may be unshippable as designed.**
Apple 4.3 routinely rejects branded clones from one developer account; the realistic model is shared-app-with-runtime-branding as default, dedicated builds only for tenants who own their developer account. *Fix:* re-scope the entitlement and onboarding before promising it commercially — doubly so for a "get funded" finance app.

## Medium Risks (will hurt within 6–12 months)

- **M1 — No caching/real-time tier (Redis + websockets) in the locked stack.** Needed by permission cache, JWT revocation list, rate-limit state, community feeds, leaderboards, and presence. Add now.
- **M2 — Tax built in-house (Engine 24).** Default to Merchant-of-Record (Paddle/LemonSqueezy) to offload global tax and liability.
- **M3 — India recurring-payment (RBI e-mandate) breaks the subscription abstraction.** Design subscriptions around the most-constrained provider.
- **M4 — Custom-domain TLS + email deliverability at scale unsolved.** Adopt Cloudflare for SaaS; design per-domain email auth + reputation isolation.
- **M5 — No central entitlement enforcement.** Mirror the `can()` pattern for entitlements.
- **M6 — Ownership/relationship authZ not centralized.** Fold into `can(actor, perm, resource)` so endpoints can't skip it.
- **M7 — Analytics dual-source-of-truth + cross-domain attribution leakage.** One canonical event pipeline; attribution fallback + identity resolution + window.
- **M8 — Event-bus/worker transport ambiguity.** Commit to a managed queue + real worker runtime; stop saying "Postgres table or queue."
- **M9 — Secrets management for per-tenant provider credentials underspecified.** Concrete KMS/vault design; this is a prime breach target.
- **M10 — Auth model ambiguity** (host vs JWT tenant claim; global-identity ATO blast radius; Supabase login SPOF; revocation mechanism).

## Future Risks (watch; address when triggers fire)

- **F1 — Postgres sharding / Citus** when the single primary's write/connection ceiling is hit.
- **F2 — Columnar warehouse** (ClickHouse/BigQuery) when PG materialized views contend with OLTP.
- **F3 — Biometric/BIPA compliance** for proctoring L2/L3 (deferred — keep it deferred until legally designed).
- **F4 — Multi-region / data residency** for enterprise/compliance tenants.
- **F5 — ReBAC / policy engine** if relationship-based access outgrows RBAC + ownership checks.
- **F6 — Distributed tracing/APM + per-tenant cost attribution** as the fleet and tenant count grow.

---

# Part 3 — Recommendations (prioritized)

1. **Re-baseline Phase 0 around isolation correctness.** Build a tenant-isolation test harness that runs against a *pooled, production-like* Postgres and proves zero leakage under transaction pooling. Adopt transaction-scoped `SET LOCAL`. Extend the existing IDOR matrix to cover the pooling failure mode. *No feature code until this gate is green.* (Addresses C1, C2.)
2. **Add three components to the "locked" stack now:** a connection pooler strategy made explicit, **Redis/Upstash** (cache + revocation + rate-limit + leaderboards), and a **managed queue + worker runtime**. These are load-bearing across at least six engines. (M1, M8, C2.)
3. **Resolve the cross-PRD dependency inversion** by shipping a minimal generic scoring/extension capability in Atlas Phase 1, or by reclassifying five-dimension scoring as a first-party Atlas engine. Protect the "never fork" invariant. (C3.)
4. **Get legal counsel engaged before build** on (a) the FundedBeyond challenge-funnel + readiness framing and (b) proctoring biometrics. Treat both as gating, budgeted line items, not afterthoughts. (C4, F3.)
5. **Decide the mobile distribution model now** — shared app + runtime branding as default; dedicated builds only for tenants with their own developer account — and re-word the entitlement and onboarding. (C5.)
6. **Default commerce to Merchant-of-Record** to offload tax/compliance; design the subscription abstraction against India e-mandate constraints. (M2, M3.)
7. **Pick Cloudflare for SaaS** for custom-hostname TLS; design per-domain email authentication and reputation isolation. (M4.)
8. **Centralize entitlement enforcement and ownership/relationship checks** the same way authorization is centralized. (M5, M6.)
9. **Adopt one canonical event pipeline** (outbox → fan-out to PostHog + warehouse) and design explicit attribution fallback/identity resolution + window. (M7.)
10. **Specify a concrete secrets-management component** for per-tenant credentials; add per-adapter webhook replay protection. (M9, M10.)
11. **Add `tenant_id`-propagating distributed tracing and start tagging per-tenant spend from day one** so gross-margin-per-tenant is measurable. (F6.)

---

## What I'd explicitly keep as-is (don't over-engineer)

The roadmaps' deferrals are correct: marketplace, AI generation layer, multi-region/dedicated infra, IRT adaptivity, and formal SOC2/ISO audit are all rightly later. The provider abstraction, append-only ledgers/audit, idempotency discipline, data-export-as-a-right, human-gated AI, and video-fully-offloaded are good decisions I would defend in a board meeting. **The fixes above are about the gap between the documents' ambition and the locked stack's reality — close that gap in Phase 0 and this is a fundable build.**
