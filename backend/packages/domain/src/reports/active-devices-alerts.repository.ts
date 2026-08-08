import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

function asUnknownString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return fallback;
  return fallback;
}

export type DeviceSecurityAlertRow = {
  id: string;
  tenant_id: string;
  membership_id: string;
  alert_key: string;
  alert_type: string;
  severity: string;
  status: string;
  title: string;
  evidence_json: unknown;
  session_ids: unknown;
  detected_at: Date;
  resolved_at: Date | null;
  resolved_by: string | null;
  notes_json: unknown;
  created_at: Date;
  updated_at: Date;
};

export type DetectedAlertCandidate = {
  alertKey: string;
  membershipId: string;
  alertType: "concurrent_sessions" | "device_limit_exceeded" | "shared_fingerprint";
  severity: "critical" | "warn" | "info";
  title: string;
  evidence: Record<string, unknown>;
  sessionIds: string[];
  detectedAt: Date;
};

function mapRow(row: Record<string, unknown>): DeviceSecurityAlertRow {
  return {
    id: asUnknownString(row["id"]),
    tenant_id: asUnknownString(row["tenant_id"]),
    membership_id: asUnknownString(row["membership_id"]),
    alert_key: asUnknownString(row["alert_key"]),
    alert_type: asUnknownString(row["alert_type"]),
    severity: asUnknownString(row["severity"]),
    status: asUnknownString(row["status"]),
    title: asUnknownString(row["title"]),
    evidence_json: row["evidence_json"] ?? null,
    session_ids: row["session_ids"] ?? [],
    detected_at: row["detected_at"] as Date,
    resolved_at: (row["resolved_at"] as Date | null) ?? null,
    resolved_by: typeof row["resolved_by"] === "string" ? row["resolved_by"] : null,
    notes_json: row["notes_json"] ?? null,
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

export const activeDevicesAlertsRepository = {
  async listSessionsWithIdentity(tx: TenantTx): Promise<
    Array<{
      id: string;
      membership_id: string;
      device_fingerprint: string | null;
      user_agent: string | null;
      ip_address: string | null;
      platform: string | null;
      last_seen_at: Date;
      created_at: Date;
      learner_name: string | null;
      email: string | null;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ds.id,
        ds.membership_id,
        ds.device_fingerprint,
        ds.user_agent,
        ds.ip_address,
        ds.platform,
        ds.last_seen_at,
        ds.created_at,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email
      from device_sessions ds
      join memberships m on m.id = ds.membership_id and m.tenant_id = ds.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where ds.tenant_id = current_setting('app.tenant_id', true)::uuid
      order by ds.last_seen_at desc
      limit 5000
    `;
    return rows.map((row) => ({
      id: asUnknownString(row["id"]),
      membership_id: asUnknownString(row["membership_id"]),
      device_fingerprint:
        typeof row["device_fingerprint"] === "string" ? row["device_fingerprint"] : null,
      user_agent: typeof row["user_agent"] === "string" ? row["user_agent"] : null,
      ip_address: typeof row["ip_address"] === "string" ? row["ip_address"] : null,
      platform: typeof row["platform"] === "string" ? row["platform"] : null,
      last_seen_at: row["last_seen_at"] as Date,
      created_at: row["created_at"] as Date,
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
    }));
  },

  async upsertOpenAlert(tx: TenantTx, candidate: DetectedAlertCandidate): Promise<void> {
    const id = randomUUID();
    const evidenceJson = JSON.stringify(candidate.evidence);
    const sessionIdsJson = JSON.stringify(candidate.sessionIds);
    await tx.$executeRaw`
      insert into device_security_alerts (
        id, tenant_id, membership_id, alert_key, alert_type, severity, status,
        title, evidence_json, session_ids, detected_at, notes_json, created_at, updated_at
      ) values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${candidate.membershipId}::uuid,
        ${candidate.alertKey},
        ${candidate.alertType},
        ${candidate.severity},
        'open',
        ${candidate.title},
        ${evidenceJson}::jsonb,
        ${sessionIdsJson}::jsonb,
        ${candidate.detectedAt.toISOString()}::timestamptz,
        '[]'::jsonb,
        now(),
        now()
      )
      on conflict (tenant_id, alert_key) do update set
        title = excluded.title,
        severity = excluded.severity,
        evidence_json = excluded.evidence_json,
        session_ids = excluded.session_ids,
        detected_at = case
          when device_security_alerts.status = 'open' then least(device_security_alerts.detected_at, excluded.detected_at)
          else device_security_alerts.detected_at
        end,
        status = case
          when device_security_alerts.status in ('resolved', 'dismissed') then device_security_alerts.status
          else 'open'
        end,
        updated_at = now()
    `;
  },

  async listAlerts(
    tx: TenantTx,
    args: { status: string; type?: string | undefined; limit: number; offset: number },
  ): Promise<DeviceSecurityAlertRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from device_security_alerts
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and status = ${args.status}
        and (
          ${args.type ?? null}::text is null
          or alert_type = ${args.type ?? null}
        )
      order by detected_at desc, id desc
      limit ${args.limit}
      offset ${args.offset}
    `;
    return rows.map(mapRow);
  },

  async countAlerts(
    tx: TenantTx,
    args: { status: string; type?: string | undefined },
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from device_security_alerts
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and status = ${args.status}
        and (
          ${args.type ?? null}::text is null
          or alert_type = ${args.type ?? null}
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countByTypeOpen(tx: TenantTx): Promise<Record<string, number>> {
    const rows = await tx.$queryRaw<Array<{ alert_type: string; count: bigint }>>`
      select alert_type, count(*)::bigint as count
      from device_security_alerts
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and status = 'open'
      group by alert_type
    `;
    const out: Record<string, number> = {};
    for (const row of rows) out[row.alert_type] = Number(row.count);
    return out;
  },

  async countByStatus(tx: TenantTx): Promise<Record<string, number>> {
    const rows = await tx.$queryRaw<Array<{ status: string; count: bigint }>>`
      select status, count(*)::bigint as count
      from device_security_alerts
      where tenant_id = current_setting('app.tenant_id', true)::uuid
      group by status
    `;
    const out: Record<string, number> = {};
    for (const row of rows) out[row.status] = Number(row.count);
    return out;
  },

  async findById(tx: TenantTx, alertId: string): Promise<DeviceSecurityAlertRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from device_security_alerts
      where id = ${alertId}::uuid
      limit 1
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async updateStatus(
    tx: TenantTx,
    args: { alertIds: string[]; status: "resolved" | "dismissed"; actorMembershipId: string },
  ): Promise<number> {
    const count = await tx.$executeRaw`
      update device_security_alerts
      set
        status = ${args.status},
        resolved_at = now(),
        resolved_by = ${args.actorMembershipId}::uuid,
        updated_at = now()
      where id = any(${args.alertIds}::uuid[])
        and status = 'open'
    `;
    return count;
  },

  async appendNote(
    tx: TenantTx,
    args: {
      alertId: string;
      note: {
        id: string;
        body: string;
        createdAt: string;
        authorMembershipId: string | null;
        authorLabel: string | null;
      };
    },
  ): Promise<DeviceSecurityAlertRow | null> {
    const existing = await this.findById(tx, args.alertId);
    if (!existing) return null;
    type AlertNote = {
      id: string;
      body: string;
      createdAt: string;
      authorMembershipId: string | null;
      authorLabel: string | null;
    };
    const existingNotes: AlertNote[] = Array.isArray(existing.notes_json)
      ? (existing.notes_json as AlertNote[])
      : [];
    const notes: AlertNote[] = [...existingNotes, args.note];
    const notesJson = JSON.stringify(notes);
    await tx.$executeRaw`
      update device_security_alerts
      set notes_json = ${notesJson}::jsonb, updated_at = now()
      where id = ${args.alertId}::uuid
    `;
    return this.findById(tx, args.alertId);
  },
};
