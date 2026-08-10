import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { JobStatus } from "./reports.contract";
import type { BiExportJobRow } from "./bi-export.types";

function mapBiExportRow(row: Record<string, unknown>): BiExportJobRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    requested_by_membership_id: String(row["requested_by_membership_id"]),
    status: String(row["status"]) as JobStatus,
    dataset_key: String(row["dataset_key"]),
    params_json: row["params_json"] ?? null,
    r2_object_key: typeof row["r2_object_key"] === "string" ? row["r2_object_key"] : null,
    error_json: row["error_json"] ?? null,
    completed_at: row["completed_at"] instanceof Date ? row["completed_at"] : null,
    expires_at: row["expires_at"] instanceof Date ? row["expires_at"] : null,
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

export const biExportRepository = {
  async insertJob(
    tx: TenantTx,
    args: {
      requestedByMembershipId: string;
      datasetKey: string;
      paramsJson: unknown;
    },
  ): Promise<BiExportJobRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into bi_export_jobs (
        id,
        tenant_id,
        requested_by_membership_id,
        status,
        dataset_key,
        params_json,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.requestedByMembershipId}::uuid,
        'QUEUED',
        ${args.datasetKey},
        ${JSON.stringify(args.paramsJson)}::jsonb,
        now(),
        now()
      )
      returning *
    `;

    const row = rows[0];
    if (!row) {
      throw new Error("BI_EXPORT_JOB_INSERT_FAILED");
    }

    return mapBiExportRow(row);
  },

  async findById(tx: TenantTx, jobId: string): Promise<BiExportJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from bi_export_jobs
      where id = ${jobId}::uuid
      limit 1
    `;

    const row = rows[0];
    return row ? mapBiExportRow(row) : null;
  },

  async listJobs(
    tx: TenantTx,
    args: {
      status?: JobStatus;
      cursor?: string;
      limit: number;
    },
  ): Promise<BiExportJobRow[]> {
    if (args.status && args.cursor) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from bi_export_jobs
        where status = ${args.status}
          and id < ${args.cursor}::uuid
        order by created_at desc, id desc
        limit ${args.limit + 1}
      `;
      return rows.map(mapBiExportRow);
    }

    if (args.status) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from bi_export_jobs
        where status = ${args.status}
        order by created_at desc, id desc
        limit ${args.limit + 1}
      `;
      return rows.map(mapBiExportRow);
    }

    if (args.cursor) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from bi_export_jobs
        where id < ${args.cursor}::uuid
        order by created_at desc, id desc
        limit ${args.limit + 1}
      `;
      return rows.map(mapBiExportRow);
    }

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from bi_export_jobs
      order by created_at desc, id desc
      limit ${args.limit + 1}
    `;
    return rows.map(mapBiExportRow);
  },

  async markRunning(tx: TenantTx, jobId: string): Promise<BiExportJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update bi_export_jobs
      set status = 'RUNNING', updated_at = now()
      where id = ${jobId}::uuid
        and status = 'QUEUED'
      returning *
    `;

    const row = rows[0];
    return row ? mapBiExportRow(row) : null;
  },

  async markSucceeded(
    tx: TenantTx,
    args: {
      jobId: string;
      objectKey: string;
      expiresAt: Date;
    },
  ): Promise<BiExportJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update bi_export_jobs
      set
        status = 'SUCCEEDED',
        r2_object_key = ${args.objectKey},
        error_json = null,
        completed_at = now(),
        expires_at = ${args.expiresAt},
        updated_at = now()
      where id = ${args.jobId}::uuid
      returning *
    `;

    const row = rows[0];
    return row ? mapBiExportRow(row) : null;
  },

  async markFailed(
    tx: TenantTx,
    args: {
      jobId: string;
      errorCode: string;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      update bi_export_jobs
      set
        status = 'FAILED',
        error_json = ${JSON.stringify({ code: args.errorCode })}::jsonb,
        completed_at = now(),
        updated_at = now()
      where id = ${args.jobId}::uuid
    `;
  },

  async clearFile(tx: TenantTx, jobId: string): Promise<BiExportJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update bi_export_jobs
      set
        r2_object_key = null,
        updated_at = now()
      where id = ${jobId}::uuid
        and r2_object_key is not null
      returning *
    `;
    const row = rows[0];
    return row ? mapBiExportRow(row) : null;
  },

  async cancelJob(tx: TenantTx, jobId: string): Promise<BiExportJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update bi_export_jobs
      set
        status = 'CANCELLED',
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
      where id = ${jobId}::uuid
        and status in ('QUEUED', 'RUNNING')
      returning *
    `;
    const row = rows[0];
    return row ? mapBiExportRow(row) : null;
  },
};
