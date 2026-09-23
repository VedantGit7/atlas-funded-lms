# F18 server authority implementation plan

> **For agentic workers:** Use subagent-driven-development for scoped dependency mapping, endpoint preservation and independent review. Preserve F01–F17 working changes. Do not commit or deploy.

**Goal:** make the API app and backend domain packages authoritative for business operations, remove shadowed web implementations, and enforce contract synchronization and architectural boundaries.

**Architecture:** browser and server-rendered UI call the API through the existing authenticated proxy/server API adapter. Shared DTOs remain in `@atlas/contracts`, generated from backend definitions. Web-owned auth callbacks, cookies, shell gates and presentation adapters remain in the web app. Backend services are not imported into the browser or re-exported through a new application-to-application dependency.

**Tech stack:** Next.js 16, TypeScript, Zod, existing pnpm workspace packages, Node architecture checks, Vitest and isolated Playwright journeys.

The user approved the existing F18 audit specification by requesting its implementation. This plan makes that work concrete without another approval checkpoint.

## Tasks

- [x] Map imports and actual runtime ownership. Inspect all web API routes, server modules, diagnostic business modules and worker/event copies. Identify live value consumers and preserve frontend-only endpoints before removal. Record current hashes only as supplementary evidence, not a deletion rule.
- [x] Add failing architecture tests for reintroduced web API business routes, server/worker business trees, backend application imports through aliases/relative paths, and unsynchronized generated contracts. Keep web auth bridges and UI server adapters explicit.
- [x] Preserve certificate-brand-kit and public credential download endpoints in the authoritative backend, with route behavior/security tests. Retain existing canonical binary upload handling and web ingress forwarding checks rather than the shadowed upload route.
- [x] Move the four live type-only imports to the existing contracts package. Retire the verified unreachable web server/API/event/diagnostic business cluster and obsolete application-server aliases. Adapt tests that inspected the retired copies to enforce the new boundary and exercise canonical handlers.
- [x] Make contract generation deterministic and checkable without rewriting files. Detect missing, changed and orphaned generated files; preserve explicitly handwritten shared utilities and reject runtime database/service dependencies. Wire the checks into CI and package scripts.
- [x] Verify TypeScript, architecture/route/security tests, current API closure, fresh web build and representative authenticated browser flows on disposable local services. Preserve proxy cookies, tenant identity, uploads, auth refresh and cross-tenant denial. Resolve real failures rather than deleting tests to make removal pass.
- [x] Obtain independent review, document route/module ownership, update the F18 audit status and remediation report, and stop temporary services. State any verification limits precisely.

## Verification contract

No deletion based solely on equality. Before removing a file, check consumers and backend authority. A protected route must not become an unguarded web adapter. Backend startup, MFA, revocation, tenant and upload boundaries remain enforced. Generated-contract checking must fail on stale or missing files without a mutating sync step hiding drift. Tests use disposable local fixtures; clear database/Redis environment variables before ordinary Vitest because its global teardown can otherwise target a configured database.
