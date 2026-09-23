# F05 deployment configuration remediation

**Status: implemented and verified locally on 20 September 2026. Production rollout and live provider acceptance checks remain pending.**

## Approved objective and implementation plan

The user requested F05 from the comprehensive audit. Reject incomplete or misleading deployed configuration before the web app, API or outbox worker accepts work. Preserve F01–F04 and local development. No deployment, credential rotation or provider configuration changes are part of this working-tree fix.

Use one pure deployment contract in `@atlas/core/config`, composed with the existing Redis/proxy validator by `@atlas/api/deployment-startup`. Both Next.js Node instrumentation hooks and worker startup call this entry point. Shared deployed-runtime detection also closes lazy storage/email/observability bypasses. Prefer this over isolated fixes that can drift, or network-dependent probes on every serverless cold start. Connectivity and persistence are separate release checks; configuration validity must never be presented as proof that a provider is reachable.

Deployed signals include NODE_ENV=production, APP_ENV or RELEASE_ENV production/staging, and Vercel deployment indicators. Deployed runtimes require explicit APP_ENV=production|staging; dev/test labels cannot bypass that requirement. Local dev/test defaults remain available when no deployed signal exists. Unknown explicit APP_ENV is invalid. Errors list variable names and safe reasons, never submitted values or credentials.

Contract groups: persistent R2 storage and explicit bucket/credentials; distinct runtime database logins with known owner/group names rejected and explicit TLS; canonical public/internal origins and platform host; Supabase server/browser settings; cryptographic secrets; SMTP settings; cron/worker credentials and worker heartbeat; release identity and error monitoring. Open Badge signing material is required when issuance is enabled. F04 Redis/proxy rules are preserved, with deployment detection extended to the common helper.

- [x] Reproduce NODE_ENV/provider bypass and missing startup prerequisites with failing tests.
- [x] Add shared environment detection, safe configuration errors and deployment contract.
- [x] Wire both apps and worker before readiness; validate lazy providers before cached instances are returned.
- [x] Add a read-only configuration preflight command using the same contract and update environment documentation.
- [x] Run focused and broader regressions, TypeScript, lint, package/route guards and independent review.
- [x] Record verification, remaining deployment connectivity/persistence checks and source hashes.

## Result

Both Node server startup hooks and the worker use `validateDeploymentStartup`. Missing or unsafe deployed settings fail before requests/worker health readiness. The command `pnpm check:deployment api` (also `web` and `worker`) runs the same validator without contacting providers. It prints safe variable-level errors, never submitted secret values, and explicitly reports `connectivityVerified: false`.

Independent deployment signals prevent a missing or misleading `APP_ENV` from enabling local storage, mock email, memory rate limits or missing monitoring salt. Storage validates its real provider schema at startup. Returning a cached development provider cannot bypass deployed restrictions. DB URL query overrides and duplicates are rejected so validated username/TLS settings cannot be replaced by driver parameters. Public Supabase settings reject privileged JWTs and secret keys.

The frontend's mock-only email module now reuses the backend SMTP implementation. Frontend notification and report delivery preserve tenant usage attribution. Deployed SMTP requires TLS. Server Sentry settings handle blank public DSN/release values correctly; the worker initializes server monitoring and reports successful empty sweeps to the heartbeat endpoint.

## Verification

Evidence directory: [audits/2026-09-20](audits/2026-09-20/). Test counts below overlap and must not be added together.

| Check                                                                                                     | Observed result                                                                              | Evidence                                                |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Initial startup/storage reproduction                                                                      | 43 failed, 2 passed before remediation; expected failures now covered by passing final tests | `f05-red.log`                                           |
| Initial email/monitoring reproduction                                                                     | 5 failed, 28 passed before provider fixes                                                    | `f05-provider-red.log`                                  |
| Initial frontend SMTP reproduction                                                                        | 1 failed before frontend provider bridge                                                     | `f05-web-email-red.log`                                 |
| Broad offline regression: unit, security, lint rules, events                                              | 323 files passed; 2,425 tests passed, 1 skipped                                              | `f05-offline-tests.log`                                 |
| Final focused regression after review/type fixes: deployment, notifications, reports, worker, F04 startup | 52 files passed; 427 tests passed                                                            | `f05-final-tests.log`                                   |
| TypeScript project build                                                                                  | Exit 0                                                                                       | `f05-typecheck.log`                                     |
| ESLint on changed TypeScript                                                                              | Exit 0                                                                                       | `f05-lint.log`                                          |
| Route metadata, package exports, frontend API closure, observability guards                               | All four exited 0                                                                            | `f05-guards.json`                                       |
| Local configuration preflight using existing `.env.local`                                                 | Passed, development, no provider connectivity claimed                                        | `f05-local-preflight.log`                               |
| Synthetic deployed preflight subprocess                                                                   | Valid config succeeds; invalid DB URL fails with redacted output                             | `deployment-preflight.test.ts`, included in final tests |
| Local HTTP request via loopback with platform Host header                                                 | HTTP 200, sign-in content, no detected build/server error; unauthenticated request           | `f05-local-http.json`                                   |
| Independent final code review                                                                             | No substantive remaining findings in F05 scope; prior bypass findings reproduced and closed  | `f05-review.md`                                         |

The broad suite ran before the last type-narrowing and report tenant-attribution edits; the final focused suite and TypeScript/lint ran after them. Historical intermediate failed logs remain for traceability. The browser extension timed out during the authenticated visual check, so no authenticated browser verification is claimed for F05. The local hostname was not resolved by the direct HTTP client; the loopback request with the correct Host header succeeded. No production build or live provider integration suite was run for this remediation.

Workspace linking used the frozen lockfile, offline cache and disabled lifecycle scripts. Only existing workspace dependency links were added; no external package versions changed. Regression runs excluded ambient database/Redis URLs to avoid using the development database during test teardown.

## Deployment acceptance still required

Follow [the deployment configuration runbook](../runbooks/deployment-configuration.md) with actual staging secrets. The shared validator checks settings, not actual credentials, grants, certificates, network connectivity, bucket permissions or alert delivery. Verify DB grants/RLS and transport, Redis sharing/edge trust, SMTP delivery, worker processing/heartbeat, Sentry receipt, canonical routing, and a real test upload surviving instance replacement. Wallet/blockchain provider credentials need separate feature verification.

No production deployment, credential rotation, role/bucket creation, email delivery or R2 write was performed. The original F05 persistence acceptance criterion remains a release gate, and the audit is marked accordingly. Prior F01–F04 changes remain in the working tree.
