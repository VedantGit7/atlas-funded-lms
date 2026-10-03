# Release Health Runbook

## Command

```bash
pnpm release:health --base-url "$RELEASE_HEALTH_BASE_URL" --expected-release "$RELEASE_HEALTH_EXPECTED_RELEASE"
```

Both the base URL and expected identity are required. They can also be supplied through `RELEASE_HEALTH_BASE_URL` and `RELEASE_HEALTH_EXPECTED_RELEASE`:

```bash
pnpm release:health
```

## Checks performed

- Health endpoint returns 2xx twice
- Each response includes unique `x-request-id`
- Response JSON matches approved health schema
- Required release identifier match on both responses
- Prints rollback target from `RELEASE_SHA` or `RELEASE_VERSION`
- Emits machine-readable JSON

## Staging smoke

Set `OBSERVABILITY_SMOKE_ENABLED=true` to run staging smoke wrapper:

```bash
node scripts/observability/staging-smoke.mjs --base-url "$RELEASE_HEALTH_BASE_URL" --expected-release "$RELEASE_HEALTH_EXPECTED_RELEASE"
```

Never aim release health at production unless executing an approved release action.

Release health is an HTTP identity/liveness observation. It does not establish database readiness, useful worker progress, a completed rollback or restore, alert provider configuration, or human notification receipt. A disabled staging smoke is skipped evidence, not a successful deployment check.
