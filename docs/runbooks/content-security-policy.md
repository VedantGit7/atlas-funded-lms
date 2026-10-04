# Content Security Policy rollout (F13)

Status: deployed web must enforce (audit H5). `CSP_ENFORCE=1` enforces; `0` (or unset) only reports, and deployment validation refuses a deployed web service that is not enforcing unless `CSP_REPORT_ONLY_INCIDENT` names the incident that justified rolling back. Other nonempty values fail instead of silently weakening the policy. Changing the flag requires restarting/redeploying the web application. Report-only is not XSS prevention.

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

## Tenant code snippets (audit H5)

Marketing integrations let a tenant admin add HTML and script (site body, order tracking, signup tracking). That code runs in this origin, with the authority of whoever is viewing the page. Three controls bound it:

- **Where it runs.** Only on public and learner pages, decided by `frontend/apps/web/src/features/marketing/snippet-scope.ts`. It never runs on staff areas (`/admin`, `/studio`, `/platform`, `/moderate`, `/review`), on credential pages (`/login`, `/signup`, `/reset-password`, `/invite`, `/auth`, `/verify-email`), or on account security (`/profile`, `/settings`). Supabase accounts span tenants, so a password typed on one tenant's page also opens that person's accounts elsewhere. Every top-level route must be classified, and a structure test fails on an unclassified one. Injected code cannot be unloaded, so a document that has run snippets turns any navigation into those areas into a full page load. Signup tracking fires on the first page after signup completes (the `signupComplete` marker), never on the signup form.
- **Who it runs for.** `GET /api/v1/public/marketing/integrations/snippets` returns nothing to a signed-in viewer holding any role beyond learner, and nothing when a presented session cannot be verified. It is `private, no-store` with `Vary: Cookie`.
- **What it can do.** With `CSP_ENFORCE=1`, recreated snippet scripts get no nonce: inline snippet code is blocked, and external scripts run only from `CSP_SCRIPT_ORIGINS`. Package JavaScript cannot be pulled into app pages either; the SCORM route refuses same-origin subresource requests.

Editing snippets requires step-up MFA and is audited (audit H4).

## Reports and operational use

`POST /api/v1/public/security/csp-report` receives legacy CSP and Reporting API JSON envelopes. Policy uses the broadly supported `report-uri` directive. The collector accepts at most 16 KiB and 10 records, with a five-second body-read deadline. Invalid, oversized and throttled input is rejected before report logging. Successful input returns 204 with no-store.

The dedicated `cspReport` bucket allows 120 requests/minute per trusted client-IP identity; it does not consume public page read quotas. Configure the F04 trusted proxy/IP boundary and shared Redis limiter in deployed environments. Unknown clients share the existing bounded unknown identity. Enforce ingress body limits too; the application cap cannot prevent an upstream proxy from buffering a body first.

Filter structured logs for `message=csp.report.received`, then group by release, document origin, directive, blocked origin and disposition. Reports include fixed source categories and bounded numeric fields; raw policies, samples, referrers, URL paths, query strings, credentials and fragments are discarded. All reports are marked untrusted and are not proof of an attack or authority for automatic allowlisting. Browser extensions, privacy tools and blocked reporting can distort counts. Hostnames can themselves contain identifiers, so logs still require the normal restricted access/retention policy. A public report endpoint is deliberately not a security-audit event source.

## Framing and SCORM

Ordinary pages retain X-Frame-Options DENY and CSP frame-ancestors none. `/f/:token` permits same-origin framing for the existing form modal. `/api/v1/public/scorm/:token/:path*` permits same-origin framing while its **separate enforced CSP sandbox omits allow-same-origin**. Both app configs put this narrow framing exception after the baseline. Never add a static global CSP: the installed Next response sender can retain that header instead of the route sandbox or per-request policy.

### SCORM playback (audit H2)

Package files are served as `/api/v1/public/scorm/<capability>/<path in package>`. The player's iframe also carries `sandbox="allow-scripts allow-forms allow-popups"`, so package documents run in an opaque origin even if a proxy drops the header: they cannot read the app's cookies, storage or DOM. Never add `allow-same-origin`.

- **Package-read capability.** The browser sends no session cookie from an opaque origin, so each launch (`GET /api/v1/modules/:id/scorm-launch`) mints a signed capability and puts it in the URL path. Relative references (`scripts/app.js`, `../media/clip.mp4`) then resolve beneath it and carry it automatically. It is scoped to one tenant, membership, module and stored content version, and expires after six hours. Reopening the chapter mints a fresh one. It is signed with `SCORM_CONTENT_SIGNING_KEYS` (see [deployment configuration](deployment-configuration.md)).
- **Every file is re-authorized.** The capability says who and what, not whether. Each request runs one short tenant transaction that rechecks:
  - the membership is active and has `course.read`;
  - the module is a published SCORM module in a published course;
  - the enrollment is active;
  - the stored package is still the version the launch was minted for.

  Revoking any of these takes effect on the next file. Every refusal is the same 404. Storage is read only after the transaction ends, so no pooled connection is held across network I/O. Byte ranges are served for media.

- **Logs and referrers.** The path is a credential. The route logs the fixed name `/api/v1/public/scorm/[token]/[...path]`, never the URL, and package responses send `referrer-policy: no-referrer`. Requests are limited per launch (`scormContent`, 600/minute), so a classroom behind one NAT address does not share a budget.
- **Runtime.** Each package HTML file gets one injected `<script src>` for `.atlas-scorm-runtime.js` beneath the same capability. It is placed after any `<meta charset>`, and the package's bytes and encoding are otherwise untouched. That response carries the runtime and the learner's saved data, with `no-store`. Every document gets a local, synchronous SCORM 1.2 `API` and SCORM 2004 `API_1484_11`, each with the standard data model, validation and error codes, seeded with saved data, entry (`resume` after a suspend) and accumulated time.
- **Bridge.** The runtime reports `hello`, `initialize`, `commit` and `terminate` to the player with `postMessage`, targeted at the app origin. The player:
  - accepts only this launch's protocol, only from its own iframe or frames inside it, with bounded data-model keys and values, and never acts on anything else;
  - attaches its listener before the iframe loads;
  - answers `hello` with the newest saved data, so a multi-page SCO's next document is current;
  - serializes saves (at most one in flight, at least 2 s apart, merged while waiting, backing off on failure);
  - sends a final `keepalive` save when the learner leaves.

  The server merges commits under a row lock and credits session time once, on terminate (capped at 12 hours). It treats a 1.2 `lesson_status` of completed, passed or failed, or a 2004 completion of completed or success of passed, as complete. Completion is sticky. A score is not progress; only 2004's `progress_measure` moves the percentage before completion.

- **App pages cannot run package JavaScript.** The app document CSP allows `'self'` scripts, so `<script src="/api/v1/public/scorm/…/evil.js">` in a tenant snippet would otherwise run author-uploaded code with the app's authority. The route refuses same-origin subresource requests (Fetch Metadata `sec-fetch-site: same-origin` with a non-navigation destination) before doing anything else. Package documents' own requests are cross-site, and the player's iframe load is a navigation.
- **Nested SCO frames are not supported.** An iframe inside a package has an opaque parent, which no `frame-ancestors` source matches; Chromium confirms that even `frame-ancestors *` refuses it. Such packages stay blocked rather than relaxing the framing policy. A multi-page SCO that navigates its own frame works. Supporting nested frames needs a dedicated cookie-less content origin, which would let the package frames share an origin.

`pnpm test:scorm-browser` (`scripts/security/verify-scorm-runtime-bridge.mjs`) runs this in real Chromium with the production sandbox headers, injection, runtime, Fetch Metadata rule and player bridge, against a fixture server. CI runs it in the `browser-smoke` job. It checks:

- isolation;
- cookie-free relative loading;
- resume;
- multi-page refresh;
- impostor-frame rejection;
- the snippet bypass;
- the nested-frame limitation.

The route's database behaviour is covered by `tests/integration/api/scorm-content-capability.test.ts`.

The certificate share dialog now offers direct and social links only; the unsupported external iframe offer and snippet helper were removed in the 2026-09-26 local follow-up. Public verification pages retain ordinary DENY framing. External certificate embedding requires an explicit authorized-origin design and separate acceptance before it can be offered again.

## Staged acceptance and rollback

1. Restore the deployable web/API topology described in F11. Deploy this candidate in report-only mode with actual provider origins and shared rate limiting. Confirm web-to-API rewrites deliver the report route and preserve the SCORM sandbox.
2. Exercise login/password reset/OAuth, learner lesson navigation/video/assessment, admin and platform operations, checkout, consent/analytics, tenant custom assets, forms, and proctoring camera/microphone. Inspect policy responses, reports, and browser errors; add only documented necessary origins. Verify refresh, direct loads and client-side navigation.
3. Resolve the SCORM routing, API bridge, version and resume gaps above. Verify package scripts remain opaque and cannot read parent cookies/DOM while completion tracking persists correctly. Verify certificate direct/social sharing works and no unsupported iframe offer is exposed; ordinary verification-page framing must remain denied.
4. Turn on `CSP_ENFORCE=1` in staging, repeat journeys and submit a controlled nonce-free inline script/event-handler fixture. Confirm the scripts do not execute, trusted theme/framework hydration still works, reports arrive, normal pages reject framing, and permitted forms/SCORM still frame correctly. Keep a saved candidate/release/provider inventory with the results.
5. Roll out enforcement to production only after the above acceptance, and watch failures against the baseline. Do not interpret zero reports as proof of safety. The emergency rollback is `CSP_ENFORCE=0` with `CSP_REPORT_ONLY_INCIDENT=<incident reference>` plus redeploy (deployment validation refuses report-only without it); record the incident and correction because this removes document CSP enforcement. The separate SCORM sandbox must stay enforced throughout.

No production environment flags are changed by this local implementation. SEC-01 remains open until enforcement and the journey evidence are complete.
