# Tenant Configuration Production Plan Runbook

## Purpose

Document the manual, redacted production execution path for any tenant manifest. Scripts never silently mutate production.

## Commands

```bash
pnpm tenant-config:validate -- --tenant <slug>
pnpm tenant-config:plan -- --tenant <slug> --environment production --production-plan-only
```

## Operator inputs (runtime only)

- Owner email and display name
- Platform principal ID with provisioning permissions
- Approved branding storage reference IDs
- Legal approval reference (for readiness publish)
- Production DNS/Vercel operator credentials (outside repository)

## Execution order

1. Validate manifest
2. Provision tenant if absent (`POST /platform/tenants`, `seedProfile: EMPTY`)
3. Grant entitlements from manifest
4. Apply branding/theme drafts
5. Record production domain (pending verification)
6. Apply competency/readiness draft configuration
7. Create draft learning paths, certificate templates, badges, and community spaces
8. Verify projection with `tenant-config:verify`
9. Complete manual DNS/Vercel/SSL activation
10. Publish branding/readiness/scoring only through approved human workflows

## Refused operations

- `pnpm tenant-config:apply --environment production` without `--production-plan-only`
- Direct certificate issuance
- Direct notification sends
- Challenge purchase/checkout configuration
- Automatic Funded Trader Program unlocks
