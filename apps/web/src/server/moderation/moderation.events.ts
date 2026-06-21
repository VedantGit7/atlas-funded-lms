import { z } from "zod";

export const MODERATION_CASE_OPENED_AUDIT = "moderation.case_opened" as const;
export const MODERATION_DECIDED_AUDIT = "community.moderation.decided" as const;

export const MODERATION_REPORTED_EVENT = "moderation.reported" as const;
export const MODERATION_DECIDED_EVENT = "moderation.decided" as const;

export const moderationReportedPayloadSchema = z
  .object({
    caseId: z.string().uuid(),
    targetType: z.enum(["post", "comment"]),
    targetId: z.string().uuid(),
    openedByMembershipId: z.string().uuid(),
    reasonKey: z.string().nullable(),
  })
  .strict();

export const moderationDecidedPayloadSchema = z
  .object({
    caseId: z.string().uuid(),
    decisionKey: z.string(),
    caseStatus: z.enum(["OPEN", "REVIEWING", "ACTIONED", "REJECTED", "CLOSED"]),
    decidedByMembershipId: z.string().uuid(),
    contentAction: z.enum(["delete"]).nullable().optional(),
    appealId: z.string().uuid().nullable().optional(),
    appealOutcome: z.enum(["uphold", "reject"]).nullable().optional(),
  })
  .strict();

export type ModerationReportedPayload = z.output<typeof moderationReportedPayloadSchema>;
export type ModerationDecidedPayload = z.output<typeof moderationDecidedPayloadSchema>;
