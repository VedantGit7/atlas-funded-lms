# F13 — Content Security Policy remediation

Date: 2026-09-20. Scope: local implementation and verification; no deployment or production flag change.

## Changes

- Fresh cryptographic nonces bind each web document's response policy, Next renderer and trusted theme script. Spoofed request policies/nonces are replaced; HTML is dynamic and private/no-store.
- Replaced blanket HTTPS permissions with exact known/configured origins. Production scripts do not permit unsafe-inline or unsafe-eval. Only local development permits the eval/WebSocket exceptions required by development tooling. Tenant marketing HTML does not receive the trusted nonce.
- Added bounded, rate-limited violation collection with structured, reduced telemetry. Reports cannot consume the ordinary public-read allowance.
- Removed static global CSP because the installed Next response sender can let it override a route's policy. Both apps now preserve the enforced opaque SCORM sandbox and narrowly allow its same-origin framing. Embedded forms receive their own same-origin framing exception; other pages retain DENY.
- Added regression coverage and an operator [rollout runbook](../runbooks/content-security-policy.md), including provider configuration, monitoring, acceptance and rollback.

## Verification and evidence

Evidence lives under [audits/2026-09-20](audits/2026-09-20). The initial policy, report parsing, header precedence and later configuration regressions were observed failing before their fixes. Unit coverage checks nonces, spoofing, production/development differences, rejected origins, isolated SCORM headers, report sanitization/limits and collection rate limits. Runtime sender tests use the installed Next response implementation rather than assuming configuration precedence.

- Broad regression run: 2,822 tests passed, one skipped, and one CI guard failed only because the sandbox could not read the existing pnpm cache. That guard passed on the authorized isolated retry: 2,823 passing checks across those runs. Evidence: `f13-regression.log`, `f13-ci-retry.log`. This broad checkpoint preceded the final quota/type refinements.
- After the final refinements: all 351 tests in the affected API/web/SCORM suites passed (`f13-focused-final.log`). This includes the collector's dedicated-quota isolation regression and protected login/refresh nonce paths. These overlap the broad run; do not add the counts as unique tests.
- Whole-workspace `tsc -b` and scoped ESLint passed (`f13-typecheck-final.log`, `f13-lint-final.log`). Initial exact-optional-property errors were fixed rather than suppressed. Route metadata, audit compliance, package export and secret guards passed.
- The repeatable `node scripts/security/verify-csp-browser.mjs` proof passed eight checks in Chrome 153: trusted nonce execution, blocked inline/event-handler injection, actual browser CSP report delivery, fresh document nonces, functional same-origin form framing, denied ordinary framing, and no external page requests. The fixture uses the actual production policy builder; it does **not** exercise Next hydration, the API collector deployment or authenticated LMS journeys. Collector behavior is separately covered by route tests. See `f13-browser-final.log`.
- Independent review identified shared public-read/report throttling; the new isolated bucket and regression resolved it. Review found no further high-confidence implementation defect. Source hashes in `f13-source-hashes.json` identify the reviewed local files; this is not deployment evidence.

## Remaining release acceptance

F13 is **implemented locally, pending rollout and full acceptance**. The default remains report-only deliberately; it does not block malicious scripts until the explicit enforcement flag is enabled. F11 still lacks a working hosted candidate for authenticated journey validation. No claim is made that live checkout, OAuth, video, proctoring or admin/learning journeys passed under enforcement.

Code review uncovered two pre-existing functional gaps: SCORM progress relies on parent-window access that the secure opaque sandbox denies, and certificate iframe embeds conflict with ordinary DENY framing. The 2026-09-26 local follow-up removes the unsupported certificate iframe offer and its snippet helper while retaining direct-link and social sharing. Verification pages retain DENY; external certificate embedding remains unsupported until authorized origins and a dedicated embedding design are defined.

SCORM remains open. The player exposes only the SCORM 1.2 parent API, constructs it before the asynchronous saved-CMI load completes, and has no validated message bridge or SCORM 2004 API. Package files are served unchanged through a query-based content URL, so normal relative script/style/media paths do not map to the package content endpoint. Resolve authorized package asset routing, local synchronous SCORM APIs inside the opaque document, a bounded message bridge tied to the active iframe, and saved-state initialization before claiming progress/resume compatibility. Keep the sandbox intact. Raw inline marketing scripts must also be migrated before enforcing in deployments that use them. See the runbook's staged acceptance matrix.

The 2026-09-26 Chrome 154 diagnostic `node scripts/security/verify-scorm-auth-boundary.mjs` also reproduces a deeper asset-authorization blocker using the real production sandbox headers: the iframe navigation receives a fixture SameSite=Lax session cookie, but an opaque document's relative script request is cross-site, omits that cookie and receives 401 from the fixture's cookie-protected asset endpoint. Parent DOM, cookies and localStorage remain inaccessible. This verifies isolation and a compatibility failure, **not working SCORM**. A path-based route alone cannot solve it. A scoped package-read authorization design must define key management, expiry/renewal, revocation and tenant/enrollment revalidation before runtime or asset-route work proceeds; no bearer capability or new authentication route was added in this follow-up.

**Update (audit H2):** SCORM playback is now implemented as described in the [CSP runbook](../runbooks/content-security-policy.md#scorm-playback-audit-h2): per-launch package-read capabilities, per-file re-authorization, an in-document SCORM 1.2/2004 runtime and a validated bridge. `verify-scorm-auth-boundary.mjs` was replaced by `verify-scorm-runtime-bridge.mjs`, which verifies the working design in Chromium. Nested SCO frames remain unsupported.

Local follow-up verification: 60 tests passed across the existing CSP policy, report collector and SCORM header suites; six passed and one existing worker-gate test skipped across certificate sharing and structure suites. The new real-component sharing regression failed on the unsupported iframe offer before the cleanup and passed afterward. These focused checks do not establish hosted enforcement or authenticated/provider acceptance.

SEC-01 remains open, with the original owner and expiry, until a working deployed candidate completes those checks and enforcement is enabled. No additional security exception was introduced.
