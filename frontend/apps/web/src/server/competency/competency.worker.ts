import { withTenantTx } from "@atlas/db";
import {
  assessmentGradedPayloadSchema,
  assessmentSubmittedPayloadSchema,
  practiceSessionCompletedPayloadSchema,
} from "./competency-projection.schemas";
import { ingestSignalsAndProject } from "./competency-projection.service";
import {
  mapAssessmentAttemptToSignals,
  mapPracticeSessionToSignals,
} from "./competency-signal-mapper.service";

export const COMPETENCY_WORKER_DESTINATION = "competency.projection";

export async function handleCompetencyOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.tenantId == null) {
    throw new Error("Competency worker requires tenant-scoped events.");
  }

  const tenantId = event.tenantId;

  await withTenantTx(
    {
      tenantId,
      requestId: event.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      const ctx = {
        tenantId,
        requestId: event.requestId,
      };

      if (event.eventType === "assessment.submitted") {
        const payload = assessmentSubmittedPayloadSchema.parse(event.payload);
        const signals = await mapAssessmentAttemptToSignals({
          tx,
          attemptId: payload.attemptId,
          membershipId: payload.membershipId,
          onlyScoredItems: true,
        });

        if (signals.length === 0) return;

        await ingestSignalsAndProject({
          tx,
          ctx,
          sourceEventId: event.id,
          signals,
        });
        return;
      }

      if (event.eventType === "assessment.graded") {
        const payload = assessmentGradedPayloadSchema.parse(event.payload);
        const signals = await mapAssessmentAttemptToSignals({
          tx,
          attemptId: payload.attemptId,
          membershipId: payload.learnerMembershipId,
          onlyScoredItems: true,
        });

        if (signals.length === 0) return;

        await ingestSignalsAndProject({
          tx,
          ctx,
          sourceEventId: event.id,
          signals,
        });
        return;
      }

      if (event.eventType === "practice.session_completed") {
        const payload = practiceSessionCompletedPayloadSchema.parse(event.payload);
        const signals = await mapPracticeSessionToSignals({
          tx,
          practiceSessionId: payload.practiceSessionId,
          membershipId: payload.membershipId,
        });

        if (signals.length === 0) return;

        await ingestSignalsAndProject({
          tx,
          ctx,
          sourceEventId: event.id,
          signals,
        });
      }
    },
  );
}

export const competencyOutboxHandlers = [
  {
    destinationKey: COMPETENCY_WORKER_DESTINATION,
    handle: handleCompetencyOutboxEvent,
  },
];
