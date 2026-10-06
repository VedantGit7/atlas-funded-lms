import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type {
  DestinationKind,
  DestinationsRosterListQuery,
  HealthDayStatus,
} from "./destinations-roster.dto";

export type DestinationRow = {
  id: string;
  tenant_id: string;
  created_by_membership_id: string;
  name: string;
  kind: string;
  config_json: unknown;
  secrets_json: unknown;
  is_active: boolean;
  last_delivery_at: Date | null;
  last_delivery_status: string | null;
  last_error: string | null;
  consecutive_failures: number;
  health_30d_json: unknown;
  created_at: Date;
  updated_at: Date;
  schedule_count: number;
  linked_schedules_json: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function maskSecret(secret: string): string {
  if (secret.length <= 4) return "••••";
  return `••••${secret.slice(-4)}`;
}

export function parseHealth(value: unknown): HealthDayStatus[] {
  if (!Array.isArray(value)) return Array.from({ length: 20 }, () => "empty" as const);
  const mapped = value
    .filter(
      (item): item is HealthDayStatus => item === "success" || item === "fail" || item === "empty",
    )
    .slice(-30);
  while (mapped.length < 20) mapped.unshift("empty");
  return mapped.slice(-30);
}

export function pushHealthDay(current: unknown, status: "success" | "fail"): HealthDayStatus[] {
  const next = parseHealth(current).slice();
  next.push(status);
  return next.slice(-30);
}

export function emailDomain(address: string): string {
  const at = address.lastIndexOf("@");
  return at >= 0 ? address.slice(at + 1).toLowerCase() : "";
}

export function isExternalEmail(address: string, tenantDomains: string[]): boolean {
  const domain = emailDomain(address);
  if (!domain) return true;
  if (tenantDomains.length === 0) return true;
  return !tenantDomains.some((td) => domain === td || domain.endsWith(`.${td}`));
}

export function parseWebhookParts(url: string): { host: string; pathTruncated: string } {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + (parsed.search || "");
    const truncated = path.length > 48 ? `${path.slice(0, 24)}...${path.slice(-16)}` : path || "/";
    return { host: parsed.host, pathTruncated: truncated };
  } catch {
    return { host: "invalid-url", pathTruncated: "/" };
  }
}

export const destinationsRosterRepository = {
  async listTenantEmailDomains(tx: TenantTx): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ hostname: string }>>`
      select hostname
      from tenant_domains
      where deleted_at is null
        and status = 'ACTIVE'
      order by is_primary desc, hostname asc
    `;
    return rows
      .map((row) => {
        const host = row.hostname.toLowerCase().replace(/^www\./, "");
        // Prefer registrable-ish domain for email matching when hostname is a full LMS host.
        const parts = host.split(".").filter(Boolean);
        if (parts.length >= 2) return parts.slice(-2).join(".");
        return host;
      })
      .filter(Boolean);
  },

  async summarize(tx: TenantTx) {
    const rows = await tx.$queryRaw<
      Array<{
        total_count: number;
        email_count: number;
        webhook_count: number;
        storage_count: number;
        failing_count: number;
        failing_caption: string | null;
        last_delivery_at: Date | null;
        deliveries_this_month: number;
        deliveries_succeeded_this_month: number;
      }>
    >`
      with dest as (
        select *
        from report_delivery_destinations
      ),
      failing as (
        select
          count(*)::int as failing_count,
          (
            select
              case
                when d.kind = 'webhook' then coalesce(
                  'webhook returning ' || nullif(substring(coalesce(d.last_error, '') from '([0-9]{3})'), ''),
                  left(coalesce(d.last_error, 'delivery failing'), 48)
                )
                else left(coalesce(d.last_error, 'delivery failing'), 48)
              end
            from dest d
            where d.is_active = true
              and (
                d.last_delivery_status = 'failed'
                or d.consecutive_failures > 0
              )
            order by d.consecutive_failures desc, d.last_delivery_at desc nulls last
            limit 1
          ) as failing_caption
        from dest d
        where d.is_active = true
          and (
            d.last_delivery_status = 'failed'
            or d.consecutive_failures > 0
          )
      ),
      month_deliveries as (
        select
          count(*) filter (
            where last_delivery_at >= date_trunc('month', now() at time zone 'utc')
          )::int as deliveries_this_month,
          count(*) filter (
            where last_delivery_at >= date_trunc('month', now() at time zone 'utc')
              and last_delivery_status = 'succeeded'
          )::int as deliveries_succeeded_this_month
        from dest
      )
      select
        (select count(*)::int from dest) as total_count,
        (select count(*)::int from dest where kind = 'email') as email_count,
        (select count(*)::int from dest where kind = 'webhook') as webhook_count,
        (select count(*)::int from dest where kind = 'storage') as storage_count,
        (select failing_count from failing) as failing_count,
        (select failing_caption from failing) as failing_caption,
        (select max(last_delivery_at) from dest) as last_delivery_at,
        (select deliveries_this_month from month_deliveries) as deliveries_this_month,
        (select deliveries_succeeded_this_month from month_deliveries) as deliveries_succeeded_this_month
    `;
    return (
      rows[0] ?? {
        total_count: 0,
        email_count: 0,
        webhook_count: 0,
        storage_count: 0,
        failing_count: 0,
        failing_caption: null,
        last_delivery_at: null,
        deliveries_this_month: 0,
        deliveries_succeeded_this_month: 0,
      }
    );
  },

  async list(
    tx: TenantTx,
    query: DestinationsRosterListQuery,
  ): Promise<{
    rows: DestinationRow[];
    totalCount: number;
  }> {
    const limit = query.limit;
    const offset = (query.page - 1) * limit;
    const q = query.q?.trim() ? `%${query.q.trim().toLowerCase()}%` : null;
    const kind = query.kind === "any" ? null : query.kind;
    const status = query.status;

    const orderBy =
      query.sort === "name_asc"
        ? "d.name asc"
        : query.sort === "last_delivery_desc"
          ? "d.last_delivery_at desc nulls last, d.updated_at desc"
          : query.sort === "failures_desc"
            ? "d.consecutive_failures desc, d.updated_at desc"
            : "d.updated_at desc";

    const rows = await tx.$queryRawUnsafe<DestinationRow[]>(
      `
      select
        d.*,
        (
          select count(*)::int
          from report_schedules rs
          where rs.delivery_json->>'destinationId' = d.id::text
        ) as schedule_count,
        (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', rs.id,
                'name', coalesce(nullif(rs.name, ''), 'Untitled schedule')
              )
              order by rs.name asc nulls last
            ),
            '[]'::jsonb
          )
          from report_schedules rs
          where rs.delivery_json->>'destinationId' = d.id::text
        ) as linked_schedules_json
      from report_delivery_destinations d
      where ($1::text is null or lower(d.name) like $1 or lower(d.config_json::text) like $1)
        and ($2::text is null or d.kind = $2)
        and (
          $3::text = 'all'
          or ($3::text = 'enabled' and d.is_active = true)
          or ($3::text = 'disabled' and d.is_active = false)
          or (
            $3::text = 'failing'
            and d.is_active = true
            and (d.last_delivery_status = 'failed' or d.consecutive_failures > 0)
          )
        )
      order by ${orderBy}
      limit $4 offset $5
      `,
      q,
      kind,
      status,
      limit,
      offset,
    );

    const countRows = await tx.$queryRawUnsafe<Array<{ total: number }>>(
      `
      select count(*)::int as total
      from report_delivery_destinations d
      where ($1::text is null or lower(d.name) like $1 or lower(d.config_json::text) like $1)
        and ($2::text is null or d.kind = $2)
        and (
          $3::text = 'all'
          or ($3::text = 'enabled' and d.is_active = true)
          or ($3::text = 'disabled' and d.is_active = false)
          or (
            $3::text = 'failing'
            and d.is_active = true
            and (d.last_delivery_status = 'failed' or d.consecutive_failures > 0)
          )
        )
      `,
      q,
      kind,
      status,
    );

    return { rows, totalCount: countRows[0]?.total ?? 0 };
  },

  async getById(tx: TenantTx, id: string): Promise<DestinationRow | null> {
    const rows = await tx.$queryRaw<DestinationRow[]>`
      select
        d.*,
        (
          select count(*)::int
          from report_schedules rs
          where rs.delivery_json->>'destinationId' = d.id::text
        ) as schedule_count,
        (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', rs.id,
                'name', coalesce(nullif(rs.name, ''), 'Untitled schedule')
              )
              order by rs.name asc nulls last
            ),
            '[]'::jsonb
          )
          from report_schedules rs
          where rs.delivery_json->>'destinationId' = d.id::text
        ) as linked_schedules_json
      from report_delivery_destinations d
      where d.id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listAffectedSchedules(tx: TenantTx, id: string) {
    return tx.$queryRaw<Array<{ id: string; name: string | null }>>`
      select id, name
      from report_schedules
      where delivery_json->>'destinationId' = ${id}
      order by name asc nulls last
    `;
  },

  async create(
    tx: TenantTx,
    input: {
      createdByMembershipId: string;
      name: string;
      kind: DestinationKind;
      config: Record<string, unknown>;
      secrets: Record<string, unknown> | null;
    },
  ): Promise<DestinationRow> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into report_delivery_destinations (
        id, tenant_id, created_by_membership_id, name, kind, config_json, secrets_json
      ) values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${input.createdByMembershipId}::uuid,
        ${input.name},
        ${input.kind},
        ${JSON.stringify(input.config)}::jsonb,
        ${input.secrets ? JSON.stringify(input.secrets) : null}::jsonb
      )
    `;
    const row = await this.getById(tx, id);
    if (!row) throw new Error("Failed to create destination.");
    return row;
  },

  async update(
    tx: TenantTx,
    id: string,
    patch: {
      name?: string;
      isActive?: boolean;
      config?: Record<string, unknown>;
      secrets?: Record<string, unknown> | null;
      lastDeliveryAt?: Date | null;
      lastDeliveryStatus?: string | null;
      lastError?: string | null;
      consecutiveFailures?: number;
      health30d?: HealthDayStatus[];
    },
  ): Promise<DestinationRow> {
    const existing = await this.getById(tx, id);
    if (!existing) throw new Error("Destination not found.");

    const nextConfig = patch.config ?? asRecord(existing.config_json);
    const nextSecrets = patch.secrets === undefined ? existing.secrets_json : patch.secrets;

    await tx.$executeRaw`
      update report_delivery_destinations
      set
        name = ${patch.name ?? existing.name},
        is_active = ${patch.isActive ?? existing.is_active},
        config_json = ${JSON.stringify(nextConfig)}::jsonb,
        secrets_json = ${nextSecrets == null ? null : JSON.stringify(nextSecrets)}::jsonb,
        last_delivery_at = ${
          patch.lastDeliveryAt === undefined ? existing.last_delivery_at : patch.lastDeliveryAt
        },
        last_delivery_status = ${
          patch.lastDeliveryStatus === undefined
            ? existing.last_delivery_status
            : patch.lastDeliveryStatus
        },
        last_error = ${patch.lastError === undefined ? existing.last_error : patch.lastError},
        consecutive_failures = ${
          patch.consecutiveFailures === undefined
            ? existing.consecutive_failures
            : patch.consecutiveFailures
        },
        health_30d_json = ${
          patch.health30d
            ? JSON.stringify(patch.health30d)
            : JSON.stringify(existing.health_30d_json ?? [])
        }::jsonb,
        updated_at = now()
      where id = ${id}::uuid
    `;

    const row = await this.getById(tx, id);
    if (!row) throw new Error("Destination not found after update.");
    return row;
  },

  async delete(tx: TenantTx, id: string) {
    await tx.$executeRaw`
      update report_schedules
      set
        delivery_json = jsonb_strip_nulls(
          coalesce(delivery_json, '{}'::jsonb)
          - 'destinationId'
          - 'emails'
          - 'webhookUrl'
          - 'bucket'
          - 'path'
          || jsonb_build_object('mode', 'download')
        ),
        updated_at = now()
      where delivery_json->>'destinationId' = ${id}
    `;

    // Delivery records are kept; they stop naming the destination, which is
    // how a pending delivery already treats a deleted one.
    await tx.$executeRaw`
      update report_delivery_effects set destination_id = null, updated_at = now()
      where destination_id = ${id}::uuid
    `;

    await tx.$executeRaw`
      delete from report_delivery_destinations
      where id = ${id}::uuid
    `;
  },

  async listAllForExport(tx: TenantTx): Promise<DestinationRow[]> {
    return tx.$queryRaw<DestinationRow[]>`
      select
        d.*,
        (
          select count(*)::int
          from report_schedules rs
          where rs.delivery_json->>'destinationId' = d.id::text
        ) as schedule_count,
        (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', rs.id,
                'name', coalesce(nullif(rs.name, ''), 'Untitled schedule')
              )
              order by rs.name asc nulls last
            ),
            '[]'::jsonb
          )
          from report_schedules rs
          where rs.delivery_json->>'destinationId' = d.id::text
        ) as linked_schedules_json
      from report_delivery_destinations d
      order by d.name asc
    `;
  },
};
