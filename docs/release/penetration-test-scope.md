# External penetration test — scope and briefing

Prepared 2026-08-20 for hardening programme Phase 5.3. **Status: ready to
commission, not yet commissioned** (tracked as SEC-07 in the
[security exception register](security-exception-register.md)).

This document exists because the internal security work was _constructive_: each
probe set out to prove one specific hypothesis, and every one of them succeeded.
That says nothing about the hypotheses nobody thought to form. An external tester
is being engaged for adversarial discovery, not to re-run the list below.

## What the product is

A multi-tenant LMS. Tenants are separated at the database by PostgreSQL
row-level security, and reached either as subdomains of a shared base domain or
on their own custom domains. There is a cross-tenant **platform** plane operated
by a small number of staff.

The three trust boundaries that matter, in order:

1. **Tenant → tenant.** The one that must never fail. Every tenant-scoped table
   has RLS enabled and forced, and the application connects as a role that is
   neither superuser nor `BYPASSRLS`.
2. **Learner → instructor → tenant admin.** Privilege escalation inside a tenant.
3. **Tenant admin → platform.** The platform plane can read across tenants.

## Priority surfaces

| Priority | Surface                                                     | Why                                                  |
| -------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| P0       | Tenant isolation on every read and write path               | The product's core guarantee                         |
| P0       | Platform plane (`/api/v1/platform/*`) authn/authz           | Cross-tenant reach                                   |
| P0       | SCORM content serving and upload                            | Author-supplied HTML/JS executed in learner browsers |
| P0       | Payment webhooks (Stripe, Razorpay) and wallet/coupon paths | Money, and unauthenticated entry points              |
| P1       | Proctoring media and identity verification                  | Biometric-adjacent personal data                     |
| P1       | Data export / deletion (subject access)                     | Bulk personal data egress                            |
| P1       | Invitation and signup flows                                 | Account takeover, tenant enumeration                 |
| P2       | Marketing tracking snippet injection                        | Tenant-admin-supplied JS, deliberately arbitrary     |

## Already fixed — please verify rather than rediscover

These were found internally and closed. Confirming the fixes hold is in scope;
reporting them as new findings is not.

- Cross-tenant read without the transaction wrapper (RLS backstop, C5)
- `tenant_domains` host resolution leaking across tenants
- Concurrent wallet double-spend and concurrent coupon over-redemption (C2, C3)
- SCORM zip bomb and path traversal (C4, M4)
- SCORM content executing on the app origin (C1)
- SSRF to link-local, loopback and RFC1918 from tenant-configured URLs (H3)
- Cross-tenant CSRF on shared-subdomain tenants (H20)
- Unauthenticated stored XSS via unsanitised rendered HTML (H1)
- Platform access granted by environment variable rather than by record (H7)
- MFA not enforced on platform operators (H5)
- Non-CSPRNG for coupon, referral and affiliate codes (H15)
- CSV formula injection into admin spreadsheets (M1)
- Replay of mutating requests despite an `Idempotency-Key` (M10)

## Known accepted exceptions — in scope to challenge, not to report as unknown

- **CSP is Report-Only**, pending a nonce for an inline theme script. If you can
  demonstrate an XSS that the other controls do not stop, that changes the
  priority of enforcement and we want to know.
- **`PLATFORM_OPERATOR_ASSIGNMENTS` remains as break-glass**, checked after the
  database and logged. If it can be reached without the logging, that is a
  finding.
- Full list in the [security exception register](security-exception-register.md).

## Questions the internal work could not answer

These are the areas where constructive testing is weakest and adversarial
testing is most valuable:

1. **Authorization composition.** Individual permission checks are tested. What
   about sequences — does a chain of individually-permitted operations reach a
   state no single permission allows?
2. **Tenant resolution under ambiguity.** Host header, `x-tenant-id`, custom
   domains and the platform host all feed tenant resolution. What happens when
   they disagree, or when a header is duplicated or unusually encoded?
3. **RLS bypass through a code path nobody classified as tenant-scoped.** The
   guard asserts every table with `tenant_id` is protected. A table without that
   column, or a view, or a function marked `SECURITY DEFINER`, would not be
   caught.
4. **The idempotency registry as an oracle.** Replay protection stores response
   bodies. Can one tenant's key collide with, or reveal, another's?
5. **File upload and processing beyond SCORM** — certificates, branding assets,
   report exports.
6. **Race conditions outside the money paths.** Wallet and coupon are hardened
   and tested. Enrolment, invitation acceptance, and workflow transitions are
   not proven to the same standard.
7. **Session and cookie handling across the custom-domain and shared-subdomain
   cases**, which differ in their same-site properties.

## Rules of engagement

- Test against a **dedicated staging environment** seeded with at least three
  tenants, including one on a custom domain. Never production.
- Provide accounts at each role: learner, instructor, tenant admin, tenant
  owner, platform operator. Two tenants' worth, so cross-tenant attempts are
  possible with legitimate credentials.
- Destructive testing is permitted in staging. Please avoid data volumes that
  make the environment unusable for parallel work.
- Denial of service is **out of scope** — capacity is measured separately
  (Phase 5.1) and a successful DoS tells us nothing we do not already model.

## Deliverable expected

- Findings with severity, reproduction steps, and evidence.
- Explicit statement of what was tested and found **clean** — a report listing
  only findings cannot be distinguished from a shallow test.
- A retest after remediation.

## Before commissioning

- [ ] Staging environment provisioned and seeded with the tenant mix above
- [ ] Test accounts created and handed over
- [ ] This document reviewed against the state of the code at that time
- [ ] Owner assigned for triage and remediation scheduling
