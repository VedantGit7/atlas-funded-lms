# Better Stack Monitor Template

Configure monitors manually in Better Stack. Do not automate dashboard mutation from CI.

## HTTP uptime monitor

- **Name:** Atlas LMS Health (`{{ENVIRONMENT}}`)
- **URL:** `https://{{TENANT_OR_PLATFORM_HOST}}/api/v1/health`
- **Method:** GET
- **Expected status:** 200
- **Header check:** `x-request-id` present
- **Frequency:** 1 minute
- **Regions:** primary + secondary

## Worker heartbeat monitor

- **Name:** Atlas LMS Worker Heartbeat (`{{ENVIRONMENT}}`)
- **Type:** Heartbeat
- **URL:** value from `BETTER_STACK_WORKER_HEARTBEAT_URL` secret (never commit)
- **Grace period:** 5 minutes

## Platform host monitor

- **URL:** `https://{{PLATFORM_HOST}}/api/v1/health`

## Active tenant domain monitor

- **URL:** `https://{{TENANT_DOMAIN}}/api/v1/health`

Replace placeholders per environment. Never paste secret URLs into tickets or source control.
