import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type ZoomConnectionRow = {
  id: string;
  account_id: string | null;
  status: string;
  connected_at: Date | null;
};

export type ZoomMeetingRow = {
  id: string;
  external_meeting_id: string;
  topic: string | null;
  started_at: Date | null;
  ended_at: Date | null;
};

export const zoomRepository = {
  async upsertConnection(
    tx: TenantTx,
    args: {
      accountId?: string | null;
      accessTokenRef?: string | null;
      refreshTokenRef?: string | null;
    },
  ): Promise<ZoomConnectionRow> {
    const existing = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select id from zoom_connections limit 1
    `;

    if (existing[0]) {
      const connectionId = String(existing[0]["id"]);
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        update zoom_connections
        set
          account_id = coalesce(${args.accountId ?? null}, account_id),
          access_token_ref = coalesce(${args.accessTokenRef ?? null}, access_token_ref),
          refresh_token_ref = coalesce(${args.refreshTokenRef ?? null}, refresh_token_ref),
          status = 'connected',
          connected_at = now(),
          updated_at = now()
        where id = ${connectionId}::uuid
        returning id, account_id, status, connected_at
      `;
      const row = rows[0];
      if (!row) throw new Error("ZOOM_CONNECTION_UPDATE_FAILED");
      return {
        id: String(row["id"]),
        account_id: typeof row["account_id"] === "string" ? row["account_id"] : null,
        status: String(row["status"]),
        connected_at: row["connected_at"] instanceof Date ? row["connected_at"] : null,
      };
    }

    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into zoom_connections (id, tenant_id, account_id, access_token_ref, refresh_token_ref, status, connected_at, created_at, updated_at)
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.accountId ?? null},
        ${args.accessTokenRef ?? null},
        ${args.refreshTokenRef ?? null},
        'connected',
        now(),
        now(),
        now()
      )
      returning id, account_id, status, connected_at
    `;
    const row = rows[0];
    if (!row) throw new Error("ZOOM_CONNECTION_INSERT_FAILED");
    return {
      id: String(row["id"]),
      account_id: typeof row["account_id"] === "string" ? row["account_id"] : null,
      status: String(row["status"]),
      connected_at: row["connected_at"] instanceof Date ? row["connected_at"] : null,
    };
  },

  async getConnection(tx: TenantTx): Promise<{ id: string } | null> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text as id from zoom_connections limit 1
    `;
    return rows[0] ?? null;
  },

  async listMeetings(tx: TenantTx): Promise<ZoomMeetingRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select id, external_meeting_id, topic, started_at, ended_at
      from zoom_meetings
      order by started_at desc nulls last
      limit 100
    `;
    return rows.map((row) => ({
      id: String(row["id"]),
      external_meeting_id: String(row["external_meeting_id"]),
      topic: typeof row["topic"] === "string" ? row["topic"] : null,
      started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
      ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
    }));
  },

  async upsertMeetingFromWebhook(
    tx: TenantTx,
    args: {
      connectionId: string;
      externalMeetingId: string;
      topic?: string | null;
      startedAt?: Date | null;
      endedAt?: Date | null;
      participants?: Array<{
        externalUserId?: string;
        displayName?: string;
        joinTime?: Date | null;
        leaveTime?: Date | null;
        durationSeconds?: number | null;
      }>;
    },
  ): Promise<{ meetingId: string; participantCount: number }> {
    const existing = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text as id from zoom_meetings
      where external_meeting_id = ${args.externalMeetingId}
      limit 1
    `;

    let meetingId: string;
    if (existing[0]) {
      meetingId = existing[0].id;
      await tx.$executeRaw`
        update zoom_meetings
        set
          topic = coalesce(${args.topic ?? null}, topic),
          started_at = coalesce(${args.startedAt ?? null}::timestamptz, started_at),
          ended_at = coalesce(${args.endedAt ?? null}::timestamptz, ended_at),
          updated_at = now()
        where id = ${meetingId}::uuid
      `;
    } else {
      meetingId = randomUUID();
      await tx.$executeRaw`
        insert into zoom_meetings (id, tenant_id, zoom_connection_id, external_meeting_id, topic, started_at, ended_at, created_at, updated_at)
        values (
          ${meetingId}::uuid,
          current_setting('app.tenant_id', true)::uuid,
          ${args.connectionId}::uuid,
          ${args.externalMeetingId},
          ${args.topic ?? null},
          ${args.startedAt ?? null}::timestamptz,
          ${args.endedAt ?? null}::timestamptz,
          now(),
          now()
        )
      `;
    }

    let participantCount = 0;
    for (const participant of args.participants ?? []) {
      const participantId = randomUUID();
      await tx.$executeRaw`
        insert into zoom_meeting_participants (
          id, tenant_id, zoom_meeting_id, external_user_id, display_name,
          join_time, leave_time, duration_seconds, created_at, updated_at
        )
        values (
          ${participantId}::uuid,
          current_setting('app.tenant_id', true)::uuid,
          ${meetingId}::uuid,
          ${participant.externalUserId ?? null},
          ${participant.displayName ?? null},
          ${participant.joinTime ?? null}::timestamptz,
          ${participant.leaveTime ?? null}::timestamptz,
          ${participant.durationSeconds ?? null},
          now(),
          now()
        )
      `;
      participantCount += 1;
    }

    return { meetingId, participantCount };
  },
};
