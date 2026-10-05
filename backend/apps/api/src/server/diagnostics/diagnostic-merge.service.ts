import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  isSessionProofExpired,
  parseStoredSessionProof,
  verifySessionSecret,
} from "@atlas/security";
import { submitAttempt } from "../../server/attempts/attempts.service";
import { attemptKeyConflict } from "../attempts/attempts.errors";
import { attemptsRepository } from "../../server/attempts/attempts.repository";
import { diagnosticRepository, parseDiagnosticSessionMetadata } from "./diagnostic.repository";
import { diagnosticSessionInvalid } from "./diagnostic-public-session.service";
import { presentationFromProjection } from "./diagnostic-result.service";
import { toAttemptDraftAnswers } from "./diagnostic-result.service";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function mergeAnonymousDiagnosticSession(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  anonymousId: string;
  secret: string;
  idempotencyKey: string;
}) {
  const session = await diagnosticRepository.findByAnonymousId(
    args.tx,
    args.ctx.tenantId,
    args.anonymousId,
  );

  if (!session || !session.anonymous_id || !session.assessment_id) {
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

  if (proof.mergedAttemptId && proof.mergedMembershipId === args.ctx.actorMembershipId) {
    return {
      data: {
        sessionId: session.id,
        attemptId: proof.mergedAttemptId,
        membershipId: args.ctx.actorMembershipId,
        resultPath: `/diagnostic/me/${session.id}/result`,
        alreadyMerged: true,
      },
    };
  }

  if (proof.mergedAt) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Diagnostic session has already been merged.",
    });
  }

  if (session.status !== "completed") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Only completed diagnostic sessions can be merged.",
    });
  }

  const metadata = parseDiagnosticSessionMetadata(session.metadata_json);
  if (!metadata.answers || Object.keys(metadata.answers).length === 0) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Diagnostic answers are unavailable for merge.",
    });
  }

  const mergeIdempotencyKey = `diagnostic-merge:${session.id}`;
  // Audit M2: only this learner's merge of this session counts as "already
  // merged"; another learner's never hands back their attempt.
  const byKey = await attemptsRepository.findOwnByIdempotencyKey(args.tx, {
    idempotencyKey: mergeIdempotencyKey,
    membershipId: args.ctx.actorMembershipId,
    assessmentId: session.assessment_id,
  });
  if (byKey.kind === "foreign") {
    throw attemptKeyConflict();
  }

  if (byKey.kind === "own") {
    return {
      data: {
        sessionId: session.id,
        attemptId: byKey.attempt.id,
        membershipId: args.ctx.actorMembershipId,
        resultPath: `/diagnostic/me/${session.id}/result`,
        alreadyMerged: true,
      },
    };
  }

  // Audit M9: the attempt keeps the order the anonymous session presented.
  const presentation = presentationFromProjection(metadata.questionProjection ?? []);
  const attempt = await attemptsRepository.insertAttempt(args.tx, {
    tenantId: args.ctx.tenantId,
    assessmentId: session.assessment_id,
    membershipId: args.ctx.actorMembershipId,
    idempotencyKey: mergeIdempotencyKey,
    dueAt: null,
    presentation,
  });

  await attemptsRepository.updateMetadata(args.tx, attempt.id, {
    presentation,
    draftAnswers: toAttemptDraftAnswers(metadata.answers),
  });

  await submitAttempt(args.tx, args.ctx, attempt.id, args.idempotencyKey);

  const mergedAt = new Date().toISOString();
  await diagnosticRepository.updateSession(args.tx, session.id, {
    status: "merged",
    membershipId: args.ctx.actorMembershipId,
    attemptId: attempt.id,
    mergeJson: {
      ...proof,
      mergedAt,
      mergedAttemptId: attempt.id,
      mergedMembershipId: args.ctx.actorMembershipId,
    },
  });

  await auditWriter.write(
    args.tx,
    {
      tenantId: args.ctx.tenantId,
      actorMembershipId: args.ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: args.ctx.requestId,
    },
    {
      action: "diagnostic.anonymous_merged",
      target: { type: "diagnostic_session", id: session.id },
      before: { status: session.status, membershipId: null, attemptId: null },
      after: {
        status: "merged",
        membershipId: args.ctx.actorMembershipId,
        attemptId: attempt.id,
      },
      reason: null,
      metadata: {
        anonymousId: session.anonymous_id,
        assessmentId: session.assessment_id,
      },
    },
  );

  await outbox.publish(args.tx, {
    ctx: {
      tenantId: args.ctx.tenantId,
      actorMembershipId: args.ctx.actorMembershipId,
      requestId: args.ctx.requestId,
    },
    eventType: "diagnostic.completed",
    aggregateType: "diagnostic_session",
    aggregateId: session.id,
    payload: {
      sessionId: session.id,
      assessmentId: session.assessment_id,
      membershipId: args.ctx.actorMembershipId,
      completedAt: mergedAt,
    },
    idempotencyKey: `diagnostic.completed:${session.id}`,
  });

  return {
    data: {
      sessionId: session.id,
      attemptId: attempt.id,
      membershipId: args.ctx.actorMembershipId,
      resultPath: `/diagnostic/${session.id}/result`,
      alreadyMerged: false,
    },
  };
}
