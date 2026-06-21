import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { JobStatus } from "./data-rights.contract";
import type { DeletionRequestRow, ExportJobRow, TenantExportSnapshot } from "./data-rights.types";

function mapExportJobRow(row: Record<string, unknown>): ExportJobRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    requested_by_membership_id: String(row["requested_by_membership_id"]),
    status: String(row["status"]) as JobStatus,
    scope_json: row["scope_json"],
    r2_object_key: typeof row["r2_object_key"] === "string" ? row["r2_object_key"] : null,
    error_json: row["error_json"] ?? null,
    expires_at: row["expires_at"] instanceof Date ? row["expires_at"] : null,
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

function mapDeletionRequestRow(row: Record<string, unknown>): DeletionRequestRow {
  return {
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

  async markExportJobSucceeded(
    tx: TenantTx,
    args: {
      exportJobId: string;
      objectKey: string;
      expiresAt: Date;
    },
  ): Promise<ExportJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update export_jobs
      set
        status = 'SUCCEEDED',
        r2_object_key = ${args.objectKey},
        expires_at = ${args.expiresAt},
        error_json = null,
        updated_at = now()
      where id = ${args.exportJobId}::uuid
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
      where id = ${args.exportJobId}::uuid
    `;
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
  ): Promise<DeletionRequestRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from deletion_requests
      where id = ${deletionRequestId}::uuid
      limit 1
    `;

    const row = rows[0];
    return row ? mapDeletionRequestRow(row) : null;
  },

  async markDeletionRequestSucceeded(
    tx: TenantTx,
    deletionRequestId: string,
  ): Promise<DeletionRequestRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update deletion_requests
      set
        status = 'SUCCEEDED',
        completed_at = now(),
        updated_at = now()
      where id = ${deletionRequestId}::uuid
        and status = 'QUEUED'
      returning *
    `;

    const row = rows[0];
    return row ? mapDeletionRequestRow(row) : null;
  },

  async buildTenantExportSnapshot(tx: TenantTx, tenantId: string): Promise<TenantExportSnapshot> {
    const memberships = await tx.$queryRaw<Array<{ id: string; status: string; joined_at: Date }>>`
      select id::text, status, joined_at
      from memberships
      where tenant_id = ${tenantId}::uuid
      order by joined_at asc
    `;

    const profiles = await tx.$queryRaw<
      Array<{ membership_id: string; display_name: string | null }>
    >`
      select membership_id::text, display_name
      from member_profiles
      where tenant_id = ${tenantId}::uuid
      order by created_at asc
    `;

    const courses = await tx.$queryRaw<
      Array<{ id: string; slug: string; title: string; status: string }>
    >`
      select id::text, slug, title, status
      from courses
      where tenant_id = ${tenantId}::uuid
        and deleted_at is null
      order by updated_at desc
    `;

    const enrollments = await tx.$queryRaw<
      Array<{ id: string; course_id: string; membership_id: string; status: string }>
    >`
      select id::text, course_id::text, membership_id::text, status
      from enrollments
      where tenant_id = ${tenantId}::uuid
      order by enrolled_at desc
    `;

    return {
      exportedAt: new Date().toISOString(),
      tenantId,
      memberships: memberships.map((row) => ({
        id: row.id,
        status: row.status,
        joinedAt: row.joined_at.toISOString(),
      })),
      memberProfiles: profiles.map((row) => ({
        membershipId: row.membership_id,
        displayName: row.display_name,
      })),
      courses: courses.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.status,
      })),
      enrollments: enrollments.map((row) => ({
        id: row.id,
        courseId: row.course_id,
        membershipId: row.membership_id,
        status: row.status,
      })),
    };
  },
};
