export const APPROVED_POSTHOG_EVENTS = [
  "diagnostic_started",
  "diagnostic_completed",
  "signup_completed",
  "lesson_completed",
  "assessment_attempt_started",
  "assessment_submitted",
  "swipe_session_completed",
  "readiness_viewed",
  "cta_outbound_clicked",
  "certificate_verified",
  "community_post_created",
  "admin_workflow_action",
] as const;

export type ApprovedPostHogEvent = (typeof APPROVED_POSTHOG_EVENTS)[number];

export const APPROVED_POSTHOG_PROPERTIES = [
  "tenantSafeId",
  "actorSafeId",
  "actorPlane",
  "routeGroup",
  "release",
  "environment",
  "source",
  "contentType",
  "assessmentType",
  "workflowAction",
  "outcome",
] as const;

const FORBIDDEN_POSTHOG_PROPERTIES = [
  "tenantId",
  "membershipId",
  "principalId",
  "email",
  "phone",
  "name",
  "token",
  "signedUrl",
  "assessmentAnswers",
  "diagnosticAnswers",
  "contentBody",
  "moderationEvidence",
] as const;

export function isApprovedPostHogEvent(event: string): event is ApprovedPostHogEvent {
  return (APPROVED_POSTHOG_EVENTS as readonly string[]).includes(event);
}

export function sanitizePostHogProperties(
  input: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};

  for (const key of APPROVED_POSTHOG_PROPERTIES) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      output[key] = value;
    }
  }

  return output;
}

export function assertNoForbiddenPostHogProperties(input: Record<string, unknown>): void {
  for (const key of Object.keys(input)) {
    if ((FORBIDDEN_POSTHOG_PROPERTIES as readonly string[]).includes(key)) {
      throw new Error(`Forbidden PostHog property: ${key}`);
    }
  }
}
