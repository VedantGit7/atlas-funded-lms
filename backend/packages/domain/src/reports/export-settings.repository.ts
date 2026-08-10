import type { TenantTx } from "@atlas/db";
import type { ExportSettings } from "./export-settings.dto";

const AVG_FILE_BYTES = 22_000;

export type ExportSettingsRow = {
  tenant_id: string;
  settings_json: unknown;
  updated_by_membership_id: string | null;
  created_at: Date;
  updated_at: Date;
  updated_by_name: string | null;
};

export type StorageStatsRow = {
  files_stored_count: number;
  expiring_soon_count: number;
  expired_count: number;
};

export function retentionCutoff(value: number, unit: "days" | "hours"): Date {
  const ms = unit === "hours" ? value * 3_600_000 : value * 86_400_000;
  return new Date(Date.now() - ms);
}

export function retentionLabel(value: number, unit: "days" | "hours"): string {
  if (unit === "hours") return `${value} hour${value === 1 ? "" : "s"}`;
  return `${value} day${value === 1 ? "" : "s"}`;
}

export function estimateBytes(fileCount: number): number {
  return Math.max(0, fileCount) * AVG_FILE_BYTES;
}

export const exportSettingsRepository = {
  async get(tx: TenantTx): Promise<ExportSettingsRow | null> {
    const rows = await tx.$queryRaw<ExportSettingsRow[]>`
      select
        s.tenant_id,
        s.settings_json,
        s.updated_by_membership_id,
        s.created_at,
        s.updated_at,
        (
          select coalesce(nullif(trim(mp.display_name), ''), ap.email)
          from memberships m
          left join member_profiles mp on mp.membership_id = m.id
          left join auth_principals ap on ap.id = m.auth_principal_id
          where m.id = s.updated_by_membership_id
          limit 1
        ) as updated_by_name
      from report_export_settings s
      where s.tenant_id = current_setting('app.tenant_id', true)::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async upsert(
    tx: TenantTx,
    settings: ExportSettings,
    updatedByMembershipId: string,
  ): Promise<ExportSettingsRow> {
    await tx.$executeRaw`
      insert into report_export_settings (
        tenant_id,
        settings_json,
        updated_by_membership_id,
        created_at,
        updated_at
      ) values (
        current_setting('app.tenant_id', true)::uuid,
        ${JSON.stringify(settings)}::jsonb,
        ${updatedByMembershipId}::uuid,
        now(),
        now()
      )
      on conflict (tenant_id) do update set
        settings_json = excluded.settings_json,
        updated_by_membership_id = excluded.updated_by_membership_id,
        updated_at = now()
    `;
    const row = await this.get(tx);
    if (!row) throw new Error("Failed to upsert export settings.");
    return row;
  },

  async listRoles(tx: TenantTx) {
    return tx.$queryRaw<Array<{ key: string; name: string }>>`
      select key, name
      from roles
      where deleted_at is null
      order by name asc
    `;
  },

  async countExternalDestinations(tx: TenantTx): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      select count(*)::int as count
      from report_delivery_destinations
      where is_active = true
        and kind in ('email', 'webhook', 'storage')
    `;
    return rows[0]?.count ?? 0;
  },

  async storageStats(tx: TenantTx): Promise<StorageStatsRow> {
    const rows = await tx.$queryRaw<StorageStatsRow[]>`
      with files as (
        select expires_at, r2_object_key
        from report_runs
        where r2_object_key is not null
        union all
        select expires_at, r2_object_key
        from export_jobs
        where r2_object_key is not null
      )
      select
        count(*) filter (
          where expires_at is null or expires_at > now()
        )::int as files_stored_count,
        count(*) filter (
          where expires_at is not null
            and expires_at > now()
            and expires_at <= now() + interval '48 hours'
        )::int as expiring_soon_count,
        count(*) filter (
          where expires_at is not null
            and expires_at <= now()
        )::int as expired_count
      from files
    `;
    return (
      rows[0] ?? {
        files_stored_count: 0,
        expiring_soon_count: 0,
        expired_count: 0,
      }
    );
  },

  async countFilesOutsideRetention(tx: TenantTx, cutoff: Date): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      with files as (
        select coalesce(completed_at, created_at) as finished_at
        from report_runs
        where r2_object_key is not null
        union all
        select created_at as finished_at
        from export_jobs
        where r2_object_key is not null
      )
      select count(*)::int as count
      from files
      where finished_at < ${cutoff}
    `;
    return rows[0]?.count ?? 0;
  },

  async purgeExpiredFiles(tx: TenantTx): Promise<number> {
    const reportResult = await tx.$executeRaw`
      update report_runs
      set
        r2_object_key = null,
        updated_at = now()
      where r2_object_key is not null
        and expires_at is not null
        and expires_at <= now()
    `;
    const jobResult = await tx.$executeRaw`
      update export_jobs
      set
        r2_object_key = null,
        updated_at = now()
      where r2_object_key is not null
        and expires_at is not null
        and expires_at <= now()
    `;
    const a = typeof reportResult === "number" ? reportResult : 0;
    const b = typeof jobResult === "number" ? jobResult : 0;
    return a + b;
  },

  async purgeFilesOlderThan(tx: TenantTx, cutoff: Date): Promise<number> {
    const reportResult = await tx.$executeRaw`
      update report_runs
      set
        r2_object_key = null,
        updated_at = now()
      where r2_object_key is not null
        and coalesce(completed_at, created_at) < ${cutoff}
    `;
    const jobResult = await tx.$executeRaw`
      update export_jobs
      set
        r2_object_key = null,
        updated_at = now()
      where r2_object_key is not null
        and created_at < ${cutoff}
    `;
    const a = typeof reportResult === "number" ? reportResult : 0;
    const b = typeof jobResult === "number" ? jobResult : 0;
    return a + b;
  },

  async listRecentSettingsAudit(tx: TenantTx, limit = 8) {
    return tx.$queryRaw<
      Array<{
        id: string;
        occurred_at: Date;
        action: string;
        metadata_json: unknown;
        actor_name: string | null;
      }>
    >`
      select
        a.id,
        a.occurred_at,
        a.action,
        a.metadata_json,
        (
          select coalesce(nullif(trim(mp.display_name), ''), ap.email, 'Unknown')
          from memberships m
          left join member_profiles mp on mp.membership_id = m.id
          left join auth_principals ap on ap.id = m.auth_principal_id
          where m.id = a.actor_membership_id
          limit 1
        ) as actor_name
      from audit_entries a
      where a.target_type = 'report_export_settings'
      order by a.occurred_at desc, a.id desc
      limit ${limit}
    `;
  },
};
