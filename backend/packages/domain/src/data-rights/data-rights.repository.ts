import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { JobStatus } from "./data-rights.contract";
import type { DeletionRequestRow, ExportJobRow } from "./data-rights.types";
import { ERASURE_DELAY_DAYS } from "./privacy-lifecycle.contract";

function mapExportJobRow(row: Record<string, unknown>): ExportJobRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    requested_by_membership_id: String(row["requested_by_membership_id"]),
    status: String(row["status"]) as JobStatus,
    scope_json: row["scope_json"],
    artifact_json: row["artifact_json"] ?? null,
    r2_object_key: typeof row["r2_object_key"] === "string" ? row["r2_object_key"] : null,
    error_json: row["error_json"] ?? null,
    expires_at: row["expires_at"] instanceof Date ? row["expires_at"] : null,
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

function mapDeletionRequestRow(row: Record<string, unknown>): DeletionRequestRow {
  return {
    outcome_json: row["outcome_json"] ?? null,
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    requested_by_membership_id:
      typeof row["requested_by_membership_id"] === "string"
        ? row["requested_by_membership_id"]
        : null,
    target_type: String(row["target_type"]),
    target_id: String(row["target_id"]),
    status: String(row["status"]) as JobStatus,
    reason: typeof row["reason"] === "string" ? row["reason"] : null,
    scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
    completed_at: row["completed_at"] instanceof Date ? row["completed_at"] : null,
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

export const dataRightsRepository = {
  async insertExportJob(
    tx: TenantTx,
    args: {
      requestedByMembershipId: string;
      scopeJson: unknown;
    },
  ): Promise<ExportJobRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into export_jobs (
        id,
        tenant_id,
        requested_by_membership_id,
        status,
        scope_json,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.requestedByMembershipId}::uuid,
        'QUEUED',
        ${JSON.stringify(args.scopeJson)}::jsonb,
        now(),
        now()
      )
      returning *
    `;

    const row = rows[0];
    if (!row) {
      throw new Error("EXPORT_JOB_INSERT_FAILED");
    }

    return mapExportJobRow(row);
  },

  /**
   * A readable name for each membership: profile name, else account name,
   * else email (QA S2.7, review 1 m18 — names, not IDs).
   */
  async memberDisplayNames(tx: TenantTx, membershipIds: string[]): Promise<Map<string, string>> {
    const ids = [...new Set(membershipIds)];
    if (ids.length === 0) return new Map();
    const rows = await tx.$queryRaw<Array<{ id: string; name: string | null }>>`
      select
        m.id::text as id,
        coalesce(
          nullif(btrim(mp.display_name), ''),
          nullif(btrim(ap.name), ''),
          ap.email,
          m.invited_email_normalized
        ) as name
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.id = any(${ids}::uuid[])
    `;
    return new Map(
      rows.flatMap((row) => (row.name ? [[row.id, row.name] as [string, string]] : [])),
    );
  },

  async listExportJobs(
    tx: TenantTx,
    args: {
      status?: JobStatus;
      cursor?: string;
      limit: number;
    },
  ): Promise<ExportJobRow[]> {
    if (args.status && args.cursor) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from export_jobs
        where status = ${args.status}
          and id < ${args.cursor}::uuid
        order by created_at desc, id desc
        limit ${args.limit + 1}
      `;
      return rows.map(mapExportJobRow);
    }

    if (args.status) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from export_jobs
        where status = ${args.status}
        order by created_at desc, id desc
        limit ${args.limit + 1}
      `;
      return rows.map(mapExportJobRow);
    }

    if (args.cursor) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from export_jobs
        where id < ${args.cursor}::uuid
        order by created_at desc, id desc
        limit ${args.limit + 1}
      `;
      return rows.map(mapExportJobRow);
    }

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from export_jobs
      order by created_at desc, id desc
      limit ${args.limit + 1}
    `;
    return rows.map(mapExportJobRow);
  },

  async findExportJobById(tx: TenantTx, exportJobId: string): Promise<ExportJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from export_jobs
      where id = ${exportJobId}::uuid
      limit 1
    `;

    const row = rows[0];
    return row ? mapExportJobRow(row) : null;
  },

  async claimExportJobForProcessing(
    tx: TenantTx,
    exportJobId: string,
  ): Promise<ExportJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update export_jobs
      set status = 'RUNNING', updated_at = now()
      where id = ${exportJobId}::uuid
        and status = 'QUEUED'
      returning *
    `;

    const row = rows[0];
    return row ? mapExportJobRow(row) : null;
  },

  async lockRunningExportJob(tx: TenantTx, exportJobId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id from export_jobs
      where id = ${exportJobId}::uuid and status = 'RUNNING'
      for update
    `;
    return rows.length > 0;
  },

  /** Release only this worker's successfully claimed job after its work stops. */
  async requeueExportJob(tx: TenantTx, exportJobId: string): Promise<void> {
    await tx.$executeRaw`
      update export_jobs
      set status = 'QUEUED',
        error_json = '{"code":"EXPORT_GENERATION_RETRY_PENDING"}'::jsonb,
        updated_at = now()
      where id = ${exportJobId}::uuid and status = 'RUNNING'
    `;
  },

  async registerExportArtifact(
    tx: TenantTx,
    args: { exportJobId: string; objectKey: string; expiresAt: Date; artifact: unknown },
  ): Promise<void> {
    const count = await tx.$executeRaw`
      update export_jobs set r2_object_key = ${args.objectKey}, artifact_json = ${JSON.stringify(args.artifact)}::jsonb,
        expires_at = ${args.expiresAt}, updated_at = now()
      where id = ${args.exportJobId}::uuid and status = 'RUNNING'
    `;
    if (count !== 1) throw new Error("EXPORT_JOB_NOT_RUNNING");
  },
  async markExportWriterStopped(tx: TenantTx, exportJobId: string): Promise<void> {
    await tx.$executeRaw`
      update export_jobs set artifact_json = artifact_json || jsonb_build_object('writerStoppedAt', now()), updated_at = now()
      where id = ${exportJobId}::uuid and status in ('RUNNING', 'CANCELLED') and artifact_json is not null
    `;
  },
  async markExportJobSucceeded(
    tx: TenantTx,
    args: {
      exportJobId: string;
      objectKey: string;
      expiresAt: Date;
      artifact: unknown;
    },
  ): Promise<ExportJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update export_jobs
      set
        status = 'SUCCEEDED',
        artifact_json = ${JSON.stringify(args.artifact)}::jsonb,
        r2_object_key = ${args.objectKey},
        expires_at = ${args.expiresAt},
        error_json = null,
        updated_at = now()
      where id = ${args.exportJobId}::uuid and status = 'RUNNING'
        and r2_object_key = ${args.objectKey}
      returning *
    `;

    const row = rows[0];
    return row ? mapExportJobRow(row) : null;
  },

  async markExportJobFailed(
    tx: TenantTx,
    args: {
      exportJobId: string;
      errorCode: string;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      update export_jobs
      set
        status = 'FAILED',
        error_json = ${JSON.stringify({ code: args.errorCode })}::jsonb,
        updated_at = now()
      where id = ${args.exportJobId}::uuid and status = 'RUNNING'
    `;
  },

  async clearExportJobFile(tx: TenantTx, exportJobId: string): Promise<ExportJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update export_jobs
      set
        r2_object_key = null,
        updated_at = now()
      where id = ${exportJobId}::uuid
        and r2_object_key is not null
      returning *
    `;
    const row = rows[0];
    return row ? mapExportJobRow(row) : null;
  },

  async cancelExportJob(tx: TenantTx, exportJobId: string): Promise<ExportJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update export_jobs
      set
        status = 'CANCELLED',
        updated_at = now()
      where id = ${exportJobId}::uuid
        and status in ('QUEUED', 'RUNNING')
      returning *
    `;
    const row = rows[0];
    return row ? mapExportJobRow(row) : null;
  },

  async insertDeletionRequest(
    tx: TenantTx,
    args: {
      requestedByMembershipId: string;
      targetType: string;
      targetId: string;
      reason: string | null;
    },
  ): Promise<DeletionRequestRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into deletion_requests (
        id,
        tenant_id,
        requested_by_membership_id,
        target_type,
        target_id,
        status,
        reason,
        scheduled_at,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.requestedByMembershipId}::uuid,
        ${args.targetType},
        ${args.targetId},
        'QUEUED',
        ${args.reason},
        -- Erased this long after the request unless an admin processes it
        -- sooner (launch plan 5.7).
        now() + make_interval(days => ${ERASURE_DELAY_DAYS}::int),
        now(),
        now()
      )
      returning *
    `;

    const row = rows[0];
    if (!row) {
      throw new Error("DELETION_REQUEST_INSERT_FAILED");
    }

    return mapDeletionRequestRow(row);
  },

  async findPendingDeletionRequestForTarget(
    tx: TenantTx,
    args: {
      targetType: string;
      targetId: string;
    },
  ): Promise<DeletionRequestRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from deletion_requests
      where target_type = ${args.targetType}
        and target_id = ${args.targetId}
        and status in ('QUEUED', 'RUNNING')
      limit 1
    `;

    const row = rows[0];
    return row ? mapDeletionRequestRow(row) : null;
  },

  async listDeletionRequests(
    tx: TenantTx,
    args: {
      status?: JobStatus;
      cursor?: string;
      limit: number;
    },
  ): Promise<DeletionRequestRow[]> {
    if (args.status && args.cursor) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from deletion_requests
        where status = ${args.status}
          and id < ${args.cursor}::uuid
        order by created_at desc, id desc
        limit ${args.limit + 1}
      `;
      return rows.map(mapDeletionRequestRow);
    }

    if (args.status) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from deletion_requests
        where status = ${args.status}
        order by created_at desc, id desc
        limit ${args.limit + 1}
      `;
      return rows.map(mapDeletionRequestRow);
    }

    if (args.cursor) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from deletion_requests
        where id < ${args.cursor}::uuid
        order by created_at desc, id desc
        limit ${args.limit + 1}
      `;
      return rows.map(mapDeletionRequestRow);
    }

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from deletion_requests
      order by created_at desc, id desc
      limit ${args.limit + 1}
    `;
    return rows.map(mapDeletionRequestRow);
  },

  async findDeletionRequestById(
    tx: TenantTx,
    deletionRequestId: string,
    lockForProcessing = false,
  ): Promise<DeletionRequestRow | null> {
    if (lockForProcessing) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select * from deletion_requests
        where id = ${deletionRequestId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
        for update
      `;
      return rows[0] ? mapDeletionRequestRow(rows[0]) : null;
    }
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from deletion_requests
      where id = ${deletionRequestId}::uuid
      limit 1
    `;

    const row = rows[0];
    return row ? mapDeletionRequestRow(row) : null;
  },

  /**
   * Brings a queued request's erasure forward to now: an admin processing it.
   * The worker carries it out on its next sweep (launch plan 5.7).
   */
  async expediteDeletionRequest(
    tx: TenantTx,
    deletionRequestId: string,
  ): Promise<DeletionRequestRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update deletion_requests
      set scheduled_at = clock_timestamp(), updated_at = now()
      where id = ${deletionRequestId}::uuid
        and tenant_id = current_setting('app.tenant_id', true)::uuid
        and status in ('QUEUED', 'RUNNING')
        -- Already due: nothing to bring forward. clock_timestamp(), not now():
        -- a request processed twice at once is brought forward once.
        and (scheduled_at is null or scheduled_at > clock_timestamp())
      returning *
    `;
    const row = rows[0];
    return row ? mapDeletionRequestRow(row) : null;
  },

  /** Requests whose erasure is due, oldest first, for the worker. */
  async listDueDeletionRequests(tx: TenantTx, limit: number): Promise<DeletionRequestRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from deletion_requests
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and target_type = 'membership'
        and status in ('QUEUED', 'RUNNING')
        and scheduled_at is not null
        and scheduled_at <= now()
      order by scheduled_at, id
      limit ${limit}
    `;
    return rows.map(mapDeletionRequestRow);
  },

  /** A request the erasure refused for good (for example, the academy owner). */
  async markDeletionRequestFailed(
    tx: TenantTx,
    deletionRequestId: string,
    errorCode: string,
  ): Promise<void> {
    await tx.$executeRaw`
      update deletion_requests
      set status = 'FAILED',
          outcome_json = jsonb_build_object('version', 2, 'operation', 'erase_member', 'error', ${errorCode}::text),
          completed_at = now(),
          updated_at = now()
      where id = ${deletionRequestId}::uuid
        and tenant_id = current_setting('app.tenant_id', true)::uuid
        and status in ('QUEUED', 'RUNNING')
    `;
  },
};
