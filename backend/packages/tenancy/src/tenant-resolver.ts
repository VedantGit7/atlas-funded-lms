import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { normalizeHost, resolveRequestHostFromHeaders } from "./host";
import { assertTenantActive, assertTenantDomainActive } from "./tenant-state";
import { tenantNotFound } from "./tenant-errors";
import type { ResolvedTenantContext, TenantDomainStatus, TenantState } from "./types";

type TenantResolutionRow = {
  tenant_id: string;
  tenant_slug: string;
  tenant_state: TenantState;
  domain_id: string;
  domain_status: TenantDomainStatus;
  hostname: string;
};

type TenantResolverDb = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

/**
 * Recently resolved hostnames, per process (audit §3.1). An anonymous request
 * otherwise opens a database transaction only to find its tenant.
 *
 * - Only found domains are kept: an unknown hostname always asks the database,
 *   so a newly added or verified domain works at once.
 * - The tenant's and domain's state are kept with them, and the active checks
 *   still run on every request against that state.
 * - Suspending, resuming or archiving a tenant, or deleting a domain, clears
 *   this process's copy once committed (forgetResolvedTenantHosts). Other
 *   processes catch up within TENANT_HOST_TTL_MS.
 */
const TENANT_HOST_TTL_MS = 30_000;
const MAX_TENANT_HOSTS = 10_000;
const resolvedHosts = new Map<string, { row: TenantResolutionRow; expiresAt: number }>();

function cachedDomain(host: string): TenantResolutionRow | undefined {
  const entry = resolvedHosts.get(host);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    resolvedHosts.delete(host);
    return undefined;
  }
  return entry.row;
}

function rememberDomain(host: string, row: TenantResolutionRow): void {
  if (resolvedHosts.size >= MAX_TENANT_HOSTS) {
    // Oldest insertions first.
    const oldest = resolvedHosts.keys().next().value;
    if (oldest !== undefined) resolvedHosts.delete(oldest);
  }
  resolvedHosts.set(host, { row, expiresAt: Date.now() + TENANT_HOST_TTL_MS });
}

/** After a committed change to a tenant's state or its domains. */
export function forgetResolvedTenantHosts(): void {
  resolvedHosts.clear();
}

/**
 * The verified domain for exactly this hostname, or nothing.
 *
 * `app.resolve_tenant_host` is the only way the application roles can read
 * `tenant_domains` before a tenant context exists, and it answers one exact
 * hostname: an unknown, deleted or unverified domain all come back empty, so
 * callers cannot tell them apart. See docs/runbooks/tenant-host-resolution.md.
 */
async function findVerifiedDomain(
  db: TenantResolverDb,
  host: string,
): Promise<TenantResolutionRow | null> {
  const cached = cachedDomain(host);
  if (cached) return cached;

  const rows = await db.$queryRaw<TenantResolutionRow[]>`
    select
      tenant_id::text as tenant_id,
      tenant_slug,
      tenant_state,
      domain_id::text as domain_id,
      domain_status,
      hostname
    from app.resolve_tenant_host(${host})
  `;

  const row = rows[0] ?? null;
  if (row) rememberDomain(host, row);
  return row;
}

function toContext(
  row: TenantResolutionRow,
  host: string,
  requestId: string,
): ResolvedTenantContext {
  return {
    requestId,
    host,
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantState: row.tenant_state,
    tenantDomainId: row.domain_id,
    tenantDomainStatus: row.domain_status,
  };
}

export async function resolveTenantFromRequest(args: {
  req: Request;
  db: TenantResolverDb;
}): Promise<ResolvedTenantContext> {
  const requestId = getOrCreateRequestId(args.req.headers);
  const host = resolveRequestHostFromHeaders(args.req.headers);

  return resolveTenantFromHost({
    host,
    requestId,
    db: args.db,
  });
}

/**
 * The request's tenant from this process's recent lookups, without a database
 * connection; null when it has none, so the caller asks the database. Applies
 * the same state checks as resolveTenantFromHost.
 */
export function resolveTenantFromRecentLookup(req: Request): ResolvedTenantContext | null {
  const host = normalizeHost(resolveRequestHostFromHeaders(req.headers));
  const row = cachedDomain(host);
  if (!row) return null;
  assertTenantDomainActive(row.domain_status);
  assertTenantActive(row.tenant_state);
  return toContext(row, host, getOrCreateRequestId(req.headers));
}

export async function resolveTenantFromHost(args: {
  host: string;
  requestId: string;
  db: TenantResolverDb;
}): Promise<ResolvedTenantContext> {
  const host = normalizeHost(args.host);
  const row = await findVerifiedDomain(args.db, host);

  if (!row) {
    throw tenantNotFound();
  }

  assertTenantDomainActive(row.domain_status);
  assertTenantActive(row.tenant_state);

  return toContext(row, host, args.requestId);
}

export async function lookupTenantFromHost(args: {
  host: string;
  requestId: string;
  db: TenantResolverDb;
}): Promise<ResolvedTenantContext | null> {
  const host = normalizeHost(args.host);
  const row = await findVerifiedDomain(args.db, host);

  return row ? toContext(row, host, args.requestId) : null;
}
