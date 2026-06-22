# Release Health Runbook

## Command

```bash
pnpm release:health -- --base-url "$RELEASE_HEALTH_BASE_URL"
```

Optional:

```bash
pnpm release:health -- --base-url "$RELEASE_HEALTH_BASE_URL" --expected-release "$RELEASE_HEALTH_EXPECTED_RELEASE"
```

## Checks performed

- Health endpoint returns 2xx twice
- Each response includes unique `x-request-id`
- Response JSON matches approved health schema
- Optional release identifier match
- Prints rollback target from `RELEASE_SHA` or `RELEASE_VERSION`
- Emits machine-readable JSON

## Staging smoke

Set `OBSERVABILITY_SMOKE_ENABLED=true` to run staging smoke wrapper:

```bash
node scripts/observability/staging-smoke.mjs --base-url "$RELEASE_HEALTH_BASE_URL"
```

Never aim release health at production unless executing an approved release action.
