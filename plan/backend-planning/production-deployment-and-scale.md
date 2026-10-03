---
name: Production Deployment, Scale and Platform Margin
status: draft
updated: 2026-08-15
depends-on:
  - monorepo-split-and-api-extraction.md
related:
  - future-backend-flexibility.md
  - open-signup-freemium-and-payments.md
  - ../frontend-planning/local-dev-urls.md
---

# Production deployment, scale and platform margin

**Intent:** define how Atlas goes to production for FundedBeyond (tenant #1) and stays
economically viable as a **B2B multi-tenant platform** sold to other academies.

**Scope:** deployment topology, capacity, cost model, and the metering gaps that determine
gross margin. No product scope, screens, APIs, permissions, or entities are introduced here.

> **Source of truth reminder:** `docs/locked/` remains authoritative. Section 5 of this plan
> proposes a **hosting deviation** from the locked stack. That deviation is **not approved**
> and must be signed off by the owner before implementation.

---

## 1. Business model (corrected)

Atlas is **not** sold to learners. It is sold to **academies (tenants)**, who onboard their own
learners — the Learnyst / Teachable / Kajabi model. FundedBeyond Academy is tenant #1 and a real
academy with a large, currently unknown learner count.

This has one dominant consequence for every decision below:

| Dimension          | Scales with                               |
| ------------------ | ----------------------------------------- |
| **Revenue**        | Number of tenants × plan tier             |
| **Infrastructure** | Total learner activity across ALL tenants |

These are **different dimensions**. Where they diverge, margin leaks. A single large tenant on a
flat plan can consume the margin of many small ones. FundedBeyond is exactly that shape of tenant.

---

## 2. Cost structure

### 2.1 Already-won structural savings

Two locked decisions remove the line items that normally destroy LMS margins. Both must be
preserved:

- **No self-hosted video** (Master PRD §0.4). Video bandwidth is provider-side, not ours.
- **R2 object storage**, zero egress fees (`STORAGE_PROVIDER=r2`,
  `backend/packages/storage/src/providers/storage-provider-factory.ts`).

Result: marginal infrastructure cost per additional learner is near zero.

### 2.2 Infrastructure budget

| Stage                      | Est. $/mo | Contents                                                        |
| -------------------------- | --------- | --------------------------------------------------------------- |
| Launch (FundedBeyond live) | 50–80     | 2 app instances, worker, managed Postgres + PITR, Redis, CF, R2 |
| Growth (real cohorts)      | 100–150   | More instances, larger DB, event-day headroom                   |
| Multi-tenant (20+)         | 250–500   | Scales sub-linearly with tenant count                           |

Indicative platform gross margin at ~$100/tenant/mo: **~76% at 5 tenants, ~87% at 20, ~90% at 50.**
Verify all provider pricing before committing — figures above are planning estimates.

### 2.3 Variable costs that scale with usage

These matter **more than hosting** and are currently unmetered (see F5):

| Cost               | Source in repo                                                             | Risk                                                          |
| ------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Payment processing | Stripe / Razorpay adapters                                                 | 2–3% of GMV; exceeds infra as % revenue                       |
| Video delivery     | Provider refs (`provider-video.service.ts`)                                | Largest variable cost; provider choice is a business decision |
| WhatsApp           | `backend/apps/api/src/server/whatsapp/whatsapp.provider.ts`                | Meta bills **per conversation**                               |
| Email              | `backend/apps/api/src/server/notifications/notification.email-provider.ts` | Linear, low unit cost                                         |
| Zoom               | Live sessions integration                                                  | Per-host licensing                                            |
| Proctoring media   | `ProctoringMediaArtifact`                                                  | Accumulates permanently (see F6)                              |

---

## 3. Findings (evidence-based)

### F1 — Concurrency ceiling: ~20 in-flight tenant requests per instance

**Severity: high. Launch blocker.**

Every authenticated tenant request runs inside a Prisma **interactive transaction**
(`backend/packages/api/src/create-tenant-route.ts` → `backend/packages/db/src/with-tenant-tx.ts`).
An interactive transaction pins a Postgres connection for the **entire request duration** —
auth, entitlement, authorization decision, and handler queries.

Pool default is `max: 20` (`backend/packages/db/src/client.ts`, env `DATABASE_POOL_MAX`).
Request 21 waits up to `maxWait: 10_000` ms, then fails with P2028.

This has already been hit twice in development and worked around by raising limits:

- `client.ts`: _"Admin/studio shells fire several parallel authenticated probes; the default pg
  pool size of 10 starves under that fan-out and cascades into ITX timeouts."_
- `transaction-options.ts`: _"those multi-query routes routinely exceed 5s wall-clock and fail
  with P2028."_

Raising `DEFAULT_TENANT_TX_TIMEOUT_MS` to 30s is **counterproductive under load**: a slow request
now pins its connection for up to 30 seconds.

**Fix (no architectural change):** `withTenantTx` issues **5 sequential round trips** before any
business logic (`SET LOCAL ROLE`, then four separate `set_config` calls). Collapse these into a
single statement. Latency per request converts directly into connection hold time, which converts
directly into capacity. Same wrapper, same RLS guarantees, same locked contract.

**Corollary:** app and database **must be co-located in one region**. Cross-region RTT multiplies
hold time and forces a larger database purchase.

### F2 — Rate limiting does not survive more than one instance

**Severity: high. Security issue.**

`backend/packages/api/src/rate-limit.ts` stores buckets in an in-process `Map`. No Redis exists in
the repo.

- With N instances, effective limits are **N× configured**
- Every deploy, restart, or scale event **wipes all counters**
- `publicAuth` (20/min) is a brute-force control on the login of a platform handling payments

Must move to a shared store, or be enforced at Cloudflare, before multi-instance deployment.

### F3 — No worker entrypoint exists

**Severity: high. Launch blocker.**

`backend/apps/api/src/events/worker-router.ts` exports ~10 outbox batch processors (competency,
gamification, readiness, automation, search, analytics, data-rights, reports, certificates).
**Nothing invokes them in production.** The only internal routes are three crons in
`frontend/apps/web/vercel.json` (`fx/refresh`, `certificates/expire`, `reports/tick`) plus
dead-letter replay.

Shipped features silently never process without this.

### F4 — Every API call is a double hop

`frontend/apps/web/next.config.ts` rewrites `/api/v1/:path*` → `API_INTERNAL_URL` in `beforeFiles`,
unconditionally. On per-invocation hosting this is **two invocations plus inter-project egress per
request**. Behind a single reverse proxy it is a loopback and costs nothing.

### F5 — Entitlements are boolean, not quantitative

**Severity: high. Direct margin risk for the platform model.**

`backend/packages/authorization/src/enforce-entitlement.ts` checks only that an entitlement key
**exists and is active**. It never reads `Entitlement.value_json`. The `usageContext` parameter is
declared in the signature and **never used**.

Consequences:

- "Up to 500 learners", "50GB storage", "10,000 WhatsApp messages" **cannot be enforced**
- A tenant on the cheapest plan can consume unlimited resources
- `TenantSubscription` records `plan_name` but has **no price/amount field** and no link to the
  entitlements the plan should grant

**What already exists and helps:**

- `Entitlement.value_json` — limits are storable today
- `TenantActiveDay` (tenant + membership + day) — **monthly-active-learner metering primitive**
- `EntitlementGrantHistory` — full audit of plan changes
- Feature flags + per-tenant config for tier gating

The data model anticipates usage-based pricing. Only the enforcement and metering layer is missing.

### F6 — No retention policy on proctoring media

L2/L3 proctoring stores `ProctoringMediaArtifact` per attempt. No retention or expiry logic exists
in `backend/apps/api/src/server/proctoring/`; the only `retention` handling is in reports export
settings. Exam recordings accumulate permanently.

This is simultaneously a **cost leak** and a **privacy liability** (indefinitely retained biometric
exam footage). Far cheaper to fix before years of recordings accumulate.

### F7 — Neither Next app sets `output: "standalone"`

Required for slim container images.

---

## 4. Noisy neighbour: F1 is a contract problem, not just performance

As a single academy, the concurrency ceiling is a performance concern. As a **platform**, one
tenant's exam window or cohort launch degrades **every other paying tenant** on the same instance.

This elevates F1 from optimisation to **a precondition for credibly selling to tenant #2.**

---

## 5. Target architecture

| Component  | Choice                                                         | Rationale                                          |
| ---------- | -------------------------------------------------------------- | -------------------------------------------------- |
| App        | Web + API containers, **one region, co-located with DB**       | Removes F4 double hop; scales horizontally         |
| Worker     | **Separate container**, independent scaling                    | Reports/PDF/exports never compete with requests    |
| Postgres   | **Managed, PITR enabled**, same region                         | Data durability is non-negotiable                  |
| Redis      | Small managed instance                                         | Distributed rate limiting (F2) + hot config cache  |
| Edge       | Cloudflare — cache public/learner reads, WAF, edge rate limits | Cheapest request is one that never reaches the app |
| Assets     | R2                                                             | Zero egress; already abstracted                    |
| Video      | Provider-hosted (locked)                                       | Largest variable cost stays off our balance sheet  |
| Tenant DNS | Cloudflare for SaaS custom hostnames                           | Correct fit for host-header tenant resolution      |

**Postgres provisioning order:** `sql/setup` (roles incl. `atlas_app`) → Prisma migrations →
`sql/rls` → `sql/triggers` → `sql/indexes` → `sql/grants` → `sql/partitions`. Must be a repeatable
script, not manual.

### 5.1 Scheduled-spike scaling (the efficiency unlock)

FundedBeyond's load is **not random**. It spikes at cohort launches, live sessions, and exam
windows — all scheduled by the tenant. This means sophisticated autoscaling is unnecessary; the
requirement is **adding instances ahead of a known event and removing them after**.

Run lean baseline capacity, scale on the event calendar. Peak-grade reliability at off-peak cost.
Exam windows are simultaneously the highest-load and highest-stakes moments in the product, and
they are predictable.

### 5.2 Hosting deviation — REQUIRES OWNER APPROVAL

Master PRD §0.3 locks **Vercel** as the hosting layer. The container topology above is a deviation.

- If **approved**: record it as an accepted exception (ADR in `docs/ops/` or an addendum note) so
  `docs/locked/` does not silently contradict production.
- If **rejected**: F1–F3 and F6–F7 all still apply and still save money on Vercel. The proxy hop
  (F4) must then be bypassed at the edge, and Playwright-based PDF/report generation must move off
  serverless regardless.

**Status: undecided. Do not implement hosting changes until resolved.**

---

## 6. Pricing and margin (platform)

The core requirement: **price on the dimension that drives cost.**

- Recommended primary dimension: **monthly active learners** — `TenantActiveDay` already tracks it
  and it correlates with real infrastructure consumption
- Secondary metered dimensions: storage consumed, premium channels (WhatsApp/SMS), video if
  self-brokered
- Expensive notification channels should be **opt-in per tenant**, so a chatty default does not
  quietly consume margin

Without F5 resolved, negative-margin tenants cannot be identified, let alone prevented.

---

## 7. Roadmap

Phases 1–2 are independent of the hosting decision and should not wait on it.

### Phase 1 — Capacity and security (launch blockers)

1. Collapse `withTenantTx` setup round trips into a single statement (F1)
2. Move rate limiting to a shared store (F2)
3. Build the worker entrypoint for outbox processors (F3)
4. Re-tune `DATABASE_POOL_MAX` and ITX timeouts against measured latency, not incident response

### Phase 2 — Margin protection

5. Read and enforce `Entitlement.value_json`; wire the existing `usageContext` parameter (F5)
6. Per-tenant usage counters for storage and premium channels (F5)
7. Proctoring media retention policy (F6)
8. Add price/amount and entitlement linkage to `TenantSubscription` (F5)

### Phase 3 — Deployment (gated on §5.2 decision)

9. `output: "standalone"` on both Next apps (F7)
10. Containerise; single reverse proxy; eliminate the double hop (F4)
11. Repeatable Postgres provisioning script (roles → migrations → sql/\*)
12. Managed Postgres + PITR, Redis, Cloudflare (DNS/WAF/rate limits/caching)
13. Backups to R2 with a **rehearsed restore drill** (`release:restore:validate`,
    `release:rollback:verify` already exist)
14. Deploy job in `.github/workflows/ci.yml` (currently validation only)

### Phase 4 — Validation

15. **Load test to establish the real ceiling.** Currently unknown and unmeasured.
16. Event-day scaling runbook in `runbooks/`
17. Verify tenant isolation and rate limits hold across multiple instances

---

## 8. Definition of done

- [ ] Measured concurrent-request ceiling documented, with headroom for a FundedBeyond cohort burst
- [ ] Rate limits verified correct across ≥2 instances and across a deploy
- [ ] Outbox processors demonstrably running in production
- [ ] Restore from backup rehearsed end to end, timed and documented
- [ ] Quantitative entitlement limits enforced for at least learners and storage
- [ ] Proctoring media retention active with a documented retention window
- [x] Per-tenant cost attribution available for pricing decisions -- Platform console P9
      (`/platform/costs`), 2026-09-18. The rate card and fixed costs must be entered once
      hosting is chosen; see `docs/runbooks/cost-attribution.md` for what is and is not metered.
- [ ] `pnpm ci` and `pnpm sprint0:gate` green

---

## 9. Open decisions

| #   | Decision                                       | Owner | Blocks  |
| --- | ---------------------------------------------- | ----- | ------- |
| D1  | Approve or reject the hosting deviation (§5.2) | Owner | Phase 3 |
| D2  | Primary pricing dimension (§6)                 | Owner | Phase 2 |
| D3  | Video provider (cost vs access control)        | Owner | Margin  |
| D4  | Proctoring media retention window              | Owner | Phase 2 |
| D5  | Managed Postgres provider (region-matched)     | Owner | Phase 3 |

---

## 10. Risks

| Risk                                    | Impact                                         | Mitigation             |
| --------------------------------------- | ---------------------------------------------- | ---------------------- |
| Launch without F1 fix                   | Cohort burst queues then errors                | Phase 1 + load test    |
| Scale to 2 instances without F2         | Auth brute-force protection silently weak      | Phase 1                |
| Sell tenant #2 before F1                | Noisy neighbour breaches customer expectations | Phase 1 before sales   |
| Sell any tenant before F5               | Unidentifiable negative-margin customers       | Phase 2 before pricing |
| Self-hosting Postgres to save ~$25/mo   | Data loss risk vastly exceeds saving           | Managed + PITR         |
| Proctoring media accumulating before F6 | Permanent cost floor + privacy exposure        | Phase 2, early         |
