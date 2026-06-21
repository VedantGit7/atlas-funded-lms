import { z } from "zod";
import {
  APPEAL_REVIEW_OUTCOMES,
  APPEAL_STATUSES,
  MODERATION_CASE_DECISION_KEYS,
  MODERATION_CASE_STATUSES,
  MODERATION_TARGET_TYPES,
  REGISTERED_MODERATION_CONTENT_ACTIONS,
} from "./moderation.contract";

const rejectClientTenantFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    membership_id: z.never().optional(),
    membershipId: z.never().optional(),
  })
  .passthrough();

const htmlTagPattern = /<[^>]*>/g;
const scriptPattern = /javascript:/i;

export function rejectUnsafePlainText(value: string): boolean {
  return !htmlTagPattern.test(value) && !scriptPattern.test(value);
}

export function structuredBodyToPlainText(bodyJson: unknown): string {
  if (!bodyJson || typeof bodyJson !== "object" || Array.isArray(bodyJson)) {
    return "[content unavailable]";
  }

  const blocks = (bodyJson as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) {
    return "[content unavailable]";
  }

  const parts: string[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      continue;
    }

    const children = (block as { children?: unknown }).children;
    if (!Array.isArray(children)) {
      continue;
    }

    for (const child of children) {
      if (!child || typeof child !== "object" || Array.isArray(child)) {
        continue;
      }

      const type = (child as { type?: unknown }).type;
      if (type === "text") {
        const text = (child as { text?: unknown }).text;
        if (typeof text === "string" && text.trim().length > 0) {
          parts.push(text.trim());
        }
      } else if (type === "mention") {
        parts.push("@member");
      } else if (type === "verify_link") {
        parts.push("[credential link]");
      }
    }
  }

  const joined = parts.join(" ").trim();
  return joined.length > 0 ? joined.slice(0, 500) : "[empty content]";
}

export const moderationListQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(MODERATION_CASE_STATUSES).optional(),
    targetType: z.enum(MODERATION_TARGET_TYPES).optional(),
    caseId: z.string().uuid().optional(),
    view: z.enum(["cases", "appeals"]).default("cases"),
  })
  .strict();

export const createModerationCaseBodySchema = rejectClientTenantFields
  .extend({
    targetType: z.enum(MODERATION_TARGET_TYPES),
    targetId: z.string().uuid(),
    reasonKey: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9_.-]+$/i)
      .optional(),
  })
  .strict();

export const moderationCaseIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const decideModerationCaseBodySchema = rejectClientTenantFields
  .extend({
    decisionKey: z.enum(MODERATION_CASE_DECISION_KEYS),
    reason: z
      .string()
      .min(1)
      .max(1000)
      .refine(rejectUnsafePlainText, "Reason must not contain HTML or unsafe markup")
      .optional(),
    contentAction: z.enum(REGISTERED_MODERATION_CONTENT_ACTIONS).optional(),
  })
  .strict();

export const createAppealBodySchema = rejectClientTenantFields
  .extend({
    moderationCaseId: z.string().uuid(),
    body: z
      .string()
      .min(1)
      .max(5000)
      .refine(rejectUnsafePlainText, "Appeal body must not contain HTML or unsafe markup"),
  })
  .strict();

export const appealIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const reviewAppealBodySchema = rejectClientTenantFields
  .extend({
    outcome: z.enum(APPEAL_REVIEW_OUTCOMES),
    reason: z
      .string()
      .min(1)
      .max(1000)
      .refine(rejectUnsafePlainText, "Reason must not contain HTML or unsafe markup")
      .optional(),
    nextCaseStatus: z.enum(["REJECTED", "CLOSED"]).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.outcome === "uphold" && value.nextCaseStatus == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "nextCaseStatus is required when upholding an appeal",
        path: ["nextCaseStatus"],
      });
    }
  });

export const moderationDecisionViewSchema = z.object({
  id: z.string().uuid(),
  decisionKey: z.string(),
  decidedByMembershipId: z.string().uuid().nullable(),
  occurredAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

export const moderationCaseViewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(MODERATION_CASE_STATUSES),
  targetType: z.enum(MODERATION_TARGET_TYPES),
  targetId: z.string().uuid(),
  reasonKey: z.string().nullable(),
  openedByMembershipId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  target: z
    .object({
      targetType: z.enum(MODERATION_TARGET_TYPES),
      targetId: z.string().uuid(),
      authorMembershipId: z.string().uuid(),
      previewText: z.string(),
      title: z.string().nullable(),
      deleted: z.boolean(),
    })
    .nullable(),
  decisions: z.array(moderationDecisionViewSchema),
  appeals: z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.enum(APPEAL_STATUSES),
        submittedByMembershipId: z.string().uuid(),
        body: z.string(),
        createdAt: z.string().datetime(),
      }),
    )
    .optional(),
});

export const moderationCaseListResponseSchema = z.object({
  data: z.object({
    items: z.array(moderationCaseViewSchema),
  }),
  page: z.object({
    nextCursor: z.string().uuid().nullable(),
    hasMore: z.boolean(),
  }),
});

export const moderationCaseDetailResponseSchema = z.object({
  data: moderationCaseViewSchema,
});

export const createModerationCaseResponseSchema = moderationCaseDetailResponseSchema;

export const decideModerationCaseResponseSchema = moderationCaseDetailResponseSchema;

export const createAppealResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    moderationCaseId: z.string().uuid(),
    status: z.enum(APPEAL_STATUSES),
    body: z.string(),
    createdAt: z.string().datetime(),
  }),
});

export const reviewAppealResponseSchema = z.object({
  data: z.object({
    appealId: z.string().uuid(),
    outcome: z.enum(APPEAL_REVIEW_OUTCOMES),
    appealStatus: z.enum(APPEAL_STATUSES),
    caseStatus: z.enum(MODERATION_CASE_STATUSES),
  }),
});

export type ModerationListQuery = z.output<typeof moderationListQuerySchema>;
export type CreateModerationCaseBody = z.output<typeof createModerationCaseBodySchema>;
export type DecideModerationCaseBody = z.output<typeof decideModerationCaseBodySchema>;
export type CreateAppealBody = z.output<typeof createAppealBodySchema>;
export type ReviewAppealBody = z.output<typeof reviewAppealBodySchema>;
