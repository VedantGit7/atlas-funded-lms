# Alert Policy

## Severity

| Severity | Examples                                                                                                 | Response                                  |
| -------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| SEV-1    | Health monitor down in production, worker heartbeat missing >10m, error rate spike on auth/tenant routes | Page on-call immediately                  |
| SEV-2    | Release health gate failure in staging, elevated 5xx on non-critical routes                              | Notify platform channel within 15 minutes |
| SEV-3    | Single Sentry issue with low volume, non-production monitor blip                                         | Triage next business day                  |

## Escalation

1. On-call engineer acknowledges within 5 minutes (SEV-1).
2. Escalate to observability owner if unresolved in 30 minutes.
3. Escalate to platform lead if tenant isolation or auth regression suspected.

## Ownership

- Sentry projects: Platform Engineering
- PostHog project: Product Analytics + Platform Engineering
- Better Stack monitors/logs: DevOps / Platform Operations

## Noise controls

- Expected 401/403/404 denials must not page.
- PostHog is product analytics only, not audit or security evidence.
