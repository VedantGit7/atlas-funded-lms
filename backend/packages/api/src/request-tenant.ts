import { requireSupabaseUser, upsertAuthPrincipal } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { resolveTenantFromRecentLookup, resolveTenantFromRequest } from "@atlas/tenancy";

/**
 * The connection discipline of `createTenantRoute`, for routes that cannot use it
 * (public pages, webhooks, file downloads, auth flows). Audit H3.
 *
 * 1. Network work (Supabase, request bodies, providers) with no connection held.
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
 * that verify with Supabase and then mirror the principal: the principal
 * upsert is one atomic statement, and the network wait before it must not pin
 * a pooled connection. Not for multi-statement work that needs one transaction.
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
 * Phases 1 and 2 for signed-in routes: Supabase verification with no
 * connection held, then tenant and principal on one released connection.
 * Authentication runs first, as in `createTenantRoute`, so an anonymous caller
 * learns nothing about whether a tenant host exists.
 */
export async function authenticateTenantRequest(req: TenantRequest): Promise<{
  supabaseUser: Awaited<ReturnType<typeof requireSupabaseUser>>;
  tenant: ResolvedRequestTenant;
  principal: Awaited<ReturnType<typeof upsertAuthPrincipal>>;
}> {
  const supabaseUser = await requireSupabaseUser(req);
  const { tenant, principal } = await withGlobalDb(async (db) => ({
    tenant: await resolveTenantFromRequest({ req, db }),
    principal: await upsertAuthPrincipal({
      db,
      supabaseUserId: supabaseUser.supabaseUserId,
      email: supabaseUser.email,
      emailConfirmed: supabaseUser.emailConfirmed,
      mfaEnabled: supabaseUser.mfaEnabled,
      markLogin: false,
    }),
  }));
  return { supabaseUser, tenant, principal };
}
