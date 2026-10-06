import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type LiveSessionRow = {
  id: string;
  title: string;
  course_id: string | null;
  status: string;
  scheduled_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  metadata_json: unknown;
  created_at: Date;
};

export type LiveAttendanceRow = {
  id: string;
  live_session_id: string;
  membership_id: string;
  status: string;
  joined_at: Date | null;
  left_at: Date | null;
  duration_seconds: number | null;
};

function mapSessionRow(row: Record<string, unknown>): LiveSessionRow {
  return {
    id: String(row["id"]),
    title: String(row["title"]),
    course_id: typeof row["course_id"] === "string" ? row["course_id"] : null,
    status: String(row["status"]),
    scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
    started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
    ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
    metadata_json: row["metadata_json"] ?? null,
    created_at: row["created_at"] as Date,
  };
}

function mapAttendanceRow(row: Record<string, unknown>): LiveAttendanceRow {
  return {
    id: String(row["id"]),
    live_session_id: String(row["live_session_id"]),
    membership_id: String(row["membership_id"]),
    status: String(row["status"]),
    joined_at: row["joined_at"] instanceof Date ? row["joined_at"] : null,
    left_at: row["left_at"] instanceof Date ? row["left_at"] : null,
    duration_seconds: row["duration_seconds"] != null ? Number(row["duration_seconds"]) : null,
  };
}

export const liveRepository = {
  async insertSession(
    tx: TenantTx,
    args: {
      title: string;
      courseId?: string | null;
      status: string;
      scheduledAt?: Date | null;
      metadataJson?: unknown;
    },
  ): Promise<LiveSessionRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into live_sessions (id, tenant_id, title, course_id, status, scheduled_at, metadata_json, created_at, updated_at)
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.title},
        ${args.courseId ?? null}::uuid,
        ${args.status},
        ${args.scheduledAt ?? null}::timestamptz,
        ${args.metadataJson ? JSON.stringify(args.metadataJson) : null}::jsonb,
        now(),
        now()
      )
      returning *
    `;
    const row = rows[0];
    if (!row) throw new Error("LIVE_SESSION_INSERT_FAILED");
    return mapSessionRow(row);
  },

  async listSessions(tx: TenantTx): Promise<LiveSessionRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select * from live_sessions order by scheduled_at desc nulls last limit 100
    `;
    return rows.map(mapSessionRow);
  },

  async findSessionById(tx: TenantTx, sessionId: string): Promise<LiveSessionRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select * from live_sessions where id = ${sessionId}::uuid limit 1
    `;
    return rows[0] ? mapSessionRow(rows[0]) : null;
  },

  async updateSession(
    tx: TenantTx,
    sessionId: string,
    args: {
      title?: string;
      status?: string;
      scheduledAt?: Date | null;
      startedAt?: Date | null;
      endedAt?: Date | null;
      metadataJson?: unknown;
    },
  ): Promise<LiveSessionRow | null> {
    const existing = await this.findSessionById(tx, sessionId);
    if (!existing) return null;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update live_sessions
      set
        title = ${args.title ?? existing.title},
        status = ${args.status ?? existing.status},
        scheduled_at = ${args.scheduledAt !== undefined ? args.scheduledAt : existing.scheduled_at}::timestamptz,
        started_at = ${args.startedAt !== undefined ? args.startedAt : existing.started_at}::timestamptz,
        ended_at = ${args.endedAt !== undefined ? args.endedAt : existing.ended_at}::timestamptz,
        metadata_json = ${args.metadataJson !== undefined ? JSON.stringify(args.metadataJson) : existing.metadata_json}::jsonb,
        updated_at = now()
      where id = ${sessionId}::uuid
      returning *
    `;
    return rows[0] ? mapSessionRow(rows[0]) : null;
  },

  async deleteSession(tx: TenantTx, sessionId: string): Promise<boolean> {
    // Polls outlive the session they ran in (the foreign key restricts).
    await tx.$executeRaw`
      update polls set live_session_id = null, updated_at = now() where live_session_id = ${sessionId}::uuid
    `;
    const count = await tx.$executeRaw`delete from live_sessions where id = ${sessionId}::uuid`;
    return count > 0;
  },

  async checkIn(
    tx: TenantTx,
    args: { sessionId: string; membershipId: string; status: string },
  ): Promise<LiveAttendanceRow> {
    const id = randomUUID();
    const joinedAt = new Date();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into live_attendance (id, tenant_id, live_session_id, membership_id, status, joined_at, created_at, updated_at)
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.sessionId}::uuid,
        ${args.membershipId}::uuid,
        ${args.status},
        ${joinedAt}::timestamptz,
        now(),
        now()
      )
      on conflict (tenant_id, live_session_id, membership_id) do update
      set
        status = excluded.status,
        joined_at = coalesce(live_attendance.joined_at, excluded.joined_at),
        updated_at = now()
      returning *
    `;
    const row = rows[0];
    if (!row) throw new Error("LIVE_ATTENDANCE_CHECKIN_FAILED");
    return mapAttendanceRow(row);
  },

  async listAttendance(tx: TenantTx, sessionId: string): Promise<LiveAttendanceRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select * from live_attendance where live_session_id = ${sessionId}::uuid order by joined_at desc
    `;
    return rows.map(mapAttendanceRow);
  },

  async refreshSessionInsights(tx: TenantTx, sessionId: string): Promise<void> {
    const stats = await tx.$queryRaw<Array<{ peak: bigint; avg_duration: number | null }>>`
      select
        count(*) as peak,
        avg(duration_seconds) as avg_duration
      from live_attendance
      where live_session_id = ${sessionId}::uuid and status = 'attended'
    `;

    const peak = Number(stats[0]?.peak ?? 0);
    const avgDuration = stats[0]?.avg_duration ?? null;

    await tx.$executeRaw`
      update live_sessions
      set metadata_json = coalesce(metadata_json, '{}'::jsonb) || ${JSON.stringify({
        insights: { peakAttendance: peak, avgDurationSeconds: avgDuration },
      })}::jsonb,
      updated_at = now()
      where id = ${sessionId}::uuid
    `;
  },
};
