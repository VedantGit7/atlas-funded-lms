# PostHog product analytics (Layer A)

## Required env

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_POSTHOG_KEY` | Frontend | Browser SDK project key |
| `NEXT_PUBLIC_POSTHOG_HOST` | Frontend | e.g. `https://eu.i.posthog.com` |
| `POSTHOG_API_KEY` / `POSTHOG_HOST` | Backend worker | Server outbox → PostHog (see `@atlas/observability` posthog server) |

## Consent

- Browser capture is gated on `analyticsConsent` from member privacy preferences (`AnalyticsConsentBridge`).
- Without consent, `captureApprovedClientEvent` is a no-op.
- Only taxonomy-approved event names and properties are allowed.

## Staging checklist

1. Enable consent for a test member.
2. Trigger diagnostic start/complete, landing CTA, readiness view, certificate verify.
3. Confirm events appear in PostHog (approved names only).
4. Confirm server outbox mapped LMS events still flow via `posthog.product-analytics` worker.
