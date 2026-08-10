import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { JobStatus, ReportFormat } from "./reports.contract";
import type {
  ReportDefinitionRow,
  ReportRunRow,
  ReportScheduleRow,
  SystemReportDefinition,
} from "./reports.types";

function mapDefinitionRow(row: Record<string, unknown>): ReportDefinitionRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    key: String(row["key"]),
    category: String(row["category"]),
    title: String(row["title"]),
    description: typeof row["description"] === "string" ? row["description"] : null,
    param_schema_json: row["param_schema_json"],
    dataset_key: String(row["dataset_key"]),
    default_format: String(row["default_format"]),
    scope: String(row["scope"]) as ReportDefinitionRow["scope"],
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

function mapScheduleRow(row: Record<string, unknown>): ReportScheduleRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    report_definition_id: String(row["report_definition_id"]),
    created_by_membership_id: String(row["created_by_membership_id"]),
    name: typeof row["name"] === "string" ? row["name"] : null,
    cron_expression: String(row["cron_expression"]),
    timezone: String(row["timezone"]),
    params_json: row["params_json"],
    formats_json: row["formats_json"],
    delivery_json: row["delivery_json"] ?? null,
    next_run_at: row["next_run_at"] as Date,
    is_active: Boolean(row["is_active"]),
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

function mapRunRow(row: Record<string, unknown>): ReportRunRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    report_definition_id: String(row["report_definition_id"]),
    report_schedule_id:
      typeof row["report_schedule_id"] === "string" ? row["report_schedule_id"] : null,
    requested_by_membership_id: String(row["requested_by_membership_id"]),
    status: String(row["status"]) as JobStatus,
    params_json: row["params_json"],
    format: String(row["format"]) as ReportFormat,
    row_count: typeof row["row_count"] === "number" ? row["row_count"] : null,
    r2_object_key: typeof row["r2_object_key"] === "string" ? row["r2_object_key"] : null,
    error_json: row["error_json"] ?? null,
    progress_percent:
      typeof row["progress_percent"] === "number"
        ? row["progress_percent"]
        : row["progress_percent"] == null
          ? null
          : Number(row["progress_percent"]) || null,
    started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
    completed_at: row["completed_at"] instanceof Date ? row["completed_at"] : null,
    expires_at: row["expires_at"] instanceof Date ? row["expires_at"] : null,
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

export const reportsRepository = {
  async upsertSystemDefinition(
    tx: TenantTx,
    definition: SystemReportDefinition,
  ): Promise<ReportDefinitionRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into report_definitions (
        id,
        tenant_id,
        key,
        category,
        title,
        description,
        param_schema_json,
        dataset_key,
        default_format,
        scope,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${definition.key},
        ${definition.category},
        ${definition.title},
        ${definition.description},
        ${JSON.stringify(definition.paramSchemaJson)}::jsonb,
        ${definition.datasetKey},
        ${definition.defaultFormat},
        ${definition.scope},
        now(),
        now()
      )
      on conflict (tenant_id, key) do update
      set
        category = excluded.category,
        title = excluded.title,
        description = excluded.description,
        param_schema_json = excluded.param_schema_json,
        dataset_key = excluded.dataset_key,
        default_format = excluded.default_format,
        scope = excluded.scope,
        updated_at = now()
      returning *
    `;

    const row = rows[0];
    if (!row) {
      throw new Error("REPORT_DEFINITION_UPSERT_FAILED");
    }

    return mapDefinitionRow(row);
  },

  async insertTenantDefinition(
    tx: TenantTx,
    args: {
      key: string;
      category: string;
      title: string;
      description: string | null;
      paramSchemaJson: unknown;
      datasetKey: string;
      defaultFormat: ReportFormat;
    },
  ): Promise<ReportDefinitionRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into report_definitions (
        id,
        tenant_id,
        key,
        category,
        title,
        description,
        param_schema_json,
        dataset_key,
        default_format,
        scope,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.key},
        ${args.category},
        ${args.title},
        ${args.description},
        ${JSON.stringify(args.paramSchemaJson)}::jsonb,
        ${args.datasetKey},
        ${args.defaultFormat},
        'tenant',
        now(),
        now()
      )
      returning *
    `;

    const row = rows[0];
    if (!row) {
      throw new Error("REPORT_DEFINITION_INSERT_FAILED");
    }

    return mapDefinitionRow(row);
  },

  async listDefinitions(tx: TenantTx): Promise<ReportDefinitionRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from report_definitions
      order by category asc, title asc
    `;
    return rows.map(mapDefinitionRow);
  },

  async findDefinitionByKey(tx: TenantTx, key: string): Promise<ReportDefinitionRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from report_definitions
      where key = ${key}
      limit 1
    `;

    const row = rows[0];
    return row ? mapDefinitionRow(row) : null;
  },

  async findDefinitionById(tx: TenantTx, id: string): Promise<ReportDefinitionRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from report_definitions
      where id = ${id}::uuid
      limit 1
    `;

    const row = rows[0];
    return row ? mapDefinitionRow(row) : null;
  },

  async insertReportRun(
    tx: TenantTx,
    args: {
      reportDefinitionId: string;
      reportScheduleId?: string | null;
      requestedByMembershipId: string;
      paramsJson: unknown;
      format: ReportFormat;
    },
  ): Promise<ReportRunRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into report_runs (
        id,
        tenant_id,
        report_definition_id,
        report_schedule_id,
        requested_by_membership_id,
        status,
        params_json,
        format,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.reportDefinitionId}::uuid,
        ${args.reportScheduleId ?? null}::uuid,
        ${args.requestedByMembershipId}::uuid,
        'QUEUED',
        ${JSON.stringify(args.paramsJson)}::jsonb,
        ${args.format},
        now(),
        now()
      )
      returning *
    `;

    const row = rows[0];
    if (!row) {
      throw new Error("REPORT_RUN_INSERT_FAILED");
    }

    return mapRunRow(row);
  },

  async listReportRuns(
    tx: TenantTx,
    args: {
      status?: JobStatus;
      definitionKey?: string;
      cursor?: string;
      limit: number;
    },
  ): Promise<Array<ReportRunRow & { definition_key: string; definition_title: string }>> {
    if (args.definitionKey && args.status && args.cursor) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select rr.*, rd.key as definition_key, rd.title as definition_title
        from report_runs rr
        join report_definitions rd on rd.id = rr.report_definition_id
        where rr.status = ${args.status}
          and rd.key = ${args.definitionKey}
          and rr.id < ${args.cursor}::uuid
        order by rr.created_at desc, rr.id desc
        limit ${args.limit + 1}
      `;
      return rows.map((row) => ({
        ...mapRunRow(row),
        definition_key: String(row["definition_key"]),
        definition_title: String(row["definition_title"]),
      }));
    }

    if (args.definitionKey && args.status) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select rr.*, rd.key as definition_key, rd.title as definition_title
        from report_runs rr
        join report_definitions rd on rd.id = rr.report_definition_id
        where rr.status = ${args.status}
          and rd.key = ${args.definitionKey}
        order by rr.created_at desc, rr.id desc
        limit ${args.limit + 1}
      `;
      return rows.map((row) => ({
        ...mapRunRow(row),
        definition_key: String(row["definition_key"]),
        definition_title: String(row["definition_title"]),
      }));
    }

    if (args.definitionKey && args.cursor) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select rr.*, rd.key as definition_key, rd.title as definition_title
        from report_runs rr
        join report_definitions rd on rd.id = rr.report_definition_id
        where rd.key = ${args.definitionKey}
          and rr.id < ${args.cursor}::uuid
        order by rr.created_at desc, rr.id desc
        limit ${args.limit + 1}
      `;
      return rows.map((row) => ({
        ...mapRunRow(row),
        definition_key: String(row["definition_key"]),
        definition_title: String(row["definition_title"]),
      }));
    }

    if (args.definitionKey) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select rr.*, rd.key as definition_key, rd.title as definition_title
        from report_runs rr
        join report_definitions rd on rd.id = rr.report_definition_id
        where rd.key = ${args.definitionKey}
        order by rr.created_at desc, rr.id desc
        limit ${args.limit + 1}
      `;
      return rows.map((row) => ({
        ...mapRunRow(row),
        definition_key: String(row["definition_key"]),
        definition_title: String(row["definition_title"]),
      }));
    }

    if (args.status && args.cursor) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select rr.*, rd.key as definition_key, rd.title as definition_title
        from report_runs rr
        join report_definitions rd on rd.id = rr.report_definition_id
        where rr.status = ${args.status}
          and rr.id < ${args.cursor}::uuid
        order by rr.created_at desc, rr.id desc
        limit ${args.limit + 1}
      `;
      return rows.map((row) => ({
        ...mapRunRow(row),
        definition_key: String(row["definition_key"]),
        definition_title: String(row["definition_title"]),
      }));
    }

    if (args.status) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select rr.*, rd.key as definition_key, rd.title as definition_title
        from report_runs rr
        join report_definitions rd on rd.id = rr.report_definition_id
        where rr.status = ${args.status}
        order by rr.created_at desc, rr.id desc
        limit ${args.limit + 1}
      `;
      return rows.map((row) => ({
        ...mapRunRow(row),
        definition_key: String(row["definition_key"]),
        definition_title: String(row["definition_title"]),
      }));
    }

    if (args.cursor) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select rr.*, rd.key as definition_key, rd.title as definition_title
        from report_runs rr
        join report_definitions rd on rd.id = rr.report_definition_id
        where rr.id < ${args.cursor}::uuid
        order by rr.created_at desc, rr.id desc
        limit ${args.limit + 1}
      `;
      return rows.map((row) => ({
        ...mapRunRow(row),
        definition_key: String(row["definition_key"]),
        definition_title: String(row["definition_title"]),
      }));
    }

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select rr.*, rd.key as definition_key, rd.title as definition_title
      from report_runs rr
      join report_definitions rd on rd.id = rr.report_definition_id
      order by rr.created_at desc, rr.id desc
      limit ${args.limit + 1}
    `;
    return rows.map((row) => ({
      ...mapRunRow(row),
      definition_key: String(row["definition_key"]),
      definition_title: String(row["definition_title"]),
    }));
  },

  async findReportRunById(
    tx: TenantTx,
    reportRunId: string,
  ): Promise<(ReportRunRow & { definition_key: string; definition_title: string }) | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select rr.*, rd.key as definition_key, rd.title as definition_title
      from report_runs rr
      join report_definitions rd on rd.id = rr.report_definition_id
      where rr.id = ${reportRunId}::uuid
      limit 1
    `;

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      ...mapRunRow(row),
      definition_key: String(row["definition_key"]),
      definition_title: String(row["definition_title"]),
    };
  },

  async claimReportRunForProcessing(
    tx: TenantTx,
    reportRunId: string,
  ): Promise<ReportRunRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update report_runs
      set
        status = 'RUNNING',
        started_at = now(),
        progress_percent = 5,
        error_json = null,
        updated_at = now()
      where id = ${reportRunId}::uuid
        and status = 'QUEUED'
      returning *
    `;

    const row = rows[0];
    return row ? mapRunRow(row) : null;
  },

  async updateReportRunProgress(
    tx: TenantTx,
    args: {
      reportRunId: string;
      progressPercent: number;
      stage?: string;
      trace?: string[];
    },
  ): Promise<void> {
    const progress = Math.min(100, Math.max(0, Math.round(args.progressPercent)));
    const payload = JSON.stringify({
      stage: args.stage ?? null,
      trace: args.trace ?? [],
    });
    await tx.$executeRaw`
      update report_runs
      set
        progress_percent = ${progress},
        error_json = ${payload}::jsonb,
        updated_at = now()
      where id = ${args.reportRunId}::uuid
        and status = 'RUNNING'
    `;
  },

  async markReportRunSucceeded(
    tx: TenantTx,
    args: {
      reportRunId: string;
      objectKey: string;
      rowCount: number;
      expiresAt: Date;
    },
  ): Promise<ReportRunRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update report_runs
      set
        status = 'SUCCEEDED',
        r2_object_key = ${args.objectKey},
        row_count = ${args.rowCount},
        progress_percent = 100,
        error_json = null,
        completed_at = now(),
        expires_at = ${args.expiresAt},
        updated_at = now()
      where id = ${args.reportRunId}::uuid
      returning *
    `;

    const row = rows[0];
    return row ? mapRunRow(row) : null;
  },

  async markReportRunFailed(
    tx: TenantTx,
    args: {
      reportRunId: string;
      errorCode: string;
      message?: string;
      trace?: string[];
    },
  ): Promise<void> {
    await tx.$executeRaw`
      update report_runs
      set
        status = 'FAILED',
        progress_percent = coalesce(progress_percent, 0),
        error_json = ${JSON.stringify({
          code: args.errorCode,
          message: args.message ?? null,
          trace: args.trace ?? [],
        })}::jsonb,
        completed_at = now(),
        updated_at = now()
      where id = ${args.reportRunId}::uuid
    `;
  },

  async insertSchedule(
    tx: TenantTx,
    args: {
      reportDefinitionId: string;
      createdByMembershipId: string;
      name: string | null;
      cronExpression: string;
      timezone: string;
      paramsJson: unknown;
      formatsJson: unknown;
      deliveryJson: unknown;
      nextRunAt: Date;
      isActive: boolean;
    },
  ): Promise<ReportScheduleRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into report_schedules (
        id,
        tenant_id,
        report_definition_id,
        created_by_membership_id,
        name,
        cron_expression,
        timezone,
        params_json,
        formats_json,
        delivery_json,
        next_run_at,
        is_active,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.reportDefinitionId}::uuid,
        ${args.createdByMembershipId}::uuid,
        ${args.name},
        ${args.cronExpression},
        ${args.timezone},
        ${JSON.stringify(args.paramsJson)}::jsonb,
        ${JSON.stringify(args.formatsJson)}::jsonb,
        ${args.deliveryJson == null ? null : JSON.stringify(args.deliveryJson)}::jsonb,
        ${args.nextRunAt},
        ${args.isActive},
        now(),
        now()
      )
      returning *
    `;

    const row = rows[0];
    if (!row) {
      throw new Error("REPORT_SCHEDULE_INSERT_FAILED");
    }

    return mapScheduleRow(row);
  },

  async listSchedules(
    tx: TenantTx,
  ): Promise<Array<ReportScheduleRow & { definition_key: string; definition_title: string }>> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select rs.*, rd.key as definition_key, rd.title as definition_title
      from report_schedules rs
      join report_definitions rd on rd.id = rs.report_definition_id
      order by rs.created_at desc
    `;

    return rows.map((row) => ({
      ...mapScheduleRow(row),
      definition_key: String(row["definition_key"]),
      definition_title: String(row["definition_title"]),
    }));
  },

  async findScheduleById(
    tx: TenantTx,
    scheduleId: string,
  ): Promise<(ReportScheduleRow & { definition_key: string; definition_title: string }) | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select rs.*, rd.key as definition_key, rd.title as definition_title
      from report_schedules rs
      join report_definitions rd on rd.id = rs.report_definition_id
      where rs.id = ${scheduleId}::uuid
      limit 1
    `;

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      ...mapScheduleRow(row),
      definition_key: String(row["definition_key"]),
      definition_title: String(row["definition_title"]),
    };
  },

  async updateSchedule(
    tx: TenantTx,
    args: {
      scheduleId: string;
      name?: string | null;
      cronExpression?: string;
      timezone?: string;
      paramsJson?: unknown;
      formatsJson?: unknown;
      deliveryJson?: unknown;
      nextRunAt?: Date;
      isActive?: boolean;
    },
  ): Promise<ReportScheduleRow | null> {
    const existing = await this.findScheduleById(tx, args.scheduleId);
    if (!existing) {
      return null;
    }

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update report_schedules
      set
        name = ${args.name !== undefined ? args.name : existing.name},
        cron_expression = ${args.cronExpression ?? existing.cron_expression},
        timezone = ${args.timezone ?? existing.timezone},
        params_json = ${JSON.stringify(args.paramsJson ?? existing.params_json)}::jsonb,
        formats_json = ${JSON.stringify(args.formatsJson ?? existing.formats_json)}::jsonb,
        delivery_json = ${
          args.deliveryJson === undefined
            ? existing.delivery_json == null
              ? null
              : JSON.stringify(existing.delivery_json)
            : args.deliveryJson == null
              ? null
              : JSON.stringify(args.deliveryJson)
        }::jsonb,
        next_run_at = ${args.nextRunAt ?? existing.next_run_at},
        is_active = ${args.isActive ?? existing.is_active},
        updated_at = now()
      where id = ${args.scheduleId}::uuid
      returning *
    `;

    const row = rows[0];
    return row ? mapScheduleRow(row) : null;
  },

  async deleteSchedule(tx: TenantTx, scheduleId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      delete from report_schedules
      where id = ${scheduleId}::uuid
      returning id
    `;
    return rows.length > 0;
  },

  async listDueSchedules(
    tx: TenantTx,
    args: { asOf: Date; limit: number },
  ): Promise<Array<ReportScheduleRow & { definition_key: string }>> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select rs.*, rd.key as definition_key
      from report_schedules rs
      join report_definitions rd on rd.id = rs.report_definition_id
      where rs.is_active = true
        and rs.next_run_at <= ${args.asOf}
      order by rs.next_run_at asc
      limit ${args.limit}
    `;

    return rows.map((row) => ({
      ...mapScheduleRow(row),
      definition_key: String(row["definition_key"]),
    }));
  },

  async advanceScheduleNextRun(
    tx: TenantTx,
    args: {
      scheduleId: string;
      nextRunAt: Date;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      update report_schedules
      set next_run_at = ${args.nextRunAt}, updated_at = now()
      where id = ${args.scheduleId}::uuid
    `;
  },

  async clearReportRunFile(tx: TenantTx, reportRunId: string): Promise<ReportRunRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update report_runs
      set
        r2_object_key = null,
        updated_at = now()
      where id = ${reportRunId}::uuid
        and r2_object_key is not null
      returning *
    `;
    const row = rows[0];
    return row ? mapRunRow(row) : null;
  },

  async cancelReportRun(tx: TenantTx, reportRunId: string): Promise<ReportRunRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update report_runs
      set
        status = 'CANCELLED',
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
      where id = ${reportRunId}::uuid
        and status in ('QUEUED', 'RUNNING')
      returning *
    `;
    const row = rows[0];
    return row ? mapRunRow(row) : null;
  },

  async findRequesterProfile(
    tx: TenantTx,
    membershipId: string,
  ): Promise<{ name: string | null; email: string | null }> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as name,
        coalesce(ap.email, m.invited_email_normalized) as email
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.id = ${membershipId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) {
      return { name: null, email: null };
    }
    return {
      name: typeof row["name"] === "string" ? row["name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
    };
  },
};
