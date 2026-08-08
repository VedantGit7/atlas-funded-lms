import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type DeviceSessionRow = {
  id: string;
  tenant_id: string;
  membership_id: string;
  device_fingerprint: string | null;
  user_agent: string | null;
  ip_address: string | null;
  platform: string | null;
  last_seen_at: Date;
  created_at: Date;
  updated_at: Date;
};

function mapRow(row: Record<string, unknown>): DeviceSessionRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    membership_id: String(row["membership_id"]),
    device_fingerprint: typeof row["device_fingerprint"] === "string" ? row["device_fingerprint"] : null,
    user_agent: typeof row["user_agent"] === "string" ? row["user_agent"] : null,
    ip_address: typeof row["ip_address"] === "string" ? row["ip_address"] : null,
    platform: typeof row["platform"] === "string" ? row["platform"] : null,
    last_seen_at: row["last_seen_at"] as Date,
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

export const devicesRepository = {
  async upsertSession(
    tx: TenantTx,
    args: {
      membershipId: string;
      deviceFingerprint?: string | null;
      userAgent?: string | null;
      ipAddress?: string | null;
      platform?: string | null;
    },
  ): Promise<DeviceSessionRow> {
    const fingerprint = args.deviceFingerprint ?? null;

    if (fingerprint) {
      const existing = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from device_sessions
        where membership_id = ${args.membershipId}::uuid
          and device_fingerprint = ${fingerprint}
        order by last_seen_at desc
        limit 1
      `;
      const current = existing[0];
      if (current) {
        const updated = await tx.$queryRaw<Array<Record<string, unknown>>>`
          update device_sessions
          set
            user_agent = coalesce(${args.userAgent ?? null}, user_agent),
            ip_address = coalesce(${args.ipAddress ?? null}, ip_address),
            platform = coalesce(${args.platform ?? null}, platform),
            last_seen_at = now(),
            updated_at = now()
          where id = ${String(current["id"])}::uuid
          returning *
        `;
        const row = updated[0];
        if (!row) {
          throw new Error("DEVICE_SESSION_UPDATE_FAILED");
        }
        return mapRow(row);
      }
    }

    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into device_sessions (
        id,
        tenant_id,
        membership_id,
        device_fingerprint,
        user_agent,
        ip_address,
        platform,
        last_seen_at,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.membershipId}::uuid,
        ${fingerprint},
        ${args.userAgent ?? null},
        ${args.ipAddress ?? null},
        ${args.platform ?? null},
        now(),
        now(),
        now()
      )
      returning *
    `;

    const row = rows[0];
    if (!row) {
      throw new Error("DEVICE_SESSION_INSERT_FAILED");
    }

    return mapRow(row);
  },

  async listSessions(
    tx: TenantTx,
    args: { membershipId?: string; cursor?: string; limit: number },
  ): Promise<DeviceSessionRow[]> {
    if (args.membershipId && args.cursor) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from device_sessions
        where membership_id = ${args.membershipId}::uuid
          and id < ${args.cursor}::uuid
        order by last_seen_at desc, id desc
        limit ${args.limit + 1}
      `;
      return rows.map(mapRow);
    }

    if (args.membershipId) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from device_sessions
        where membership_id = ${args.membershipId}::uuid
        order by last_seen_at desc, id desc
        limit ${args.limit + 1}
      `;
      return rows.map(mapRow);
    }

    if (args.cursor) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from device_sessions
        where id < ${args.cursor}::uuid
        order by last_seen_at desc, id desc
        limit ${args.limit + 1}
      `;
      return rows.map(mapRow);
    }

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from device_sessions
      order by last_seen_at desc, id desc
      limit ${args.limit + 1}
    `;
    return rows.map(mapRow);
  },

  async findSessionById(tx: TenantTx, sessionId: string): Promise<DeviceSessionRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select * from device_sessions where id = ${sessionId}::uuid limit 1
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async deleteSessionsByIds(tx: TenantTx, sessionIds: string[]): Promise<number> {
    if (sessionIds.length === 0) return 0;
    const count = await tx.$executeRaw`
      delete from device_sessions
      where id = any(${sessionIds}::uuid[])
    `;
    return Number(count);
  },

  async deleteSessionsForMembership(tx: TenantTx, membershipId: string): Promise<number> {
    const count = await tx.$executeRaw`
      delete from device_sessions
      where membership_id = ${membershipId}::uuid
    `;
    return Number(count);
  },
};
