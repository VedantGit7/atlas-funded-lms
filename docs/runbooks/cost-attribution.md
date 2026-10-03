# Per-Tenant Cost Attribution

## Purpose

Show what each tenant costs the platform to serve, so plan prices can be set above it. This
closes definition-of-done item 8 in `plan/backend-planning/production-deployment-and-scale.md`
("Per-tenant cost attribution available for pricing decisions") and the architecture review's
finding that "only the _usage_ side is metered; the _cost_ side isn't instrumented."

The screen is **Platform console → Costs** (`/platform/costs`, screen P9).

## Who can use it

| Platform role | Read costs | Change rates and fixed costs |
| ------------- | ---------- | ---------------------------- |
| super_admin   | yes        | yes                          |
| operations    | yes        | yes                          |
| support       | no         | no                           |

Permissions are `platform.cost.read` and `platform.cost.manage`. Support has neither: supplier
pricing and per-tenant margins are commercial information. The tenant application and worker
database roles have no privileges on the cost tables at all, not even `SELECT`.

## How a tenant's cost is built

**Usage-based cost** = the tenant's own usage x the unit rate, per driver:

| Driver         | Unit             | Measured from                                                    |
| -------------- | ---------------- | ---------------------------------------------------------------- |
| File storage   | GB-month         | `storage_references` bytes uploaded and not deleted at month end |
| Active members | active member    | distinct members in `tenant_active_days` during the month        |
| Emails         | email            | successful sends through `EmailProvider`, metered per tenant     |
| Custom domains | domain-month     | verified `CUSTOM_DOMAIN` rows in service at month end            |
| API requests   | million requests | tenant API requests, metered in `createTenantRoute`              |

**Fixed cost** = each flat monthly bill, divided between tenants in proportion to the key you
choose for that bill: API requests, active members, member-days, stored GB, or an equal split.
Choose the key that actually consumes the bill:

| Bill                           | Sensible key   |
| ------------------------------ | -------------- |
| App server (VPS)               | API requests   |
| Database / auth plan           | Active members |
| Monitoring, domains, flat SaaS | Equal split    |

If nobody had any of a line's key that month, the line falls back to an equal split and the
screen says so.

## Setting it up

1. Enter a **unit rate** for each driver you pay per unit for. The editor suggests a published
   price (R2, Supabase, SES, Cloudflare for SaaS); check it against your own invoice before saving.
   Leave **API requests** unset on a fixed-price server -- put the server in fixed costs instead.
2. Add each **fixed monthly bill** with the key it is shared by.
3. Record the source (invoice, plan name) in the note field. It is stored with the rate.

Rates and fixed costs apply **from a month onwards**. Nothing is ever edited or deleted:

- a new rate supersedes the old one from its month; past months keep reporting the rate that
  applied then;
- a mistyped rate is corrected by setting the same month again -- the newer entry wins and the
  mistake stays in the history;
- a bill that stops is **ended** after its last month, not deleted.

Every change is written to the platform audit log.

## Reading the report

- **Per active member** is the figure to set a per-learner price from. It is shown to four
  decimals on purpose.
- The **current month is partial**: fixed costs are for the whole month while usage is still
  accumulating, so cost per member falls as the month fills in. Price from complete months.
- A warning lists any driver with measured usage but **no rate**. That usage is excluded from the
  totals rather than shown as free.
- Amounts are **USD**, as the suppliers invoice. Before comparing with INR prices, convert at the
  rate you actually pay: include card forex fees, and the 18% IGST payable under reverse charge on
  foreign services (recoverable as input credit when GST-registered).

## Not yet included

The report lists these under "Not included in these totals", so the total is a floor:

- **Video storage and delivery.** The video provider bills per GB; neither figure is recorded per
  tenant here.
- **Page rendering and public routes.** Only authenticated tenant API requests are metered.
- **Database size.** Shared and not measured per tenant; include the database plan as a fixed cost.

## How the metering works

Requests and emails are counted in memory in each server process and written every 60 seconds
as one row per tenant per month in `analytics_rollups` (`usage.api_requests`,
`usage.emails_sent`), so metering never adds a write to a request. A process that dies without
flushing loses at most its last minute of counts, which is acceptable for attributing a monthly
bill and is why nothing billed to a customer uses this path. The outbox worker flushes on graceful
shutdown. Set `ATLAS_USAGE_METERING=off` to disable metering in a process.

Months are calendar months in UTC.
