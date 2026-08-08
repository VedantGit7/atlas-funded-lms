import type { PlatformTx } from "@atlas/db";
import type { PlatformTenantListQuery, ProvisionTenantRequest } from "../schemas/platform-tenants";
import type { PlatformTenantRow } from "./platform-tenant.types";

export async function insertProvisioningTenant(
  tx: PlatformTx,
  input: ProvisionTenantRequest,
): Promise<{ id: string }> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO tenants (
      id,
      slug,
      display_name,
      legal_name,
      state,
      default_locale,
      default_timezone,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      ${input.slug},
      ${input.displayName},
      ${input.legalName ?? null},
      'PROVISIONING',
      ${input.defaultLocale},
      ${input.defaultTimezone},
      now(),
      now()
    )
    RETURNING id
  `;

  const row = rows[0];
  if (row === undefined) {
    throw new Error("Expected tenant insert to return id");
  }

  return row;
}

export async function findTenantBySlug(
  tx: PlatformTx,
  slug: string,
): Promise<{ id: string; slug: string; state: string } | null> {
  const rows = await tx.$queryRaw<{ id: string; slug: string; state: string }[]>`
    SELECT id, slug, state
    FROM tenants
    WHERE slug = ${slug}
      AND deleted_at IS NULL
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function findPlatformTenantById(
  tx: PlatformTx,
  tenantId: string,
): Promise<PlatformTenantRow | null> {
  const rows = await tx.$queryRaw<PlatformTenantRow[]>`
    SELECT
      t.id,
      t.slug,
      t.display_name,
      t.legal_name,
      t.state,
      t.default_locale,
      t.default_timezone,
      t.created_at,
      t.updated_at,
      td.id AS primary_domain_id,
      td.hostname AS primary_domain_hostname,
      td.status AS primary_domain_status,
      td.type AS primary_domain_type,
      pj.id AS latest_job_id,
      pj.status AS latest_job_status
    FROM tenants t
    LEFT JOIN tenant_domains td
      ON td.tenant_id = t.id
      AND td.is_primary = true
      AND td.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT id, status
      FROM provisioning_jobs
      WHERE tenant_id = t.id
      ORDER BY created_at DESC
      LIMIT 1
    ) pj ON true
    WHERE t.id = ${tenantId}
      AND t.deleted_at IS NULL
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function listPlatformTenants(
  tx: PlatformTx,
  query: PlatformTenantListQuery & {
    cursorCreatedAt?: Date | null;
    cursorId?: string | null;
  },
): Promise<PlatformTenantRow[]> {
  const limitPlusOne = query.limit + 1;

  return tx.$queryRaw<PlatformTenantRow[]>`
    SELECT
      t.id,
      t.slug,
      t.display_name,
      t.legal_name,
      t.state,
      t.default_locale,
      t.default_timezone,
      t.created_at,
      t.updated_at,
      td.id AS primary_domain_id,
      td.hostname AS primary_domain_hostname,
      td.status AS primary_domain_status,
      td.type AS primary_domain_type,
      pj.id AS latest_job_id,
      pj.status AS latest_job_status
    FROM tenants t
    LEFT JOIN tenant_domains td
      ON td.tenant_id = t.id
      AND td.is_primary = true
      AND td.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT id, status
      FROM provisioning_jobs
      WHERE tenant_id = t.id
      ORDER BY created_at DESC
      LIMIT 1
    ) pj ON true
    WHERE t.deleted_at IS NULL
      AND (${query.state ?? null}::text IS NULL OR t.state = ${query.state ?? null}::"TenantState")
      AND (
        ${query.q ?? null}::text IS NULL
        OR t.slug ILIKE '%' || ${query.q ?? null} || '%'
        OR t.display_name ILIKE '%' || ${query.q ?? null} || '%'
      )
      AND (
        ${query.cursorCreatedAt ?? null}::timestamptz IS NULL
        OR (t.created_at, t.id) < (${query.cursorCreatedAt ?? null}::timestamptz, ${query.cursorId ?? null}::uuid)
      )
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT ${limitPlusOne}
  `;
}

export async function updateTenantState(
  tx: PlatformTx,
  args: {
    tenantId: string;
    from: string[];
    to: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  },
): Promise<{ id: string; previous_state: string; state: string }> {
  const rows = await tx.$queryRaw<{ id: string; previous_state: string; state: string }[]>`
    UPDATE tenants
    SET state = ${args.to}::"TenantState",
        updated_at = now()
    WHERE id = ${args.tenantId}
      AND state = ANY(${args.from}::"TenantState"[])
      AND deleted_at IS NULL
    RETURNING id, ${args.from[0]}::text AS previous_state, state::text
  `;

  if (!rows[0]) {
    throw new Error("INVALID_TENANT_STATE_TRANSITION");
  }

  return rows[0];
}
