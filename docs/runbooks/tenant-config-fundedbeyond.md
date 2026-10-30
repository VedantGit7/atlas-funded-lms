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

1. In the platform console, open the tenant's **Domains** tab and add `academy.fundedbeyond.com`. It is added pending, with a TXT record to create.
2. In Cloudflare, create the TXT record shown (`_atlas-verify.academy.fundedbeyond.com`). Point `academy` at the server with a proxied record, and add it to the Full (strict) and HTTPS rules (`coolify-deployment.md`, "TLS and DNS"). The origin certificate already covers it.
3. **Verify** in the console. The domain becomes active only when the TXT record matches.
4. **Make primary**, so invitation and email links use it. Then send the owner invitation (`platform-operator-access.md`, "On a fresh environment").
5. Record audit review and run tenant smoke on the branded host.
6. Rollback: disable domain, revert DNS, keep tenant data intact; no fallback tenant behavior.

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
