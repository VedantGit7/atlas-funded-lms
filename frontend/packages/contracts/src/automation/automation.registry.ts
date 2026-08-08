import { z } from "zod";
import { APPROVED_EVENT_TYPES } from "../events/event-types";
import { gamificationAssessmentGradedPayloadSchema } from "../gamification/gamification-event.schemas";
import { lessonCompletedPayloadSchema } from "../gamification/gamification-event.schemas";
import { certificateIssuedOutboxPayloadSchema } from "../certificates/certificate.dto";
import { isAutomationCycleEvent } from "./automation.events";

const unsafeKeyPattern = /^(eval|Function|url|webhook)$/;

export const AUTOMATION_TRIGGER_EVENT_TYPES = [
  "lesson.completed",
  "path.step_completed",
  "assessment.submitted",
  "assessment.graded",
  "practice.session_completed",
  "certificate.issued",
  "readiness.band_changed",
  "learning.enrollment.created",
  "workflow.transitioned",
  "badge.awarded",
  "streak.updated",
  "gamification.level_up",
  "quest.completed",
  "reward.redeemed",
  "competency.score_changed",
] as const;

export type AutomationTriggerEventType = (typeof AUTOMATION_TRIGGER_EVENT_TYPES)[number];

export const automationTriggerEventTypeSchema = z.enum(AUTOMATION_TRIGGER_EVENT_TYPES);

export const automationRuleKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9._-]*$/);

export const automationConditionAlwaysSchema = z.object({ type: z.literal("always") }).strict();

export const automationConditionAssessmentPassedSchema = z
  .object({
    type: z.literal("assessmentPassed"),
    minScorePercent: z.number().min(0).max(100),
  })
  .strict();

export const automationConditionSchema = z.discriminatedUnion("type", [
  automationConditionAlwaysSchema,
  automationConditionAssessmentPassedSchema,
]);

export const automationActionNotificationRequestSchema = z
  .object({
    type: z.literal("notification.request"),
    templateKey: z.string().min(1).max(128),
    membershipIdField: z.enum(["membershipId", "learnerMembershipId"]).default("membershipId"),
  })
  .strict();

export const automationActionCertificateIssueSchema = z
  .object({
    type: z.literal("certificate.issue"),
    templateId: z.string().uuid(),
    recipientMembershipIdField: z
      .enum(["membershipId", "learnerMembershipId"])
      .default("learnerMembershipId"),
    sourceType: z.enum(["course", "learning_path", "assessment"]),
    sourceIdField: z.string().min(1).max(64),
  })
  .strict();

export const automationActionSchema = z.discriminatedUnion("type", [
  automationActionNotificationRequestSchema,
  automationActionCertificateIssueSchema,
]);

export const REGISTERED_AUTOMATION_ACTION_TYPES = [
  "notification.request",
  "certificate.issue",
] as const;

export function assertAutomationTriggerEventType(eventType: string): AutomationTriggerEventType {
  automationTriggerEventTypeSchema.parse(eventType);
  if (!APPROVED_EVENT_TYPES.has(eventType)) {
    throw new Error(`Unapproved automation trigger event type: ${eventType}`);
  }
  if (isAutomationCycleEvent(eventType)) {
    throw new Error(`Automation cycle event cannot be used as trigger: ${eventType}`);
  }
  return eventType as AutomationTriggerEventType;
}

function assertNoUnsafeRecord(value: Record<string, unknown>): void {
  for (const key of Object.keys(value)) {
    if (unsafeKeyPattern.test(key)) {
      throw new Error(`Unsafe automation field: ${key}`);
    }
  }
}

export function parseAutomationCondition(value: unknown) {
  const parsed =
    value == null
      ? automationConditionAlwaysSchema.parse({ type: "always" })
      : automationConditionSchema.parse(value);
  assertNoUnsafeRecord(parsed);
  return parsed;
}

export function parseAutomationAction(value: unknown) {
  const parsed = automationActionSchema.parse(value);
  assertNoUnsafeRecord(parsed);
  return parsed;
}

export function evaluateAutomationCondition(args: {
  triggerEventType: AutomationTriggerEventType;
  condition: z.infer<typeof automationConditionSchema>;
  payload: unknown;
}): boolean {
  if (args.condition.type === "always") {
    return true;
  }

  if (args.triggerEventType !== "assessment.graded") {
    return false;
  }

  const parsed = gamificationAssessmentGradedPayloadSchema.safeParse(args.payload);
  if (!parsed.success) {
    return false;
  }
  const percent =
    parsed.data.possiblePoints > 0 ? (parsed.data.score / parsed.data.possiblePoints) * 100 : 0;
  return percent >= args.condition.minScorePercent;
}

export function resolvePayloadField(payload: Record<string, unknown>, field: string): unknown {
  return payload[field];
}

export function resolveMembershipIdFromPayload(
  payload: Record<string, unknown>,
  field: "membershipId" | "learnerMembershipId",
): string | null {
  const value = resolvePayloadField(payload, field);
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function validateTriggerPayloadShape(
  triggerEventType: AutomationTriggerEventType,
  payload: unknown,
): payload is Record<string, unknown> {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  if (triggerEventType === "lesson.completed") {
    return lessonCompletedPayloadSchema.safeParse(payload).success;
  }

  if (triggerEventType === "assessment.graded") {
    return gamificationAssessmentGradedPayloadSchema.safeParse(payload).success;
  }

  if (triggerEventType === "certificate.issued") {
    return certificateIssuedOutboxPayloadSchema.safeParse(payload).success;
  }

  return true;
}
