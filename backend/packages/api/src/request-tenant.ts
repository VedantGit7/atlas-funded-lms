import { requireSessionUser, resolveSessionPrincipal } from "./session-user";
import { withGlobalDb } from "@atlas/db/global-db";
import { resolveTenantFromRecentLookup, resolveTenantFromRequest } from "@atlas/tenancy";

/**
 * The connection discipline of `createTenantRoute`, for routes that cannot use it
 * (public pages, webhooks, file downloads, auth flows). Audit H3.
 *
 * 1. The session check and network work (request bodies, providers) with no
 *    connection of the main pool held.
 * 2. Global lookups on one short-lived connection, released on return.
 * 3. Only then the tenant transaction, on a second connection.
 *
 * Opening `withTenantTx` inside `withGlobalDb` holds two pooled connections per
 * request and deadlocks the pool at DATABASE_POOL_MAX concurrent requests;
 * `withGlobalDb`/`withTenantTx` now refuse it outside deployed runtimes.
 */

type TenantRequest = Parameters<typeof resolveTenantFromRequest>[0]["req"];
export type ResolvedRequestTenant = Awaited<ReturnType<typeof resolveTenantFromRequest>>;

/**
 * A global-db handle that takes a connection per statement, for auth flows
 * whose statements are each atomic and whose waits in between must not pin a
 * pooled connection. Not for multi-statement work that needs one transaction.
 */
export const globalDbPerStatement = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    return withGlobalDb((db) => db.$queryRaw<T>(query, ...values));
  },
};

/**
 * Phase 2 for anonymous routes: the request host's tenant, on a released
 * connection, or with no connection at all when this process resolved the
 * host in the last few seconds.
 */
export async function resolveRequestTenant(req: TenantRequest): Promise<ResolvedRequestTenant> {
  return (
    resolveTenantFromRecentLookup(req) ??
    (await withGlobalDb((db) => resolveTenantFromRequest({ req, db })))
  );
}

/**
 * Phases 1 and 2 for signed-in routes: the session check with no main-pool
 * connection held, then tenant and principal on one released connection.
 * Authentication runs first, as in `createTenantRoute`, so an anonymous caller
 * learns nothing about whether a tenant host exists.
 */
export async function authenticateTenantRequest(req: TenantRequest): Promise<{
  sessionUser: Awaited<ReturnType<typeof requireSessionUser>>;
  tenant: ResolvedRequestTenant;
  principal: Awaited<ReturnType<typeof resolveSessionPrincipal>>;
}> {
  const sessionUser = await requireSessionUser(req);
  const { tenant, principal } = await withGlobalDb(async (db) => ({
    tenant: await resolveTenantFromRequest({ req, db }),
    principal: await resolveSessionPrincipal({
      db,
      user: sessionUser,
    }),
  }));
  return { sessionUser, tenant, principal };
}
