# F06 outbound request remediation

**Status: implemented and verified locally on 20 September 2026. Deployment, real provider staging checks and infrastructure egress controls remain pending.**

## Approved objective and implementation plan

The user requested F06 from the comprehensive audit: close the gap between DNS validation and the actual outbound connection for tenant-configured webhook destinations. Preserve F01–F05 and existing caller signatures. No deployment or network policy changes are included.

Use Node HTTP/HTTPS with a per-request, pinned lookup result. Resolve all addresses once, reject the entire result if any address is non-public, and connect only to a vetted address. Keep the original hostname for Host/SNI/certificate identity; explicitly require certificate verification. Disable shared agents and automatic address-family selection so no alternate resolver or reused socket escapes the decision. Do not follow redirects or accept caller-supplied transport overrides.

This implements the audit's approved design. A second DNS check would retain a race; a separate proxy is useful defense in depth but would require new infrastructure. Native Node transport avoids introducing an additional HTTP dependency here. Retain HTTP compatibility for existing consumers; production integrations should use HTTPS. Optional destination allowlisting is deployment-controlled through `OUTBOUND_ALLOWED_HOSTS`, with exact host matching and no tenant-controlled bypass.

Bound the complete DNS/upload/headers/body operation to 15 seconds, or earlier caller cancellation. Buffer at most 1 MiB for each request/response; request identity encoding and reject unexpected encoded responses to avoid decompression bombs. Cap response headers at 16 KiB. The four current consumers send JSON and inspect HTTP status, so buffering within these limits preserves their usage. Errors must never include full destination URLs, credentials or payloads.

Files: separate address/URL policy into `backend/packages/security/src/outbound-policy.ts`, keep public exports and orchestration in `safe-outbound-fetch.ts`, and put the native transport in `pinned-outbound-transport.ts`. Add controlled DNS/transport regressions and local socket tests under `tests/unit/security` and `tests/integration/security`. Update the audit and add an operational runbook with egress requirements and remaining staging checks.

- [x] Reproduce DNS mixed-answer/pinning, IPv6 representation, timeout and body-limit gaps with failing tests.
- [x] Implement strict address classification, single-resolution pinning, hostname verification, cancellation and bounded transport.
- [x] Verify existing call signatures, native sockets, redirects, malicious headers/options, size limits and slow responses.
- [x] Run focused and broader regressions, TypeScript, lint and package guards; obtain independent security review.
- [x] Record evidence, source hashes and rollout limitations.

## What changed

Previously, `assertOutboundUrlAllowed` checked one DNS answer and then `fetch` resolved the name independently. The validated address was not bound to the connection. The new helper resolves all returned addresses once, rejects a mixed public/private answer set, and supplies the approved address through the native socket lookup callback. The original hostname is retained for Host/SNI and certificate verification. Public IP literals skip DNS but still pass the same address policy.

The address classifier now handles expanded/compressed IPv6 numerically, IPv4-mapped addresses, transition ranges and special-purpose/documentation space. Redirects, routing/framing header overrides and caller-supplied transport options cannot redirect the connection. TLS verification is explicitly enabled. Native agents are fresh and direct; installed Node source confirmed that the environment-proxy flag only configures global agents, which are not used here.

A 15-second deadline spans DNS, upload preparation, connection, headers and complete body consumption; earlier caller cancellation wins. Requests/responses are limited to 1 MiB and response headers to 16 KiB. Identity encoding is requested and compressed responses are rejected. Every completed or failed socket operation is explicitly closed, including an early response received before an upload drains. The returned Response contains a bounded buffered body, status, headers and original URL.

The four existing marketing/report webhook call sites already use the shared helper, so they inherit the fix without changing their signatures or tenant payloads. The previous redirect tests that stubbed global fetch were moved to native-transport fixtures; address tests now mock DNS to remain offline. A deployment-wide optional exact hostname allowlist is documented in `.env.example`.

## Verification and evidence

Evidence directory: [audits/2026-09-20](audits/2026-09-20/). Counts overlap; do not add them together.

| Check                                                                         | Observed result                                                                                                                    | Evidence                |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Pre-fix regression reproduction                                               | 27 failures, 3 passes; the missing DNS deadline also caused an initial timeout/teardown error. These cases pass after remediation. | `f06-red.log`           |
| First pinning/bounds implementation                                           | 30 tests passed                                                                                                                    | `f06-first-green.log`   |
| Early-response socket cleanup reproduction                                    | Expected failure before explicit successful-request destruction                                                                    | `f06-cleanup-red.log`   |
| Final focused security, socket, reports and marketing outbox checks           | 43 files, 378 tests passed                                                                                                         | `f06-focused.log`       |
| Broad unit/security/lint-rule/event suite plus outbound socket integration    | 326 files passed; 2,483 tests passed, 1 skipped                                                                                    | `f06-offline-tests.log` |
| TypeScript project build                                                      | Exit 0                                                                                                                             | `f06-typecheck.log`     |
| ESLint on six changed/new TypeScript files                                    | Exit 0                                                                                                                             | `f06-lint.log`          |
| Route metadata, package exports, frontend API closure, observability contract | All four guards passed                                                                                                             | `f06-guards.json`       |
| Independent final security review                                             | No substantive outstanding concerns; reviewer separately ran 91 outbound tests successfully                                        | `f06-review.md`         |

Local socket tests verify actual HTTP authority/body transmission, pinned connection behavior, successful TLS with original-host SNI, rejection of untrusted and hostname-mismatched certificates before HTTP payload delivery, redirect handling, oversized headers and declared/chunked bodies, stalled headers, slow trickles, truncation, HEAD and bodyless responses. DNS rebinding, mixed records, IPv6 pinning, allowlists, caller overrides and whole-operation deadlines are covered with controlled DNS/transport fixtures. The low-level adapter receives loopback addresses only within the isolated socket tests; the public helper still rejects them. No production test bypass flag exists.

Review found newer TLS trust-store APIs in the first test version; tests now use a Node-22-compatible test-only CA wrapper while retaining real TLS verification. Review also prompted explicit request destruction on successful early responses. Local checks ran on Node 24.11.1; CI's Node 22.13.1 execution remains pending. Test fixtures include a deliberately public synthetic TLS private key that must never be deployed.

No dependencies were added, and no database migration was needed. Tests ran without ambient database/Redis URLs to avoid accidental development-database teardown. No production build, hosted deployment, real webhook delivery or infrastructure mutation was performed. Prior F01–F05 working-tree changes remain intact.

## Operational tradeoffs and release requirements

See [the outbound webhook runbook](../runbooks/outbound-webhooks.md). Existing integrations must return an uncompressed acknowledgement within the new limits, use final URLs without redirects, and resolve entirely to approved public addresses. HTTP compatibility remains; prefer HTTPS in deployment. One selected address and fresh sockets trade connection pooling/fallback efficiency for a clear validated connection boundary. The OS DNS lookup may complete after cancellation, but it cannot dispatch a late HTTP request.

The optional allowlist defaults to unrestricted public hosts for existing SaaS integrations. Configure it after inventorying expected destinations. Network egress filtering across IPv4/IPv6 and permitted ports is still required as defense in depth: code cannot establish how a hosting network routes public-looking addresses. Validate real provider compatibility, retries, signatures and failure monitoring in staging before deployment. The full external delivery workflows and hosting firewall behavior were not exercised locally.
