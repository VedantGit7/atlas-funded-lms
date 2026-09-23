# Content Security Policy rollout (F13)

Status: implementation prepared locally; production enforcement and full journey acceptance remain pending. `CSP_ENFORCE=0` (or unset) reports violations; `1` enforces. Other nonempty values fail instead of silently weakening the policy. Changing the flag requires restarting/redeploying the web application. Report-only is not XSS prevention.

## What the application now supplies

The web proxy generates a fresh 144-bit cryptographic nonce for each document request, strips client-supplied CSP/nonce headers, and forwards its own request policy so Next can nonce framework scripts. The root layout reads request headers and gives that nonce to the trusted theme initializer. HTML is dynamic and marked private/no-store; do not add CDN HTML caching without redesigning nonce handling. Static framework assets retain their normal cache behavior.

Production script policy has no unsafe-inline, unsafe-eval, blanket HTTPS or strict-dynamic. Exact script origins support approved loaders without transitively trusting every script recreated from tenant marketing HTML. This remains defense in depth: same-origin executable uploads or a compromised allowed provider could undermine source allowlists. Preserve sanitization, correct upload content types, and SCORM isolation.

Inline styles remain allowed for tenant themes and component styles. Local development alone permits eval and WebSocket schemes for Next development tooling. Preview/staging/production indicators disable these development exceptions. Camera/microphone remain permitted to the same origin for proctoring; browser consent still applies.

## Provider inventory and configuration

| Usage                              | Allowed sources / operator action                                                                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App scripts, API, fonts and assets | Same origin; Next fonts are locally served.                                                                                                                                                                                 |
| Supabase                           | Exact `NEXT_PUBLIC_SUPABASE_URL` origin for images/connections and its matching WebSocket origin.                                                                                                                           |
| Browser error reports              | Origin of `NEXT_PUBLIC_SENTRY_DSN`, with DSN credentials/path excluded. Server-only Sentry does not require browser permission.                                                                                             |
| PostHog                            | Enabled when the browser project key is configured; exact configured host, default EU ingestion, and the known EU/US assets host. Custom proxies must serve required assets themselves or have explicit additional sources. |
| Storage                            | Exact `R2_PUBLIC_ENDPOINT` origin and account endpoint from `R2_ACCOUNT_ID`. Inventory every custom asset/CDN host and browser upload destination.                                                                          |
| Razorpay                           | `checkout.razorpay.com` scripts; checkout/API frames; `api.razorpay.com` connections. Complete sandbox checkout before enforcement; provider features may require additional reviewed origins.                              |
| Video                              | YouTube `www.youtube.com` and Vimeo `player.vimeo.com` frames. Review any alternate/privacy-enhanced/video CDN hosts in actual content. Bunny currently opens an external link.                                             |
| Stripe / OAuth                     | Current flows use top-level redirects; this is not proof that every provider journey works. Test callbacks, popups and COOP behavior on the candidate.                                                                      |
| Marketing integrations             | Never automatically nonce tenant snippets. Raw inline tracking snippets will be blocked on enforcement; migrate to approved external scripts or separately reviewed application-owned integrations.                         |

`CSP_SCRIPT_ORIGINS`, `CSP_IMAGE_ORIGINS`, `CSP_MEDIA_ORIGINS`, `CSP_CONNECT_ORIGINS`, and `CSP_FRAME_ORIGINS` accept comma/whitespace-separated **exact HTTPS origins** (maximum 32 / 4,096 characters per list). Paths, credentials, queries, fragments, wildcard hosts, directives and HTTP destinations are rejected. These are deployment-wide grants: do not add arbitrary tenant-supplied hosts automatically. Each grant needs a provider purpose and the narrowest applicable directive. Provider variables are parsed to origins; never paste secrets into these lists.

## Reports and operational use

`POST /api/v1/public/security/csp-report` receives legacy CSP and Reporting API JSON envelopes. Policy uses the broadly supported `report-uri` directive. The collector accepts at most 16 KiB and 10 records, with a five-second body-read deadline. Invalid, oversized and throttled input is rejected before report logging. Successful input returns 204 with no-store.

The dedicated `cspReport` bucket allows 120 requests/minute per trusted client-IP identity; it does not consume public page read quotas. Configure the F04 trusted proxy/IP boundary and shared Redis limiter in deployed environments. Unknown clients share the existing bounded unknown identity. Enforce ingress body limits too; the application cap cannot prevent an upstream proxy from buffering a body first.

Filter structured logs for `message=csp.report.received`, then group by release, document origin, directive, blocked origin and disposition. Reports include fixed source categories and bounded numeric fields; raw policies, samples, referrers, URL paths, query strings, credentials and fragments are discarded. All reports are marked untrusted and are not proof of an attack or authority for automatic allowlisting. Browser extensions, privacy tools and blocked reporting can distort counts. Hostnames can themselves contain identifiers, so logs still require the normal restricted access/retention policy. A public report endpoint is deliberately not a security-audit event source.

## Framing and SCORM

Ordinary pages retain X-Frame-Options DENY and CSP frame-ancestors none. `/f/:token` permits same-origin framing for the existing form modal. `/api/v1/modules/:id/scorm-content` permits same-origin framing while its **separate enforced CSP sandbox omits allow-same-origin**. Both app configs put this narrow framing exception after the baseline. Never add a static global CSP: the installed Next response sender can retain that header instead of the route sandbox or per-request policy.

The existing SCORM player expects direct parent `window.API` access, which an opaque sandbox correctly prevents. A validated postMessage bridge and SCORM-version implementation are still required to prove completion/progress tracking; adding allow-same-origin is not an acceptable workaround. SCORM 2004's declared support also needs verification. The public certificate view advertises an external iframe embed but ordinary framing headers deny it; define authorized embedding origins before offering that capability. These are pre-existing acceptance gaps, not grounds to weaken all pages.

## Staged acceptance and rollback

1. Restore the deployable web/API topology described in F11. Deploy this candidate in report-only mode with actual provider origins and shared rate limiting. Confirm web-to-API rewrites deliver the report route and preserve the SCORM sandbox.
2. Exercise login/password reset/OAuth, learner lesson navigation/video/assessment, admin and platform operations, checkout, consent/analytics, tenant custom assets, forms, and proctoring camera/microphone. Inspect policy responses, reports, and browser errors; add only documented necessary origins. Verify refresh, direct loads and client-side navigation.
3. Resolve the SCORM parent API bridge and certificate embedding capability gaps. Verify package scripts remain opaque and cannot read parent cookies/DOM while completion tracking persists correctly.
4. Turn on `CSP_ENFORCE=1` in staging, repeat journeys and submit a controlled nonce-free inline script/event-handler fixture. Confirm the scripts do not execute, trusted theme/framework hydration still works, reports arrive, normal pages reject framing, and permitted forms/SCORM still frame correctly. Keep a saved candidate/release/provider inventory with the results.
5. Roll out enforcement to production only after the above acceptance, and watch failures against the baseline. Do not interpret zero reports as proof of safety. The emergency rollback is `CSP_ENFORCE=0` plus redeploy; record the incident and correction because this removes document CSP enforcement. The separate SCORM sandbox must stay enforced throughout.

No production environment flags are changed by this local implementation. SEC-01 remains open until enforcement and the journey evidence are complete.
