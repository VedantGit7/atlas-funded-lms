export { APPROVED_EVENT_TYPES, assertApprovedEventType } from "@atlas/events/event-types";

export const COMPETENCY_CONSUMED_EVENT_TYPES = [
  "assessment.submitted",
  "assessment.graded",
  "practice.session_completed",
] as const;

export const COMPETENCY_EMITTED_EVENT_TYPES = [
  "competency.signal_recorded",
  "competency.score_changed",
] as const;
