// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type AttemptRow = {
  id: string;
  tenant_id: string;
  assessment_id: string;
  membership_id: string;
  status: string;
  started_at: Date;
  submitted_at: Date | null;
  graded_at: Date | null;
  score_pct: unknown;
  metadata_json: unknown;
  idempotency_key: string | null;
};

export type AttemptAnswerRow = {
  id: string;
  tenant_id: string;
  attempt_id: string;
  assessment_item_id: string;
  answer_json: unknown;
  is_correct: boolean | null;
  points_awarded: unknown;
  occurred_at: Date;
  idempotency_key: string;
};

export type AttemptMetadata = {
  dueAt?: string;
  draftAnswers?: Record<
    string,
    {
      answerJson: Record<string, unknown>;
      updatedAt: string;
    }
  >;
  idempotencyAnswers?: Record<
    string,
    {
      assessmentItemId: string;
      answerJson: Record<string, unknown>;
      savedAt: string;
    }
  >;
  submitIdempotency?: Record<
    string,
    {
      id: string;
      status: "SUBMITTED" | "GRADED";
      submittedAt: string;
      scorePercent: number | null;
      passed: boolean | null;
      requiresManualGrading: boolean;
      canReviewAnswers: boolean;
    }
  >;
};

export function parseAttemptMetadata(metadataJson: unknown): AttemptMetadata {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return {};
  }

  // Narrow unknown JSON metadata to the attempt metadata contract.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Prisma JSON is typed as object after the guard above.
  return metadataJson as AttemptMetadata;
}

export const attemptsRepository = {
  async findById(tx: TenantTx, attemptId: string): Promise<AttemptRow | null> {
    const row = await tx.attempt.findFirst({
      where: { id: attemptId },
      select: {
        id: true,
        tenant_id: true,
        assessment_id: true,
        membership_id: true,
        status: true,
        started_at: true,
        submitted_at: true,
        graded_at: true,
        score_pct: true,
        metadata_json: true,
        idempotency_key: true,
      },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      assessment_id: row.assessment_id,
      membership_id: row.membership_id,
      status: row.status,
      started_at: row.started_at,
      submitted_at: row.submitted_at,
      graded_at: row.graded_at,
      score_pct: row.score_pct,
      metadata_json: row.metadata_json,
      idempotency_key: row.idempotency_key,
    };
  },

  async findByIdempotencyKey(tx: TenantTx, idempotencyKey: string): Promise<AttemptRow | null> {
    const row = await tx.attempt.findFirst({
      where: { idempotency_key: idempotencyKey },
      select: {
        id: true,
        tenant_id: true,
        assessment_id: true,
        membership_id: true,
        status: true,
        started_at: true,
        submitted_at: true,
        graded_at: true,
        score_pct: true,
        metadata_json: true,
        idempotency_key: true,
      },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      assessment_id: row.assessment_id,
      membership_id: row.membership_id,
      status: row.status,
      started_at: row.started_at,
      submitted_at: row.submitted_at,
      graded_at: row.graded_at,
      score_pct: row.score_pct,
      metadata_json: row.metadata_json,
      idempotency_key: row.idempotency_key,
    };
  },

  async countAttemptsForMembership(
    tx: TenantTx,
    args: { assessmentId: string; membershipId: string },
  ): Promise<number> {
    const count = await tx.attempt.count({
      where: {
        assessment_id: args.assessmentId,
        membership_id: args.membershipId,
        status: { notIn: ["ABANDONED", "VOIDED"] },
      },
    });

    return count;
  },

  async insertAttempt(
    tx: TenantTx,
    args: {
      tenantId: string;
      assessmentId: string;
      membershipId: string;
      idempotencyKey: string;
      dueAt: string | null;
    },
  ): Promise<AttemptRow> {
    const id = randomUUID();
    const metadata: AttemptMetadata = args.dueAt ? { dueAt: args.dueAt } : {};

    await tx.$executeRaw`
      insert into attempts (
        id,
        tenant_id,
        assessment_id,
        membership_id,
        status,
        started_at,
        metadata_json,
        idempotency_key
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.assessmentId}::uuid,
        ${args.membershipId}::uuid,
        'STARTED',
        now(),
        ${JSON.stringify(metadata)}::jsonb,
        ${args.idempotencyKey}
      )
    `;

    const created = await this.findById(tx, id);
    if (!created) {
      throw new Error("Failed to create attempt");
    }

    return created;
  },

  async updateMetadata(tx: TenantTx, attemptId: string, metadata: AttemptMetadata): Promise<void> {
    await tx.$executeRaw`
      update attempts
      set metadata_json = ${JSON.stringify(metadata)}::jsonb
      where id = ${attemptId}::uuid
    `;
  },

  async submitAttempt(
    tx: TenantTx,
    args: {
      attemptId: string;
      status: "SUBMITTED" | "GRADED";
      scorePercent: number | null;
      metadata: AttemptMetadata;
    },
  ): Promise<void> {
    if (args.status === "GRADED") {
      await tx.$executeRaw`
        update attempts
        set
          status = 'GRADED'::"AttemptStatus",
          submitted_at = coalesce(submitted_at, now()),
          graded_at = now(),
          score_pct = ${args.scorePercent},
          metadata_json = ${JSON.stringify(args.metadata)}::jsonb
        where id = ${args.attemptId}::uuid
      `;
      return;
    }

    await tx.$executeRaw`
      update attempts
      set
        status = 'SUBMITTED'::"AttemptStatus",
        submitted_at = now(),
        score_pct = ${args.scorePercent},
        metadata_json = ${JSON.stringify(args.metadata)}::jsonb
      where id = ${args.attemptId}::uuid
    `;
  },

  async listAnswersForAttempt(tx: TenantTx, attemptId: string): Promise<AttemptAnswerRow[]> {
    const rows = await tx.attemptAnswer.findMany({
      where: { attempt_id: attemptId },
      orderBy: { occurred_at: "asc" },
      select: {
        id: true,
        tenant_id: true,
        attempt_id: true,
        assessment_item_id: true,
        answer_json: true,
        is_correct: true,
        points_awarded: true,
        occurred_at: true,
        idempotency_key: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      attempt_id: row.attempt_id,
      assessment_item_id: row.assessment_item_id,
      answer_json: row.answer_json,
      is_correct: row.is_correct,
      points_awarded: row.points_awarded,
      occurred_at: row.occurred_at,
      idempotency_key: row.idempotency_key,
    }));
  },

  async insertAnswer(
    tx: TenantTx,
    args: {
      tenantId: string;
      attemptId: string;
      assessmentItemId: string;
      answerJson: Record<string, unknown>;
      idempotencyKey: string;
      isCorrect: boolean | null;
      pointsAwarded: number | null;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      insert into attempt_answers (
        id,
        tenant_id,
        attempt_id,
        assessment_item_id,
        answer_json,
        is_correct,
        points_awarded,
        occurred_at,
        idempotency_key
      )
      values (
        ${randomUUID()}::uuid,
        ${args.tenantId}::uuid,
        ${args.attemptId}::uuid,
        ${args.assessmentItemId}::uuid,
        ${JSON.stringify(args.answerJson)}::jsonb,
        ${args.isCorrect},
        ${args.pointsAwarded},
        now(),
        ${args.idempotencyKey}
      )
    `;
  },

  async insertGradingTask(
    tx: TenantTx,
    args: {
      tenantId: string;
      attemptId: string;
      assignedToMembershipId: string | null;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      insert into grading_tasks (
        id,
        tenant_id,
        attempt_id,
        assigned_to_membership_id,
        status,
        created_at,
        updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${args.tenantId}::uuid,
        ${args.attemptId}::uuid,
        ${args.assignedToMembershipId}::uuid,
        'open',
        now(),
        now()
      )
    `;
  },
};
