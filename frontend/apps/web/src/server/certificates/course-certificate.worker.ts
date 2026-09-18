// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { withTenantTx } from "@atlas/db";
import {
  gamificationAssessmentGradedPayloadSchema,
  gamificationAssessmentSubmittedPayloadSchema,
  lessonCompletedPayloadSchema,
} from "../gamification/gamification-event.schemas";
import { handleCourseCertificateSourceEvent } from "./course-certificate-issuance.service";
import { isCertificateFeatureEnabled } from "./certificate-feature-flags";
import { processCertificateOutboxBatch } from "./certificate-worker-router";

export const COURSE_CERTIFICATE_WORKER_DESTINATION = "course.certificates";

const COURSE_CERTIFICATE_SOURCE_EVENTS = [
  "lesson.completed",
  "assessment.submitted",
  "assessment.graded",
] as const;

export async function handleCourseCertificateOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.tenantId == null) {
    throw new Error("Course certificate worker requires tenant-scoped events.");
  }
  const tenantId = event.tenantId;

  if (
    event.eventType !== "lesson.completed" &&
    event.eventType !== "assessment.submitted" &&
    event.eventType !== "assessment.graded"
  ) {
    return;
  }

  // Validate known payload shapes; ignore malformed events quietly after parse throws upstream.
  if (event.eventType === "lesson.completed") {
    lessonCompletedPayloadSchema.parse(event.payload);
  } else if (event.eventType === "assessment.submitted") {
    gamificationAssessmentSubmittedPayloadSchema.parse(event.payload);
  } else {
    gamificationAssessmentGradedPayloadSchema.parse(event.payload);
  }

  await withTenantTx(
    {
      tenantId,
      requestId: event.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      await handleCourseCertificateSourceEvent(
        tx,
        { tenantId, requestId: event.requestId },
        {
          id: event.id,
          eventType: event.eventType,
          payload: event.payload,
        },
      );
    },
  );

  // Drain any certificate.issued events published above (already off-request).
  if (isCertificateFeatureEnabled("pdfWorker")) {
    await processCertificateOutboxBatch({
      tenantId,
      requestId: `${event.requestId}:certificate-pdf`,
      limit: 10,
    }).catch((error: unknown) => {
      console.error("[course.certificates] PDF outbox drain failed", {
        tenantId,
        requestId: event.requestId,
        message: error instanceof Error ? error.message : "unknown",
      });
    });
  }
}

export const courseCertificateOutboxHandlers = [
  {
    destinationKey: COURSE_CERTIFICATE_WORKER_DESTINATION,
    handle: handleCourseCertificateOutboxEvent,
  },
];

export { COURSE_CERTIFICATE_SOURCE_EVENTS };
