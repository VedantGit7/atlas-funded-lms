import type { TenantTx } from "@atlas/db";
import {
  assessmentsRepository,
  extractAssessmentConfig,
  extraAttemptsGranted,
} from "../assessments/assessments.repository";
import type { LessonQuizSummary } from "./lesson-schemas";

/**
 * What a quiz lesson shows before the quiz starts (QA review 1 C6, review 2
 * C5): the rules, and where the learner stands. The lesson used to print the
 * quiz's id; it now shows this card with a Start, Resume or Retake button.
 */
export async function loadQuizSummary(
  tx: TenantTx,
  args: { tenantId: string; assessmentId: string; membershipId: string | null },
): Promise<LessonQuizSummary | null> {
  const assessment = await assessmentsRepository.findById(tx, args.assessmentId);
  if (!assessment || assessment.tenant_id !== args.tenantId) return null;

  const config = extractAssessmentConfig(assessment.config_json);
  const questionCount = await assessmentsRepository.countAssessmentItems(tx, args.assessmentId);

  const attempts = args.membershipId
    ? await tx.attempt.findMany({
        where: {
          assessment_id: args.assessmentId,
          membership_id: args.membershipId,
          status: { notIn: ["ABANDONED", "VOIDED"] },
        },
        orderBy: { started_at: "desc" },
        select: { id: true, status: true, score_pct: true },
      })
    : [];

  const scoreOf = (value: unknown) => (value == null ? null : Number(value));
  const passedOf = (status: string, score: number | null) =>
    status === "GRADED" && score != null ? score >= config.passMarkPercent : null;

  const allowed =
    config.attemptsAllowed +
    (args.membershipId ? extraAttemptsGranted(assessment.config_json, args.membershipId) : 0);
  const scores = attempts
    .filter((attempt) => attempt.status === "GRADED")
    .map((attempt) => scoreOf(attempt.score_pct))
    .filter((score): score is number => score != null);
  const last = attempts.find((attempt) => attempt.status !== "STARTED") ?? null;
  const lastScore = last ? scoreOf(last.score_pct) : null;

  return {
    title: assessment.title,
    available: assessment.status === "PUBLISHED",
    questionCount,
    passMarkPercent: config.passMarkPercent,
    timeLimitSeconds: config.timeLimitSeconds ?? null,
    attemptsAllowed: allowed,
    attemptsUsed: attempts.length,
    attemptsRemaining: Math.max(0, allowed - attempts.length),
    proctoringLevel:
      config.proctoringLevel >= 1 ? config.proctoringLevel : config.l1ProctoringEnabled ? 1 : 0,
    inProgressAttemptId: attempts.find((attempt) => attempt.status === "STARTED")?.id ?? null,
    bestScorePercent: scores.length > 0 ? Math.max(...scores) : null,
    passed: scores.some((score) => score >= config.passMarkPercent),
    lastAttempt: last
      ? {
          id: last.id,
          status: last.status === "GRADED" ? "GRADED" : "SUBMITTED",
          scorePercent: lastScore,
          passed: passedOf(last.status, lastScore),
        }
      : null,
  };
}
