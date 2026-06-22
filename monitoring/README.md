# Atlas LMS Monitoring

Operational observability for Atlas LMS is provider-integrated but manually configured in each environment.

## Scope

- Error tracking: Sentry (server, edge, client, worker)
- Product analytics: PostHog (allow-listed events only)
- Logs and uptime: Better Stack via deployment log drain and HTTP monitors
- Release confidence: `pnpm release:health`

## No secrets in repository

Store DSNs, API keys, heartbeat URLs, and hash salts in deployment secret stores only. `.env.example` lists variable names without values.

## Health endpoint

Use the existing approved endpoint only:

`GET /api/v1/health`

Expected:

- HTTP 2xx
- `x-request-id` response header (`req_<uuid>`)
- JSON body with `ok`, `service`, `status`, `requestId`, optional `environment`, optional `release`

## Request ID correlation

1. Read `x-request-id` from API response or error envelope.
2. Search structured logs and Sentry tags for the same `requestId`.
3. For worker-originated work, also search `parentRequestId`.

Request IDs are correlation aids only. They are not authorization or tenant evidence.

## Manual provider setup

See:

- [better-stack-monitor-template.md](./better-stack-monitor-template.md)
- [alert-policy.md](./alert-policy.md)
- [dashboard-specification.md](./dashboard-specification.md)
- [posthog-event-taxonomy.md](./posthog-event-taxonomy.md)
- [../docs/runbooks/observability.md](../docs/runbooks/observability.md)
