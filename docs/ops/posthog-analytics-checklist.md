# PostHog product analytics (Layer A)

## Required env

| Variable                                     | Where    | Purpose                                                     |
| -------------------------------------------- | -------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`                    | Frontend | Browser SDK project key                                     |
| `NEXT_PUBLIC_POSTHOG_HOST`                   | Frontend | Default `https://eu.i.posthog.com` (EU project)             |
| `POSTHOG_SERVER_KEY` / `POSTHOG_SERVER_HOST` | Backend  | Server capture; host defaults to `https://eu.i.posthog.com` |
| `POSTHOG_HOST` (legacy)                      | Backend  | Prefer `POSTHOG_SERVER_HOST`; document EU in `.env.example` |

## Consent

- Browser capture is gated on `analyticsConsent` from member privacy preferences (`AnalyticsConsentBridge`).
- Without consent, `captureApprovedClientEvent` is a no-op.
- Only taxonomy-approved event names and properties are allowed.

## Staging checklist

1. Enable consent for a test member.
2. Trigger diagnostic start/complete, landing CTA, readiness view, certificate verify.
3. Confirm events appear in PostHog (approved names only).
4. Confirm server outbox mapped LMS events still flow via `posthog.product-analytics` worker.
