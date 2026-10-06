# Manual Release Gates Checklist

Complete before production promotion. Automation records these as `manual_required` and never marks them passed.

## Engineering prep (automated / repo)

Sprint 10 WS1–5 engineering work is in-repo; this section tracks prep only — it does **not** replace human gates below.

- [x] PostHog browser + server defaults use EU host (`https://eu.i.posthog.com`)
- [x] `.env.example` documents `NEXT_PUBLIC_POSTHOG_HOST`, `CERTIFICATE_PDF_WORKER`, `STRIPE_WEBHOOK_SECRET`, `LEARNER_BILLING_ENC_KEY`
- [x] L1 proctoring consent + ingest covered by integration tests + e2e wiring stub (`tests/e2e/proctoring.e2e.ts`, `tests/integration/api/proctoring.test.ts`)
- [x] Certificate PDF download content-type covered when `r2_object_key` is set (`tests/unit/certificates/certificate-download-pdf.test.ts`); PDF worker still gated on `CERTIFICATE_PDF_WORKER`
- [x] Pending checkout returns `checkoutUrl` without `enrollmentId` (`tests/unit/sales-coupons/purchase-checkout-provider.test.ts` + `tests/e2e/checkout-pending-order.e2e.ts`)
- [x] WS artifacts present: migration `098_proctoring_l1`, `payment-provider.ts` + `stripe.adapter.ts`, `certificate-pdf.service.ts`, reports-delivery `destinationId`, notification archive route

**Still not automated here:** `pnpm release:suite` against a real DB, Better Stack monitors, SSL/domain verification, secrets review, backup drill, legal copy, CTO sign-off.

## Legal and product

- [ ] Legal readiness / CTA copy approved for FundedBeyond and generic tenants
- [ ] Readiness/diagnostic copy reviewed (educational only; no financial advice)

## Operations

- [ ] Monitoring and alerts configured (Sentry, PostHog, Better Stack worker heartbeat)
- [ ] Backup/restore drill completed on non-production
- [ ] Rollback target identified (`RELEASE_SHA` or `RELEASE_VERSION`)
- [ ] Domain and SSL verified for production hosts
- [ ] Production secrets reviewed (by reference only; not stored in repo)
- [ ] `pnpm db:tenant-fk:check` reports no violations against production before deploying migrations 120/121, and every constraint `validated` after ([tenant-foreign-keys.md](../runbooks/tenant-foreign-keys.md))

## Ownership

- [ ] Incident owner assigned (`INCIDENT_OWNER`)
- [ ] Release owner assigned (`RELEASE_OWNER`)
- [ ] **CTO approval** for production promotion

## Evidence

Attach `release-evidence.json` from `pnpm release:suite` with verdict `READY_FOR_PRODUCTION_REVIEW` or document blockers.

> **Note (Sprint 10):** Committed `release-evidence.json` may be stale (older local run; verdict may be `READY_FOR_STAGING` only). Do **not** treat it as `READY_FOR_PRODUCTION_REVIEW`. Re-run `pnpm release:suite` with a real test DB before production review.
