# Better Auth: design and schema (launch plan task 3.1)

Date: 31 October 2026. This replaces Supabase Auth with Better Auth, as decided in `hosting-decision-2026-10-23.md`, section 6. That section lists the flows; this note settles the three open design questions and records the schema added in migration 127. The flows themselves are built in tasks 3.2 to 3.6.

Checked against **Better Auth 1.7.14**, released 26 October 2026, by reading its published source rather than relying on its docs. Line references below are to that version.

## Decisions

| Question                               | Decision                                                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session model                          | **Database sessions.** One opaque, signed session cookie per host. Sessions live in Postgres (`auth_sessions`). No JWT access tokens, no refresh tokens.                                                                        |
| How users map to `auth_principals`     | **`auth_principals` is Better Auth's user table.** One row per person, no second identity system and no link column.                                                                                                            |
| Session assurance (aal1 and aal2, F01) | **Our own column on the session,** `assurance_level`, set to `aal2` only by a second-factor check. Better Auth has no assurance level of its own.                                                                               |
| Who may read the auth tables           | **A new database role, `atlas_auth`, used only by Better Auth.** The tenant and worker roles can't read password hashes, authenticator secrets or session tokens. The platform role sees session and login-method metadata.     |
| How Better Auth is reached             | **Through our own routes.** Each flow is an `/api/v1/...` route that calls `auth.api.*`, so route metadata, rate limits, idempotency, audit and tenant binding stay as they are. Better Auth's catch-all handler isn't mounted. |

### 1. Session model: database sessions

Better Auth always keeps a session row. Its "JWT" options don't replace that: the `jwt` plugin issues tokens for _other_ services to verify, and `session.cookieCache` with `strategy: "jwt"` only caches the session row in a second cookie. So the real choice is how much of today's access-and-refresh-token machinery to rebuild. Database sessions rebuild none of it:

- **Sign-out and account disabling are immediate.** Deleting the row ends the session. Today a signed-out access token keeps working until it expires.
- **No refresh step.** The web proxy (`frontend/apps/web/src/proxy.ts`) decodes the access token's expiry and refreshes it before protected pages and API calls. Most of `session-refresh.ts` goes away, along with the refresh races the F01 review noted.
- **Sliding expiry is built in.** `session.expiresIn` is 30 days, as `REFRESH_TOKEN_MAX_AGE_SECONDS` is today. `updateAge` is 1 day: a session used on a new day is extended, at most one write a day.
- **Users and sessions are in one Postgres.** They're backed up together, and one transaction can disable a principal and delete its sessions.

**The cost is a lookup per request,** which is what the one-minute cache in `session.ts` (audit §3.1) already avoids for Supabase. It stays, in the same form: a per-process cache keyed by a SHA-256 of the token, at most 60 seconds, emptied for a token when it's signed out or stepped up on this process. Better Auth's own cookie cache isn't used. It would put the session's assurance level in a browser cookie that's only rewritten when Better Auth itself writes the session. Sessions aren't put in Redis (`secondaryStorage`): Better Auth would then keep them _only_ in Redis unless told otherwise, and Redis isn't backed up.

**Cookies.** One cookie, `atlas_session`, replaces `atlas_access_token` and `atlas_refresh_token`. Its value is Better Auth's `token.signature`, an HMAC with `BETTER_AUTH_SECRET`, so a token read from the database can't be used without the secret. The flags stay the same:

- `HttpOnly`, `SameSite=Lax`, `Path=/`;
- host-only, so a session on one academy's host is never sent to another;
- `Secure` in production. Better Auth then also adds the `__Secure-` name prefix.

"Keep me signed in" maps to Better Auth's `rememberMe: false`, which makes the cookie last only for the browser session, as `atlas_session_persistent` does today.

### 2. `auth_principals` is the user table

Better Auth's user model is pointed at the existing `AuthPrincipal` model (`user.modelName: "authPrincipal"`), with its field names mapped to our columns:

| Better Auth field        | Column                     | Note                                                                                                                                                  |
| ------------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | `id`                       | UUIDv7 from `createUuidV7`, as every principal gets today (`advanced.database.generateId`)                                                            |
| `email`                  | `email`                    | Better Auth lowercases it before every write and lookup (`internal-adapter.mjs` lines 127, 146, 619)                                                  |
| `emailNormalized`        | `email_normalized`         | An extra user field Better Auth doesn't know about. A create and update hook sets it to `email.trim().toLowerCase()`, the same normalisation as today |
| `name`                   | `name` (new)               | Required by Better Auth. Empty when unknown; academy profiles keep their own names                                                                    |
| `emailVerified`          | `email_verified` (new)     | Existing principals are set to `true`: one is only created for a confirmed address (audit H6)                                                         |
| `image`                  | `image` (new)              | From Google's profile, unused for now                                                                                                                 |
| `twoFactorEnabled`       | `mfa_enabled`              | The two-factor plugin's flag, and our existing enrollment flag, become one column                                                                     |
| `createdAt`, `updatedAt` | `created_at`, `updated_at` |                                                                                                                                                       |

`global_status` and `last_login_at` stay ours. A hook refuses to create a session for a principal whose `global_status` isn't `active`, and `global_status` is still read on every request, as today.

`supabase_user_id` becomes nullable: Better Auth users have none. It's dropped with the rest of Supabase in task 3.8.

**What this removes.** Today a principal is matched to a Supabase user, and a re-registered Supabase account with the same email needs a platform-reviewed relink (`auth_principal_relink_requests`, audit H6). With one table and a unique email, there's no second identity to drift. The relink tables and their console are removed in 3.8.

### 3. Assurance level stays ours

F01 and H4 rely on knowing whether _this session_ passed a second factor (`sessionAssuranceLevel`), not only whether the account has one (`mfaEnabled`). Better Auth 1.7.14 doesn't record this:

- **Its two-factor check runs only on password sign-in** (`plugins/two-factor/index.mjs`, line 249: `/sign-in/email`, `/sign-in/username`, `/sign-in/phone-number`). Google sign-in and email one-time codes create a full session for an account with an authenticator, with no challenge.
- **Verifying a code during an existing session changes nothing** (`verify-two-factor.mjs`, the branch for an existing session). There's no step-up.
- **"Trust this device"** skips the challenge, and the resulting session looks the same as any other.

So `auth_sessions` gets two columns of our own, declared to Better Auth as session `additionalFields` with `input: false`, so no request body can set them:

- `assurance_level`: `aal1` or `aal2`, default `aal1`, enforced by a check constraint;
- `mfa_verified_at`: when the second factor was checked.

**Setting `aal2`:**

- A session-create hook sets it when the session is created by the two-factor verify endpoints (TOTP or a backup code).
- The step-up route (`POST /api/v1/me/security/mfa/step-up`) and verifying a new factor (`…/mfa/verify`) set it after Better Auth accepts the code.

**Everything else gets `aal1`,** including Google and email-code sign-in. For an account with an authenticator, the sign-in flow then asks for the code on the step-up screen. The platform guard and the tenant routes that declare MFA keep refusing `aal1` either way.

**"Trust this device" isn't offered.** A backup code counts as a second factor (`aal2`), as NIST SP 800-63B allows for look-up secrets.

### 4. A database role only for Better Auth

Today `atlas_app`, the tenant application's role, can read and write `auth_principals`. Better Auth adds tables holding password hashes (`auth_accounts.password`), authenticator secrets, and session tokens. None of them should be readable from tenant code, so a SQL injection in a tenant route can't reach them.

- **New role `atlas_auth`** (`NOLOGIN`). It may only:
  - select, insert and update `auth_principals`;
  - select, insert, update and delete the four new tables.

  It never deletes a principal: Better Auth's delete-user endpoint isn't used.

- **The API's login gets it with `SET` but not `INHERIT`** (`GRANT atlas_auth TO atlas_app_login WITH INHERIT FALSE, SET TRUE`, PostgreSQL 16). The login can switch to `atlas_auth`, but ordinary queries on it never get its privileges.
- **Better Auth gets its own small connection pool,** whose connections start as `atlas_auth` (the `role` startup parameter). Every Better Auth query, including its transactions, runs as that role, so it never has to `SET ROLE` itself. The pool is created only when Better Auth is first used, and lives in `@atlas/db` with the other clients (`auth-client.ts`).

| Table                | `atlas_app`, `atlas_worker` | `atlas_platform`                                                 | `atlas_auth`                   |
| -------------------- | --------------------------- | ---------------------------------------------------------------- | ------------------------------ |
| `auth_principals`    | as today                    | as today                                                         | select, insert, update         |
| `auth_sessions`      | nothing                     | select (no `token`), delete: list and revoke sessions            | select, insert, update, delete |
| `auth_accounts`      | nothing                     | select `id`, `user_id`, `provider_id`, dates: show login methods | select, insert, update, delete |
| `auth_verifications` | nothing                     | nothing                                                          | select, insert, update, delete |
| `auth_two_factors`   | nothing                     | nothing                                                          | select, insert, update, delete |

**Why the grants are written twice.** The blanket `GRANT … ON ALL TABLES` in `sql/grants/025_02_table_grants.sql` runs after the migrations on every deploy, and would hand these tables back to every role. So `sql/grants/127_better_auth_grants.sql` runs after it and narrows them again, as the H7 and H6 blocks do. `tests/tenant-isolation/table-privilege-boundaries.test.ts` checks the result from the catalogue.

**No row-level security.** The tables are global, like `auth_principals`: a person signs in once and may belong to several academies. Isolation comes from the grants above and from host-only cookies. Tenant binding stays where it is today, in the membership lookup for the request's host.

### 5. Reached only through our routes

Better Auth is created in `@atlas/auth` (`createAtlasAuth`) and called as `auth.api.signInEmail(...)` and so on from our route handlers, with `returnHeaders: true` so its `Set-Cookie` headers go back through the web proxy. Its `/api/auth/*` handler isn't mounted. Each flow keeps:

- route metadata, `publicAuth` rate limits and idempotency;
- breach checks (`assertPasswordNotBreached`) and our error mapping;
- audit and security emails;
- the tenant host binding.

Two Better Auth endpoints have to be reachable over HTTP: the Google callback, and the links in its emails. Task 3.3 routes `/auth/callback/google` on the academy host to the API (decision doc, "Google sign-in"). Email links are built by our own code and land on our pages.

**Hosts.** Academies add custom domains at runtime, so `baseURL` uses Better Auth's dynamic form, `{ allowedHosts, protocol: "https" }`. `trustedOrigins` is a function that accepts the request's host only when it resolves to an active tenant domain or is the platform host (`lookupTenantFromHost`). The API already refuses unknown hosts before any auth call.

**Rate limits.** Better Auth's limiter uses a `customStorage` on our Redis, because `secondaryStorage` would also move sessions. Our own limits are unchanged.

## Schema (migration 127)

`backend/prisma/migrations/20261031120000_127_better_auth_schema/migration.sql`:

- **`auth_principals`:**
  - adds `name`, `email_verified` and `image`;
  - backfills `email_verified = true`;
  - makes `supabase_user_id` nullable. The unique index stays: Postgres allows any number of nulls in it.
- **`auth_sessions`:**
  - `token` is unique;
  - `user_id` references `auth_principals`, and a principal's sessions are deleted with it;
  - `ip_address`, `user_agent`, `assurance_level` and `mfa_verified_at`;
  - indexed by `user_id` and `expires_at`.
- **`auth_accounts`:**
  - one row per login method;
  - `provider_id` is `credential` (holds the password hash) or `google`;
  - unique on (`provider_id`, `account_id`), indexed by `user_id`;
  - Google tokens are encrypted by Better Auth (`account.encryptOAuthTokens`).
- **`auth_verifications`:** email verification, password reset and one-time-code values, indexed by `identifier` and `expires_at`.
- **`auth_two_factors`:** the authenticator secret and backup codes, both encrypted with `BETTER_AUTH_SECRET` by the plugin, plus its lockout counters. One row per principal.
- **The `atlas_auth` role and its grants,** in `sql/grants/025_01_roles.sql`, `025_03_login_roles.sql` and `127_better_auth_grants.sql`.

`createAtlasAuth` in `backend/packages/auth/src/better-auth.ts` holds the mapping above, with email and password and the two-factor plugin turned on. No route uses it yet. `tests/integration/auth/better-auth-schema.test.ts` runs Better Auth against a real database to check the mapping:

- a sign-up writes a UUIDv7 principal with `email_normalized`;
- a password sign-in writes an `aal1` session;
- a session isn't created for a disabled principal;
- `atlas_app` can't read password hashes or session tokens.

## Moving the staging accounts

Staging has one principal (checked 31 October 2026): the platform operator, who is also the FundedBeyond owner, with an authenticator. Supabase can't export authenticator secrets, and a custom verifier for its password hashes isn't worth it for one account. So when Better Auth goes live on staging (task 5.1):

- the owner resets the password once with "Forgot password?". Better Auth's reset adds the password login method to an existing user that has none (`utils/password.mjs`, `resetCredentialPassword`);
- `mfa_enabled` is cleared for principals without an `auth_two_factors` row, in the same release. Otherwise Better Auth would ask for a code from a factor that no longer exists;
- the owner sets up the authenticator again at first sign-in, which the platform's "MFA enrollment at aal1" route already allows.

There are no production accounts.

## Task 3.2: password flows (as built, 31 October 2026)

**A switch, off by default.** `AUTH_PROVIDER` is `supabase` unless set to `better-auth`. Better Auth needs `BETTER_AUTH_SECRET`, at least 32 characters, on the API, and the deployment check refuses anything else. It stays off on staging until 3.3 to 3.6 are done (task 5.1): until then the platform operator's authenticator sign-in has nowhere to go.

**One path for "who is signed in".**

- `requireSessionUser` and `resolveSessionPrincipal` (`@atlas/api/session-user`) answer for either system: tenant routes, `/me`, invitations, certificates and the platform guard.
- A Better Auth session is checked once a minute per token, as the Supabase one is. A Better Auth user is the principal, so it's only read, and refused unless active.

**The same routes and answers.** Sign-in, sign-up, email confirmation, resend, reset and change password keep their routes and responses. Each service function has a Better Auth branch. Two routes are new, so the web app no longer talks to Supabase for these:

- `POST /api/v1/public/auth/forgot-password` asks either system for a reset link;
- `POST /api/v1/public/auth/logout` deletes a Better Auth session and clears every session cookie.

**Emails are ours.**

- Better Auth's callbacks only record what it asked for (`captureAuthEmails`). The route then sends it (`apps/api/src/lib/auth-email.ts`) with the academy's name and its Transactional Email sender, on the host the person used.
- Asking for an email outside a route that sends it throws, so nothing is silently not sent.
- Links go to our pages: `/auth/confirm?token_hash=…&type=signup` verifies and signs in, as Supabase's link does; `/reset-password?token=…` asks for the new password.
- Full academy branding is 3.6.

**What differs from Supabase, on purpose:**

- **Resetting a forgotten password** needs no authenticator code: it ends every session and starts none, and signing in still asks for the code.
- **Changing the password** keeps this session and ends the others. Better Auth's own option would swap this session's token, and the change-password route can't set a new cookie.
- **Sessions don't slide yet.** The session check can't rewrite the cookie, so a session lasts 30 days from sign-in. Sliding it means returning Better Auth's cookie from the web proxy: an open item.
- **Placeholders are claimed at first sign-in.** An unclaimed principal is claimed when its owner first signs in with a proven address, in the session hook, because Better Auth's verify step doesn't say which user it updated. The hook checks for a platform grant, so `atlas_auth` may now read `platform_operators` (migration 128).

## Task 3.3: Google sign-in and login methods (as built, 1 November 2026)

Behind the same `AUTH_PROVIDER` switch, with the Google client from `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The deployment check needs both or neither.

**The redirect.**

- Better Auth's routes sit under `/auth` (`basePath`), so Google returns to `https://<academy>/auth/callback/google`, the address registered on both Google clients in task 0.4.
- That web route (`/auth/callback/[provider]`) passes the code, Google's `state`, and the browser's cookies to `POST /api/v1/public/auth/oauth/callback`.
- Better Auth checks the state against its signed `atlas.state` cookie, which the start route passed to the browser. A callback without that cookie is refused.
- Supabase's flow keeps `/auth/callback`; both use one handler (`app/auth/oauth/oauth-callback.ts`).

**Linking, as the design asked.**

- A Google sign-in reaches an existing account with the same address only when Google has verified the address and so have we.
- Google is deliberately not a "trusted provider": Better Auth would then link even when Google hasn't verified the address.
- An unverified local account answers `ACCOUNT_NOT_LINKED` (409): sign in with the password, then connect Google from the security settings. This stops someone who signed up with another person's address, and never verified it, from gaining that person's Google sign-in.

**New accounts.**

- A new address Google has verified gets a principal and an `aal1` session.
- One Google hasn't verified gets our verification email and no session (audit H6).

**Login methods.**

- The security settings list the principal's login methods (the password one reads as "email"), start linking Google (the state cookie is set through Next's cookie store), and remove one.
- Better Auth refuses to remove the last way to sign in.
- `session.freshAge` is 0: our routes decide what is sensitive (H4). Otherwise Better Auth's own freshness rule refused to unlink a day after sign-in.

**Unchanged:**

- **The platform console:** it offers no Google sign-in, because its Google clients register academy addresses only.
- **Apple is hidden:** its sign-in and sign-up buttons and its "connect" option are gone. An Apple login method linked before still lists and can be removed.
- **"Keep me signed in" off:** this drops the session cookie's lifetime, as with Supabase.

**For task 5.1:**

- add the staging client's ID and secret to the API's environment (`provider.env`, through hidden prompts);
- an academy on a custom domain needs that domain's `/auth/callback/google` added to the Google client before Google sign-in works there.

## Open items for the flow tasks

- **Sliding sessions.** Pass Better Auth's refreshed cookie back through the web proxy, so a session used every day doesn't end 30 days after sign-in.
- **3.5, existing sessions after enrollment.** Turning on two-factor leaves the user's other sessions at `aal1`, which the gates already handle.
- **3.7, test cleanup.** `scripts/db/purge-test-tenants.mjs` refuses to delete a test principal that any table still references, including `auth_sessions` and `auth_accounts`, whose rows are deleted with the principal anyway. Until it allows those, tests delete their own Better Auth rows, as `better-auth-schema.test.ts` does.
- **After launch, cleanup.** Better Auth deletes expired verification rows when it reads them, but expired sessions stay. Add a periodic delete of expired `auth_sessions` and `auth_verifications` rows to the API.
