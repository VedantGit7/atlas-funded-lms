import { withTenantTx } from "@atlas/db";
import {
  diagnosticCompletedPayloadSchema,
  gamificationAssessmentGradedPayloadSchema,
  gamificationAssessmentSubmittedPayloadSchema,
  gamificationPracticeSessionCompletedPayloadSchema,
  lessonCompletedPayloadSchema,
  pathStepCompletedPayloadSchema,
} from "./gamification-event.schemas";
import { processGamificationSourceEvent } from "./gamification.service";

export const GAMIFICATION_WORKER_DESTINATION = "gamification.engine";

export async function handleGamificationOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.tenantId == null) {
    throw new Error("Gamification worker requires tenant-scoped events.");
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
        actorMembershipId: "00000000-0000-0000-0000-000000000000",
      };

      if (event.eventType === "lesson.completed") {
        lessonCompletedPayloadSchema.parse(event.payload);
      } else if (event.eventType === "path.step_completed") {
        pathStepCompletedPayloadSchema.parse(event.payload);
      } else if (event.eventType === "assessment.submitted") {
        gamificationAssessmentSubmittedPayloadSchema.parse(event.payload);
      } else if (event.eventType === "assessment.graded") {
        gamificationAssessmentGradedPayloadSchema.parse(event.payload);
      } else if (event.eventType === "practice.session_completed") {
        gamificationPracticeSessionCompletedPayloadSchema.parse(event.payload);
      } else if (event.eventType === "diagnostic.completed") {
        diagnosticCompletedPayloadSchema.parse(event.payload);
      } else {
        return;
      }

      const membershipId =
        event.eventType === "assessment.graded"
          ? gamificationAssessmentGradedPayloadSchema.parse(event.payload).learnerMembershipId
          : (event.payload as { membershipId: string }).membershipId;

      await processGamificationSourceEvent(tx, { ...ctx, actorMembershipId: membershipId }, event);
    },
  );
}

export const gamificationOutboxHandlers = [
  {
    destinationKey: GAMIFICATION_WORKER_DESTINATION,
    handle: handleGamificationOutboxEvent,
  },
];
