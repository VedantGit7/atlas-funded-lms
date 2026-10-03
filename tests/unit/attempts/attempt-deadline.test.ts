import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_ACTOR_MEMBERSHIP_ID } from "@atlas/core/actor/system-actor";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const learnerId = "018f0000-0000-7000-8000-000000000020";
const assessmentId = "018f0000-0000-7000-8000-000000000030";
const attemptId = "018f0000-0000-7000-8000-000000000040";
const assessmentItemId = "018f0000-0000-7000-8000-000000000050";
const itemId = "018f0000-0000-7000-8000-000000000060";
const correctOptionId = "018f0000-0000-7000-8000-000000000071";
const wrongOptionId = "018f0000-0000-7000-8000-000000000072";

type Row = {
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

const { attempts, insertedAnswers, mockAuditWrite, mockOutboxPublish, mockFinalizeProctoring } =
  vi.hoisted(() => ({
    attempts: new Map<string, Row>(),
    insertedAnswers: [] as unknown[],
    mockAuditWrite: vi.fn(),
    mockOutboxPublish: vi.fn(),
    mockFinalizeProctoring: vi.fn(),
  }));

vi.mock("@atlas/audit", () => ({ auditWriter: { write: mockAuditWrite } }));
vi.mock("@atlas/events", () => ({ outbox: { publish: mockOutboxPublish } }));

vi.mock("../../../backend/apps/api/src/server/proctoring/proctoring.service", () => ({
  finalizeProctoringReport: mockFinalizeProctoring,
  startProctoringSession: vi.fn(),
}));

vi.mock(
  "../../../backend/apps/api/src/server/assessments/assessments.repository",
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      assessmentsRepository: {
        findById: vi.fn(async () => ({
          id: assessmentId,
          tenant_id: tenantId,
          status: "PUBLISHED",
          config_json: { timeLimitSeconds: 600, passMarkPercent: 50, attemptsAllowed: 1 },
        })),
        listAssessmentItems: vi.fn(async () => [
          { id: assessmentItemId, item_id: itemId, position: 1, points: 1, config_json: {} },
        ]),
      },
    };
  },
);

vi.mock(
  "../../../backend/apps/api/src/server/item-registry/item-registry.repository",
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      itemRegistryRepository: {
        findItemById: vi.fn(async () => ({
          id: itemId,
          item_type_key: "mcq_single",
          stem_json: { stem: "2 + 2?" },
          explanation_json: null,
        })),
        listItemOptions: vi.fn(async () => [
          { id: correctOptionId, option_json: { text: "4" }, is_correct: true, position: 1 },
          { id: wrongOptionId, option_json: { text: "5" }, is_correct: false, position: 2 },
        ]),
      },
    };
  },
);

vi.mock(
  "../../../backend/apps/api/src/server/attempts/attempts.repository",
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    const read = (id: string) => {
      const row = attempts.get(id);
      return row ? { ...row } : null;
    };
    return {
      ...actual,
      attemptsRepository: {
        findById: vi.fn(async (_tx: unknown, id: string) => read(id)),
        findByIdForUpdate: vi.fn(async (_tx: unknown, id: string) => read(id)),
        updateMetadata: vi.fn(async (_tx: unknown, id: string, metadata: unknown) => {
          const row = attempts.get(id);
          if (row) row.metadata_json = metadata;
        }),
        insertAnswer: vi.fn(async (_tx: unknown, args: unknown) => {
          insertedAnswers.push(args);
        }),
        insertGradingTask: vi.fn(),
        submitAttempt: vi.fn(
          async (
            _tx: unknown,
            args: {
              attemptId: string;
              status: string;
              scorePercent: number | null;
              metadata: unknown;
            },
          ) => {
            const row = attempts.get(args.attemptId);
            if (!row) return;
            row.status = args.status;
            row.score_pct = args.scorePercent;
            row.metadata_json = args.metadata;
            row.submitted_at = new Date();
          },
        ),
      },
    };
  },
);

import {
  ATTEMPT_DEADLINE_GRACE_MS,
  attemptDeadlinePhase,
  finalizeExpiredAttempt,
  getAttempt,
  saveAttemptAnswer,
  submitAttempt,
} from "../../../backend/apps/api/src/server/attempts/attempts.service";

const tx = {} as never;
const learnerCtx = { tenantId, actorMembershipId: learnerId, requestId: "req-learner" };

/** A STARTED attempt whose deadline is `dueOffsetMs` from now, with a correct answer saved. */
function seedAttempt(dueOffsetMs: number) {
  attempts.set(attemptId, {
    id: attemptId,
    tenant_id: tenantId,
    assessment_id: assessmentId,
    membership_id: learnerId,
    status: "STARTED",
    started_at: new Date(Date.now() - 600_000),
    submitted_at: null,
    graded_at: null,
    score_pct: null,
    idempotency_key: "start-key",
    metadata_json: {
      dueAt: new Date(Date.now() + dueOffsetMs).toISOString(),
      draftAnswers: {
        [assessmentItemId]: {
          answerJson: { selectedOptionId: correctOptionId },
          updatedAt: new Date().toISOString(),
        },
      },
    },
  });
}

function stored() {
  const row = attempts.get(attemptId);
  if (!row) throw new Error("attempt missing");
  return row;
}

describe("timed attempt deadlines (audit finding H1)", () => {
  beforeEach(() => {
    attempts.clear();
    insertedAnswers.length = 0;
    mockAuditWrite.mockReset();
    mockOutboxPublish.mockReset();
    mockFinalizeProctoring.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("attemptDeadlinePhase", () => {
    const dueAt = "2026-10-01T10:00:00.000Z";
    const due = Date.parse(dueAt);

    it("is open for untimed attempts and before the deadline", () => {
      expect(attemptDeadlinePhase({})).toBe("open");
      expect(attemptDeadlinePhase({ dueAt }, due - 1)).toBe("open");
      expect(attemptDeadlinePhase({ dueAt }, due)).toBe("open");
    });

    it("is grace inside the window and closed after it", () => {
      expect(attemptDeadlinePhase({ dueAt }, due + 1)).toBe("grace");
      expect(attemptDeadlinePhase({ dueAt }, due + ATTEMPT_DEADLINE_GRACE_MS)).toBe("grace");
      expect(attemptDeadlinePhase({ dueAt }, due + ATTEMPT_DEADLINE_GRACE_MS + 1)).toBe("closed");
    });
  });

  describe("submitAttempt", () => {
    it("grades a submit that arrives after the deadline instead of rejecting it", async () => {
      seedAttempt(-(ATTEMPT_DEADLINE_GRACE_MS + 60_000));

      const result = await submitAttempt(tx, learnerCtx, attemptId, "submit-late");

      expect(result.data.status).toBe("GRADED");
      expect(result.data.scorePercent).toBe(100);
      expect(stored().status).toBe("GRADED");
      expect(stored().metadata_json).toMatchObject({
        submission: { trigger: "learner", afterDeadline: true },
      });
    });

    it("accepts a submit inside the grace window", async () => {
      seedAttempt(-5_000);

      const result = await submitAttempt(tx, learnerCtx, attemptId, "submit-grace");

      expect(result.data.status).toBe("GRADED");
      expect(stored().metadata_json).toMatchObject({
        submission: { trigger: "learner", afterDeadline: true },
      });
    });

    it("records an on-time submit as on time", async () => {
      seedAttempt(60_000);

      await submitAttempt(tx, learnerCtx, attemptId, "submit-on-time");

      expect(stored().metadata_json).toMatchObject({
        submission: { trigger: "learner", afterDeadline: false },
      });
    });

    it("returns the existing result when the deadline already finalized the attempt", async () => {
      seedAttempt(-(ATTEMPT_DEADLINE_GRACE_MS + 60_000));
      await finalizeExpiredAttempt(tx, { tenantId, requestId: "req-sweep" }, attemptId);
      const answersAfterDeadline = insertedAnswers.length;

      const result = await submitAttempt(tx, learnerCtx, attemptId, "submit-after-sweep");

      expect(result.data.status).toBe("GRADED");
      expect(result.data.scorePercent).toBe(100);
      // Not graded a second time.
      expect(insertedAnswers).toHaveLength(answersAfterDeadline);
      expect(mockOutboxPublish).toHaveBeenCalledOnce();
    });

    it("hides another learner's attempt", async () => {
      seedAttempt(60_000);

      await expect(
        submitAttempt(
          tx,
          { ...learnerCtx, actorMembershipId: "018f0000-0000-7000-8000-000000000099" },
          attemptId,
          "submit-other",
        ),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("saveAttemptAnswer", () => {
    const input = { itemId, answerJson: { selectedOptionId: wrongOptionId } };

    it("accepts a save that lands inside the grace window", async () => {
      seedAttempt(-5_000);

      await expect(
        saveAttemptAnswer(tx, learnerCtx, attemptId, input, "save-grace"),
      ).resolves.toMatchObject({ data: { assessmentItemId } });
    });

    it("rejects a save after the grace window", async () => {
      seedAttempt(-(ATTEMPT_DEADLINE_GRACE_MS + 1_000));

      await expect(
        saveAttemptAnswer(tx, learnerCtx, attemptId, input, "save-late"),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe("finalizeExpiredAttempt", () => {
    it("grades saved answers and credits the learner, attributed to the system", async () => {
      seedAttempt(-(ATTEMPT_DEADLINE_GRACE_MS + 60_000));

      const finalized = await finalizeExpiredAttempt(
        tx,
        { tenantId, requestId: "req-sweep" },
        attemptId,
      );

      expect(finalized).toBe(true);
      expect(stored().status).toBe("GRADED");
      expect(Number(stored().score_pct)).toBe(100);
      expect(stored().metadata_json).toMatchObject({
        submission: { trigger: "deadline", afterDeadline: true },
      });

      // Audit: the deadline closed it, not a member.
      expect(mockAuditWrite).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          actorMembershipId: SYSTEM_ACTOR_MEMBERSHIP_ID,
          systemSource: "assessments.attempt_deadline",
        }),
        expect.objectContaining({
          action: "attempt.submitted",
          metadata: expect.objectContaining({ trigger: "deadline", afterDeadline: true }),
        }),
      );

      // Consumers credit payload.membershipId, so it must be the learner, not the system.
      expect(mockOutboxPublish).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          eventType: "assessment.submitted",
          payload: expect.objectContaining({ membershipId: learnerId, attemptId }),
        }),
      );
      expect(mockFinalizeProctoring).toHaveBeenCalledOnce();
    });

    it("leaves attempts inside the grace window alone", async () => {
      seedAttempt(-5_000);

      expect(await finalizeExpiredAttempt(tx, { tenantId, requestId: "r" }, attemptId)).toBe(false);
      expect(stored().status).toBe("STARTED");
    });

    it("does nothing for an attempt that is already finalized", async () => {
      seedAttempt(-(ATTEMPT_DEADLINE_GRACE_MS + 60_000));
      await finalizeExpiredAttempt(tx, { tenantId, requestId: "r1" }, attemptId);

      expect(await finalizeExpiredAttempt(tx, { tenantId, requestId: "r2" }, attemptId)).toBe(
        false,
      );
      expect(mockOutboxPublish).toHaveBeenCalledOnce();
    });

    it("ignores untimed attempts", async () => {
      seedAttempt(0);
      const row = stored();
      row.metadata_json = {};

      expect(await finalizeExpiredAttempt(tx, { tenantId, requestId: "r" }, attemptId)).toBe(false);
    });

    it("ignores another tenant's attempt", async () => {
      seedAttempt(-(ATTEMPT_DEADLINE_GRACE_MS + 60_000));

      expect(
        await finalizeExpiredAttempt(
          tx,
          { tenantId: "018f0000-0000-7000-8000-0000000000ff", requestId: "r" },
          attemptId,
        ),
      ).toBe(false);
      expect(stored().status).toBe("STARTED");
    });
  });

  describe("getAttempt", () => {
    it("finalizes an expired attempt on read and returns its result", async () => {
      seedAttempt(-(ATTEMPT_DEADLINE_GRACE_MS + 60_000));

      const view = await getAttempt(tx, learnerCtx, attemptId);

      expect(view.data.status).toBe("GRADED");
      expect(view.data).toMatchObject({ scorePercent: 100, passed: true });
    });

    it("still serves the runner inside the grace window", async () => {
      seedAttempt(-5_000);

      const view = await getAttempt(tx, learnerCtx, attemptId);

      expect(view.data.status).toBe("STARTED");
      expect(view.data.items).toHaveLength(1);
    });
  });
});
