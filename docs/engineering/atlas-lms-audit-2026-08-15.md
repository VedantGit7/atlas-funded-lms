# Atlas LMS — Full System Audit

**Date:** 2026-08-15
**Commit:** `9872b62` (main)
**Scope:** security, architecture, authorization, commerce, data layer, reliability, performance, frontend, CI/CD, dependencies, privacy
**Method:** systematic static review of 53 server modules, 227 Prisma models, ~766 routes and 394 test files; execution of the repository's guard suite (`check:*`, `ci:*`, `security:check`, `typecheck`, `pnpm audit`); **and live verification against a running PostgreSQL instance** — all test suites executed, plus a direct RLS isolation probe

> Every finding cites file-level evidence. Conclusions verified against a live database are marked
> **[live]**. Remaining unverified areas are listed in §8.

**Totals:** 6 critical · 20 high · 17 medium · 11 low (54 findings)

> **Revision note.** This report covers four passes: static review, live database verification
> (§9), a targeted deep pass (§10), and exploit confirmation (§10.1). Conclusions moved in both
> directions — RLS policy correctness **passed**, and the SQL-injection sweep over all 147 unsafe
> raw-SQL calls came back clean — while live testing raised four new criticals (`BYPASSRLS`
> connection role, pool deadlock, no email transport, and a demonstrated wallet double-spend).
> **Nine of the ten most severe findings are now demonstrated against the running system rather
> than reasoned from code**; C1 is the sole exception and its preconditions are individually
> confirmed.

---

## 0. Executive summary

The architecture is **strong and unusually well-governed**. The declarative route pipeline, the
tenant transaction wrapper, audit hash-chaining, integer-cents money handling, and the breadth of
the guard suite are better than most production SaaS. Crucially, the **core tenant-isolation
design is sound** — a live probe confirms RLS isolates correctly under `withTenantTx`, and I found
no way to read another tenant's data through the normal request path.

**But that isolation currently has no backstop.** The application connects to PostgreSQL as a
superuser with `BYPASSRLS`, so RLS protects nothing on any code path that misses the transaction
wrapper (C5). The database layer of the PRD's "three layers" is, as deployed, decorative.

The defects cluster at the edges, in seven groups:

1. **Untrusted HTML is rendered from the app's own origin with no Content-Security-Policy and
   no security headers of any kind.** Two independent stored-XSS vectors (SCORM packages,
   rich-text fields). This is the most serious cluster.
2. **Money paths have read-modify-write race conditions.** Wallet credits can be double-spent and
   coupons over-redeemed by firing concurrent requests. No row locks, no atomic updates, default
   READ COMMITTED isolation.
3. **RLS has no teeth as deployed.** The app's database user bypasses row-level security entirely.
   Isolation depends 100% on application discipline, with no database-level safety net.
4. **CI cannot pass and the test suites are red.** One job has no database and always fails, and
   the `build` job depends on it. **43 tests fail across 4 suites**; **8 CI jobs are red** in total.
   Two guard scripts still point at pre-monorepo-restructure paths — one crashes, one **passes
   silently**, making migration-drift detection a permanent no-op.
5. **Server-side request forgery** on three tenant-configurable webhook surfaces, with no URL
   validation beyond syntax.
6. **The service collapses completely at 20 concurrent requests** — measured, not estimated.
   Each request holds two pool connections, so at pool size the pool deadlocks and **every request
   fails after a 10-second stall** (C6). Five simultaneous admin users are enough to trigger it.
7. **Email delivery does not exist** (C7). No transport library is installed; signup verification,
   password reset and invitations cannot work.

None of these require an architectural rewrite. The most severe are configuration, deployment and
input-handling gaps in otherwise well-built subsystems — C5, C6 and the two broken guard paths are
each roughly a one-line change.

---

## 1. What is genuinely good

Recorded first because these controls are why the findings below are contained rather than fatal.

| Control                        | Evidence                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Declarative route pipeline     | `create-tenant-route.ts` — Zod in **and out**, entitlement, resource load, permission, inside tenant tx                                                                                                                                                                                                                                                  |
| Response validation            | Output re-parsed with Zod; failure returns 500 without leaking (`expose: false`)                                                                                                                                                                                                                                                                         |
| Tenant transaction wrapper     | `with-tenant-tx.ts` — `SET LOCAL ROLE`, transaction-local `set_config`, never session-level                                                                                                                                                                                                                                                              |
| Authorization engine           | `can.ts` — tenant match on actor **and** resource, explicit DENY precedence, platform-permission rejection in tenant scope                                                                                                                                                                                                                               |
| Header spoofing defence        | Both middlewares strip `SPOOFABLE_TENANT_HEADERS` and client request IDs                                                                                                                                                                                                                                                                                 |
| **Money as integer cents**     | `amount_cents`, `total_amount_cents`, `balance_credits` — no floats anywhere in the schema                                                                                                                                                                                                                                                               |
| **No exam answer-key leakage** | `buildRunnerItems` (learner path) omits `isCorrect`/`answerKeyJson`; only `loadScoringItems` (server-side grading) reads them                                                                                                                                                                                                                            |
| **No code-execution sinks**    | Zero `eval`, `new Function`, `vm`, `child_process` across the entire backend                                                                                                                                                                                                                                                                             |
| **No SQL injection** [scanned] | All 147 `$queryRawUnsafe`/`$executeRawUnsafe` calls audited: parameterized with `$n`, or interpolating only compile-time constants (`SELECT_CTA`) and allowlisted `ORDER BY` fragments from typed unions. Dynamic `SET` clauses build column names from code literals with values bound. **Clean** — notable for a fully hand-written raw-SQL data layer |
| **Invitation token strength**  | `randomBytes(32).toString("base64url")`, stored as `invite_token_hash` (`member-admin.service.ts:151,246`)                                                                                                                                                                                                                                               |
| **Git history clean**          | No secret ever committed; `.gitignore` covers `.env*` with an `.env.example` exception                                                                                                                                                                                                                                                                   |
| Webhook signature verification | Razorpay HMAC-SHA256 with length check + `timingSafeEqual`; Stripe `constructEvent`                                                                                                                                                                                                                                                                      |
| Audit integrity                | `sql/triggers/006_audit_append_only_and_hash_chain.sql` — append-only **with hash chain**                                                                                                                                                                                                                                                                |
| Append-only coverage           | 13 trigger files: audit, outbox, attempts, ledger, moderation, proctoring, workflow transitions                                                                                                                                                                                                                                                          |
| Attempt idempotency            | `startAttempt` dedupes via `findByIdempotencyKey`                                                                                                                                                                                                                                                                                                        |
| Tenant domain gating           | `tenant-resolver.ts` enforces `assertTenantDomainActive` on resolution                                                                                                                                                                                                                                                                                   |
| Resource registry              | `ci:tenant-resource-registry` — **155/155 covered**                                                                                                                                                                                                                                                                                                      |
| Test breadth                   | 394 test files with dedicated `tenant-isolation`, `security`, `authorization` suites                                                                                                                                                                                                                                                                     |
| Type safety                    | `pnpm typecheck` passes clean                                                                                                                                                                                                                                                                                                                            |

---

## 2. Critical

### C1 — Stored XSS via SCORM content served from the app origin

**Files:** `backend/apps/api/src/app/api/v1/modules/[id]/scorm-content/route.ts`,
`backend/packages/storage/src/scorm-package-extract.ts`

The endpoint returns uploaded SCORM files with `content-type` from `guessContentType()`, which
returns `text/html`, `application/javascript`, and `image/svg+xml`:

```ts
new NextResponse(new Uint8Array(result.body), {
  headers: { "content-type": result.contentType, "cache-control": "private, max-age=60" },
});
```

No CSP, no `nosniff`, no `Content-Disposition`, no sandbox origin. `/api/v1/*` is proxied through
the web app **by design** so session cookies work (`next.config.ts` rewrite), so this is served
same-origin with the victim's cookies.

**Attack:** a content author uploads a package containing `evil.html`. Any learner opening the
module executes attacker JavaScript in the tenant origin with their session. Escalates
instructor → learner, and instructor → tenant admin if an admin previews.

SCORM content _is_ HTML and JavaScript, so filtering cannot fix this. Requires a **separate
sandbox origin** with no auth cookies plus strict CSP, or at minimum a sandboxed iframe.

### C2 — Wallet credits can be double-spent (race condition)

**File:** `backend/apps/api/src/server/sales-wallet/sales-wallet.service.ts`

Every balance mutation is read-modify-write with an **absolute** write:

```ts
const maxByBalance = Math.min(maxByOrder, wallet.balance_credits); // read
const nextBalance = wallet.balance_credits - creditsSpent; // compute in JS
await salesWalletRepository.updateBalances(tx, { balanceCredits: nextBalance }); // absolute write
```

(lines 259-272; same pattern at 347-353 for redemption and 193-206 for crediting)

The repository writes `set balance_credits = ${args.balanceCredits}` — not
`balance_credits = balance_credits - N`. There is **no `FOR UPDATE`**, no optimistic version
column, and **no `isolationLevel` is set anywhere in the codebase** (verified: only generated
Prisma types mention it), so transactions run at Postgres default READ COMMITTED.

**Demonstrated, not theorised [measured].** Replaying the service's exact read-compute-write
sequence against the live database — a 100-credit wallet, five concurrent spends of 100 each:

```
starting balance : 100
concurrent spends of 100 each : 5
results          : ["SPENT","SPENT","SPENT","SPENT","SPENT"]
succeeded        : 5  (correct = 1)
final balance    : 0
>>> CONFIRMED DOUBLE-SPEND: 5 spends of 100 credits from a 100-credit wallet
```

**500 credits of value released from a 100-credit balance.** Every spend passed the
`credits > balance` check because all five read the same stale balance.

This also corrupts `sales_wallet_transactions.balance_after`, which is an append-only ledger, so
the audit trail is silently wrong.

Only **two** `FOR UPDATE` locks exist in the entire codebase (gamification, practice) and neither
is on a money path.

### C3 — Coupon usage limits can be exceeded (race condition)

**Files:** `sales-coupons.service.ts:448`, `sales-coupons.repository.ts:359-361`

```ts
if (coupon.total_usage_limit != null && totalUsed >= coupon.total_usage_limit) { … }
```

Check-then-act against a separate `count` subquery, with no lock and no database constraint
enforcing the limit. Concurrent redemptions of the final coupon use all pass the check.
Applies to `total_usage_limit` and `per_learner_limit` alike.

**Demonstrated [measured].** A `PERCENT / 100` coupon with `total_usage_limit = 1`, five concurrent
redemptions replaying the service's count-then-insert sequence against the live database:

```
total_usage_limit    : 1
concurrent redeems   : 5
results              : ["REDEEMED","REDEEMED","REDEEMED","REDEEMED","REDEEMED"]
redemptions recorded : 5   (limit = 1)
>>> CONFIRMED OVER-REDEMPTION: 5 redemptions against a limit of 1 (100% discount each)
```

Five free enrollments from a single-use 100%-off coupon. The same pattern governs `per_learner_limit`,
so one learner can redeem a once-per-learner coupon arbitrarily many times.

### C4 — Zip bomb plus a known-vulnerable ZIP parser on the same user-supplied path

**File:** `backend/packages/storage/src/scorm-package-extract.ts:106-116`

```ts
const files = zip.getEntries().filter(e => !e.isDirectory)
  .map(entry => ({ … content: entry.getData() … }));   // every entry, fully in RAM
```

No cap on entry count, per-file size, or total uncompressed size. `assertAllowedSize` limits only
the **compressed** upload. A small ZIP decompresses to many gigabytes.

Compounding this, `pnpm audit` reports **GHSA-xcpc-8h2w-3j85** against `adm-zip < 0.6.0`
("crafted ZIP triggers 4GB memory allocation") — a **direct production dependency** on exactly
this path (`backend__packages__storage > adm-zip`). Patched in `>= 0.6.0`.

**Demonstrated [measured].** A three-entry archive built with the project's own `adm-zip`, passed
through the real `extractScormPackage`:

```
compressed archive   : 199.5 KB
uncompressed content : 200 MB
compression ratio    : 1026x
extractScormPackage() completed in 2700 ms
entries materialised : 3
bytes held in memory : 200.0 MB      <-- external Buffer memory, held simultaneously
No entry-count, per-file, or total-size limit was enforced.
```

`STORAGE_MAX_LESSON_ASSET_BYTES` defaults to **100,000,000 (100 MB)** and is checked against the
**compressed** upload only. At the measured 1026× ratio a permitted 100 MB upload materialises
**roughly 100 GB in memory** — a guaranteed OOM. This was a naive single-entry bomb; nested archives
reach far higher ratios.

Because the API process is shared, an OOM kill takes down **every tenant on that instance** — a
cross-tenant denial of service triggerable by one authenticated instructor with one upload.

### C7 — Email delivery is not implemented; every email flow is non-functional

`backend/apps/api/src/server/notifications/notification.email-provider.ts` contains exactly two
implementations:

- `UnconfiguredEmailProvider` — `send()` rejects with `EMAIL_PROVIDER_NOT_CONFIGURED`
- `EnvEmailProvider` — `isConfigured()` returns true **only** when
  `NOTIFICATION_EMAIL_PROVIDER === "mock"`, and `send()` then `console.info`s a redacted line and
  returns `Promise.resolve()`. **Nothing is transmitted.**

**No email library is installed anywhere in the monorepo** — verified across every `package.json`:
no `resend`, `@sendgrid/mail`, `nodemailer`, `postmark`, `@aws-sdk/client-ses`, or `mailgun`.
`NOTIFICATION_EMAIL_PROVIDER` is not documented in `.env.example`.

Production therefore has only two possible states:

| Configuration                      | Behaviour                                  |
| ---------------------------------- | ------------------------------------------ |
| `NOTIFICATION_EMAIL_PROVIDER=mock` | Emails **silently discarded**, logged only |
| anything else (including unset)    | Every email operation **throws**           |

Flows that cannot work: **signup email verification, password reset, membership invitations**, all
learner and admin notifications, system emails, and the marketing email campaigns that have a
full authoring UI (`MarketingEmailWizardPanel.tsx`).

This blocks open signup outright — a learner cannot verify an address or recover an account. Note
that `plan/backend-planning/open-signup-freemium-and-payments.md` marks Phase 1 open signup as
**done**; it cannot function without email delivery.

The abstraction is clean and provider-shaped, so this is an unimplemented adapter rather than a
design flaw — but it is a hard launch blocker.

### C6 — Total service collapse at pool-size concurrency (measured pool deadlock) **[measured]**

This supersedes the earlier "capacity is ~10 concurrent requests" estimate in H6. Measured against
the live database, the failure mode is **not** graceful degradation — it is a **connection-pool
deadlock producing a 100% error rate**.

`create-tenant-route.ts` nests `withTenantTx` inside `withGlobalDb`, so each request holds **two**
pool connections simultaneously. With `DATABASE_POOL_MAX = 20`, once 20 requests are in flight each
holds an outer connection and waits for an inner one. **None can proceed and none release.** The
deadlock only breaks when the connect timeout fires, failing every request.

Measured, replicating the exact statement sequence (`SET LOCAL ROLE`, four `set_config` calls, then
a query), pool max 20, 10s connect timeout:

| Concurrent requests | As shipped (2 conns/req)           | One connection per request |
| ------------------- | ---------------------------------- | -------------------------- |
| 5                   | 5 ok — 30 rps                      | 5 ok — 65 rps              |
| 10                  | 10 ok — 88 rps                     | 10 ok — 147 rps            |
| 15                  | 15 ok — 123 rps                    | 15 ok — 190 rps            |
| **20**              | **0 ok · 20 FAILED · 10.1s stall** | 20 ok — 208 rps            |
| **40**              | **0 ok · 40 FAILED · 10.1s stall** | 40 ok — 299 rps            |
| 80                  | —                                  | 80 ok — **364 rps**        |

Error at the cliff: `INNER: timeout exceeded when trying to connect`.

**How easily is 20 reached?** The codebase's own comment states that _"admin/studio shells fire
several parallel authenticated probes"_ (`client.ts`). At roughly four parallel calls per page load,
**five simultaneous admin users are sufficient to take the instance to a 100% error rate.** A cohort
launch or exam-window start would do it instantly.

Removing the nesting — one connection per request — eliminates the cliff entirely and reaches
**364 rps at 80 concurrent** with no other change. This is the highest-leverage fix in the audit.

### C5 — The application connects to PostgreSQL as a superuser with `BYPASSRLS` **[live]**

Row-level security is the first of the three isolation layers promised in Master PRD §0.4 #1.
As deployed it protects nothing, because the connecting role can ignore it.

```
CONNECTED AS: {"usr":"atlas","is_super":true,"bypassrls":true}
```

A direct probe — two tenants, one branding row each, identical query under both conditions:

| Condition                                             | Result                                   |
| ----------------------------------------------------- | ---------------------------------------- |
| `SET LOCAL ROLE atlas_app` (what `withTenantTx` does) | `rows=1 sawA=true sawB=false` — isolated |
| No role switch (raw connection user)                  | `rows=2 sawA=true sawB=true` — **leak**  |

The policies themselves are **correct**: `tenant_isolation` is `tenant_id = app.current_tenant_id()`
scoped `TO atlas_app, atlas_worker`, and `platform_scope` is `USING (true)` scoped `TO
atlas_platform`. Role membership runs `atlas → {atlas_app, atlas_worker, atlas_platform}`, i.e.
downward, so `atlas_app` does **not** inherit the platform policy. The design is right.

The problem is purely the login role. Because `atlas` is `rolsuper` **and** `rolbypassrls`, any
query that reaches the database without `SET LOCAL ROLE atlas_app` sees **every tenant's rows**.
Tenant isolation therefore rests entirely on application discipline — `withTenantTx`,
`withGlobalDb`, `withPlatformScope`, and the `check-prisma-boundary` / `db:check-no-direct-prisma`
guards. Those guards currently pass, so there is no known live exposure, **but there is no
database-level backstop if any one of them is ever bypassed, disabled, or missed.**

**Compounding this, the guard that is supposed to verify RLS cannot detect the problem.**
`scripts/check-rls-state.ts` inspects only `relrowsecurity` / `relforcerowsecurity` flags. It
reported `PASS: RLS is enabled and forced on all tenant_id tables` on the very database where the
probe demonstrated a full bypass. The check gives false assurance.

**Fix:** production `DATABASE_URL` must use a **non-superuser login role without `BYPASSRLS`**
(a login role granted `atlas_app`), with a separate migration role as the DevOps package already
requires. Extend `check-rls-state.ts` to assert `NOT rolsuper AND NOT rolbypassrls` for the
connecting user, and add a regression test asserting cross-tenant reads fail without the wrapper.

Verified in local dev and test. **Production configuration is unverified** — but nothing in the
repository, `.env.example`, or `docker-compose.yml` establishes a non-superuser application role,
so the same setup should be assumed unless deliberately changed.

---

## 3. High

### H1 — Stored XSS via unsanitised rich-text HTML (8 sites, no sanitizer in the repo)

There is **no HTML sanitization library anywhere** — no DOMPurify, no `sanitize-html`, no custom
sanitizer. Author-controlled HTML is injected directly:

| File                                                                    | Value                                 |
| ----------------------------------------------------------------------- | ------------------------------------- |
| `features/learner/components/newsfeed/LearnerNewsfeedArticle.tsx:150`   | `post.bodyHtml`                       |
| `features/admin/grow/NewsfeedBuilderPanel.tsx:837`                      | `bodyHtml`                            |
| `features/marketing/MarketingCtaRuntime.tsx:89`                         | `html` — **public page**              |
| `features/marketing/PublicMarketingFormClient.tsx:116`                  | `done.thankYouHtml` — **public page** |
| `features/admin/grow/MarketingEmailWizardPanel.tsx:1366`                | preview HTML                          |
| `features/notifications/components/NotificationTemplateManager.tsx:742` | inline preview HTML                   |
| `features/account-security/MfaManager.tsx:41`                           | `value` (likely QR SVG)               |
| `components/ThemeInitScript.tsx:60`                                     | generated theme script — appears safe |

Separately, `marketing_integration_settings` stores `site_body_html`, `order_tracking_html`, and
`signup_tracking_html` — arbitrary tracking snippets injected into public pages. That is an
intentional feature (like Google Tag Manager), but with no CSP it widens the same blast radius.

### H2 — No security headers anywhere in the application

Neither middleware nor either `next.config.ts` sets any of:

`Content-Security-Policy` · `X-Content-Type-Options` · `X-Frame-Options` / `frame-ancestors` ·
`Strict-Transport-Security` · `Referrer-Policy` · `Permissions-Policy`

Verified by grep across both apps and both configs — zero matches.

**Confirmed against a live response [measured].** Full header set returned by the running API for
`GET /api/v1/health`:

```
HTTP/1.1 200 OK
x-request-id · vary · cache-control · content-type · Date · Connection · Keep-Alive · Transfer-Encoding
```

Explicit probe of each control against the running server:

```
content-security-policy      *** ABSENT ***
x-content-type-options       *** ABSENT ***
x-frame-options              *** ABSENT ***
strict-transport-security    *** ABSENT ***
referrer-policy              *** ABSENT ***
permissions-policy           *** ABSENT ***
```

(`x-powered-by` is correctly suppressed by `poweredByHeader: false`.)

This is what removes the second line of defence from C1 and H1, and independently allows
clickjacking on `/admin` and `/studio`, MIME sniffing, and referrer leakage.

**Cheapest high-impact fix in the audit** — one `headers()` block per app.

### H3 — Server-side request forgery on three webhook surfaces

**Files:** `marketing-integrations.dispatch.ts:25`, `marketing-integrations.service.ts:83`,
`reports-delivery.ts:285`, `destinations-roster.service.ts:468`

URLs are validated only by `z.url()` / `z.url().max(2000)` — **syntax only**. There is:

- no private/loopback/link-local IP blocking (no `127.0.0.1`, `169.254.169.254`, RFC1918 checks
  exist anywhere in the codebase)
- no protocol allowlist
- no host allowlist
- **no redirect restriction** — no `redirect: "manual"` anywhere, so `fetch` follows up to 20
  redirects, defeating any future host allowlist

**Attack:** a tenant admin points a webhook at `http://169.254.169.254/…` (cloud metadata) or
`http://127.0.0.1:<port>` and the server makes the request.

**Demonstrated [measured].** The actual schema (`z.url().max(2000)`) accepts every internal target:

```
ACCEPTED  http://169.254.169.254/latest/meta-data/     <- cloud metadata service
ACCEPTED  http://127.0.0.1:5432/                       <- local Postgres
ACCEPTED  http://localhost:3001/api/v1/health          <- Atlas's own internal API
ACCEPTED  http://10.0.0.1/admin                        <- RFC1918
ACCEPTED  http://[::1]:6379/                           <- Redis over IPv6
ACCEPTED  file:///etc/passwd
ACCEPTED  gopher://127.0.0.1:11211/_stats
```

`file://` and `gopher://` are rejected later by undici at the transport layer, so practical
exploitation is http/https to internal hosts — but the **schema itself applies no protocol,
host, or address restriction whatsoever**.

Response bodies are not returned, so this is **blind SSRF** — but the caller does receive the
status code and `error.message`, which differs between connection-refused, timeout, and DNS
failure. That is sufficient to **port-scan and fingerprint the internal network**.

### H4 — Rate limiting does not survive more than one instance

**File:** `backend/packages/api/src/rate-limit.ts` — buckets in a module-level `Map`, no Redis
anywhere in the repo.

- With N instances the effective limit is **N× configured**
- Every deploy, restart, or scale event **resets all counters**
- `publicAuth` (20/min) is the brute-force control on login for a platform handling payments

Degrades silently the moment a second instance is added — which H6 makes necessary.

### H5 — MFA is recorded but never enforced

`mfaEnabled` is resolved per request (`auth/src/session.ts`), persisted to `auth_principals`, and
returned in DTOs. Grep across all backend packages and the API app finds **no code path that
requires it** — not for tenant admin, not for platform super-admin, not for payouts, refunds,
exports, or destructive actions. The capability and the data exist; the gate was never built.

Worse, computing it costs two extra Supabase network round trips per request (see H6).

### H6 — Effective capacity is ~10 concurrent requests per instance

Two compounding causes.

**Two pooled connections per request.** `create-tenant-route.ts` nests `withTenantTx` _inside_
`withGlobalDb`, and both open a Prisma interactive transaction. With `DATABASE_POOL_MAX`
defaulting to 20 (`db/src/client.ts`), that is **~10 concurrent requests** before the pool is
exhausted; further requests queue against `maxWait: 10_000` ms then fail with P2028.

**A database connection is held across external network I/O.** `requireSupabaseUser` runs inside
`withGlobalDb` and makes up to three Supabase HTTPS calls — `getUser`, plus `setSession` **and**
`mfa.listFactors` for MFA resolution (`session.ts:44-65`). Connection #1 is pinned for all of it,
to compute a boolean that nothing enforces (H5).

The codebase already documents hitting this twice and responding by raising limits — pool 10→20,
ITX timeout 5s→30s. Raising the ITX timeout is counterproductive under load: a slow request now
pins its connection for up to 30 seconds.

Fixes in value order: move `requireSupabaseUser` outside `withGlobalDb`; drop the two MFA probe
calls until MFA is enforced; stop holding two transactions; collapse the five sequential setup
statements in `withTenantTx` into one.

### H7 — Platform super-admin is granted by an environment variable

**File:** `backend/packages/auth/src/platform-auth.ts:35-38`

```ts
const assignments = parsePlatformOperatorAssignments(
  process.env["PLATFORM_OPERATOR_ASSIGNMENTS"] ?? "",
);
return assignments.get(email) ?? null;
```

Cross-tenant access to every academy's data is an **email-string match against an env var**:

- Not in the database → outside RBAC, `EntitlementGrantHistory`, and the audit hash chain
- Granting/revoking requires a deploy; no emergency revocation path
- Anyone who can edit environment variables (CI, hosting console) self-grants cross-tenant access
- No MFA requirement (H5) on the most privileged role in the platform
- Binds authority to an email address, making platform security dependent on Supabase
  email-change verification

### H8 — N+1 queries on the exam path, inside the interactive transaction

**Files:** `attempts.service.ts:78-105` (`loadScoringItems`), `:112-153` (`buildRunnerItems`)

Both loop over assessment items issuing **two queries per item** (`findItemById` +
`listItemOptions`). A 100-question exam is ~200 sequential round trips, all inside the interactive
transaction holding a pooled connection.

This is the worst possible interaction with H6, and it peaks at exactly the worst moment — exam
start, when every learner in a cohort hits it simultaneously.

The same pattern appears in at least 15 other services, including `assessments.service.ts:129`,
`diagnostic-result.service.ts:51,98`, `competency-projection.service.ts:114,123`,
`community.service.ts:206`, and throughout `gamification.service.ts`.

### H9 — CI is structurally unable to pass

**File:** `.github/workflows/ci.yml`

The `rls-tests` job has **no `services: postgres` and no `DATABASE_URL`**, but
`scripts/check-rls-state.ts` exits 1 without it. Verified:

```
$ env -u DATABASE_URL npx tsx scripts/check-rls-state.ts
DATABASE_URL is required for db:rls:check
REAL EXIT CODE: 1
```

The `build` job lists `rls-tests` among 27 dependencies, so **`build` can never run**. The guard
suite that makes this repository strong is **not gating merges** — and merge commits are landing
on `main` regardless.

### H10 — `ci:permission-metadata` crashes; permission metadata is unverified

```
ENOENT: packages/domain/src/at-risk/at-risk.route-metadata.ts
```

A **pre-monorepo-restructure path** (`packages/…` instead of `backend/packages/…`). The script
dies before checking anything, so permission metadata across all routes is currently
**unverified** while appearing covered by a green-looking CI job.

### H11 — `owner`/`admin` bypass all resource predicates via hardcoded string match

**File:** `backend/packages/authorization/src/can.ts:30-32, 88, 99, 110`

```ts
function isAdminBypassRole(roleKeys: string[]): boolean {
  return roleKeys.includes("owner") || roleKeys.includes("admin");
}
```

Holding a role keyed `owner` or `admin` skips **every ownership and relationship predicate**. This
is an implicit blanket grant that contradicts Master PRD §0.4 #9 (default deny, least privilege).

It is **not trivially exploitable** — `createRole` rejects duplicate keys (`role-admin.service.ts:108-119`)
and system roles are seeded per tenant. But the guard is application-level check-then-act, and the
schema has only `@@index([tenant_id, key])`, **not `@@unique`** (`schema.prisma:256`). Two
concurrent `createRole` calls with `key: "admin"` can both pass the check and insert. The role-key
schema (`^[a-z][a-z0-9_]*$`) does not blocklist reserved keys.

An actor with `role.create` could then obtain predicate bypass on permissions they already hold —
e.g. an instructor limited to their own courses grading any course. `enforceNoGrantUp` prevents
escalating _permissions_ but does not prevent escalating _predicate scope_.

### H12 — 43 tests fail across 4 suites; 6 CI jobs red **[live]**

| Suite                   | Result                               | CI job                       |
| ----------------------- | ------------------------------------ | ---------------------------- |
| `test:unit`             | **1224 passed** (212 files)          | green                        |
| `tests/security`        | **11 passed**                        | green (within security)      |
| `test:authorization`    | 320 passed · **13 failed** (5 files) | `authorization-tests` red    |
| `test:integration` (db) | 12 passed · **2 failed**             | `integration-tests` red      |
| `test:tenant-isolation` | 164 passed · **11 failed** (7 files) | `tenant-isolation-tests` red |
| `test:e2e`              | 136 passed · **17 failed** (7 files) | `e2e-tests` red              |

Combined with `rls-tests` (H9) and `security-check`, **six CI jobs are red**, and `build` depends
on all of them.

**None of the failures indicate a security hole.** They are drift, in three groups:

1. **Stale test database.** `atlas_lms_test` lacked `proctoring_sessions` and `course_reviews`
   (present in dev). Rebuilding it via `pnpm db:test:setup` fixed **11 of 22** tenant-isolation
   failures. Notably this means the **L2/L3 proctoring isolation tests had never run against a
   database containing those tables.**
2. **Broken imports and fixture drift.** `branding-domain-authz.test.ts:44` imports
   `routeMetadata` from the theme route, which exports `getRouteMetadata` / `putRouteMetadata` —
   so the assertion ran against `undefined`. Several isolation tests assert `toHaveLength(1)`
   against fixtures that now seed more rows.
3. **UI refactor drift** in the source-text assertions described in H13.

### H13 — The "e2e" and much of the "authorization" suite are source-text assertions, not tests **[live]**

A large share of `tests/e2e`, `tests/authorization`, and the shell/nav portions of
`tests/tenant-isolation` do not exercise running code. They read component source files as strings
and regex-match for substrings:

```
expected '"use client";…' to contain 'aria-label="Mobile learner navigation"'
expected '"use client";…' to contain 'Confirm publish'
expected 'import { AdminPageGate }…' to match /ServerApiError|401|403|denied/
```

Consequences:

- **They provide no end-to-end confidence.** Nothing is rendered, no request is made, no
  authorization decision is evaluated. Grepping a page for the string `403` does not demonstrate
  that the page denies access.
- They break on every cosmetic refactor, which is precisely what has happened.
- They create **false assurance**: `authorization-tests` sounds like a security gate but is largely
  a lint for string presence.

The genuinely valuable database-backed isolation tests are the minority, and they mostly pass. The
suite needs re-basing onto behavioural tests before its green status means anything.

### H20 — Cross-tenant CSRF: `SameSite=Lax` does not separate tenants on a shared base domain

Cookie flags are otherwise correct — `httpOnly: true`, `secure: isProduction`, `sameSite: "lax"`,
and **no `domain` attribute**, so cookies are host-only (`cookie-store.ts:14-16`). That prevents
cookie _leakage_ between tenants.

It does **not** prevent cross-tenant CSRF. `SameSite` is evaluated against the **registrable
domain**, not the hostname. With `TENANT_BASE_DOMAIN` placing tenants on subdomains
(`tenant-a.atlas.com`, `tenant-b.atlas.com`), those origins are **same-site**, so `Lax` permits a
page on one tenant to issue state-changing `POST`/`PUT`/`DELETE` requests to another tenant — and
the browser attaches the target tenant's host-only cookies because the request host matches.

**There is no Origin or Referer validation anywhere** — verified across `packages/api`, both
middlewares: zero matches.

The exploit chain is fully present in this codebase:

1. A tenant admin injects JavaScript on their own subdomain — `marketing_integration_settings.site_body_html`
   is designed for exactly this, and newsfeed/CTA `bodyHtml` is unsanitised (H1)
2. No CSP restricts what that script may do (H2)
3. A victim from another tenant visits that page while authenticated
4. Script issues authenticated mutations against the victim's tenant; `Lax` allows it; no Origin
   check rejects it

Tenants on genuine **custom domains are cross-site and therefore protected** — the exposure is
specific to the shared-subdomain default, which is the onboarding path for every new tenant.

**Fix:** validate `Origin` against the resolved tenant host on every mutating route in
`createTenantRoute` / `createPlatformRoute` — a handful of lines in one place, since all mutations
funnel through those wrappers. `SameSite=Strict` is not a sufficient substitute (same-site is still
same-site) and would break OAuth return flows.

### H19 — `pnpm lint` crashes with a V8 out-of-memory abort, hiding 12 real errors **[measured]**

Running the repo-wide gate:

```
$ pnpm lint          # eslint . --max-warnings=0
<V8 stack trace: AddressSpaceReservation, StrongRootAllocatorBase::deallocate_impl>
[ELIFECYCLE] Command failed with exit code 134
```

Exit 134 is SIGABRT — a V8 heap exhaustion. The type-aware ESLint config (16 KB, custom
`atlas/*` rules) cannot complete across the monorepo. The CI `lint` job runs bare `pnpm lint` with
**no `NODE_OPTIONS=--max-old-space-size`**, so it is subject to the same crash.

Linting only four security-critical packages directly surfaces **12 errors** the broken gate has
been masking:

| File                                        | Errors                                            |
| ------------------------------------------- | ------------------------------------------------- |
| `packages/api/create-platform-route.ts`     | 5× deprecated `ZodTypeAny`                        |
| `packages/auth/account-security.service.ts` | 3× unnecessary conditional (one **always falsy**) |
| `packages/auth/session.ts`                  | 4× unnecessary conditional (one **always true**)  |

**One of these is a latent auth defect.** `session.ts:64`:

```ts
const factors = [...(data.totp ?? []), ...(data.phone ?? [])];
return factors.some((factor) => factor.status === "verified");
```

ESLint reports _"comparison is always true, since `"verified" === "verified"` is true"_ — the
element type is narrowed to the literal, so the predicate cannot discriminate. Whether this is
harmless depends on whether `listFactors()` pre-filters to verified factors. **It is inert today
because MFA is never enforced (H5) — but it must be verified before MFA enforcement is wired,
or an unverified/pending factor could satisfy the check.**

Fix the gate first (raise the heap, or lint per-package), then work the backlog it exposes. The
12 errors above come from 4 of ~25 packages; the full count is unknown precisely because the gate
cannot run.

### H18 — Release-readiness evidence asserts a clean state that is now false

`release-evidence.json` at the repo root reports:

```
generatedAt : 2026-06-22T18:30:12.652Z     (8 weeks stale)
verdict     : READY_FOR_STAGING
gates       : 37  — all "passed"
```

Three of those "passed" gates are **measurably failing today**:

| Gate in evidence       | Actual state now                          |
| ---------------------- | ----------------------------------------- |
| `Permission metadata`  | **CRASHES** with ENOENT (H10)             |
| `Entitlement metadata` | **FAILS** on 5 routes (M2)                |
| `Audit obligations`    | audit-metadata **FAILS** on 3 routes (M3) |

Three substantial merges have landed since it was generated (admin insights, exports module, P0/P1
completion plus proctoring L2/L3). The artifact is a point-in-time snapshot with no staleness
guard, so it now vouches for a state the codebase left weeks ago.

`productionApproved: false` is at least honest, and the file is gitignored (local-only). But the
`release-evidence-validation` CI job asserts only `test -f release-evidence.json` — **existence,
not freshness or verdict**. A stale green artifact satisfies it.

Relatedly, `docs/release/security-exception-register.md` records **"No open exceptions at story
delivery"** while this audit finds 6 critical and 18 high issues. Its own rules state _"P0 security
or isolation exceptions block `READY_FOR_STAGING`"_ and _"Never waive RLS, `withTenantTx`, `can()`,
or platform scope requirements"_ — C5 is not a waiver but an unnoticed hole in exactly that
guarantee. The register is empty because nothing detected these, not because they were assessed.

### H17 — WCAG 2 AA contrast failures on login and the public landing **[measured]**

The accessibility suite was executed end-to-end (both dev servers booted, real Chromium). Result:
**4 failed, 2 passed**.

| Test                                      | Result                                  |
| ----------------------------------------- | --------------------------------------- |
| `axe-public-routes` → login page          | **FAIL — 128 serious violations**       |
| `axe-public-routes` → public landing      | **FAIL — 58 color-contrast violations** |
| `keyboard-flows` → login tab order        | FAIL (selector ambiguity, see below)    |
| `keyboard-flows` → login submit via Enter | FAIL (selector ambiguity)               |

Every violation is `color-contrast` at **serious** impact, and the dominant cause is **one design
token**:

```css
/* frontend/apps/web/src/components/theme/fba-theme.css:15 */
--fba-tx3: #a09888; /* on --fba-bg: #fffdf9  →  contrast 2.81:1, WCAG AA requires 4.5:1 */
```

`--fba-tx3` is the muted-text token used for placeholders, helper text and icon buttons. At 12px it
fails badly. A second cluster — `#817f7e` on `--fba-bg2: #ede9e0` — measures **4.47:1**, missing the
4.5:1 threshold by a hair across 11 nodes.

Because these are token values rather than per-component styles, **correcting two hex values
resolves the large majority of 186 violations across both pages.** These are also the two
highest-traffic unauthenticated pages in the product — the first thing every learner sees.

This makes `browser-smoke` the **eighth red CI job** (it runs `tests/browser/accessibility`).

**Keyboard-flow failures are test drift with a real signal behind them.** `getByLabel("Password")`
resolves to two elements — the password input and the `aria-label="Show password"` toggle. The
test needs a stricter selector, but the underlying collision is genuine: a screen-reader user
encounters two controls whose accessible names both begin "Password".

### H16 — Learner bundle is 2.4× over its own budget **[measured]**

After a full `@atlas/web` build, the repository's own budget check fails:

```
Bundle budget failed: largest static chunk 354.6 kB gzip exceeds 150 kB budget.
```

That is roughly 1.2–1.5 MB of uncompressed JavaScript to download, parse and execute in a single
chunk. For FundedBeyond's audience — Indian retail traders, largely on mid-range mobile — this is
the difference between a usable and an unusable first load, and it directly undermines the
`performance.md` plan.

This also makes `learner-bundle-boundary` the **seventh red CI job**. It had been invisible in
earlier passes because the check silently skips when no build output is present
(`Skipping gzip chunk budget: .next/static/chunks not found`) — the same
skip-instead-of-fail pattern as H14.

### H15 — `Math.random()` used for coupon, referral and affiliate codes

| File                                 | Use                 |
| ------------------------------------ | ------------------- |
| `sales-coupons.service.ts:119`       | **coupon codes**    |
| `sales-affiliates.repository.ts:115` | **affiliate codes** |
| `sales-referrals.repository.ts:51`   | **referral codes**  |

`Math.random()` is not a CSPRNG. V8's `xorshift128+` state is recoverable from a modest number of
observed outputs, after which all future values are predictable.

All three are **money-bearing identifiers**: coupon codes grant discounts, referral and affiliate
codes drive commission attribution. An attacker who obtains a handful of issued codes can predict
subsequent ones and redeem unreleased or individually-targeted discounts, or hijack commission
attribution. This compounds with C3 (coupon limits are not enforced under concurrency).

Fix: `crypto.randomInt` / `randomBytes`. Invitation tokens already do this correctly —
`randomBytes(32).toString("base64url")` in `member-admin.service.ts:151,246`, stored hashed.

### H14 — `check-migrate-status.mjs` silently passes and always has **[live]**

```js
const migrationsDir = join(repoRoot, "prisma", "migrations"); // does not exist
…
if (migrationDirectories.length === 0) {
  console.log("Migration status check skipped: no migrations yet (Sprint 0 Prisma baseline).");
  process.exit(0);
}
```

Migrations live at `backend/prisma/migrations` since the monorepo restructure. `readdirSync` throws,
the `catch` returns `[]`, and the guard **exits 0 without checking anything**. Confirmed live:
it prints "no migrations yet" while `prisma migrate status` reports **99 migrations applied**.

This is the same stale-path class as H10, but strictly worse: H10 crashes loudly, this one
**reports success**. Schema drift between code and a deployed database would never be caught by
`pnpm ci`.

---

## 4. Medium

| ID  | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | **CSV formula injection.** At least 3 duplicate `csvEscape`/`escapeCsvValue` implementations (`custom-field-segments.service.ts:440`, `insights-engagement-funnel.ts:217`, `reports-export-runner.ts:6`). All quote `"` `,` `\n` correctly but none neutralise leading `=` `+` `-` `@`. Learner-controlled names and custom fields flow into admin exports opened in Excel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| M2  | **`ci:entitlement-metadata` fails** — 5 routes missing the field: `automation-runs`, `branding/assets/upload`, `internal/reports/tick`, `provisioning/jobs`, `reports/internal/tick`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| M3  | **`ci:audit-metadata` fails** — 3 sensitive routes: `branding/assets/upload`, `platform/eventing/dead-letters`, `platform/shell`. Two are **platform-scope** — the cross-tenant operations that most need an audit trail. Also has **no GitHub job**, only the local `pnpm ci` chain, so it is invisible on PRs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| M4  | **SCORM key traversal guard is bypassable.** `scorm-package-extract.ts:134` does a single-pass `.replace(/\.\.(\/                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | $)/g,"")`; input `....//x`yields`../x`. Path arrives straight from a client query param. **Demonstrated [measured]** — three working payloads against the real function: `....//secret`, `..././secret`, and `....\/secret`all produce`tenants/T/modules/M/scorm/content/../secret`, escaping the module prefix. The naive `../secret`is correctly stripped, which is why it looked safe. R2 keys are literal so impact is low there, but`local-fs` guards only the **storage root**, not the tenant prefix (`local-filesystem-storage-provider.ts:166-173`), so on that provider a crafted path reaches another tenant's directory. Fix: loop until stable, or reject any `..` segment outright. |
| M5  | **`STORAGE_PROVIDER` defaults to `local-fs`** (`storage-env.ts:4`). A deploy that forgets the variable silently writes to ephemeral container disk — uploaded content and certificates vanish on redeploy, with no boot-time error. Production should fail closed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| M6  | **RLS coverage is split and never verified in CI.** `sql/rls/025_tenant_rls_policies.sql` covers 128 tables via a `DO` block; newer tables enable RLS inline across 47 migrations. Spot checks passed (proctoring L1-L3, Zoom, live attendance via the array; report destinations, export settings, custom-field segments, device alerts via migrations). But 219 of 227 models carry `tenant_id`, and the only real verification is `db:rls:check` — which per H9 **never runs**.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| M7  | **`observability:check` fails** — `.env.example` missing `RELEASE_HEALTH_BASE_URL`. Trivial, but fails both `security:check` and its own CI job.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| M8  | **`frontend-api-closure` will fail in CI** — advisory locally ("53 routes not referenced"), but the job sets `STRICT_API_CLOSURE: "1"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| M9  | **No `server-only` markers.** Zero files in the frontend import `server-only`. Nothing at the language level prevents a server module being pulled into a client component. `check-learner-bundle-boundary` covers part of this, but only for the learner bundle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| M10 | **Idempotency is not framework-guaranteed.** `requireIdempotencyKey` asserts only that the header is present; dedup depends on each handler having its own `@@unique([tenant_id, idempotency_key])`. Present on several tables, but no central registry — a handler that forgets it silently accepts duplicate writes on the payment path.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| M11 | **Entitlements are boolean, not quantitative.** `enforce-entitlement.ts` checks key existence only; `Entitlement.value_json` is never read and the `usageContext` parameter is declared but unused. `TenantSubscription` has no price field. Plan limits cannot be enforced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| M12 | **No retention policy on proctoring media.** `ProctoringMediaArtifact` accumulates indefinitely; no retention logic in `server/proctoring/`. Permanent cost floor plus a privacy exposure — indefinitely retained biometric exam footage carries regulatory weight.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| M13 | **No worker entrypoint.** `events/worker-router.ts` exports ~10 outbox batch processors; nothing invokes them in production. Certificates, reports, search indexing, analytics, automation and data-rights exports do not process.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| M14 | **Dependency vulnerabilities.** Beyond `adm-zip` (C4): `tmp < 0.2.6` via `@lhci/cli`, `brace-expansion` via Sentry/exceljs toolchains. Both build/dev-only, low real risk, but they keep `pnpm audit --audit-level high` and the `dependency-scan` job red.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| M15 | **`startPracticeSession` fails on a NOT NULL constraint [live].** `null value in column "session_type" of relation "practice_sessions"` at `practice.repository.ts:177` via `practice.service.ts:430`. **Persists after rebuilding the test database from the current dev schema**, so it is not stale-schema drift. The insert does supply `${data.sessionType}`, so the value is null/undefined at runtime on that path. Either a real bug in the practice-start flow or a stale fixture — needs triage. Practice sessions are a core learner feature.                                                                                                                                                                                                                                                                                                                                                                         |
| M16 | **A tenant ID is passed as `actorMembershipId` at 6 system entry points.** `actorMembershipId: tenant.tenantId` in `payments/webhooks/razorpay/route.ts:74`, `payments/webhooks/stripe/route.ts:72`, `public/marketing/integrations/actions/paid-enrollment/route.ts:40`, `.../sign-up/route.ts:40`, `public/sales/attribution/route.ts:28`, `zoom/webhooks/route.ts:24`. `withTenantTx` then sets `app.actor_membership_id` to a tenant UUID, so **audit attribution on both payment webhooks — the most financially sensitive events in the system — points at a membership that does not exist.** Master PRD §0.4 #8 explicitly requires auditing payments. Ownership predicates comparing `actor.membershipId` fail closed rather than open, so this is attribution corruption rather than an access-control hole. Both fields are bare `string`, so TypeScript cannot catch it — branded ID types would prevent recurrence. |
| M17 | **9 admin pages have no server-side denied-state handling [live].** They render `<AdminPageGate state="ready">` unconditionally and delegate all fetching to client components: `admin/batches`, `admin/certificates/analytics`, `admin/custom-fields`, `admin/devices`, `admin/learner-billing/locations/add`, `admin/live-sessions`, `admin/messenger`, `admin/polls`, `admin/sub-schools/create`. Contrast the established pattern in `admin/members/page.tsx`, which fetches via `serverApi`, catches `ServerApiError` 401/403, and renders `state="denied"`. **Not a data leak** — the API still enforces `can()` — but the admin shell renders for unauthorised users (disclosing which screens exist) and there is no graceful denial. Surfaced by `tests/authorization/admin-pages.test.ts` (T52–T57), which was correctly failing; the test is right and the pages drifted.                                             |

---

## 5. Low

| ID  | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Generated Prisma client committed to git — ~30k-line diffs on regenerate, drowning review                                                                                                                                                                                                                                                                                                                                                                                         |
| L2  | `tmp-promo-check.cjs` — stray scratch file at repo root                                                                                                                                                                                                                                                                                                                                                                                                                           |
| L3  | Untracked generated model files in the working tree (`ExamSecurityPolicy`, `ProctoringSession`, …)                                                                                                                                                                                                                                                                                                                                                                                |
| L4  | `enforcePublicRateLimit` throws `code: "INTERNAL_ERROR"` with HTTP 429 — misleading error code                                                                                                                                                                                                                                                                                                                                                                                    |
| L5  | Rate-limit client key trusts the first `x-forwarded-for` hop with no trusted-proxy allowlist — spoofable                                                                                                                                                                                                                                                                                                                                                                          |
| L6  | `infrastructure/` contains only `.gitkeep` despite a 5,238-line DevOps architecture package                                                                                                                                                                                                                                                                                                                                                                                       |
| L7  | `backend/prisma/models/` is empty (`.gitkeep` only) — dead directory implying a structure never adopted                                                                                                                                                                                                                                                                                                                                                                           |
| L8  | `@atlas/api-app` has no tests (`"test": "echo \"No api-app tests configured yet.\""`) despite holding all routes                                                                                                                                                                                                                                                                                                                                                                  |
| L9  | **Stale `.gitignore` paths are the root cause of L1.** `.gitignore` still lists `packages/db/src/generated/`, but the generated Prisma client now lives at `backend/packages/db/src/generated/` — **verified not ignored**. That is precisely why the ~30k-line generated-client diffs are committed. Same for `packages/**/src/**/*.d.ts` and `packages/**/tsconfig.tsbuildinfo`. **One-line fix.**                                                                              |
| L10 | **Four stale pre-restructure directories persist**: root `packages/` (231 orphaned `.d.ts` files, not a pnpm workspace member, matched only by the stale ignore rule above), root `apps/` (empty), root `src/` (`.gitkeep` only), and root `runbooks/` (`.gitkeep` only — the real ones are in `docs/runbooks/`, 7 files). Local cruft rather than shipped code, but it pollutes IDE navigation and repo-wide search, and it is the same restructure debt behind H10, H14 and L9. |
| L11 | 8 of 18 storage tests are **skipped** (`test:storage`) — worth confirming the skips are environmental rather than disabled coverage on a security-relevant surface.                                                                                                                                                                                                                                                                                                               |

**A pattern worth naming:** the F-1 monorepo restructure moved `packages/*` → `backend/packages/*`
and `prisma/` → `backend/prisma/`, but left stale paths in at least four places — two guard scripts
(H10 crashes, H14 passes silently), `.gitignore` (L9), and four orphaned directories (L10). Each
failure is independent and none is loud. A single sweep for pre-restructure paths across
`scripts/`, `.gitignore` and CI config would close all of them.

---

## 6. Remediation plan

### Phase 0 — Before any production traffic

| #   | Action                                                                                  | Finding |
| --- | --------------------------------------------------------------------------------------- | ------- |
| 1   | Add security headers + CSP via `headers()` in both Next apps                            | H2      |
| 2   | Make wallet balance updates atomic (`balance = balance - N`) or `SELECT … FOR UPDATE`   | C2      |
| 3   | Enforce coupon limits with a DB constraint or a lock, not check-then-act                | C3      |
| 4   | Upgrade `adm-zip` to `>= 0.6.0`                                                         | C4      |
| 5   | Cap SCORM entry count, per-file size and total uncompressed size; stream to storage     | C4      |
| 6   | Serve SCORM from a sandbox origin (or sandboxed iframe + strict CSP)                    | C1      |
| 7   | Add a sanitizer and apply it at all 8 `dangerouslySetInnerHTML` sites                   | H1      |
| 8   | Fix `rls-tests` (add Postgres service + `DATABASE_URL`) and run `db:rls:check` for real | H9, M6  |
| 9   | Fix the stale path in `check-permission-metadata.ts`                                    | H10     |

### Phase 1 — Before scaling past one instance

| #   | Action                                                                          | Finding |
| --- | ------------------------------------------------------------------------------- | ------- |
| 10  | Move rate limiting to Redis, or enforce at Cloudflare                           | H4      |
| 11  | Move `requireSupabaseUser` outside `withGlobalDb`; drop the two MFA probes      | H6, H5  |
| 12  | Stop holding two interactive transactions per request                           | H6      |
| 13  | Collapse `withTenantTx` setup into a single statement                           | H6      |
| 14  | Batch the exam-item queries (one query per assessment, not two per item)        | H8      |
| 15  | Add SSRF guards: protocol + private-IP blocking, `redirect: "manual"`           | H3      |
| 16  | Build the worker entrypoint                                                     | M13     |
| 17  | Fix the 5 entitlement + 3 audit metadata routes; add an audit-metadata CI job   | M2, M3  |
| 18  | Make `STORAGE_PROVIDER` fail closed in production                               | M5      |
| 19  | Fix the `..` strip loop; reject `..` segments outright                          | M4      |
| 20  | Add CSV formula-injection escaping; consolidate the 3 duplicate implementations | M1      |

### Phase 2 — Before selling to tenant #2

| #   | Action                                                                       | Finding |
| --- | ---------------------------------------------------------------------------- | ------- |
| 21  | Enforce MFA for tenant-admin and platform-operator actions                   | H5      |
| 22  | Move platform operator assignments into the DB with audit and revocation     | H7      |
| 23  | Replace `isAdminBypassRole` string matching with an explicit role capability | H11     |
| 24  | Add `@@unique([tenant_id, key])` on `roles`; blocklist reserved role keys    | H11     |
| 25  | Quantitative entitlement enforcement + per-tenant usage metering             | M11     |
| 26  | Proctoring media retention policy                                            | M12     |
| 27  | Central idempotency registry with framework-level replay protection          | M10     |
| 28  | Adopt `server-only` markers across server modules                            | M9      |
| 29  | Load test to establish the true concurrency ceiling                          | H6, H8  |
| 30  | Stop committing the generated Prisma client                                  | L1      |

---

## 7. Verification status

| Check                           | Result                                                     |
| ------------------------------- | ---------------------------------------------------------- |
| `typecheck`                     | **pass**                                                   |
| `check:route-metadata`          | **pass**                                                   |
| `check:prisma-boundary`         | **pass**                                                   |
| `check:audit-compliance`        | **pass**                                                   |
| `check:outbox-compliance`       | **pass**                                                   |
| `check:forbidden-scope`         | **pass**                                                   |
| `check:secrets`                 | **pass**                                                   |
| `ci:zod-boundaries`             | **pass**                                                   |
| `ci:tenant-resource-registry`   | **pass** — 155/155                                         |
| `db:sql:check`                  | **pass**                                                   |
| `ci:learner-bundle-boundary`    | pass (chunk budget skipped — no build present)             |
| `ci:permission-metadata`        | **CRASH** — stale path (H10)                               |
| `ci:entitlement-metadata`       | **FAIL** — 5 routes (M2)                                   |
| `ci:audit-metadata`             | **FAIL** — 3 routes (M3)                                   |
| `observability:check`           | **FAIL** — missing env reference (M7)                      |
| `pnpm audit --audit-level high` | **FAIL** — incl. `adm-zip` (C4)                            |
| `security:check`                | **FAIL** — dependency.audit + observability.contract       |
| `ci:frontend-api-closure`       | advisory pass locally; **would fail** under CI strict (M8) |

### Live database checks

| Check                            | Result                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `db:rls:check`                   | **PASS** — RLS enabled and forced on all `tenant_id` tables                  |
| **RLS isolation probe**          | **PASS under `atlas_app`** — but full bypass as the raw connection user (C5) |
| `db:tenant-indexes:check`        | **PASS** — all tenant tables have a tenant-leading index                     |
| `db:append-only:check`           | **PASS** — append-only trigger coverage complete                             |
| `prisma migrate status` (dev)    | **PASS** — 99 migrations applied, schema up to date                          |
| `db:migrate:check`               | **FALSE PASS** — silently skips (H14)                                        |
| `test:unit`                      | **PASS** — 1224 tests, 212 files                                             |
| `tests/security`                 | **PASS** — 11 tests                                                          |
| `test:authorization`             | **FAIL** — 13 of 335 (H12, H13)                                              |
| `test:integration` (`tests/db`)  | **FAIL** — 2 of 14 (seed-count drift)                                        |
| `test:tenant-isolation`          | **FAIL** — 11 of 175 after test-DB rebuild (was 22) (H12)                    |
| `test:e2e`                       | **FAIL** — 17 of 154 (H13)                                                   |
| `test:events` / `test:workers`   | **PASS** — 18 tests, 4 files                                                 |
| `test:storage`                   | **PASS** — 10 passed, **8 skipped** (L11)                                    |
| `pnpm --filter @atlas/web build` | **PASS** — exit 0                                                            |
| `ci:learner-bundle-boundary`     | **FAIL** — 354.6 kB gzip vs 150 kB budget (H16)                              |
| Playwright accessibility         | **FAIL** — 4 of 6 (H17)                                                      |
| Live security-header probe       | **FAIL** — all six controls absent on a running server (H2)                  |
| `prisma migrate status`          | **PASS** — 99 migrations applied, schema up to date                          |

---

## 8. Still not verified

- **Production database role configuration** — C5 is confirmed in dev/test; production is unknown,
  but nothing in the repo establishes a non-superuser app role
- **Load characteristics under real traffic** — the H6/H8 ceiling is derived from pool size and
  code paths, **not measured**. This remains the single most important open item.
- **Playwright visual and journey suites** — only the accessibility suite was executed (4 failed, 2 passed; see H17)
- Cloudflare/WAF configuration and Supabase project settings
- Email/WhatsApp template rendering and deliverability
- Mobile (React Native) surface — not in this repository
- **C1 (SCORM XSS) is the one finding still reasoned rather than demonstrated.** Its two
  mechanical preconditions are individually confirmed — `guessContentType` returns `text/html`
  for `.html`, and no CSP or `nosniff` header exists anywhere — but no end-to-end upload-and-execute
  proof was performed, as that needs a seeded tenant, an enrolled learner and a Supabase session.
- Cross-tenant exploitation of M4 on the `local-fs` provider was reasoned from the path guard, not
  executed against a live storage root

---

## 9. What the live pass changed

| Previously                                      | Now                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| M6: "RLS coverage unverifiable by inspection"   | **Resolved positively** — enabled and forced on all tenant tables; policies correct |
| "RLS correctness unverified"                    | **Verified by probe** — isolation holds under `withTenantTx`                        |
| —                                               | **New C5** — app role is superuser with `BYPASSRLS`; RLS has no backstop            |
| —                                               | **New H12** — 43 failing tests, 6 red CI jobs                                       |
| —                                               | **New H13** — "e2e"/authorization suites are source-text assertions                 |
| —                                               | **New H14** — `db:migrate:check` silently no-ops                                    |
| —                                               | **New M15** — practice-session start fails a NOT NULL constraint                    |
| Index coverage unknown                          | **PASS** — all tenant tables have tenant-leading indexes                            |
| Append-only coverage assumed from trigger files | **PASS** — verified complete against the database                                   |

Two things are worth stating plainly. First, the **tenant-isolation design is genuinely sound** —
that was the biggest open question and it came back clean. Second, the reason it looked clean to
the existing tooling is partly luck: `check-rls-state.ts` passed on a database where a full RLS
bypass was trivially demonstrable, because it never checks the connecting role's privileges.

## 10. Round-3 deep pass — negative results

Areas swept in the final pass that came back **clean**. Recorded so they need not be re-audited.

| Area                             | Method                                                                                              | Result                                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **SQL injection**                | Scanned all 3,111 backend files; classified every `$queryRawUnsafe`/`$executeRawUnsafe` (147 calls) | **Clean** — only 6 interpolate, all compile-time constants or allowlisted `ORDER BY` from typed unions; dynamic `SET` binds all values |
| **Open redirect**                | Traced every `redirect(userInput)` candidate                                                        | **Clean** — the one candidate (`signup-action.ts:70`) resolves to a server-side constant `"/platform"`                                 |
| **Timing-unsafe secret compare** | Regex for `===` against secret/token/signature/hash identifiers                                     | **Clean** — all use `timingSafeEqual` or hashed lookups                                                                                |
| **Secrets in git history**       | `git log --all --diff-filter=A` over env/key/cert patterns                                          | **Clean** — only `.env.example` was ever added                                                                                         |
| **PII in logs**                  | Swept all `console.*` for email/password/token/secret                                               | **Clean** — the email provider deliberately logs `toDomain` only, never the address                                                    |
| **Code execution sinks**         | `eval`, `new Function`, `vm`, `child_process`                                                       | **Clean** — zero occurrences                                                                                                           |
| **Exam answer-key leakage**      | Compared learner vs grading item builders                                                           | **Clean** — `buildRunnerItems` omits `isCorrect` / `answerKeyJson`                                                                     |
| **Invitation tokens**            | Reviewed generation and storage                                                                     | **Clean** — `randomBytes(32).toString("base64url")`, stored hashed                                                                     |
| **Integration API key**          | `requireIntegrationApiKey`                                                                          | **Clean** — hashed lookup, not a string comparison                                                                                     |
| **Public route inventory**       | Enumerated all 41 unauthenticated routes                                                            | **Clean** — the sensitive ones (`paid-enrollment`, integration `sign-up`) require an integration API key                               |

Two caveats on that last row: the integration actions are correctly key-gated but pass a malformed
actor id (M16), and `Math.random()` weakens the code-generation paths (H15).

### Exploit confirmation status

Findings were re-tested against the running system rather than left as code reasoning. Current state:

| Finding                   | Status                                                                     |
| ------------------------- | -------------------------------------------------------------------------- |
| C2 wallet double-spend    | **Demonstrated** — 5 spends of 100 credits from a 100-credit wallet        |
| C3 coupon over-redemption | **Demonstrated** — 5 redemptions against `total_usage_limit = 1`           |
| C4 zip bomb               | **Demonstrated** — 199.5 KB archive → 200 MB resident, 1026× amplification |
| C5 RLS bypass             | **Demonstrated** — cross-tenant read without the tx wrapper                |
| C6 pool deadlock          | **Measured** — 100% failure at 20 concurrent; 364 rps once un-nested       |
| C7 no email transport     | **Verified** — no transport library installed anywhere in the monorepo     |
| H3 SSRF                   | **Demonstrated** — schema accepts metadata IP, loopback, RFC1918, IPv6     |
| H16 bundle budget         | **Measured** — 354.6 kB gzip vs 150 kB budget                              |
| M4 SCORM path traversal   | **Demonstrated** — 3 working payloads escape the module prefix             |
| **C1 SCORM stored XSS**   | **Preconditions confirmed, end-to-end not executed** — see §8              |

---

### Remediation additions

| #   | Action                                                                             | Finding  |
| --- | ---------------------------------------------------------------------------------- | -------- |
| 31  | **Connect production as a non-superuser role without `BYPASSRLS`**                 | C5       |
| 32  | Extend `check-rls-state.ts` to assert `NOT rolsuper AND NOT rolbypassrls`          | C5       |
| 33  | Add a regression test asserting cross-tenant reads fail **without** the tx wrapper | C5       |
| 34  | Fix the migrations path in `check-migrate-status.mjs`                              | H14      |
| 35  | Audit all guard scripts for pre-restructure paths; fail loudly instead of skipping | H10, H14 |
| 36  | Triage the 43 failing tests; get all 6 CI jobs green                               | H12      |
| 37  | Re-base "e2e"/authorization suites onto behavioural tests                          | H13      |
| 38  | Refresh `atlas_lms_test` in CI so isolation tests run against the current schema   | H12      |
| 39  | Triage the practice-session NOT NULL failure                                       | M15      |

| 40 | **Implement a real email transport** (adapter exists, no provider) | C7 |
| 41 | **Remove the nested transaction** — one pool connection per request | C6 |
| 42 | Replace `Math.random()` with `crypto.randomInt` for coupon/referral/affiliate codes | H15 |
| 43 | Pass a real membership id (or an explicit system actor) at the 6 system entry points | M16 |
| 44 | Introduce branded `TenantId` / `MembershipId` types so M16 cannot recur | M16 |

Items 31, 34 and 41 are each effectively a one-line change. **Item 41 alone takes the service from
a 100% error rate at 20 concurrent requests to 364 rps at 80** — it is the highest-leverage fix in
the audit and should be done first.

---

## 11. Found during Phase 2 remediation (2026-08-17)

Two defects the audit did not catch, both found by **running** code that had never run before. Both
are recorded here because the audit's own method missed them, and the reason is instructive.

### 11.1 The outbox poll had no completion filter — new critical

`pollOutboxEventsForProcessing` selected the oldest `limit` rows matching `available_at <= now()`
and nothing else. Nothing in the schema marks an event processed, so:

- already-delivered events were re-polled and re-skipped on every pass;
- events with no handler in the polling group were re-polled forever, leaving no trace at all;
- **anything past the first `limit` rows was never reached.** Once `limit` inert events accumulated
  at the head of the queue, the outbox stopped advancing permanently.

This is strictly worse than C6 (the worker never being called). C6 meant events sat undelivered;
this meant that even with a worker, delivery would stall after the first batch. The two masked each
other: the poll's behaviour was unobservable while nothing called it.

Reproduced live as a hot loop reporting `processed: 260, delivered: 0` every sweep. Fixed by
filtering on the `event_deliveries` ledger that already existed, keyed by the polling group's
`(event_type, destination_key)` subscriptions; the same database then drained in two sweeps.

**Why the audit missed it.** The query was read for injection and for tenant scoping, both of which
it passes. Correctness of a poll query is only visible against its caller's lifecycle, and it had no
live caller to read it against.

### 11.2 Package `exports` maps did not cover their own imports

Ten `@atlas/*` subpath specifiers across five packages were absent from those packages' `exports`
maps, and six more packages mapped `"./*"` to `"./src/*"` with no file extension. The Next.js
bundler resolves all of these through tsconfig `paths` and never complains, so every one of them was
a latent hard crash for any runtime using plain Node resolution — workers, scripts, migrations.

Not a security finding, but the same shape as several in this report: a check that appears to exist
(an `exports` map implies a declared surface) while being unenforced, so it drifts silently.

**Now guarded.** `check-package-exports.mjs` fails the build on any undeclared subpath import, and
`check-outbox-worker-coverage.mjs` fails when an exported `process*OutboxBatch` is not registered
with the worker. Both were verified to fail on deliberately broken input, not merely to pass.

### Method note

Every finding in §2–§5 came from reading code, and the strongest ones from executing it. Both
findings above came from running a process that had never been started. Where this report lists
code as "exported but unreachable", that status should be read as **unverified**, not as working —
unreachable code is not exercised by any test or gate, so nothing constrains its correctness.
