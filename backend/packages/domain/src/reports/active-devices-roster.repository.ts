import type { TenantTx } from "@atlas/db";
import type { ActiveDevicesRosterQuery } from "./active-devices-roster.dto";

export type ActiveDevicesLearnerRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  device_count: number;
  last_seen_at: Date | null;
  platforms: string[] | null;
  ip_addresses: string[] | null;
};

export type ActiveDevicesRosterFilter = {
  email?: string;
  platform?: string;
  windowFrom?: string | null;
  overLimitOnly?: boolean;
  registrationLimit?: number;
};

export function resolveActiveDevicesWindow(window: "24h" | "7d" | "30d" | "all"): {
  windowFrom: Date | null;
  windowTo: Date;
  windowLabel: string;
  previousFrom: Date | null;
  previousTo: Date | null;
} {
  const windowTo = new Date();
  if (window === "all") {
    return {
      windowFrom: null,
      windowTo,
      windowLabel: "All time",
      previousFrom: null,
      previousTo: null,
    };
  }

  const days = window === "24h" ? 1 : window === "7d" ? 7 : 30;
  const windowFrom = new Date(windowTo);
  windowFrom.setUTCDate(windowFrom.getUTCDate() - (days - 1));
  windowFrom.setUTCHours(0, 0, 0, 0);

  const durationMs = windowTo.getTime() - windowFrom.getTime();
  const previousTo = new Date(windowFrom.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - durationMs);

  return {
    windowFrom,
    windowTo,
    windowLabel: window === "24h" ? "24 Hours" : window === "7d" ? "7 Days" : "30 Days",
    previousFrom,
    previousTo,
  };
}

export const activeDevicesRosterRepository = {
  async readDeviceRegistrationLimit(tx: TenantTx): Promise<{
    registrationLimit: number;
    restrictionsEnabled: boolean;
  }> {
    const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
      select config_json
      from tenant_config
      where tenant_id = current_setting('app.tenant_id', true)::uuid
      limit 1
    `;
    const root =
      rows[0]?.config_json &&
      typeof rows[0].config_json === "object" &&
      !Array.isArray(rows[0].config_json)
        ? (rows[0].config_json as Record<string, unknown>)
        : {};
    const security =
      root["security"] && typeof root["security"] === "object" && !Array.isArray(root["security"])
        ? (root["security"] as Record<string, unknown>)
        : {};
    const rawLimit = security["deviceRegistrationLimit"];
    const parsed =
      typeof rawLimit === "number" ? rawLimit : typeof rawLimit === "string" ? Number(rawLimit) : 1;
    const registrationLimit = Number.isFinite(parsed)
      ? Math.min(10, Math.max(1, Math.trunc(parsed)))
      : 1;
    return {
      registrationLimit,
      restrictionsEnabled: Boolean(security["deviceRestrictionsEnabled"]),
    };
  },

  async countLearners(tx: TenantTx, filter: ActiveDevicesRosterFilter): Promise<number> {
    const limit = filter.registrationLimit ?? 1;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from (
        select ds.membership_id
        from device_sessions ds
        join memberships m on m.id = ds.membership_id and m.tenant_id = ds.tenant_id
        left join auth_principals ap on ap.id = m.auth_principal_id
        where ds.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${filter.windowFrom ?? null}::timestamptz is null
            or ds.last_seen_at >= ${filter.windowFrom ?? null}::timestamptz
          )
          and (
            ${filter.platform ?? null}::text is null
            or lower(coalesce(ds.platform, '')) = lower(${filter.platform ?? null})
          )
          and (
            ${filter.email ?? null}::text is null
            or lower(coalesce(ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.email ?? null}) || '%'
          )
        group by ds.membership_id
        having (
          ${filter.overLimitOnly ? true : false}::boolean = false
          or count(*) > ${limit}
        )
      ) learners
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listLearners(
    tx: TenantTx,
    query: ActiveDevicesRosterQuery,
    filter: ActiveDevicesRosterFilter,
  ): Promise<ActiveDevicesLearnerRow[]> {
    const skip = (query.page - 1) * query.limit;
    const limit = filter.registrationLimit ?? 1;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ds.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        count(*)::int as device_count,
        max(ds.last_seen_at) as last_seen_at,
        array_agg(distinct ds.platform) filter (where ds.platform is not null) as platforms,
        array_agg(distinct ds.ip_address) filter (where ds.ip_address is not null) as ip_addresses
      from device_sessions ds
      join memberships m on m.id = ds.membership_id and m.tenant_id = ds.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where ds.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ${filter.windowFrom ?? null}::timestamptz is null
          or ds.last_seen_at >= ${filter.windowFrom ?? null}::timestamptz
        )
        and (
          ${query.platform ?? null}::text is null
          or lower(coalesce(ds.platform, '')) = lower(${query.platform ?? null})
        )
        and (
          ${query.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.email ?? null}) || '%'
        )
      group by
        ds.membership_id,
        mp.display_name,
        ap.email,
        m.invited_email_normalized
      having (
        ${filter.overLimitOnly ? true : false}::boolean = false
        or count(*) > ${limit}
      )
      order by max(ds.last_seen_at) desc
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map((row) => ({
      membership_id: String(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      device_count: Number(row["device_count"] ?? 0),
      last_seen_at: row["last_seen_at"] instanceof Date ? row["last_seen_at"] : null,
      platforms: Array.isArray(row["platforms"])
        ? row["platforms"].filter((value): value is string => typeof value === "string")
        : null,
      ip_addresses: Array.isArray(row["ip_addresses"])
        ? row["ip_addresses"].filter((value): value is string => typeof value === "string")
        : null,
    }));
  },

  async countSessionsInWindow(
    tx: TenantTx,
    filter: ActiveDevicesRosterFilter,
    windowFromIso: string | null,
    windowToIso: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from device_sessions ds
      join memberships m on m.id = ds.membership_id and m.tenant_id = ds.tenant_id
      left join auth_principals ap on ap.id = m.auth_principal_id
      where ds.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ds.last_seen_at <= ${windowToIso}::timestamptz
        and (
          ${windowFromIso}::timestamptz is null
          or ds.last_seen_at >= ${windowFromIso}::timestamptz
        )
        and (
          ${filter.platform ?? null}::text is null
          or lower(coalesce(ds.platform, '')) = lower(${filter.platform ?? null})
        )
        and (
          ${filter.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.email ?? null}) || '%'
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countDistinctLearnersInWindow(
    tx: TenantTx,
    filter: ActiveDevicesRosterFilter,
    windowFromIso: string | null,
    windowToIso: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(distinct ds.membership_id)::bigint as count
      from device_sessions ds
      join memberships m on m.id = ds.membership_id and m.tenant_id = ds.tenant_id
      left join auth_principals ap on ap.id = m.auth_principal_id
      where ds.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ds.last_seen_at <= ${windowToIso}::timestamptz
        and (
          ${windowFromIso}::timestamptz is null
          or ds.last_seen_at >= ${windowFromIso}::timestamptz
        )
        and (
          ${filter.platform ?? null}::text is null
          or lower(coalesce(ds.platform, '')) = lower(${filter.platform ?? null})
        )
        and (
          ${filter.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.email ?? null}) || '%'
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countLearnersOverLimit(
    tx: TenantTx,
    filter: ActiveDevicesRosterFilter,
    registrationLimit: number,
    windowFromIso: string | null,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from (
        select ds.membership_id
        from device_sessions ds
        join memberships m on m.id = ds.membership_id and m.tenant_id = ds.tenant_id
        left join auth_principals ap on ap.id = m.auth_principal_id
        where ds.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${windowFromIso}::timestamptz is null
            or ds.last_seen_at >= ${windowFromIso}::timestamptz
          )
          and (
            ${filter.platform ?? null}::text is null
            or lower(coalesce(ds.platform, '')) = lower(${filter.platform ?? null})
          )
          and (
            ${filter.email ?? null}::text is null
            or lower(coalesce(ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.email ?? null}) || '%'
          )
        group by ds.membership_id
        having count(*) > ${registrationLimit}
      ) over_limit
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async getDailyTrend(
    tx: TenantTx,
    filter: ActiveDevicesRosterFilter,
    windowFromIso: string,
    windowToIso: string,
  ): Promise<Array<{ date: string; activeDevices: number; learnersSignedIn: number }>> {
    const rows = await tx.$queryRaw<
      Array<{ day: string; active_devices: bigint; learners_signed_in: bigint }>
    >`
      with days as (
        select generate_series(
          date_trunc('day', ${windowFromIso}::timestamptz),
          date_trunc('day', ${windowToIso}::timestamptz),
          interval '1 day'
        ) as day
      )
      select
        to_char(d.day, 'YYYY-MM-DD') as day,
        count(ds.id)::bigint as active_devices,
        count(distinct ds.membership_id)::bigint as learners_signed_in
      from days d
      left join device_sessions ds
        on ds.tenant_id = current_setting('app.tenant_id', true)::uuid
        and date_trunc('day', ds.last_seen_at) = d.day
        and (
          ${filter.platform ?? null}::text is null
          or lower(coalesce(ds.platform, '')) = lower(${filter.platform ?? null})
        )
      left join memberships m
        on m.id = ds.membership_id and m.tenant_id = ds.tenant_id
      left join auth_principals ap on ap.id = m.auth_principal_id
      where (
        ${filter.email ?? null}::text is null
        or ds.id is null
        or lower(coalesce(ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${filter.email ?? null}) || '%'
      )
      group by d.day
      order by d.day asc
    `;
    return rows.map((row) => ({
      date: row.day,
      activeDevices: Number(row.active_devices),
      learnersSignedIn: Number(row.learners_signed_in),
    }));
  },

  async findLearnerIdentity(
    tx: TenantTx,
    membershipId: string,
  ): Promise<{ learner_name: string | null; email: string | null } | null> {
    const rows = await tx.$queryRaw<Array<{ learner_name: string | null; email: string | null }>>`
      select
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.id = ${membershipId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async countOtherMembershipsWithFingerprint(
    tx: TenantTx,
    fingerprint: string,
    excludeMembershipId: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(distinct membership_id)::bigint as count
      from device_sessions
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and device_fingerprint = ${fingerprint}
        and membership_id <> ${excludeMembershipId}::uuid
    `;
    return Number(rows[0]?.count ?? 0);
  },
};
