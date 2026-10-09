import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { attemptsRepository } from "../attempts/attempts.repository";
import { attemptNotFound, attemptNotInProgress } from "../attempts/attempts.errors";
import {
  assessmentsRepository,
  extractAssessmentConfig,
} from "../assessments/assessments.repository";
import type {
  IdentityVerificationBody,
  IngestProctoringEventsBody,
  ProctoringEventType,
} from "./proctoring.schemas";
import {
  computeProctoringRiskScore,
  PROCTORING_EVENT_MIN_LEVEL,
  type ProctoringRiskBand,
} from "./proctoring-risk";
import { proctoringRepository } from "./proctoring.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function severityForEventType(eventType: ProctoringEventType): string {
  switch (eventType) {
    case "tab_hidden":
    case "window_blur":
    case "face_present":
    case "identity_verification_passed":
    case "media_permission_denied":
    case "media_unavailable":
      return "LOW";
    case "fullscreen_exit":
    case "copy":
    case "paste":
    case "cut":
    case "context_menu":
    case "microphone_activity":
    case "identity_verification_degraded":
      return "MEDIUM";
    case "devtools_heuristic":
    case "face_absent":
    case "multiple_faces":
    case "identity_verification_failed":
      return "HIGH";
  }
}

function summaryForEventType(eventType: string): string {
  switch (eventType) {
    case "tab_hidden":
      return "Tab became hidden";
    case "window_blur":
      return "Window lost focus";
    case "fullscreen_exit":
      return "Fullscreen exited";
    case "copy":
      return "Copy detected";
    case "paste":
      return "Paste detected";
    case "cut":
      return "Cut detected";
    case "context_menu":
      return "Context menu opened";
    case "devtools_heuristic":
      return "DevTools heuristic triggered";
    case "face_present":
      return "Face present";
    case "face_absent":
      return "Face absent";
    case "multiple_faces":
      return "Multiple faces detected";
    case "microphone_activity":
      return "Microphone activity detected";
    case "media_permission_denied":
      return "Media permission denied";
    case "media_unavailable":
      return "Media devices unavailable";
    case "identity_verification_passed":
      return "Identity verification passed";
    case "identity_verification_failed":
      return "Identity verification failed";
    case "identity_verification_degraded":
      return "Identity verification degraded";
    default:
      return eventType;
  }
}

function parseSummaryJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function eventLevelTooHigh(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Proctoring event type is not allowed for this session level.",
  });
}

function identityLevelRequired(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Identity verification requires proctoring level 3.",
  });
}

function identityEventTypeForStatus(
  status: IdentityVerificationBody["status"],
): ProctoringEventType {
  switch (status) {
    case "passed":
      return "identity_verification_passed";
    case "failed":
      return "identity_verification_failed";
    case "degraded":
      return "identity_verification_degraded";
  }
}

export async function startProctoringSession(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    attemptId: string;
    membershipId: string;
    level: number;
    consentedAt?: string | null;
    consentLevel?: number | null;
  },
) {
  const existing = await proctoringRepository.findSessionByAttemptId(tx, {
    tenantId: ctx.tenantId,
    attemptId: args.attemptId,
  });
  if (existing) {
    return existing;
  }

  const level = Math.max(1, Math.min(3, args.level));
  const consentLevel = args.consentLevel ?? level;
  const consentJson =
    args.consentedAt != null
      ? {
          consentedAt: args.consentedAt,
          level: consentLevel,
        }
      : null;

  const summaryJson: Record<string, unknown> = {
    level,
    advisory: true,
  };
  if (consentJson) {
    summaryJson["consent"] = consentJson;
  }

  return proctoringRepository.insertSession(tx, {
    tenantId: ctx.tenantId,
    attemptId: args.attemptId,
    membershipId: args.membershipId,
    level,
    summaryJson,
    consentJson,
  });
}

export async function ingestProctoringEvents(
  tx: TenantTx,
  ctx: ServiceCtx,
  attemptId: string,
  input: IngestProctoringEventsBody,
  _batchIdempotencyKey: string,
) {
  const attempt = await attemptsRepository.findById(tx, attemptId);
  if (!attempt || attempt.tenant_id !== ctx.tenantId) {
    throw attemptNotFound();
  }
  if (attempt.membership_id !== ctx.actorMembershipId) {
    throw attemptNotFound();
  }
  if (attempt.status !== "STARTED") {
    throw attemptNotInProgress();
  }

  const assessment = await assessmentsRepository.findById(tx, attempt.assessment_id);
  const config = assessment ? extractAssessmentConfig(assessment.config_json) : null;
  const proctoringLevel = config?.proctoringLevel ?? 0;
  const proctoringEnabled = proctoringLevel >= 1;

  let session = await proctoringRepository.findSessionByAttemptId(tx, {
    tenantId: ctx.tenantId,
    attemptId,
  });

  if (!session) {
    if (!proctoringEnabled) {
      throw attemptNotFound();
    }
    session = await startProctoringSession(tx, ctx, {
      attemptId,
      membershipId: attempt.membership_id,
      level: proctoringLevel,
      consentedAt: input.consent?.consentedAt ?? null,
      consentLevel: input.consent?.level ?? proctoringLevel,
    });
  } else if (input.consent) {
    const summary = parseSummaryJson(session.summary_json);
    const consentJson = {
      consentedAt: input.consent.consentedAt,
      level: input.consent.level,
    };
    summary["consent"] = consentJson;
    await proctoringRepository.updateSessionSummary(tx, {
      sessionId: session.id,
      summaryJson: summary,
      consentJson,
    });
  }

  const sessionLevel = session.level >= 1 ? session.level : proctoringLevel;

  for (const event of input.events) {
    const minLevel = PROCTORING_EVENT_MIN_LEVEL[event.eventType] ?? 1;
    if (sessionLevel < minLevel) {
      throw eventLevelTooHigh();
    }
  }

  let accepted = 0;
  let duplicates = 0;

  for (const event of input.events) {
    const inserted = await proctoringRepository.insertEvent(tx, {
      tenantId: ctx.tenantId,
      sessionId: session.id,
      eventType: event.eventType,
      severity: severityForEventType(event.eventType),
      metadataJson: event.metadata ?? null,
      occurredAt: event.occurredAt,
      idempotencyKey: `${attemptId}:${event.clientEventId}`,
    });
    if (inserted) {
      accepted += 1;
    } else {
      duplicates += 1;
    }
  }

  return {
    data: {
      accepted,
      duplicates,
    },
  };
}

export async function submitIdentityVerification(
  tx: TenantTx,
  ctx: ServiceCtx,
  attemptId: string,
  input: IdentityVerificationBody,
) {
  const attempt = await attemptsRepository.findById(tx, attemptId);
  if (!attempt || attempt.tenant_id !== ctx.tenantId) {
    throw attemptNotFound();
  }
  if (attempt.membership_id !== ctx.actorMembershipId) {
    throw attemptNotFound();
  }
  if (attempt.status !== "STARTED") {
    throw attemptNotInProgress();
  }

  const assessment = await assessmentsRepository.findById(tx, attempt.assessment_id);
  const config = assessment ? extractAssessmentConfig(assessment.config_json) : null;
  const proctoringLevel = config?.proctoringLevel ?? 0;

  if (proctoringLevel < 3) {
    throw identityLevelRequired();
  }

  let session = await proctoringRepository.findSessionByAttemptId(tx, {
    tenantId: ctx.tenantId,
    attemptId,
  });

  if (!session) {
    session = await startProctoringSession(tx, ctx, {
      attemptId,
      membershipId: attempt.membership_id,
      level: proctoringLevel,
    });
  }

  if (session.level < 3) {
    throw identityLevelRequired();
  }

  const verifiedAt =
    input.status === "passed" || input.status === "degraded" ? new Date().toISOString() : null;

  const row = await proctoringRepository.upsertIdentityVerification(tx, {
    tenantId: ctx.tenantId,
    sessionId: session.id,
    membershipId: attempt.membership_id,
    status: input.status,
    method: input.method,
    score: input.score ?? null,
    metadataJson: input.metadata ?? null,
    verifiedAt,
  });

  const eventType = identityEventTypeForStatus(input.status);
  await proctoringRepository.insertEvent(tx, {
    tenantId: ctx.tenantId,
    sessionId: session.id,
    eventType,
    severity: severityForEventType(eventType),
    metadataJson: {
      method: input.method,
      status: input.status,
      ...(input.score != null ? { score: input.score } : {}),
      ...(input.metadata ?? {}),
    },
    occurredAt: new Date().toISOString(),
    idempotencyKey: `${attemptId}:identity:${input.status}:${input.method}:${row.id}`,
  });

  return {
    data: {
      id: row.id,
      status: input.status,
      method: input.method,
      score: row.score != null ? Number(row.score) : null,
      verifiedAt: row.verified_at?.toISOString() ?? null,
    },
  };
}

export async function finalizeProctoringReport(tx: TenantTx, ctx: ServiceCtx, attemptId: string) {
  const session = await proctoringRepository.findSessionByAttemptId(tx, {
    tenantId: ctx.tenantId,
    attemptId,
  });
  if (!session) {
    return null;
  }

  const events = await proctoringRepository.listEventsForSession(tx, {
    tenantId: ctx.tenantId,
    sessionId: session.id,
  });

  const eventCounts: Record<string, number> = {};
  for (const event of events) {
    eventCounts[event.event_type] = (eventCounts[event.event_type] ?? 0) + 1;
  }

  const { score: riskScore, band: riskBand } = computeProctoringRiskScore(
    events.map((event) => event.event_type),
  );
  const reportJson = {
    eventCounts,
    riskScore,
    riskBand,
    advisory: true,
    totalEvents: events.length,
  };

  const summary = parseSummaryJson(session.summary_json);
  summary["finalized"] = {
    riskScore,
    riskBand,
    totalEvents: events.length,
    advisory: true,
  };

  await proctoringRepository.endSession(tx, {
    sessionId: session.id,
    summaryJson: summary,
  });

  return proctoringRepository.upsertReport(tx, {
    tenantId: ctx.tenantId,
    sessionId: session.id,
    riskScore,
    reportJson,
  });
}

export async function getTimelineForAttempt(
  tx: TenantTx,
  ctx: ServiceCtx,
  attemptId: string,
): Promise<{
  timeline: Array<{
    id: string;
    occurredAt: string;
    eventType: string;
    severity: string;
    summary: string | null;
  }>;
  report: {
    id: string;
    riskScore: number | null;
    riskBand: ProctoringRiskBand | null;
    summary: string | null;
    generatedAt: string;
  } | null;
}> {
  const session = await proctoringRepository.findSessionByAttemptId(tx, {
    tenantId: ctx.tenantId,
    attemptId,
  });
  if (!session) {
    return { timeline: [], report: null };
  }

  const events = await proctoringRepository.listEventsForSession(tx, {
    tenantId: ctx.tenantId,
    sessionId: session.id,
  });

  const reportRow = await proctoringRepository.findReportBySessionId(tx, {
    tenantId: ctx.tenantId,
    sessionId: session.id,
  });

  let report: {
    id: string;
    riskScore: number | null;
    riskBand: ProctoringRiskBand | null;
    summary: string | null;
    generatedAt: string;
  } | null = null;

  if (reportRow) {
    const riskScore = reportRow.risk_score != null ? Number(reportRow.risk_score) : null;
    const reportJson =
      reportRow.report_json &&
      typeof reportRow.report_json === "object" &&
      !Array.isArray(reportRow.report_json)
        ? (reportRow.report_json as Record<string, unknown>)
        : {};
    const totalEvents =
      typeof reportJson["totalEvents"] === "number" ? reportJson["totalEvents"] : events.length;
    const riskBand =
      reportJson["riskBand"] === "clean" ||
      reportJson["riskBand"] === "mild" ||
      reportJson["riskBand"] === "elevated" ||
      reportJson["riskBand"] === "egregious"
        ? reportJson["riskBand"]
        : riskScore != null
          ? computeProctoringRiskScore(events.map((event) => event.event_type)).band
          : null;

    report = {
      id: reportRow.id,
      riskScore,
      riskBand,
      summary:
        riskScore == null
          ? "Advisory proctoring report (no risk score)."
          : `Advisory risk score: ${String(riskScore)}/100 (${riskBand ?? "unknown"}; ${String(totalEvents)} event${totalEvents === 1 ? "" : "s"}).`,
      generatedAt: reportRow.generated_at.toISOString(),
    };
  }

  return {
    timeline: events.map((event) => ({
      id: event.id,
      occurredAt: event.occurred_at.toISOString(),
      eventType: event.event_type,
      severity: event.severity,
      summary: summaryForEventType(event.event_type),
    })),
    report,
  };
}
