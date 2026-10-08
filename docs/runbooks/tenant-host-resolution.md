# Tenant host resolution

Every request reaches a tenant through its hostname. This runbook covers what
an unauthenticated caller can learn about tenants and their hostnames, why, and
which controls hold that line. Read it before changing `tenant_domains`, the
resolver in `backend/packages/tenancy`, or the public bootstrap route.

## How a request finds its tenant

1. The browser's `Host` is the only tenant selector. The web proxy forwards it
   to the API as `x-atlas-tenant-host`, alongside the server-only
   `API_PROXY_SECRET` credential. API ingress (`sanitizeApiProxyHeaders`)
   deletes that header and `x-forwarded-host` unless the credential matches,
   so a direct API caller resolves by its own `Host` and nothing else. A
   tenant id in a body, query or token never selects the tenant.
2. `normalizeHost` lowercases the host and drops the port. It refuses
   `localhost`, `127.0.0.1`, `0.0.0.0`, bracketed IPv6 literals and anything
   containing a slash.
3. Before any tenant context exists, `withGlobalDb` calls
   `app.resolve_tenant_host(host)` as `atlas_app`. The function returns at most
   one row: a **verified** (`ACTIVE`), undeleted domain with exactly that
   hostname, belonging to a tenant that is not deleted. Stored hostnames are
   always lowercase (the `tenant_domains_hostname_lowercase` check), so the
   function compares the stored value with `lower(host)` and uses the hostname
   index. Keep the comparison in that form: under row-level security a
   condition containing a non-leakproof function such as `lower()` on the
   column is applied only after the policy, which makes every request scan the
   table.
4. With the tenant known, the request runs in `withTenantTx`, where row-level
   security limits every tenant table to that tenant.

## What an unauthenticated caller can learn

A caller can send any `Host` value to the public origin, so assume every
hostname can be probed. Rate limiting (`publicRead`, 120 requests a minute per
attributed IP; see `rate-limiting.md`) slows guessing but does not prevent it.

| The probed hostname is…                                           | Bootstrap (`GET /api/v1/public/bootstrap`)                                  | Any other API route                                            |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Unknown, deleted, or a domain that is not verified                | All fields `null`                                                           | `404 TENANT_NOT_FOUND`                                         |
| A verified domain of a deleted tenant                             | All fields `null`                                                           | `404 TENANT_NOT_FOUND`                                         |
| A verified domain of a provisioning, suspended or archived tenant | As for an active tenant; the state drives the "unavailable" page            | `503 TENANT_UNAVAILABLE` (signed-in routes authenticate first) |
| A verified domain of an active tenant                             | Tenant and domain ids, slug, state, public branding, support email, FX data | The route's normal response                                    |

The first two rows are indistinguishable from each other by response body,
status and code. In particular, a custom domain that a tenant has added but not
yet verified is never attributed to that tenant: anyone can type any hostname
into the domain settings, and only DNS verification shows that the tenant
controls it.

### Why the verified-domain answers are acceptable

- **Everything returned is already public.** A verified domain is the tenant's
  public site; its name, logo, colours and support address appear on every page
  of it. Bootstrap returns them so the site can render.
- **Identifiers are not credentials.** Tenant and domain UUIDs and the slug
  grant nothing: access needs a session, an active membership and a
  permission, and row-level security checks the tenant on every query.
- **Unavailable states are deliberate.** A suspended or archived academy shows
  its own learners a branded "unavailable" page rather than a bare 404, so the
  state is disclosed on that academy's own domain only.
- **Signed-in routes authenticate before resolving.** `createTenantRoute` and
  `authenticateTenantRequest` verify the session first, so an anonymous call to
  them returns `AUTH_REQUIRED` whatever the hostname.

### What cannot be learned

- **No listing.** No route returns more than the probed hostname's tenant, and
  the database itself answers only exact hostnames: with no tenant context,
  `atlas_app` and `atlas_worker` read `tenant_domains` as empty.
- **No pending claims.** Unverified, failed and removed domains, and their DNS
  verification values, are visible only inside that tenant's own context (its
  domain settings) and to platform operators.
- **No other tenant's domains from inside a tenant.** With a tenant context set,
  the `tenant_domains_tenant_isolation` policy applies alone.

## The database controls

| Object                                     | Purpose                                                                                                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.resolve_tenant_host(text)`            | `SECURITY DEFINER`, `search_path = pg_catalog, pg_temp`. Returns tenant id, slug, state, domain id, status and hostname only. `EXECUTE` for `atlas_app` and `atlas_worker`; revoked from `PUBLIC`. |
| `atlas_host_resolver`                      | Owns the function and nothing else. `NOLOGIN`, no `BYPASSRLS`. Column-level `SELECT` on the five `tenant_domains` and four `tenants` columns the function reads. No login role is a member of it.  |
| Policy `tenant_domains_host_resolver`      | Lets `atlas_host_resolver` see verified, undeleted rows only, so even the function cannot return a pending claim.                                                                                  |
| (removed) `tenant_domains_host_resolution` | The old pre-context policy that let `atlas_app` read every undeleted row when no tenant was set. Dropped by migration 124 and by `sql/rls/025`.                                                    |

Row-level security cannot see a query's `WHERE` clause, so a policy can only
admit the whole table or refuse it. Answering "this one hostname" therefore
needs a function, and the function needs an owner that may see the rows. A
dedicated owner role keeps that power out of every login role.

Its history, because each step fixed one half and the obvious next shortcut
breaks the other:

1. Until 2026-08-19 a permissive `USING (deleted_at IS NULL)` policy, created
   by hand in the live databases and never committed, made the isolation
   policy unreachable: any tenant context could read every tenant's domains.
2. Scoping it to `app.current_tenant_id() IS NULL` closed that, but any code
   running before the tenant context could still list every hostname.
3. Migration 124 (2026-10-07) replaced the policy with the function.

`tests/tenant-isolation/tenant-domains-host-resolution.test.ts` pins all three
properties against the restricted `atlas_app_login` role, and
`tests/integration/tenancy/tenant-resolver.test.ts` pins that the resolver goes
through the function.

## Known remaining exposure

`tenants` is a global catalogue that `atlas_app` and `atlas_worker` can read in
full (slugs, display names, states). It is not reachable over HTTP without a
tenant context. Code running server-side could list tenants from it, and
Atlas-subdomain hostnames follow from the slug. Narrowing it means auditing every
reader first; until then, treat a SQL injection anywhere as able to list tenant
slugs, though not custom domains.

## Changing any of this

- Do not add a policy on `tenant_domains` for `atlas_app` or `atlas_worker`
  that does not reference the tenant context. `pnpm db:rls:check` fails on one.
- Need another pre-context lookup? Add a function with the same shape (exact
  input, one row, minimal columns, a dedicated owner) instead of widening a
  policy.
- Keep every "no tenant here" answer identical. A new error code, status or
  field for "exists but unverified" re-opens the probing this runbook
  describes.
- A change to the function or its owner needs a migration, because existing
  databases get policy changes only through `prisma migrate deploy`; update
  `sql/rls/025` too if a fresh provision would otherwise differ.
