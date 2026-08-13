import { z } from "zod";
import {
  CTA_PROMINENCE_VALUES,
  DEFAULT_COMPOSITE_KEY,
  READINESS_POLICY_KEY,
} from "./readiness.types";

const rejectTenantId = z.object({ tenant_id: z.never().optional() }).loose();
const rejectClientTargetUrl = z
  .object({
    targetUrl: z.never().optional(),
    destinationUrl: z.never().optional(),
    outboundTargetUrl: z.never().optional(),
  })
  .loose();

const UNSAFE_COPY_PATTERNS = [
  /guaranteed\s+pass/i,
  /guaranteed\s+profit/i,
  /guaranteed\s+funding/i,
  /financial\s+advice/i,
] as const;

export function containsUnsafeCopy(text: string): boolean {
  return UNSAFE_COPY_PATTERNS.some((pattern) => pattern.test(text));
}

export function validateLegalCopySafety(copy: {
  disclaimer: string;
  bandNotes: Record<string, string>;
  legalReviewChecklist: string[];
  ctaCopy?: { headline: string; body: string; buttonLabel: string };
}): void {
  const texts = [
    copy.disclaimer,
    ...Object.values(copy.bandNotes),
    ...copy.legalReviewChecklist,
    copy.ctaCopy?.headline,
    copy.ctaCopy?.body,
    copy.ctaCopy?.buttonLabel,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  for (const text of texts) {
    if (containsUnsafeCopy(text)) {
      throw new Error("Legal copy must not include guaranteed outcomes or financial advice.");
    }
  }
}

export const bandProminenceRuleSchema = z.object({
  bandKey: z.string().min(1).max(64),
  prominence: z.enum(CTA_PROMINENCE_VALUES),
});

export const ctaPolicyConfigSchema = z
  .object({
    outboundTargetUrl: z.url().refine((url) => url.startsWith("https://"), {
      message: "CTA target URL must use HTTPS.",
    }),
    tokenTtlSeconds: z.number().int().min(60).max(86_400),
    bandProminenceRules: z.array(bandProminenceRuleSchema).min(1),
    ctaCopy: z.object({
      headline: z.string().min(1).max(200),
      body: z.string().min(1).max(2000),
      buttonLabel: z.string().min(1).max(120),
    }),
  })
  .superRefine((value, ctx) => {
    const bandKeys = value.bandProminenceRules.map((rule) => rule.bandKey);
    if (new Set(bandKeys).size !== bandKeys.length) {
      ctx.addIssue({
        code: "custom",
        message: "Band prominence rules must use unique band keys.",
        path: ["bandProminenceRules"],
      });
    }

    try {
      validateLegalCopySafety({
        disclaimer: "",
        bandNotes: {},
        legalReviewChecklist: [],
        ctaCopy: value.ctaCopy,
      });
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Unsafe CTA copy.",
        path: ["ctaCopy"],
      });
    }
  });

export const legalCopyConfigSchema = z
  .object({
    disclaimer: z.string().min(1).max(4000),
    bandNotes: z.record(z.string(), z.string().max(1000)),
    legalReviewChecklist: z.array(z.string().min(1).max(500)).min(1),
  })
  .superRefine((value, ctx) => {
    try {
      validateLegalCopySafety(value);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Unsafe legal copy.",
      });
    }
  });

export const updateReadinessPolicyBodySchema = z
  .object({
    scoringProfileId: z.uuid(),
    ctaPolicy: ctaPolicyConfigSchema,
    legalCopy: legalCopyConfigSchema,
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .strict()
  .and(rejectTenantId)
  .and(rejectClientTargetUrl);

export const createAttributionTokenBodySchema = z
  .object({
    sourceSurface: z.string().min(1).max(64),
    sourcePath: z.string().min(1).max(512),
  })
  .strict()
  .and(rejectTenantId)
  .and(rejectClientTargetUrl);

export const readinessPolicyDtoSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  scoringProfileId: z.uuid(),
  ctaPolicy: ctaPolicyConfigSchema,
  legalCopy: legalCopyConfigSchema.nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const readinessPolicyResponseSchema = z.object({
  data: readinessPolicyDtoSchema.nullable(),
});

export const attributionTokenResponseSchema = z.object({
  data: z.object({
    outboundUrl: z.url(),
    expiresAt: z.string(),
    tokenId: z.uuid(),
  }),
});

export const competencyScoreChangedPayloadSchema = z
  .object({
    membershipId: z.uuid(),
    dimensionId: z.uuid(),
    dimensionKey: z.string(),
    scoringProfileId: z.uuid(),
    scoringProfileKey: z.string(),
    score: z.number(),
    bandKey: z.string().nullable(),
    previousScore: z.number().nullable(),
    previousBandKey: z.string().nullable(),
  })
  .strict()
  .and(rejectTenantId);

export type UpdateReadinessPolicyBody = z.infer<typeof updateReadinessPolicyBodySchema>;
export type CreateAttributionTokenBody = z.infer<typeof createAttributionTokenBodySchema>;

export function deriveProminence(
  bandKey: string | null | undefined,
  rules: Array<{ bandKey: string; prominence: (typeof CTA_PROMINENCE_VALUES)[number] }>,
): (typeof CTA_PROMINENCE_VALUES)[number] {
  if (!bandKey) return "hidden";
  const match = rules.find((rule) => rule.bandKey === bandKey);
  return match?.prominence ?? "hidden";
}

export function buildOutboundUrl(targetUrl: string, token: string): string {
  const url = new URL(targetUrl);
  url.searchParams.set("attribution_token", token);
  return url.toString();
}

export function buildAttributionTokenPayload(args: {
  tokenId: string;
  tenantId: string;
  membershipId: string;
  sourceSurface: string;
  sourcePath: string;
  readinessBandKey: string | null;
}): Record<string, string | null> {
  return {
    tokenId: args.tokenId,
    tenantId: args.tenantId,
    membershipId: args.membershipId,
    sourceSurface: args.sourceSurface,
    sourcePath: args.sourcePath,
    readinessBandKey: args.readinessBandKey,
  };
}

export { READINESS_POLICY_KEY, DEFAULT_COMPOSITE_KEY };
