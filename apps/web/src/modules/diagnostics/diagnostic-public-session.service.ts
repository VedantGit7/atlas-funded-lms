import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  generateSessionProof,
  isSessionProofExpired,
  parseStoredSessionProof,
  verifySessionSecret,
} from "@atlas/security";
import { hashClientIp, hashUserAgent } from "@atlas/security";
import type { PublicDiagnosticCompleteOperationSchema } from "./diagnostic.schemas";
import type { z } from "zod";
import { diagnosticRepository, parseDiagnosticSessionMetadata } from "./diagnostic.repository";
import {
  buildPublicDiagnosticQuestions,
  buildScorecardFromAnswers,
  mapAnswersByAssessmentItemId,
  toStoredAnswers,
} from "./diagnostic-result.service";
import type { DiagnosticSessionMetadata } from "./diagnostic.types";

type ServiceCtx = {
  tenantId: string;
  requestId: string;
};

type CompleteInput = z.infer<typeof PublicDiagnosticCompleteOperationSchema>;

export function diagnosticSessionInvalid(): AtlasHttpError {
  return new AtlasHttpError({
    code: "AUTH_REQUIRED",
    status: 401,
    message: "Diagnostic session is invalid or expired.",
  });
}

export function diagnosticNotConfigured(): AtlasHttpError {
  return new AtlasHttpError({
    code: "INTERNAL_ERROR",
    status: 503,
    message: "Diagnostic is not available for this academy.",
  });
}

export async function startPublicDiagnosticSession(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  req: Request;
}) {
  const assessment = await diagnosticRepository.findPublishedDiagnosticAssessment(
    args.tx,
    args.ctx.tenantId,
  );

  if (!assessment) {
    throw diagnosticNotConfigured();
  }

  const projection = await buildPublicDiagnosticQuestions(args.tx, assessment.id);
  const anonymousId = randomUUID();
  const proof = generateSessionProof();
  const metadata: DiagnosticSessionMetadata = {
    questionProjection: projection.items,
  };

  const session = await diagnosticRepository.insertAnonymousSession(args.tx, {
    tenantId: args.ctx.tenantId,
    anonymousId,
    assessmentId: assessment.id,
    ipHash: hashClientIp(args.req),
    userAgentHash: hashUserAgent(args.req),
    mergeJson: {
      secretHash: proof.secretHash,
      expiresAt: proof.expiresAt,
    },
    metadataJson: metadata,
  });

  return {
    session,
    proof,
    response: {
      data: {
        anonymousId,
        sessionId: session.id,
        assessmentId: assessment.id,
        title: projection.title,
        items: projection.items,
        totalQuestions: projection.items.length,
      },
    },
  };
}

export async function completePublicDiagnosticSession(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  input: CompleteInput;
  secret: string;
}) {
  const session = await diagnosticRepository.findByAnonymousId(
    args.tx,
    args.ctx.tenantId,
    args.input.anonymousId,
  );

  if (!session || !session.anonymous_id) {
    throw diagnosticSessionInvalid();
  }

  const proof = parseStoredSessionProof(session.merge_json);
  if (
    !proof ||
    isSessionProofExpired(proof.expiresAt) ||
    !verifySessionSecret(args.secret, proof.secretHash)
  ) {
    throw diagnosticSessionInvalid();
  }

  if (session.status !== "started") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Diagnostic session is not in progress.",
    });
  }

  const metadata = parseDiagnosticSessionMetadata(session.metadata_json);

  const questions = metadata.questionProjection ?? [];
  if (questions.length === 0) {
    throw diagnosticSessionInvalid();
  }

  const answerMap = mapAnswersByAssessmentItemId({
    questions,
    answers: args.input.answers,
  });

  if (!session.assessment_id) {
    throw diagnosticSessionInvalid();
  }

  const partialScorecard = await buildScorecardFromAnswers({
    tx: args.tx,
    assessmentId: session.assessment_id,
    answers: answerMap,
    partial: true,
  });

  const storedAnswers = toStoredAnswers({ questions, answers: args.input.answers });

  const nextMetadata: DiagnosticSessionMetadata = {
    ...metadata,
    answers: storedAnswers,
    partialScorecard,
  };

  await diagnosticRepository.updateSession(args.tx, session.id, {
    status: "completed",
    completedAt: new Date(),
    metadataJson: nextMetadata,
  });

  return {
    data: {
      anonymousId: session.anonymous_id,
      sessionId: session.id,
      status: "completed" as const,
      resultPath: `/diagnostic/result?anonId=${session.anonymous_id}`,
    },
  };
}

export async function getPublicDiagnosticResult(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  anonymousId: string;
  secret: string;
}) {
  const session = await diagnosticRepository.findByAnonymousId(
    args.tx,
    args.ctx.tenantId,
    args.anonymousId,
  );

  if (!session || !session.anonymous_id) {
    throw diagnosticSessionInvalid();
  }

  const proof = parseStoredSessionProof(session.merge_json);
  if (
    !proof ||
    isSessionProofExpired(proof.expiresAt) ||
    !verifySessionSecret(args.secret, proof.secretHash)
  ) {
    throw diagnosticSessionInvalid();
  }

  if (session.status !== "completed" && session.status !== "merged") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Diagnostic is not completed yet.",
    });
  }

  const metadata = parseDiagnosticSessionMetadata(session.metadata_json);

  if (!metadata.partialScorecard) {
    throw new AtlasHttpError({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "Diagnostic result is unavailable.",
    });
  }

  return {
    data: {
      anonymousId: session.anonymous_id,
      sessionId: session.id,
      scorecard: metadata.partialScorecard,
    },
  };
}
