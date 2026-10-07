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

  return rows[0] ?? null;
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
