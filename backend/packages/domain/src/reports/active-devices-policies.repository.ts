import type { TenantTx } from "@atlas/db";
import type {
  DeviceBlockedFingerprintItem,
  DevicePolicyOverrideItem,
  DevicePolicyTenantDefaults,
  DevicePolicyTargetsQuery,
} from "./active-devices-policies.dto";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

export type DevicePolicyOverrideRow = {
  id: string;
  scope_type: string;
  scope_id: string;
  devices_allowed: number;
  on_limit_reached: string;
  expires_at: Date | null;
  updated_by_membership_id: string | null;
  updated_at: Date;
  scope_label: string | null;
  updated_by_label: string | null;
  applies_to_count: number;
};

export type DeviceBlockedFingerprintRow = {
  id: string;
  fingerprint: string;
  reason: string;
  created_at: Date;
  blocked_by_label: string | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readInt(section: Record<string, unknown>, key: string, fallback: number): number {
  const value = section[key];
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return fallback;
}

function readBool(section: Record<string, unknown>, key: string, fallback = false): boolean {
  if (section[key] === true) return true;
  if (section[key] === false) return false;
  return fallback;
}

function parseOnLimit(value: unknown): DevicePolicyTenantDefaults["onLimitReached"] {
  if (value === "sign_out_oldest" || value === "allow_and_alert" || value === "block") {
    return value;
  }
  return "block";
}

function parseIdleDays(value: unknown): DevicePolicyTenantDefaults["idleSessionExpiryDays"] {
  if (value === null) return null;
  if (value === 7 || value === 14 || value === 30 || value === 90) return value;
  if (value === "7" || value === "14" || value === "30" || value === "90") {
    return Number(value) as 7 | 14 | 30 | 90;
  }
  if (value === "never" || value === "Never") return null;
  return 30;
}

export function mapTenantDefaults(security: Record<string, unknown>): DevicePolicyTenantDefaults {
  return {
    restrictionsEnabled: readBool(security, "deviceRestrictionsEnabled", false),
    devicesAllowed: clamp(readInt(security, "deviceRegistrationLimit", 1), 1, 10),
    restrictParallelLogins: readBool(security, "restrictParallelLogins", false),
    idleSessionExpiryDays: parseIdleDays(security["deviceIdleSessionExpiryDays"]),
    onLimitReached: parseOnLimit(security["deviceOnLimitReached"]),
    requireReverificationOnNewDevice: readBool(
      security,
      "deviceRequireReverificationOnNewDevice",
      true,
    ),
    notifyLearnerOnNewDevice: readBool(security, "deviceNotifyLearnerOnNewDevice", true),
    sharedFingerprintAlertEnabled: readBool(security, "deviceSharedFingerprintAlertEnabled", true),
    sharedFingerprintThreshold: clamp(
      readInt(security, "deviceSharedFingerprintThreshold", 2),
      2,
      50,
    ),
  };
}

export function mapOverrideRow(row: DevicePolicyOverrideRow): DevicePolicyOverrideItem {
  const onLimit =
    row.on_limit_reached === "sign_out_oldest" ||
    row.on_limit_reached === "allow_and_alert" ||
    row.on_limit_reached === "block" ||
    row.on_limit_reached === "inherit"
      ? row.on_limit_reached
      : "inherit";
  const scopeType =
    row.scope_type === "role" || row.scope_type === "batch" || row.scope_type === "learner"
      ? row.scope_type
      : "learner";
  return {
    id: row.id,
    scopeType,
    scopeId: row.scope_id,
    scopeLabel: row.scope_label?.trim() || "Unknown",
    devicesAllowed: row.devices_allowed,
    onLimitReached: onLimit,
    appliesToCount: Math.max(0, row.applies_to_count),
    updatedByLabel: row.updated_by_label,
    updatedAt: row.updated_at.toISOString(),
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
  };
}

export function mapBlockedRow(row: DeviceBlockedFingerprintRow): DeviceBlockedFingerprintItem {
  const fingerprint = row.fingerprint;
  return {
    id: row.id,
    fingerprint,
    fingerprintShort: fingerprint.slice(0, 10),
    reason: row.reason,
    blockedAt: row.created_at.toISOString(),
    blockedByLabel: row.blocked_by_label,
  };
}

export const activeDevicesPoliciesRepository = {
  async readSecuritySection(tx: TenantTx): Promise<Record<string, unknown>> {
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
    const security = root["security"];
    if (!security || typeof security !== "object" || Array.isArray(security)) return {};
    return security as Record<string, unknown>;
  },

  async mergeSecuritySection(tx: TenantTx, patch: Record<string, unknown>): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
      select config_json
      from tenant_config
      where tenant_id = current_setting('app.tenant_id', true)::uuid
      limit 1
    `;
    const existing =
      rows[0]?.config_json &&
      typeof rows[0].config_json === "object" &&
      !Array.isArray(rows[0].config_json)
        ? (rows[0].config_json as Record<string, unknown>)
        : {};
    const security =
      existing["security"] &&
      typeof existing["security"] === "object" &&
      !Array.isArray(existing["security"])
        ? (existing["security"] as Record<string, unknown>)
        : {};
    const nextConfig = {
      ...existing,
      security: {
        ...security,
        ...patch,
      },
    };
    await tx.$executeRaw`
      insert into tenant_config (
        id,
        tenant_id,
        config_json,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        current_setting('app.tenant_id', true)::uuid,
        ${JSON.stringify(nextConfig)}::jsonb,
        now(),
        now()
      )
      on conflict (tenant_id) do update set
        config_json = excluded.config_json,
        updated_at = now()
    `;
  },

  async listOverrides(tx: TenantTx): Promise<DevicePolicyOverrideRow[]> {
    return tx.$queryRaw<DevicePolicyOverrideRow[]>`
      select
        o.id::text as id,
        o.scope_type,
        o.scope_id::text as scope_id,
        o.devices_allowed,
        o.on_limit_reached,
        o.expires_at,
        o.updated_by_membership_id::text as updated_by_membership_id,
        o.updated_at,
        case o.scope_type
          when 'role' then coalesce(r.name, r.key, 'Role')
          when 'batch' then coalesce(b.name, b.key, 'Batch')
          when 'learner' then coalesce(mp.display_name, ap.email, m.invited_email_normalized, 'Learner')
          else 'Unknown'
        end as scope_label,
        coalesce(ump.display_name, uap.email, um.invited_email_normalized) as updated_by_label,
        case o.scope_type
          when 'role' then (
            select count(*)::int from user_roles ur
            where ur.tenant_id = o.tenant_id and ur.role_id = o.scope_id
          )
          when 'batch' then (
            select count(*)::int from batch_memberships bm
            where bm.tenant_id = o.tenant_id and bm.batch_id = o.scope_id
          )
          else 1
        end as applies_to_count
      from device_policy_overrides o
      left join roles r
        on r.id = o.scope_id and r.tenant_id = o.tenant_id and r.deleted_at is null
        and o.scope_type = 'role'
      left join batches b
        on b.id = o.scope_id and b.tenant_id = o.tenant_id
        and o.scope_type = 'batch'
      left join memberships m
        on m.id = o.scope_id and m.tenant_id = o.tenant_id
        and o.scope_type = 'learner'
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join memberships um on um.id = o.updated_by_membership_id and um.tenant_id = o.tenant_id
      left join member_profiles ump
        on ump.membership_id = um.id and ump.tenant_id = um.tenant_id and ump.deleted_at is null
      left join auth_principals uap on uap.id = um.auth_principal_id
      where o.tenant_id = current_setting('app.tenant_id', true)::uuid
      order by
        case o.scope_type
          when 'learner' then 0
          when 'batch' then 1
          when 'role' then 2
          else 3
        end,
        o.updated_at desc
    `;
  },

  async findOverride(tx: TenantTx, overrideId: string): Promise<DevicePolicyOverrideRow | null> {
    const rows = await tx.$queryRaw<DevicePolicyOverrideRow[]>`
      select
        o.id::text as id,
        o.scope_type,
        o.scope_id::text as scope_id,
        o.devices_allowed,
        o.on_limit_reached,
        o.expires_at,
        o.updated_by_membership_id::text as updated_by_membership_id,
        o.updated_at,
        case o.scope_type
          when 'role' then coalesce(r.name, r.key, 'Role')
          when 'batch' then coalesce(b.name, b.key, 'Batch')
          when 'learner' then coalesce(mp.display_name, ap.email, m.invited_email_normalized, 'Learner')
          else 'Unknown'
        end as scope_label,
        coalesce(ump.display_name, uap.email, um.invited_email_normalized) as updated_by_label,
        case o.scope_type
          when 'role' then (
            select count(*)::int from user_roles ur
            where ur.tenant_id = o.tenant_id and ur.role_id = o.scope_id
          )
          when 'batch' then (
            select count(*)::int from batch_memberships bm
            where bm.tenant_id = o.tenant_id and bm.batch_id = o.scope_id
          )
          else 1
        end as applies_to_count
      from device_policy_overrides o
      left join roles r
        on r.id = o.scope_id and r.tenant_id = o.tenant_id and r.deleted_at is null
        and o.scope_type = 'role'
      left join batches b
        on b.id = o.scope_id and b.tenant_id = o.tenant_id
        and o.scope_type = 'batch'
      left join memberships m
        on m.id = o.scope_id and m.tenant_id = o.tenant_id
        and o.scope_type = 'learner'
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join memberships um on um.id = o.updated_by_membership_id and um.tenant_id = o.tenant_id
      left join member_profiles ump
        on ump.membership_id = um.id and ump.tenant_id = um.tenant_id and ump.deleted_at is null
      left join auth_principals uap on uap.id = um.auth_principal_id
      where o.tenant_id = current_setting('app.tenant_id', true)::uuid
        and o.id = ${overrideId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertOverride(
    tx: TenantTx,
    input: {
      scopeType: string;
      scopeId: string;
      devicesAllowed: number;
      onLimitReached: string;
      expiresAt: Date | null;
      actorMembershipId: string | null;
    },
  ): Promise<string> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      insert into device_policy_overrides (
        id,
        tenant_id,
        scope_type,
        scope_id,
        devices_allowed,
        on_limit_reached,
        expires_at,
        updated_by_membership_id,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        current_setting('app.tenant_id', true)::uuid,
        ${input.scopeType},
        ${input.scopeId}::uuid,
        ${input.devicesAllowed},
        ${input.onLimitReached},
        ${input.expiresAt},
        ${input.actorMembershipId}::uuid,
        now(),
        now()
      )
      on conflict (tenant_id, scope_type, scope_id) do update set
        devices_allowed = excluded.devices_allowed,
        on_limit_reached = excluded.on_limit_reached,
        expires_at = excluded.expires_at,
        updated_by_membership_id = excluded.updated_by_membership_id,
        updated_at = now()
      returning id::text as id
    `;
    return defined(rows[0]).id;
  },

  async updateOverride(
    tx: TenantTx,
    overrideId: string,
    input: {
      devicesAllowed: number;
      onLimitReached: string;
      expiresAt: Date | null;
      actorMembershipId: string | null;
    },
  ): Promise<boolean> {
    const result = await tx.$executeRaw`
      update device_policy_overrides
      set
        devices_allowed = ${input.devicesAllowed},
        on_limit_reached = ${input.onLimitReached},
        expires_at = ${input.expiresAt},
        updated_by_membership_id = ${input.actorMembershipId}::uuid,
        updated_at = now()
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and id = ${overrideId}::uuid
    `;
    return result > 0;
  },

  async deleteOverride(tx: TenantTx, overrideId: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      delete from device_policy_overrides
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and id = ${overrideId}::uuid
    `;
    return result > 0;
  },

  async listBlockedFingerprints(tx: TenantTx): Promise<DeviceBlockedFingerprintRow[]> {
    return tx.$queryRaw<DeviceBlockedFingerprintRow[]>`
      select
        b.id::text as id,
        b.fingerprint,
        b.reason,
        b.created_at,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as blocked_by_label
      from device_blocked_fingerprints b
      left join memberships m on m.id = b.blocked_by_membership_id and m.tenant_id = b.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where b.tenant_id = current_setting('app.tenant_id', true)::uuid
      order by b.created_at desc
      limit 200
    `;
  },

  async insertBlockedFingerprint(
    tx: TenantTx,
    input: { fingerprint: string; reason: string; actorMembershipId: string | null },
  ): Promise<string> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      insert into device_blocked_fingerprints (
        id,
        tenant_id,
        fingerprint,
        reason,
        blocked_by_membership_id,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        current_setting('app.tenant_id', true)::uuid,
        ${input.fingerprint},
        ${input.reason},
        ${input.actorMembershipId}::uuid,
        now(),
        now()
      )
      on conflict (tenant_id, fingerprint) do update set
        reason = excluded.reason,
        blocked_by_membership_id = excluded.blocked_by_membership_id,
        updated_at = now()
      returning id::text as id
    `;
    return defined(rows[0]).id;
  },

  async findBlockedFingerprint(
    tx: TenantTx,
    blockId: string,
  ): Promise<DeviceBlockedFingerprintRow | null> {
    const rows = await tx.$queryRaw<DeviceBlockedFingerprintRow[]>`
      select
        b.id::text as id,
        b.fingerprint,
        b.reason,
        b.created_at,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as blocked_by_label
      from device_blocked_fingerprints b
      left join memberships m on m.id = b.blocked_by_membership_id and m.tenant_id = b.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where b.tenant_id = current_setting('app.tenant_id', true)::uuid
        and b.id = ${blockId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async deleteBlockedFingerprint(tx: TenantTx, blockId: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      delete from device_blocked_fingerprints
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and id = ${blockId}::uuid
    `;
    return result > 0;
  },

  async scopeExists(tx: TenantTx, scopeType: string, scopeId: string): Promise<boolean> {
    if (scopeType === "role") {
      const rows = await tx.$queryRaw<Array<{ ok: number }>>`
        select 1 as ok from roles
        where tenant_id = current_setting('app.tenant_id', true)::uuid
          and id = ${scopeId}::uuid
          and deleted_at is null
        limit 1
      `;
      return Boolean(rows[0]);
    }
    if (scopeType === "batch") {
      const rows = await tx.$queryRaw<Array<{ ok: number }>>`
        select 1 as ok from batches
        where tenant_id = current_setting('app.tenant_id', true)::uuid
          and id = ${scopeId}::uuid
        limit 1
      `;
      return Boolean(rows[0]);
    }
    const rows = await tx.$queryRaw<Array<{ ok: number }>>`
      select 1 as ok from memberships
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and id = ${scopeId}::uuid
      limit 1
    `;
    return Boolean(rows[0]);
  },

  async searchTargets(
    tx: TenantTx,
    query: DevicePolicyTargetsQuery,
  ): Promise<Array<{ id: string; label: string; secondary: string | null }>> {
    const q = `%${query.q.trim().toLowerCase()}%`;
    const limit = query.limit;

    if (query.scopeType === "role") {
      const rows = await tx.$queryRaw<
        Array<{ id: string; label: string; secondary: string | null }>
      >`
        select
          r.id::text as id,
          r.name as label,
          r.key as secondary
        from roles r
        where r.tenant_id = current_setting('app.tenant_id', true)::uuid
          and r.deleted_at is null
          and (
            ${query.q.trim()} = ''
            or lower(r.name) like ${q}
            or lower(r.key) like ${q}
          )
        order by r.name asc
        limit ${limit}
      `;
      return rows;
    }

    if (query.scopeType === "batch") {
      const rows = await tx.$queryRaw<
        Array<{ id: string; label: string; secondary: string | null }>
      >`
        select
          b.id::text as id,
          b.name as label,
          b.key as secondary
        from batches b
        where b.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.q.trim()} = ''
            or lower(b.name) like ${q}
            or lower(b.key) like ${q}
          )
        order by b.name asc
        limit ${limit}
      `;
      return rows;
    }

    const rows = await tx.$queryRaw<Array<{ id: string; label: string; secondary: string | null }>>`
      select
        m.id::text as id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized, 'Learner') as label,
        coalesce(ap.email, m.invited_email_normalized) as secondary
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and m.removed_at is null
        and (
          ${query.q.trim()} = ''
          or lower(coalesce(mp.display_name, '')) like ${q}
          or lower(coalesce(ap.email, m.invited_email_normalized, '')) like ${q}
        )
      order by coalesce(mp.display_name, ap.email, m.invited_email_normalized) asc
      limit ${limit}
    `;
    return rows;
  },
};
