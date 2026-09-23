# F11 implementation and live acceptance tracking

Scope: diagnose the failed deployment, fix concrete build/routing failures, document service ownership, harden verification and establish live acceptance where configured resources permit it.

## Completed

- Inspect actual Vercel build log through signed-in browser after the connector failed; identify the install-time Prisma credential requirement.
- Correct and verify the Vercel monorepo Root Directory.
- Separate credential-free Prisma generation from credential-required migrations; test with the real CLI against a disposable fixture.
- Authenticate web-to-API tenant forwarding, reject redirects on credential-bearing fetches, fix platform Origin comparison and OAuth session-cookie relay; add regression coverage.
- Require a dedicated proxy secret in deployed web/API configuration.
- Strengthen release-health validation and test timeout, redirect, release/schema and optional preview-bypass behavior.
- Test authorization of all three cron handlers without executing provider effects.
- Inspect preview protection, domains, environment variables, scheduling and Supabase project metadata; document the observed service map and rollout prerequisites.
- Run combined tests, typecheck, scoped lint/format and architecture guards; retain evidence and final source hashes.

## Open live acceptance

- Identify/provision API and persistent worker hosting, restricted application database, Redis, R2, SMTP and monitoring for isolated staging.
- Populate verified environment configuration and choose a scheduler compatible with the 15-minute report requirement.
- Build/deploy the reviewed source, then prove canonical tenant/platform routing, anonymous/authenticated browser journeys, persistent assets, healthy worker and scheduled execution against the actual deployed SHA.
- Assign custom domains and replace the existing Cloudflare-facing redirect only after a healthy candidate exists.

These items require real infrastructure/configuration and, for hosting/plan choices, owner input. Local unit tests cannot close them. Detailed acceptance and rollback are in `docs/runbooks/deployment-topology.md`.
