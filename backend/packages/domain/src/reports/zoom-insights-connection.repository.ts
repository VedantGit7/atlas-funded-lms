import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { ZOOM_DEFAULT_SCOPES } from "./zoom-insights-connection.dto";

export type ZoomConnectionDetailRow = {
  id: string;
  account_id: string | null;
  account_name: string | null;
  account_email: string | null;
  app_id: string | null;
  scopes_json: unknown;
  status: string;
  connected_at: Date | null;
  disconnected_at: Date | null;
  last_synced_at: Date | null;
  token_expires_at: Date | null;
  schedule_enabled: boolean;
  schedule_interval_minutes: number;
  coverage_gap_count: number;
  webhook_secret_ref: string | null;
  updated_at: Date | null;
};

export type ZoomSyncRunRow = {
  id: string;
  trigger: string;
  status: string;
  started_at: Date;
  finished_at: Date | null;
  meetings_count: number;
  participants_count: number;
  skipped_count: number;
  error_message: string | null;
  log_json: unknown;
};

export type ZoomWebhookEventRow = {
  id: string;
  event_type: string;
  topic: string | null;
  status_code: number;
  received_at: Date;
};

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function mapConnection(row: Record<string, unknown>): ZoomConnectionDetailRow {
  return {
    id: String(row["id"]),
    account_id: typeof row["account_id"] === "string" ? row["account_id"] : null,
    account_name: typeof row["account_name"] === "string" ? row["account_name"] : null,
    account_email: typeof row["account_email"] === "string" ? row["account_email"] : null,
    app_id: typeof row["app_id"] === "string" ? row["app_id"] : null,
    scopes_json: row["scopes_json"] ?? null,
    status: typeof row["status"] === "string" ? row["status"] : "disconnected",
    connected_at: asDate(row["connected_at"]),
    disconnected_at: asDate(row["disconnected_at"]),
    last_synced_at: asDate(row["last_synced_at"]),
    token_expires_at: asDate(row["token_expires_at"]),
    schedule_enabled: Boolean(row["schedule_enabled"] ?? true),
    schedule_interval_minutes: Number(row["schedule_interval_minutes"] ?? 30),
    coverage_gap_count: Number(row["coverage_gap_count"] ?? 0),
    webhook_secret_ref:
      typeof row["webhook_secret_ref"] === "string" ? row["webhook_secret_ref"] : null,
    updated_at: asDate(row["updated_at"]),
  };
}

function mapSyncRun(row: Record<string, unknown>): ZoomSyncRunRow {
  return {
    id: String(row["id"]),
    trigger: String(row["trigger"]),
    status: String(row["status"]),
    started_at: asDate(row["started_at"]) ?? new Date(),
    finished_at: asDate(row["finished_at"]),
    meetings_count: Number(row["meetings_count"] ?? 0),
    participants_count: Number(row["participants_count"] ?? 0),
    skipped_count: Number(row["skipped_count"] ?? 0),
    error_message: typeof row["error_message"] === "string" ? row["error_message"] : null,
    log_json: row["log_json"] ?? null,
  };
}

export function parseScopes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  return [...ZOOM_DEFAULT_SCOPES];
}

export const zoomInsightsConnectionRepository = {
  async getConnection(tx: TenantTx): Promise<ZoomConnectionDetailRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        id::text as id,
        account_id,
        account_name,
        account_email,
        app_id,
        scopes_json,
        status,
        connected_at,
        disconnected_at,
        last_synced_at,
        token_expires_at,
        schedule_enabled,
        schedule_interval_minutes,
        coverage_gap_count,
        webhook_secret_ref,
        updated_at
      from zoom_connections
      where tenant_id = current_setting('app.tenant_id', true)::uuid
      limit 1
    `;
    const row = rows[0];
    return row ? mapConnection(row) : null;
  },

  async countMeetingsImported(tx: TenantTx): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from zoom_meetings
      where tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countMeetingsImportedToday(tx: TenantTx): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from zoom_meetings
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and created_at >= date_trunc('day', now())
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countParticipants(tx: TenantTx): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from zoom_meeting_participants
      where tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async estimateBackfill(
    tx: TenantTx,
    rangeFrom: string,
    rangeTo: string,
  ): Promise<{ meetings: number; participants: number }> {
    const rows = await tx.$queryRaw<Array<{ meetings: number; participants: number }>>`
      select
        count(distinct zm.id)::int as meetings,
        coalesce((
          select count(*)::int
          from zoom_meeting_participants zmp
          join zoom_meetings zm2 on zm2.id = zmp.zoom_meeting_id
          where zm2.tenant_id = current_setting('app.tenant_id', true)::uuid
            and zm2.started_at >= ${rangeFrom}::timestamptz
            and zm2.started_at <= ${rangeTo}::timestamptz
        ), 0) as participants
      from zoom_meetings zm
      where zm.tenant_id = current_setting('app.tenant_id', true)::uuid
        and zm.started_at >= ${rangeFrom}::timestamptz
        and zm.started_at <= ${rangeTo}::timestamptz
    `;
    const meetings = rows[0]?.meetings ?? 0;
    const participants = rows[0]?.participants ?? 0;
    // When nothing exists in-range yet, return a conservative forecast for the UI estimate.
    if (meetings === 0) {
      const days = Math.max(
        1,
        Math.ceil(
          (new Date(rangeTo).getTime() - new Date(rangeFrom).getTime()) / (24 * 60 * 60 * 1000),
        ),
      );
      return {
        meetings: Math.min(500, days * 4),
        participants: Math.min(8000, days * 60),
      };
    }
    return { meetings, participants };
  },

  async listSyncRuns(tx: TenantTx, limit = 60): Promise<ZoomSyncRunRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        id::text as id,
        trigger,
        status,
        started_at,
        finished_at,
        meetings_count,
        participants_count,
        skipped_count,
        error_message,
        log_json
      from zoom_sync_runs
      where tenant_id = current_setting('app.tenant_id', true)::uuid
      order by started_at desc
      limit ${limit}
    `;
    return rows.map(mapSyncRun);
  },

  async getSyncRun(tx: TenantTx, runId: string): Promise<ZoomSyncRunRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        id::text as id,
        trigger,
        status,
        started_at,
        finished_at,
        meetings_count,
        participants_count,
        skipped_count,
        error_message,
        log_json
      from zoom_sync_runs
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and id = ${runId}::uuid
      limit 1
    `;
    const row = rows[0];
    return row ? mapSyncRun(row) : null;
  },

  async listWebhookEvents(tx: TenantTx, limit = 12): Promise<ZoomWebhookEventRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        id::text as id,
        event_type,
        topic,
        status_code,
        received_at
      from zoom_webhook_events
      where tenant_id = current_setting('app.tenant_id', true)::uuid
      order by received_at desc
      limit ${limit}
    `;
    return rows.map((row) => ({
      id: String(row["id"]),
      event_type: String(row["event_type"]),
      topic: typeof row["topic"] === "string" ? row["topic"] : null,
      status_code: Number(row["status_code"] ?? 200),
      received_at: asDate(row["received_at"]) ?? new Date(),
    }));
  },

  async createSyncRun(
    tx: TenantTx,
    args: {
      connectionId: string;
      trigger: string;
      status: string;
      meetingsCount: number;
      participantsCount: number;
      skippedCount?: number;
      errorMessage?: string | null;
      logLines?: string[];
      rangeFrom?: string | null;
      rangeTo?: string | null;
    },
  ): Promise<ZoomSyncRunRow> {
    const id = randomUUID();
    const logJson = JSON.stringify(args.logLines ?? []);
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into zoom_sync_runs (
        id, tenant_id, zoom_connection_id, trigger, status,
        started_at, finished_at, meetings_count, participants_count, skipped_count,
        error_message, log_json, range_from, range_to, created_at, updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.connectionId}::uuid,
        ${args.trigger},
        ${args.status},
        now(),
        now(),
        ${args.meetingsCount},
        ${args.participantsCount},
        ${args.skippedCount ?? 0},
        ${args.errorMessage ?? null},
        ${logJson}::jsonb,
        ${args.rangeFrom ?? null}::timestamptz,
        ${args.rangeTo ?? null}::timestamptz,
        now(),
        now()
      )
      returning
        id::text as id,
        trigger,
        status,
        started_at,
        finished_at,
        meetings_count,
        participants_count,
        skipped_count,
        error_message,
        log_json
    `;
    const row = rows[0];
    if (!row) throw new Error("ZOOM_SYNC_RUN_INSERT_FAILED");
    return mapSyncRun(row);
  },

  async touchLastSynced(tx: TenantTx, connectionId: string): Promise<void> {
    await tx.$executeRaw`
      update zoom_connections
      set last_synced_at = now(), updated_at = now()
      where id = ${connectionId}::uuid
        and tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
  },

  async updateSchedule(
    tx: TenantTx,
    connectionId: string,
    args: { scheduleEnabled: boolean; scheduleIntervalMinutes?: number },
  ): Promise<void> {
    await tx.$executeRaw`
      update zoom_connections
      set
        schedule_enabled = ${args.scheduleEnabled},
        schedule_interval_minutes = coalesce(
          ${args.scheduleIntervalMinutes ?? null}::int,
          schedule_interval_minutes
        ),
        updated_at = now()
      where id = ${connectionId}::uuid
        and tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
  },

  async disconnect(tx: TenantTx, connectionId: string): Promise<Date> {
    const rows = await tx.$queryRaw<Array<{ disconnected_at: Date }>>`
      update zoom_connections
      set
        status = 'disconnected',
        disconnected_at = now(),
        access_token_ref = null,
        refresh_token_ref = null,
        schedule_enabled = false,
        updated_at = now()
      where id = ${connectionId}::uuid
        and tenant_id = current_setting('app.tenant_id', true)::uuid
      returning disconnected_at
    `;
    return rows[0]?.disconnected_at ?? new Date();
  },

  async createWebhookEvent(
    tx: TenantTx,
    args: {
      connectionId: string | null;
      eventType: string;
      topic?: string | null;
      statusCode?: number;
      payload?: unknown;
    },
  ): Promise<ZoomWebhookEventRow> {
    const id = randomUUID();
    const payloadJson = JSON.stringify(args.payload ?? {});
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into zoom_webhook_events (
        id, tenant_id, zoom_connection_id, event_type, topic, status_code,
        received_at, payload_json, created_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.connectionId}::uuid,
        ${args.eventType},
        ${args.topic ?? null},
        ${args.statusCode ?? 200},
        now(),
        ${payloadJson}::jsonb,
        now()
      )
      returning id::text as id, event_type, topic, status_code, received_at
    `;
    const row = rows[0];
    if (!row) throw new Error("ZOOM_WEBHOOK_EVENT_INSERT_FAILED");
    return {
      id: String(row["id"]),
      event_type: String(row["event_type"]),
      topic: typeof row["topic"] === "string" ? row["topic"] : null,
      status_code: Number(row["status_code"] ?? 200),
      received_at: asDate(row["received_at"]) ?? new Date(),
    };
  },

  async setCoverageGap(tx: TenantTx, connectionId: string, gap: number): Promise<void> {
    await tx.$executeRaw`
      update zoom_connections
      set coverage_gap_count = ${gap}, updated_at = now()
      where id = ${connectionId}::uuid
        and tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
  },
};
