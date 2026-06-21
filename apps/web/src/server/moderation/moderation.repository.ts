import type { TenantTx } from "@atlas/db";
import { randomUUID } from "node:crypto";
import type {
  AppealRow,
  ModerationCaseRow,
  ModerationDecisionRow,
  ModerationStatus,
} from "./moderation.types";

function mapCaseRow(row: Record<string, unknown>): ModerationCaseRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    target_type: String(row["target_type"]),
    target_id: String(row["target_id"]),
    status: row["status"] as ModerationStatus,
    reason_key: (row["reason_key"] as string | null) ?? null,
    opened_by_membership_id: (row["opened_by_membership_id"] as string | null) ?? null,
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

function mapDecisionRow(row: Record<string, unknown>): ModerationDecisionRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    moderation_case_id: String(row["moderation_case_id"]),
    decided_by_membership_id: (row["decided_by_membership_id"] as string | null) ?? null,
    decision_key: String(row["decision_key"]),
    decision_json: row["decision_json"],
    occurred_at: row["occurred_at"] as Date,
  };
}

function mapAppealRow(row: Record<string, unknown>): AppealRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    moderation_case_id: String(row["moderation_case_id"]),
    submitted_by_membership_id: String(row["submitted_by_membership_id"]),
    status: String(row["status"]),
    body: String(row["body"]),
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

export const moderationRepository = {
  async isAnySpaceModerator(tx: TenantTx, membershipId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
      select exists (
        select 1
        from group_memberships gm
        where gm.membership_id = ${membershipId}::uuid
          and gm.role_key in ('moderator', 'admin')
      ) as exists
    `;

    return Boolean(rows[0]?.exists);
  },

  async findOpenCaseForTarget(
    tx: TenantTx,
    args: { targetType: string; targetId: string },
  ): Promise<ModerationCaseRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from moderation_cases
      where target_type = ${args.targetType}
        and target_id = ${args.targetId}::uuid
        and status in ('OPEN'::"ModerationStatus", 'REVIEWING'::"ModerationStatus")
      limit 1
    `;

    const row = rows[0];
    return row ? mapCaseRow(row) : null;
  },

  async insertCase(
    tx: TenantTx,
    args: {
      targetType: string;
      targetId: string;
      reasonKey: string | null;
      openedByMembershipId: string;
    },
  ): Promise<ModerationCaseRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into moderation_cases (
        id,
        tenant_id,
        target_type,
        target_id,
        status,
        reason_key,
        opened_by_membership_id,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id')::uuid,
        ${args.targetType},
        ${args.targetId}::uuid,
        'OPEN'::"ModerationStatus",
        ${args.reasonKey},
        ${args.openedByMembershipId}::uuid,
        now(),
        now()
      )
      returning *
    `;

    const row = rows[0];
    if (!row) throw new Error("Failed to create moderation case");
    return mapCaseRow(row);
  },

  async updateCaseStatus(
    tx: TenantTx,
    args: { caseId: string; status: ModerationStatus },
  ): Promise<ModerationCaseRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update moderation_cases
      set status = ${args.status}::"ModerationStatus", updated_at = now()
      where id = ${args.caseId}::uuid
      returning *
    `;

    const row = rows[0];
    return row ? mapCaseRow(row) : null;
  },

  async findCaseById(tx: TenantTx, caseId: string): Promise<ModerationCaseRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from moderation_cases
      where id = ${caseId}::uuid
      limit 1
    `;

    const row = rows[0];
    return row ? mapCaseRow(row) : null;
  },

  async insertDecision(
    tx: TenantTx,
    args: {
      caseId: string;
      decidedByMembershipId: string;
      decisionKey: string;
      decisionJson: Record<string, unknown> | null;
    },
  ): Promise<ModerationDecisionRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into moderation_decisions (
        id,
        tenant_id,
        moderation_case_id,
        decided_by_membership_id,
        decision_key,
        decision_json,
        occurred_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id')::uuid,
        ${args.caseId}::uuid,
        ${args.decidedByMembershipId}::uuid,
        ${args.decisionKey},
        ${args.decisionJson != null ? JSON.stringify(args.decisionJson) : null}::jsonb,
        now()
      )
      returning *
    `;

    const row = rows[0];
    if (!row) throw new Error("Failed to insert moderation decision");
    return mapDecisionRow(row);
  },

  async listDecisionsForCase(tx: TenantTx, caseId: string): Promise<ModerationDecisionRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from moderation_decisions
      where moderation_case_id = ${caseId}::uuid
      order by occurred_at asc
    `;

    return rows.map(mapDecisionRow);
  },

  async listCases(
    tx: TenantTx,
    args: {
      status?: ModerationStatus;
      targetType?: string;
      limit: number;
      cursor?: string;
    },
  ): Promise<ModerationCaseRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from moderation_cases
      where (${args.status ?? null}::text is null or status = ${args.status ?? null}::"ModerationStatus")
        and (${args.targetType ?? null}::text is null or target_type = ${args.targetType ?? null})
        and (${args.cursor ?? null}::uuid is null or created_at < (
          select created_at from moderation_cases where id = ${args.cursor ?? null}::uuid
        ))
      order by created_at desc
      limit ${args.limit + 1}
    `;

    return rows.map(mapCaseRow);
  },

  async listCasesWithOpenAppeals(
    tx: TenantTx,
    args: { limit: number; cursor?: string },
  ): Promise<ModerationCaseRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select distinct on (mc.id) mc.*
      from moderation_cases mc
      inner join appeals a
        on a.moderation_case_id = mc.id
        and a.status = 'open'
      where (${args.cursor ?? null}::uuid is null or mc.created_at < (
        select created_at from moderation_cases where id = ${args.cursor ?? null}::uuid
      ))
      order by mc.id, a.created_at desc, mc.created_at desc
      limit ${args.limit + 1}
    `;

    return rows.map(mapCaseRow);
  },

  async findOpenAppealForCase(tx: TenantTx, caseId: string): Promise<AppealRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from appeals
      where moderation_case_id = ${caseId}::uuid
        and status = 'open'
      limit 1
    `;

    const row = rows[0];
    return row ? mapAppealRow(row) : null;
  },

  async listAppealsForCase(tx: TenantTx, caseId: string): Promise<AppealRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from appeals
      where moderation_case_id = ${caseId}::uuid
      order by created_at asc
    `;

    return rows.map(mapAppealRow);
  },

  async insertAppeal(
    tx: TenantTx,
    args: {
      caseId: string;
      submittedByMembershipId: string;
      body: string;
    },
  ): Promise<AppealRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into appeals (
        id,
        tenant_id,
        moderation_case_id,
        submitted_by_membership_id,
        status,
        body,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id')::uuid,
        ${args.caseId}::uuid,
        ${args.submittedByMembershipId}::uuid,
        'open',
        ${args.body},
        now(),
        now()
      )
      returning *
    `;

    const row = rows[0];
    if (!row) throw new Error("Failed to create appeal");
    return mapAppealRow(row);
  },

  async findAppealById(tx: TenantTx, appealId: string): Promise<AppealRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from appeals
      where id = ${appealId}::uuid
      limit 1
    `;

    const row = rows[0];
    return row ? mapAppealRow(row) : null;
  },

  async updateAppealStatus(
    tx: TenantTx,
    args: { appealId: string; status: string },
  ): Promise<AppealRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update appeals
      set status = ${args.status}, updated_at = now()
      where id = ${args.appealId}::uuid
      returning *
    `;

    const row = rows[0];
    return row ? mapAppealRow(row) : null;
  },
};
