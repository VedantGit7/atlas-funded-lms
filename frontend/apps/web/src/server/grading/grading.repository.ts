// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import { MANUAL_ITEM_TYPE_KEYS } from "./grading.constants";

export type GradingTaskRow = {
  id: string;
  tenant_id: string;
  attempt_id: string;
  assigned_to_membership_id: string | null;
  status: string;
  rubric_json: unknown;
  result_json: unknown;
  created_at: Date;
  updated_at: Date;
};

export type GradingTaskListRow = GradingTaskRow & {
  assessment_id: string;
  assessment_title: string;
  learner_membership_id: string;
  learner_display_name: string | null;
  item_type_key: string;
  manual_possible_points: unknown;
  submitted_at: Date | null;
};

export type GradingResultJson = {
  score: number;
  feedback: string;
  possiblePoints: number;
  graderMembershipId: string;
  gradedAt: string;
  idempotencyKey?: string;
  rubricJson?: Record<string, unknown>;
  graderNotesJson?: Record<string, unknown>;
  itemScores?: Array<{
    assessmentItemId: string;
    pointsAwarded: number;
  }>;
};

export function mapDbStatusToApi(
  status: string,
): "PENDING" | "IN_PROGRESS" | "GRADED" | "CANCELLED" {
  switch (status) {
    case "open":
      return "PENDING";
    case "in_progress":
      return "IN_PROGRESS";
    case "graded":
      return "GRADED";
    case "cancelled":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

export function mapApiStatusToDb(
  status: "PENDING" | "IN_PROGRESS" | "GRADED" | "CANCELLED",
): string {
  switch (status) {
    case "PENDING":
      return "open";
    case "IN_PROGRESS":
      return "in_progress";
    case "GRADED":
      return "graded";
    case "CANCELLED":
      return "cancelled";
  }
}

export function parseGradingResult(resultJson: unknown): GradingResultJson | null {
  if (!resultJson || typeof resultJson !== "object" || Array.isArray(resultJson)) {
    return null;
  }

  const value = resultJson as Record<string, unknown>;
  if (typeof value["score"] !== "number" || typeof value["feedback"] !== "string") {
    return null;
  }

  return {
    score: value["score"],
    feedback: value["feedback"],
    possiblePoints: typeof value["possiblePoints"] === "number" ? value["possiblePoints"] : 0,
    graderMembershipId:
      typeof value["graderMembershipId"] === "string" ? value["graderMembershipId"] : "",
    gradedAt: typeof value["gradedAt"] === "string" ? value["gradedAt"] : new Date().toISOString(),
    ...(typeof value["idempotencyKey"] === "string"
      ? { idempotencyKey: value["idempotencyKey"] }
      : {}),
    ...(value["rubricJson"] &&
    typeof value["rubricJson"] === "object" &&
    !Array.isArray(value["rubricJson"])
      ? { rubricJson: value["rubricJson"] as Record<string, unknown> }
      : {}),
    ...(value["graderNotesJson"] &&
    typeof value["graderNotesJson"] === "object" &&
    !Array.isArray(value["graderNotesJson"])
      ? { graderNotesJson: value["graderNotesJson"] as Record<string, unknown> }
      : {}),
    ...(Array.isArray(value["itemScores"])
      ? {
          itemScores: value["itemScores"].filter(
            (entry): entry is { assessmentItemId: string; pointsAwarded: number } =>
              typeof entry === "object" &&
              entry != null &&
              typeof (entry as { assessmentItemId?: unknown }).assessmentItemId === "string" &&
              typeof (entry as { pointsAwarded?: unknown }).pointsAwarded === "number",
          ),
        }
      : {}),
  };
}

function decimalToNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }

  return 0;
}

export const gradingRepository = {
  async findById(tx: TenantTx, taskId: string): Promise<GradingTaskRow | null> {
    const rows = await tx.$queryRaw<GradingTaskRow[]>`
      select
        id::text,
        tenant_id::text,
        attempt_id::text,
        assigned_to_membership_id::text,
        status,
        rubric_json,
        result_json,
        created_at,
        updated_at
      from grading_tasks
      where id = ${taskId}::uuid
      limit 1
    `;

    return rows[0] ?? null;
  },

  async listTasks(
    tx: TenantTx,
    args: {
      tenantId: string;
      actorMembershipId: string;
      includeAll: boolean;
      status?: "PENDING" | "IN_PROGRESS" | "GRADED" | "CANCELLED";
      assessmentId?: string;
      learnerMembershipId?: string;
      q?: string;
      limit: number;
      cursor?: string;
    },
  ): Promise<GradingTaskListRow[]> {
    const dbStatus = args.status ? mapApiStatusToDb(args.status) : null;
    const manualTypes = [...MANUAL_ITEM_TYPE_KEYS];
    const search = args.q ? `%${args.q}%` : null;

    const rows = await tx.$queryRaw<GradingTaskListRow[]>`
      select
        gt.id::text,
        gt.tenant_id::text,
        gt.attempt_id::text,
        gt.assigned_to_membership_id::text,
        gt.status,
        gt.rubric_json,
        gt.result_json,
        gt.created_at,
        gt.updated_at,
        a.assessment_id::text as assessment_id,
        asm.title as assessment_title,
        a.membership_id::text as learner_membership_id,
        mp.display_name as learner_display_name,
        coalesce(min(items.item_type_key), 'short_answer') as item_type_key,
        coalesce(sum(case when items.item_type_key = any(${manualTypes}::text[]) then ai.points else 0 end), 0) as manual_possible_points,
        a.submitted_at
      from grading_tasks gt
      inner join attempts a on a.id = gt.attempt_id and a.tenant_id = gt.tenant_id
      inner join assessments asm on asm.id = a.assessment_id and asm.tenant_id = gt.tenant_id
      left join member_profiles mp on mp.membership_id = a.membership_id and mp.tenant_id = gt.tenant_id
      left join assessment_items ai on ai.assessment_id = a.assessment_id and ai.tenant_id = gt.tenant_id
      left join items on items.id = ai.item_id and items.tenant_id = gt.tenant_id
      where gt.tenant_id = ${args.tenantId}::uuid
        and (${dbStatus}::text is null or gt.status = ${dbStatus})
        and (${args.assessmentId}::uuid is null or a.assessment_id = ${args.assessmentId ?? null}::uuid)
        and (${args.learnerMembershipId}::uuid is null or a.membership_id = ${args.learnerMembershipId ?? null}::uuid)
        and (
          ${args.includeAll} = true
          or gt.assigned_to_membership_id = ${args.actorMembershipId}::uuid
          or (asm.config_json ->> 'createdByMembershipId') = ${args.actorMembershipId}
        )
        and (${search}::text is null or asm.title ilike ${search} or coalesce(mp.display_name, '') ilike ${search})
        and (${args.cursor}::uuid is null or gt.id < ${args.cursor ?? null}::uuid)
      group by
        gt.id,
        gt.tenant_id,
        gt.attempt_id,
        gt.assigned_to_membership_id,
        gt.status,
        gt.rubric_json,
        gt.result_json,
        gt.created_at,
        gt.updated_at,
        a.assessment_id,
        asm.title,
        a.membership_id,
        mp.display_name,
        a.submitted_at
      order by gt.created_at desc, gt.id desc
      limit ${args.limit + 1}
    `;

    return rows;
  },

  async countPendingTasksForAttempt(tx: TenantTx, attemptId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from grading_tasks
      where attempt_id = ${attemptId}::uuid
        and status in ('open', 'in_progress')
    `;

    return Number(rows[0]?.count ?? 0n);
  },

  async updateTaskGraded(
    tx: TenantTx,
    args: {
      taskId: string;
      resultJson: GradingResultJson;
      rubricJson?: Record<string, unknown>;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      update grading_tasks
      set
        status = 'graded',
        result_json = ${JSON.stringify(args.resultJson)}::jsonb,
        rubric_json = coalesce(${args.rubricJson ? JSON.stringify(args.rubricJson) : null}::jsonb, rubric_json),
        updated_at = now()
      where id = ${args.taskId}::uuid
    `;
  },

  async updateAttemptAfterGrading(
    tx: TenantTx,
    args: {
      attemptId: string;
      status: "SUBMITTED" | "GRADED";
      scorePercent: number | null;
    },
  ): Promise<void> {
    if (args.status === "GRADED") {
      await tx.$executeRaw`
        update attempts
        set
          status = 'GRADED'::"AttemptStatus",
          graded_at = now(),
          score_pct = ${args.scorePercent}
        where id = ${args.attemptId}::uuid
      `;
      return;
    }

    await tx.$executeRaw`
      update attempts
      set score_pct = ${args.scorePercent}
      where id = ${args.attemptId}::uuid
    `;
  },

  async loadManualAnswerRows(
    tx: TenantTx,
    args: { attemptId: string; assessmentId: string },
  ): Promise<
    Array<{
      assessmentItemId: string;
      itemTypeKey: string;
      stemJson: unknown;
      points: number;
      answerJson: unknown;
      pointsAwarded: number | null;
    }>
  > {
    const manualTypes = [...MANUAL_ITEM_TYPE_KEYS];

    const rows = await tx.$queryRaw<
      Array<{
        assessment_item_id: string;
        item_type_key: string;
        stem_json: unknown;
        points: unknown;
        answer_json: unknown;
        points_awarded: unknown;
      }>
    >`
      select
        ai.id::text as assessment_item_id,
        items.item_type_key,
        items.stem_json,
        ai.points,
        aa.answer_json,
        aa.points_awarded
      from assessment_items ai
      inner join items on items.id = ai.item_id and items.tenant_id = ai.tenant_id
      left join attempt_answers aa
        on aa.assessment_item_id = ai.id
        and aa.attempt_id = ${args.attemptId}::uuid
      where ai.assessment_id = ${args.assessmentId}::uuid
        and items.item_type_key = any(${manualTypes}::text[])
      order by ai.position asc
    `;

    return rows.map((row) => ({
      assessmentItemId: row.assessment_item_id,
      itemTypeKey: row.item_type_key,
      stemJson: row.stem_json,
      points: decimalToNumber(row.points),
      answerJson: row.answer_json,
      pointsAwarded: row.points_awarded == null ? null : decimalToNumber(row.points_awarded),
    }));
  },

  async sumObjectivePointsAwarded(tx: TenantTx, attemptId: string): Promise<number> {
    const manualTypes = [...MANUAL_ITEM_TYPE_KEYS];
    const rows = await tx.$queryRaw<Array<{ total: unknown }>>`
      select coalesce(sum(aa.points_awarded), 0) as total
      from attempt_answers aa
      inner join assessment_items ai on ai.id = aa.assessment_item_id and ai.tenant_id = aa.tenant_id
      inner join items on items.id = ai.item_id and items.tenant_id = aa.tenant_id
      where aa.attempt_id = ${attemptId}::uuid
        and items.item_type_key <> all(${manualTypes}::text[])
    `;

    return decimalToNumber(rows[0]?.total ?? 0);
  },

  async sumTotalPossiblePoints(tx: TenantTx, assessmentId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ total: unknown }>>`
      select coalesce(sum(points), 0) as total
      from assessment_items
      where assessment_id = ${assessmentId}::uuid
    `;

    return decimalToNumber(rows[0]?.total ?? 0);
  },

  async sumManualPossiblePoints(tx: TenantTx, assessmentId: string): Promise<number> {
    const manualTypes = [...MANUAL_ITEM_TYPE_KEYS];
    const rows = await tx.$queryRaw<Array<{ total: unknown }>>`
      select coalesce(sum(ai.points), 0) as total
      from assessment_items ai
      inner join items on items.id = ai.item_id and items.tenant_id = ai.tenant_id
      where ai.assessment_id = ${assessmentId}::uuid
        and items.item_type_key = any(${manualTypes}::text[])
    `;

    return decimalToNumber(rows[0]?.total ?? 0);
  },

  async loadAttemptSummary(
    tx: TenantTx,
    attemptId: string,
  ): Promise<{
    id: string;
    assessmentId: string;
    membershipId: string;
    status: string;
    submittedAt: Date | null;
    scorePct: number | null;
  } | null> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        assessment_id: string;
        membership_id: string;
        status: string;
        submitted_at: Date | null;
        score_pct: unknown;
      }>
    >`
      select
        id::text,
        assessment_id::text,
        membership_id::text,
        status::text,
        submitted_at,
        score_pct
      from attempts
      where id = ${attemptId}::uuid
      limit 1
    `;

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      assessmentId: row.assessment_id,
      membershipId: row.membership_id,
      status: row.status,
      submittedAt: row.submitted_at,
      scorePct: row.score_pct == null ? null : decimalToNumber(row.score_pct),
    };
  },

  async loadAssessmentSummary(
    tx: TenantTx,
    assessmentId: string,
  ): Promise<{
    id: string;
    title: string;
    assessmentType: string;
    createdByMembershipId: string | null;
  } | null> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        assessment_type: string;
        config_json: { createdByMembershipId?: string } | null;
      }>
    >`
      select id::text, title, assessment_type, config_json
      from assessments
      where id = ${assessmentId}::uuid
        and deleted_at is null
      limit 1
    `;

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title,
      assessmentType: row.assessment_type,
      createdByMembershipId: row.config_json?.createdByMembershipId ?? null,
    };
  },

  async loadLearnerDisplayName(tx: TenantTx, membershipId: string): Promise<string> {
    const rows = await tx.$queryRaw<Array<{ display_name: string | null }>>`
      select display_name
      from member_profiles
      where membership_id = ${membershipId}::uuid
      limit 1
    `;

    return rows[0]?.display_name?.trim() || "Learner";
  },
};

export { decimalToNumber };
