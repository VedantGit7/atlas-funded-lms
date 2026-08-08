import type { TenantTx } from "@atlas/db";
import {
  extractAssessmentConfig,
  readDescription,
} from "../../server/assessments/assessments.repository";
import { attemptsRepository } from "../../server/attempts/attempts.repository";
import { buildAuthenticatedScorecard } from "./diagnostic-result.service";
import { diagnosticRepository } from "./diagnostic.repository";
import type { DiagnosticCatalogItem, DiagnosticCatalogStatus } from "./diagnostic.types";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

/**
 * Estimated completion time. Prefers the authored time limit; otherwise derives
 * a conservative estimate from question count (~45s/question, floored at 3 min).
 */
function estimateMinutes(questionCount: number, timeLimitSeconds: number | undefined): number {
  if (typeof timeLimitSeconds === "number" && timeLimitSeconds > 0) {
    return Math.max(1, Math.round(timeLimitSeconds / 60));
  }
  return Math.max(3, Math.round(questionCount * 0.75));
}

export async function listMyDiagnostics(
  tx: TenantTx,
  ctx: ServiceCtx,
): Promise<{ data: { items: DiagnosticCatalogItem[] } }> {
  const assessments = await diagnosticRepository.listPublishedDiagnosticAssessments(
    tx,
    ctx.tenantId,
  );

  if (assessments.length === 0) {
    return { data: { items: [] } };
  }

  // The authenticated scorecard is membership-wide (competency scores), so it is
  // computed once and reused as the "completed" summary across diagnostics.
  const scorecard = await buildAuthenticatedScorecard({
    tx,
    membershipId: ctx.actorMembershipId,
    metadata: {},
    partial: false,
  });
  const overallScore = scorecard?.overallScore ?? null;
  const overallBandLabel = scorecard?.overallBandLabel ?? null;

  const items: DiagnosticCatalogItem[] = [];

  for (const assessment of assessments) {
    const [questionCount, session] = await Promise.all([
      diagnosticRepository.countAssessmentItems(tx, assessment.id),
      diagnosticRepository.findLatestMembershipSessionForAssessment(tx, {
        tenantId: ctx.tenantId,
        membershipId: ctx.actorMembershipId,
        assessmentId: assessment.id,
      }),
    ]);

    const config = extractAssessmentConfig(assessment.config_json);

    let status: DiagnosticCatalogStatus = "not_started";
    let sessionId: string | null = null;
    let lastActivityAt: string | null = null;

    if (session) {
      sessionId = session.id;
      const attempt = session.attemptId
        ? await attemptsRepository.findById(tx, session.attemptId)
        : null;
      const inProgress = attempt == null || attempt.status === "STARTED";
      status = inProgress ? "in_progress" : "completed";
      lastActivityAt = (session.completedAt ?? session.startedAt).toISOString();
    }

    const completed = status === "completed";

    items.push({
      assessmentId: assessment.id,
      title: assessment.title,
      description: readDescription(assessment.config_json),
      questionCount,
      estimatedMinutes: estimateMinutes(questionCount, config.timeLimitSeconds),
      status,
      sessionId,
      overallScore: completed ? overallScore : null,
      overallBandLabel: completed ? overallBandLabel : null,
      lastActivityAt,
    });
  }

  return { data: { items } };
}
