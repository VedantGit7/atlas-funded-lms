# Manual Release Gates Checklist

Complete before production promotion. Automation records these as `manual_required` and never marks them passed.

## Legal and product

- [ ] Legal readiness / CTA copy approved for FundedBeyond and generic tenants
- [ ] Readiness/diagnostic copy reviewed (educational only; no financial advice)

## Operations

- [ ] Monitoring and alerts configured (Sentry, PostHog, Better Stack worker heartbeat)
- [ ] Backup/restore drill completed on non-production
- [ ] Rollback target identified (`RELEASE_SHA` or `RELEASE_VERSION`)
- [ ] Domain and SSL verified for production hosts
- [ ] Production secrets reviewed (by reference only; not stored in repo)

## Ownership

- [ ] Incident owner assigned (`INCIDENT_OWNER`)
- [ ] Release owner assigned (`RELEASE_OWNER`)
- [ ] **CTO approval** for production promotion

## Evidence

Attach `release-evidence.json` from `pnpm release:suite` with verdict `READY_FOR_PRODUCTION_REVIEW` or document blockers.
