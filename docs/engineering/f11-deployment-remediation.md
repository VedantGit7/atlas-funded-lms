# F11 — Deployment and service boundaries

Date: 2026-09-20. Status: **local remediation implemented; live acceptance remains blocked**.

The failed Vercel build was diagnosed from its actual build log. The install hook loaded a Prisma configuration that required `DATABASE_URL` even though it was only generating a client. Client generation now has a separate configuration without database credentials; migration commands retain their original configuration and fail when credentials are missing. The Vercel project's Root Directory was also corrected from blank to `frontend/apps/web`, saved, and verified by revisiting the settings page.

This does not establish a working deployment. The project has no environment variables, no successful production deployment, and no assigned academy custom domain. A new deployment was not triggered against that incomplete configuration. The source changes remain local and uncommitted alongside F01–F10.

## Verified live state

| Component             | Observation                                                                                                                            | Consequence                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel project        | `atlas-funded-lms`, ID `prj_mLNnaCQpELmd5nwk6z4jWKSlrjhg`, team `vedantwedhane-8075s-projects`, Hobby                                  | Existing project identified through signed-in browser access.                                                                                 |
| Failed preview        | `Bs19QhQ6k3gEh5z6yJg6vB4ebEeY`, SHA `ca8c0f1e7e69780b4e2ddc2a1136907a2e47c350`                                                         | Install failed with `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`. No application smoke journey ran.              |
| Production            | Overview reports “No Production Deployment”; failed production build `81ES7r6KuTNdgzFvykCryH8yHwRB`                                    | No healthy production target established.                                                                                                     |
| Build configuration   | Next.js; `pnpm build`; `pnpm install --frozen-lockfile`; include files outside root enabled; Node 24.x                                 | Root Directory is now `frontend/apps/web`. Node version remains 24.x; CI currently pins 22.13.1, so runtime alignment remains a rollout task. |
| Environment variables | Settings reports “No Environment Variables Added”                                                                                      | API origin and required runtime infrastructure credentials are not configured on this project.                                                |
| Preview protection    | Vercel Authentication enabled with Standard Protection; protected source maps checked                                                  | Existing protection preserved. No bypass secret or domain exception was listed. Data isolation is still unproven.                             |
| Domains               | Only `atlas-funded-lms.vercel.app`, “No Deployment”, Production                                                                        | `academy.fundedbeyond.com` is not assigned to this project.                                                                                   |
| Public academy URL    | HEAD at 07:41:58 UTC: HTTP 302 via Cloudflare to `https://fundedbeyond-com.l.ink/`                                                     | It still does not serve this LMS. DNS/redirect rules were not changed.                                                                        |
| Cron                  | Feature enabled but onboarding screen, no registered jobs shown                                                                        | No successful scheduled invocation established.                                                                                               |
| Supabase              | `rolumnldqjelwfvtmmqf`, `atlas-funded-lms`, `ap-south-1`, `ACTIVE_HEALTHY`; public table listing returned zero tables                  | Project existence/health does not establish a provisioned LMS application database. No migrations or database changes performed.              |
| Connector coverage    | Vercel connector returns no teams and 403 for the known deployment; browser access works. No callable Cloudflare connector tools found | Reconnect the correct Vercel team for repeatable automation; Cloudflare control-plane configuration remains unverified.                       |

Vercel Hobby cron supports once-daily jobs; the repository's report schedule runs every 15 minutes. Deploying that configuration on Hobby is unsupported. Preserve the required report frequency and choose either an eligible Vercel plan or a separately operated scheduler. No upgrade or schedule reduction was performed. See [Vercel cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## Implemented changes

1. **Credential-free installation:** `backend/prisma.generate.config.ts` supplies only the schema location. `postinstall`, `db:generate`, and `db:generate:ci` use it. Database migration configuration is unchanged. An actual Prisma CLI fixture proves generation without credentials and rejection of database operations without `DATABASE_URL`.
2. **Authenticated tenant forwarding:** web requests to the internal API carry a dedicated server-side `API_PROXY_SECRET`. API ingress authenticates it before retaining forwarded tenant/host headers, and removes the credential before application handlers. Invalid or missing credentials discard the forwarded context in deployed environments. Browser-supplied values are overwritten. Existing session, role and membership checks still apply.
3. **Platform origin:** platform mutations compare the browser Origin with configured `PLATFORM_HOST`, rather than the backend transport hostname. Local development retains its Host fallback. Arbitrary forwarded-host headers cannot select the platform origin.
4. **Internal request consistency:** server API calls, refresh, public auth, invite preview, OAuth and asset proxy calls use the shared forwarding helper. Fetches carrying its credential refuse redirects. OAuth callback clears temporary cookies before appending relayed session cookies, preventing accidental removal of the new session.
5. **Deployed configuration:** web and API startup require a nontrivial proxy secret of at least 32 characters, distinct from cron and worker secrets. The outbox worker does not require this web/API credential. `.env.example` contains only an empty template.
6. **Release health verification:** the probe requires an expected release; checks both responses for status/schema/release and matching, unique request IDs; rejects redirects; limits each request to a configurable 100–30,000 ms; and sanitizes connection failures. HTTPS is required except exact loopback hosts. An optional Vercel automation bypass is sent only to the configured origin and is never printed.
7. **Cron authorization coverage:** all three actual backend cron handlers have regression coverage for absent configuration, missing/wrong bearer credentials, and a valid credential invoking the intended service. These are isolated tests, not evidence of a live scheduled execution.
8. **Tooling compatibility:** the new Prisma configuration is included in the existing non-typechecked tooling lint scope. The package-export guard exposed two missing exports used by prior outbox tests (`@atlas/events/transaction` and `@atlas/events/repositories/outbox-job.repository`); both existing modules now have explicit exports, and the guard passes.

## Service map and release work

The [deployment topology runbook](../runbooks/deployment-topology.md) defines the web/API/worker split, resource ownership, environment separation, scheduler choice, deployment order, acceptance checks and rollback. It distinguishes known resources from services that still need provisioning or identification.

The required operational work is concrete:

- Establish the API and long-running worker hosts and a staged LMS database with restricted runtime roles and migrations. The connected Supabase project currently has no public LMS tables.
- Provision isolated staging Redis, R2, email and monitoring resources; inject the F05 configuration into the correct services. Do not copy local development credentials into deployment settings.
- Configure one explicit API origin at web build and runtime, matching web/API proxy secrets, canonical tenant/platform domains, and auth callback URLs.
- Resolve the every-15-minute scheduler requirement, then verify execution against the intended environment.
- Build/deploy the reviewed source and verify health, tenant isolation, login, platform access, file persistence and worker processing on a protected staging candidate.
- Assign custom domains and replace the existing redirect only after the candidate passes. Record the actual deployed SHA and completed F09/F10 release gates.

## Verification and limitations

Machine-readable results and source hashes are recorded in `audits/2026-09-20/f11-verification.json`; console evidence is stored beside it. Tests use isolated fixtures and mocked providers, with database and Redis environment variables removed. The Prisma fixture generates a tiny disposable client and never migrates or connects to a database.

- Combined regression suite: **314 passed across 27 files**, including Prisma CLI generation, configuration/startup, forwarding, platform Origin, cron authorization, web, observability and release-evidence checks.
- Repository TypeScript build check passed. Scoped F11 lint/format and Prisma-boundary, route-metadata, package-export and observability guards passed.
- Learner import guard passed; its size report used existing build artifacts, not a fresh F11 build. It still reports the pre-existing first-load target as open. No new bundle-size or hosted-build claim is made.
- Independent read-only review found no concrete introduced regression. The initial failing callback-host regression is retained in `f11-combined-tests.log`; the corrected combined result is in `f11-combined-green.log`.

No successful hosted build, live authenticated journey, live worker, cloud storage persistence check, real scheduled job, production database grant check, or DNS cutover is claimed. F11 stays open until its live acceptance criteria pass. Local tests are supporting evidence for the code changes, not a substitute for that acceptance.
