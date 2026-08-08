---
name: Local dev URLs and multi-tenant hosts
status: draft
updated: 2026-06-23
canonical_path: atlas-funded-lms/plan/frontend-planning/
related:
  - complete-frontend-rebuild.md
  - ../backend-planning/monorepo-split-and-api-extraction.md
---

# Local dev URLs and multi-tenant hosts

> **Why this doc exists:** `pnpm dev` prints many URLs. That is expected in local dev — not a sign the architecture is wrong. Production customers see **one primary branded domain** per academy, same as Learnyst, Teachable, and Thinkific.

---

## 1. Mental model

Atlas is a **white-label, multi-tenant LMS**. The **HTTP `Host` header** selects the tenant (or platform plane). There is **one Next.js process** on port **3000**; different hostnames load different branding, data scope, and shells.

```text
One dev server (:3000)
        │
        ├── fundedbeyond.localhost.test     →  Tenant: FundedBeyond Academy
        ├── second-smoke.localhost.test     →  Tenant: Second Smoke Academy (isolation tests)
        └── platform.localhost              →  Atlas platform console (not tenant-branded)
```

**Plain `http://localhost:3000` does not resolve a tenant** — host resolution requires a hostname registered in `tenant_domains` (see `packages/tenancy/src/host.ts`). This is intentional and matches production behavior.

---

## 2. URLs you need day to day

| Purpose | URL | Notes |
|---------|-----|-------|
| **FundedBeyond learner / default work** | `http://fundedbeyond.localhost.test:3000` | Primary dev tenant |
| **Login** | `http://fundedbeyond.localhost.test:3000/login` | Same host, auth route |
| **Tenant admin** | `http://fundedbeyond.localhost.test:3000/admin` | T1–T24 surfaces |
| **Instructor / studio** | `http://fundedbeyond.localhost.test:3000/studio` | I1–I13 surfaces |
| **Platform ops (rare)** | `http://platform.localhost:3000` | P1–P8; never tenant-branded |

Bookmark **one host** (`fundedbeyond.localhost.test:3000`) and navigate by path. You do not need a different server per route.

---

## 3. URLs you can usually ignore

These exist for **CI, staging simulation, and multi-tenant smoke tests** — not daily development.

| Host | Tenant | When to use |
|------|--------|-------------|
| `fundedbeyond-test.localhost.test` | FundedBeyond | Test env hostname in manifest |
| `fundedbeyond.staging.localhost.test` | FundedBeyond | Staging env hostname in manifest |
| `second-smoke.localhost.test` | Second Smoke Academy | Multi-tenant isolation / e2e |
| `second-smoke-test.localhost.test` | Second Smoke Academy | Test env |
| `second-smoke.staging.localhost.test` | Second Smoke Academy | Staging env |

Source: [`configs/tenants/fundedbeyond/manifest.json`](../../configs/tenants/fundedbeyond/manifest.json), [`configs/tenants/second-smoke-academy/manifest.json`](../../configs/tenants/second-smoke-academy/manifest.json).

**Production analog:** `academy.fundedbeyond.com` (FundedBeyond) vs another customer's custom domain — each customer gets one primary URL, not a list.

---

## 4. Platform host

Platform routes (`/platform/*`) are gated by platform hostname, not tenant hostname.

- Default local platform host: `platform.localhost` (see [`apps/web/src/lib/server/platform-host-gate.ts`](../../apps/web/src/lib/server/platform-host-gate.ts))
- Override via `PLATFORM_HOST` in `.env.local` (see [`.env.example`](../../.env.example))

Platform shell is **never tenant-branded** (PRD constraint).

---

## 5. Industry alignment (Learnyst, Teachable, Thinkific, Moodle Workplace)

Atlas uses the same pattern as major course / white-label LMS products:

| Concept | Industry (e.g. Learnyst) | Atlas |
|---------|---------------------------|-------|
| Tenant identity | Hostname (`school.learnyst.com` or custom domain) | Hostname (`*.localhost.test` dev; custom domain prod) |
| Learner entry | One branded URL per school | One host per tenant |
| Creator / admin | `app.learnyst.com` (central) or same host `/admin` | Same tenant host: `/admin`, `/studio` |
| Custom domain | DNS CNAME to platform | `tenant_domains` + admin domain UI (T9) |
| Path-based tenancy (`/t/acme`) | Rare in white-label course SaaS | **Not used** — host-based only (PRD) |
| Many URLs in dev | Hidden from customers | Visible because we seed multiple test tenants + env hostnames |

References:

- [Learnyst — map custom domain](https://support.learnyst.com/how-to-map-learnyst-domain-to-your-own-custom-domain)
- [Learnyst — platform FAQs](https://support.learnyst.com/learnyst-platform-faqs)
- [Thinkific — custom domain FAQ](https://support.thinkific.com/hc/en-us/articles/360030726113-Custom-Domain-Frequently-Asked-Questions)
- [Vercel — multi-tenant platforms (host resolution)](https://vercel.com/platforms/docs/multi-tenant-platforms/concepts)

**Conclusion:** Host-based multi-tenancy is the correct architecture. The “many links” problem is a **developer experience** issue, not a product-model issue.

---

## 6. Hostname resolution (local)

1. Start stack: `pnpm dev` (and DB/seed as per project README).
2. Open `http://fundedbeyond.localhost.test:3000` (not bare `localhost:3000`).
3. If the hostname does not resolve, add entries to your OS hosts file, e.g.:

   ```text
   127.0.0.1 fundedbeyond.localhost.test
   127.0.0.1 platform.localhost
   ```

   Some environments resolve `*.localhost.test` without manual hosts; use hosts file if you get DNS errors.

---

## 7. Optional dev UX improvements (planned polish)

Not required for correctness; tracked for F8 / developer experience:

- [ ] Trim `pnpm dev` startup output to **essential links only** (FundedBeyond + Platform) — **done** via `scripts/dev/print-essential-urls.mjs`
- [ ] Optional dev-only `/dev` launcher page listing tenants (collapsed “advanced” hosts for CI)
- [ ] Link this doc from root README “Local development” section

---

## 8. Non-negotiable constraints (unchanged)

- Host-based tenant resolution only — no client-sent `tenant_id`
- No `tenant.slug === "fundedbeyond"` branches in app code
- Platform plane never inherits tenant theme

See [complete-frontend-rebuild.md §16](complete-frontend-rebuild.md#16-constraints-non-negotiable).
