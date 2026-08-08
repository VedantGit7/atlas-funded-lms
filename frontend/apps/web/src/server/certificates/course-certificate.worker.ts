import { withTenantTx } from "@atlas/db";
import {
  gamificationAssessmentGradedPayloadSchema,
  gamificationAssessmentSubmittedPayloadSchema,
  lessonCompletedPayloadSchema,
} from "../gamification/gamification-event.schemas";
import { handleCourseCertificateSourceEvent } from "./course-certificate-issuance.service";

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
      tenantId: event.tenantId,
      requestId: event.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      await handleCourseCertificateSourceEvent(
        tx,
        { tenantId: event.tenantId!, requestId: event.requestId },
        {
          id: event.id,
          eventType: event.eventType,
          payload: event.payload,
        },
      );
    },
  );
}

export const courseCertificateOutboxHandlers = [
  {
    destinationKey: COURSE_CERTIFICATE_WORKER_DESTINATION,
    handle: handleCourseCertificateOutboxEvent,
  },
];

export { COURSE_CERTIFICATE_SOURCE_EVENTS };
