import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { normalizeHost } from "./host";
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

export async function resolveTenantFromRequest(args: {
  req: Request;
  db: TenantResolverDb;
}): Promise<ResolvedTenantContext> {
  const requestId = getOrCreateRequestId(args.req.headers);
  const host = normalizeHost(args.req.headers.get("host"));

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

  const rows = await args.db.$queryRaw<TenantResolutionRow[]>`
    select
      t.id::text as tenant_id,
      t.slug::text as tenant_slug,
      t.state::text as tenant_state,
      td.id::text as domain_id,
      td.status::text as domain_status,
      td.hostname::text as hostname
    from tenant_domains td
    join tenants t on t.id = td.tenant_id
    where lower(td.hostname) = ${host}
      and td.deleted_at is null
      and t.deleted_at is null
    limit 1
  `;

  const row = rows[0];

  if (!row) {
    throw tenantNotFound();
  }

  assertTenantDomainActive(row.domain_status);
  assertTenantActive(row.tenant_state);

  return {
    requestId: args.requestId,
    host,
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantState: row.tenant_state,
    tenantDomainId: row.domain_id,
    tenantDomainStatus: row.domain_status,
  };
}

export async function lookupTenantFromHost(args: {
  host: string;
  requestId: string;
  db: TenantResolverDb;
}): Promise<ResolvedTenantContext | null> {
  const host = normalizeHost(args.host);

  const rows = await args.db.$queryRaw<TenantResolutionRow[]>`
    select
      t.id::text as tenant_id,
      t.slug::text as tenant_slug,
      t.state::text as tenant_state,
      td.id::text as domain_id,
      td.status::text as domain_status,
      td.hostname::text as hostname
    from tenant_domains td
    join tenants t on t.id = td.tenant_id
    where lower(td.hostname) = ${host}
      and td.deleted_at is null
      and t.deleted_at is null
    limit 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    requestId: args.requestId,
    host,
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantState: row.tenant_state,
    tenantDomainId: row.domain_id,
    tenantDomainStatus: row.domain_status,
  };
}
