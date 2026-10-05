import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { startAttempt } from "../../server/attempts/attempts.service";
import {
  attemptsRepository,
  parseAttemptMetadata,
} from "../../server/attempts/attempts.repository";
import { readPresentationOrder } from "../../server/attempts/presentation-order";
import {
  buildAuthenticatedScorecard,
  buildPublicDiagnosticQuestions,
} from "./diagnostic-result.service";
import { diagnosticRepository, parseDiagnosticSessionMetadata } from "./diagnostic.repository";
import { diagnosticNotConfigured } from "./diagnostic-public-session.service";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function startAuthenticatedDiagnostic(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  idempotencyKey: string;
}) {
  const assessment = await diagnosticRepository.findPublishedDiagnosticAssessment(
    args.tx,
    args.ctx.tenantId,
  );

  if (!assessment) {
    throw diagnosticNotConfigured();
  }

  const started = await startAttempt(args.tx, args.ctx, assessment.id, args.idempotencyKey);
  const attempt = await attemptsRepository.findById(args.tx, started.data.id);
  // Audit M9: the order the attempt stored at start, so a reload shows the same.
  const projection = await buildPublicDiagnosticQuestions(args.tx, assessment.id, {
    id: started.data.id,
    presentation: readPresentationOrder(parseAttemptMetadata(attempt?.metadata_json).presentation),
  });

  const session = await diagnosticRepository.insertMembershipSession(args.tx, {
    tenantId: args.ctx.tenantId,
    membershipId: args.ctx.actorMembershipId,
    assessmentId: assessment.id,
    attemptId: started.data.id,
    metadataJson: {
      questionProjection: projection.items,
    },
  });

  return {
    data: {
      sessionId: session.id,
      attemptId: started.data.id,
      assessmentId: assessment.id,
      title: projection.title,
      status: "started" as const,
      items: projection.items,
      totalQuestions: projection.items.length,
    },
  };
}

export async function getAuthenticatedDiagnosticResult(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  sessionId: string;
}) {
  const session = await diagnosticRepository.findById(args.tx, args.sessionId);

  if (!session || session.tenant_id !== args.ctx.tenantId) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Diagnostic session not found or access denied.",
    });
  }

  if (session.membership_id !== args.ctx.actorMembershipId) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Diagnostic session not found or access denied.",
    });
  }

  const metadata = parseDiagnosticSessionMetadata(session.metadata_json);
  const attempt =
    session.attempt_id != null
      ? await attemptsRepository.findById(args.tx, session.attempt_id)
      : null;

  if (attempt && attempt.status === "STARTED" && session.assessment_id) {
    const projection = await buildPublicDiagnosticQuestions(args.tx, session.assessment_id, {
      id: attempt.id,
      presentation: readPresentationOrder(parseAttemptMetadata(attempt.metadata_json).presentation),
    });
    return {
      data: {
        sessionId: session.id,
        attemptId: session.attempt_id,
        status: session.status,
        scorecard: null,
        runner: {
          attemptId: attempt.id,
          items: projection.items,
          totalQuestions: projection.items.length,
        },
      },
    };
  }

  const scorecard = await buildAuthenticatedScorecard({
    tx: args.tx,
    membershipId: args.ctx.actorMembershipId,
    metadata,
    partial: false,
  });

  return {
    data: {
      sessionId: session.id,
      attemptId: session.attempt_id,
      status: session.status,
      scorecard,
      runner: null,
    },
  };
}
