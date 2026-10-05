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
  /** How the attempt was finalized. Absent on attempts submitted before this was recorded. */
  submission?: {
    /** `learner`: the learner submitted. `deadline`: the time limit closed the attempt. */
    trigger: "learner" | "deadline";
    /** True when finalization happened after `dueAt` (inside or beyond the grace window). */
    afterDeadline: boolean;
  };
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

  /**
   * The attempt a start request's key already created, if it belongs to this
   * learner and assessment (audit M2). Keys are unique per tenant, so a key
   * reused by another learner or for another assessment is reported as
   * `foreign` without returning that attempt.
   */
  async findOwnByIdempotencyKey(
    tx: TenantTx,
    args: { idempotencyKey: string; membershipId: string; assessmentId: string },
  ): Promise<{ kind: "none" } | { kind: "own"; attempt: AttemptRow } | { kind: "foreign" }> {
    const attempt = await this.findByIdempotencyKey(tx, args.idempotencyKey);
    if (!attempt) return { kind: "none" };
    if (
      attempt.membership_id !== args.membershipId ||
      attempt.assessment_id !== args.assessmentId
    ) {
      return { kind: "foreign" };
    }
    return { kind: "own", attempt };
  },

  /**
   * Serialises attempt starts for one learner on one assessment until the
   * transaction ends (audit M2). Counting attempts and inserting one is two
   * statements; without this, concurrent starts each counted below the limit
   * and all inserted.
   */
  async lockAttemptStarts(
    tx: TenantTx,
    args: { tenantId: string; assessmentId: string; membershipId: string },
  ): Promise<void> {
    await tx.$executeRaw`
      select pg_advisory_xact_lock(
        hashtextextended(${`attempt-start:${args.tenantId}:${args.assessmentId}:${args.membershipId}`}::text, 0)
      )
    `;
  },

  /** Unscoped; callers must use findOwnByIdempotencyKey. */
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

  /**
   * Reads an attempt and holds its row lock until the transaction ends.
   *
   * Finalization (learner submit, a read past the deadline, and the worker's deadline sweep) all
   * start here, so two of them can never grade the same attempt: the second waits, then sees the
   * status the first committed.
   */
  async findByIdForUpdate(tx: TenantTx, attemptId: string): Promise<AttemptRow | null> {
    const rows = await tx.$queryRaw<AttemptRow[]>`
      select
        id::text,
        tenant_id::text,
        assessment_id::text,
        membership_id::text,
        status::text as status,
        started_at,
        submitted_at,
        graded_at,
        score_pct,
        metadata_json,
        idempotency_key
      from attempts
      where id = ${attemptId}::uuid
      for update
    `;
    return rows[0] ?? null;
  },

  /**
   * In-progress attempts whose deadline plus grace has passed, oldest deadline first.
   * `dueAt` is always an ISO timestamp written by `insertAttempt`.
   */
  async listExpiredStartedAttemptIds(
    tx: TenantTx,
    args: { graceMs: number; limit: number },
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from attempts
      where status = 'STARTED'::"AttemptStatus"
        and metadata_json ? 'dueAt'
        and (metadata_json->>'dueAt')::timestamptz
          < now() - make_interval(secs => ${args.graceMs / 1000})
      order by (metadata_json->>'dueAt')::timestamptz
      limit ${args.limit}
    `;
    return rows.map((row) => row.id);
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
