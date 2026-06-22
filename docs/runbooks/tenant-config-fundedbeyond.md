# FundedBeyond Tenant Configuration Runbook

## Scope

This runbook covers manual production steps for Tenant #1 (`fundedbeyond`) using the generic tenant configuration tooling introduced in ATL-STORY-044. Runtime product code must not contain FundedBeyond forks.

## Preconditions

- Story 043 observability gates are complete on `main`.
- Platform operator has `platform.tenant.manage`, `platform.entitlement.manage`, and tenant admin permissions.
- Approved branding assets are uploaded through the existing storage/branding workflow (storage reference IDs only; never commit raw URLs or keys).
- Legal team approval reference is available before readiness/CTA publish.

## Configuration source

- Manifest: `configs/tenants/fundedbeyond/manifest.json`
- Tooling: `pnpm tenant-config:*` scripts backed by `@atlas/tenant-config` and `scripts/tenants/*`

## Local / staging validation

```bash
pnpm tenant-config:validate -- --tenant fundedbeyond
pnpm tenant-config:plan -- --tenant fundedbeyond --environment development
pnpm tenant-config:apply -- --tenant fundedbeyond --environment test
pnpm tenant-config:verify -- --tenant fundedbeyond --environment test
```

## Production plan (no mutation)

```bash
pnpm tenant-config:plan -- --tenant fundedbeyond --environment production --production-plan-only
```

Production apply is refused by default. Execute the printed plan through approved Platform Console operations.

## Production domain: `academy.fundedbeyond.com`

1. Ensure `branding.custom_domain.enable` entitlement is granted.
2. Create domain record via approved domain admin API/console using manifest hostname.
3. Complete DNS TXT verification per existing `tenant_domains` workflow.
4. Complete Vercel domain verification and SSL issuance (manual provider operations).
5. Activate domain only after verification status confirms success.
6. Record audit review and run tenant smoke on the branded host.
7. Rollback: disable domain, revert DNS, keep tenant data intact; no fallback tenant behavior.

## Legal / readiness gate

- Manifest starts with `readiness.legalApproval.status = pending_approval`.
- Do not supply CTA or legal copy in the manifest until legal approval is granted.
- After approval, update manifest with `status: approved`, `reference`, `ctaPolicy.ctaCopy`, and `legalCopy`, then re-apply through approved operator workflow.
- Never expose legal approval reference in browser state or public APIs.

## Branding

- Upload approved logo/theme assets via existing branding workflow.
- Update manifest `logo*StorageRefId` fields with operator-supplied UUID references.
- Publish branding only through existing human review/publish flow.

## Smoke checklist

- Host resolves to `fundedbeyond` tenant only.
- Public diagnostic is tenant-scoped.
- Readiness CTA uses `https://fundedbeyond.com` with attribution token path only.
- Community spaces remain membership-gated.
- No challenge checkout, payment, or trading account surfaces.

## Rollback

- Disable custom domain and revert DNS.
- Set readiness policy to `INACTIVE`.
- Do not delete tenant data during rollback.
