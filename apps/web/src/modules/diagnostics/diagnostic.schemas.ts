import { z } from "zod";
import { containsUnsafeCopy } from "../../server/readiness/readiness.schemas";

const rejectIdentityFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    membershipId: z.never().optional(),
    membership_id: z.never().optional(),
    userId: z.never().optional(),
    authPrincipalId: z.never().optional(),
    attemptId: z.never().optional(),
  })
  .passthrough();

export const DiagnosticAnonParamsSchema = z
  .object({
    anonId: z.string().uuid(),
  })
  .strict();

export const DiagnosticSessionParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const PublicDiagnosticAnswerSchema = z.object({
  itemId: z.string().uuid(),
  answerJson: z.record(z.string(), z.unknown()),
});

export const PublicDiagnosticStartOperationSchema = z
  .object({
    operation: z.literal("start"),
  })
  .strict()
  .and(rejectIdentityFields);

export const PublicDiagnosticCompleteOperationSchema = z
  .object({
    operation: z.literal("complete"),
    anonymousId: z.string().uuid(),
    answers: z.array(PublicDiagnosticAnswerSchema).min(1).max(500),
  })
  .strict()
  .superRefine((value, ctx) => {
    const itemIds = value.answers.map((answer) => answer.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate answer item IDs are not allowed.",
        path: ["answers"],
      });
    }
  })
  .and(rejectIdentityFields);

export const PublicDiagnosticStartBodySchema = z.union([
  PublicDiagnosticStartOperationSchema,
  PublicDiagnosticCompleteOperationSchema,
]);

export const PublicDiagnosticMergeBodySchema = z.object({}).strict().and(rejectIdentityFields);

export const AuthenticatedDiagnosticStartBodySchema = z
  .object({})
  .strict()
  .and(rejectIdentityFields);

const diagnosticQuestionOptionSchema = z.object({
  id: z.string().uuid(),
  optionJson: z.record(z.string(), z.unknown()),
  position: z.number().int(),
});

const diagnosticQuestionSchema = z.object({
  assessmentItemId: z.string().uuid(),
  itemId: z.string().uuid(),
  itemTypeKey: z.string(),
  position: z.number().int(),
  points: z.number(),
  required: z.boolean(),
  contentJson: z.record(z.string(), z.unknown()),
  options: z.array(diagnosticQuestionOptionSchema),
});

const diagnosticDimensionScoreSchema = z.object({
  dimensionId: z.string().uuid(),
  dimensionKey: z.string(),
  dimensionName: z.string(),
  score: z.number(),
  bandKey: z.string().nullable(),
  bandLabel: z.string().nullable(),
});

const diagnosticNextActionSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
});

export const diagnosticScorecardSchema = z
  .object({
    partial: z.boolean(),
    overallScore: z.number().nullable(),
    overallBandKey: z.string().nullable(),
    overallBandLabel: z.string().nullable(),
    interpretation: z.string(),
    dimensions: z.array(diagnosticDimensionScoreSchema),
    nextAction: diagnosticNextActionSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const texts = [
      value.interpretation,
      value.nextAction.title,
      value.nextAction.description,
      ...value.dimensions.map((dimension) => dimension.bandLabel ?? ""),
    ].filter((text) => text.length > 0);

    for (const text of texts) {
      if (containsUnsafeCopy(text)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Diagnostic copy must not include guaranteed outcomes or financial advice.",
          path: ["interpretation"],
        });
      }
    }
  });

export const publicDiagnosticStartResponseSchema = z.object({
  data: z.object({
    anonymousId: z.string().uuid(),
    sessionId: z.string().uuid(),
    assessmentId: z.string().uuid(),
    title: z.string(),
    items: z.array(diagnosticQuestionSchema),
    totalQuestions: z.number().int(),
  }),
});

export const publicDiagnosticCompleteResponseSchema = z.object({
  data: z.object({
    anonymousId: z.string().uuid(),
    sessionId: z.string().uuid(),
    status: z.literal("completed"),
    resultPath: z.string(),
  }),
});

export const publicDiagnosticStartUnionResponseSchema = z.union([
  publicDiagnosticStartResponseSchema,
  publicDiagnosticCompleteResponseSchema,
]);

export const publicDiagnosticResultResponseSchema = z.object({
  data: z.object({
    anonymousId: z.string().uuid(),
    sessionId: z.string().uuid(),
    scorecard: diagnosticScorecardSchema,
  }),
});

export const publicDiagnosticMergeResponseSchema = z.object({
  data: z.object({
    sessionId: z.string().uuid(),
    attemptId: z.string().uuid(),
    membershipId: z.string().uuid(),
    resultPath: z.string(),
    alreadyMerged: z.boolean(),
  }),
});

export const authenticatedDiagnosticStartResponseSchema = z.object({
  data: z.object({
    sessionId: z.string().uuid(),
    attemptId: z.string().uuid(),
    assessmentId: z.string().uuid(),
    title: z.string(),
    status: z.literal("started"),
    items: z.array(diagnosticQuestionSchema),
    totalQuestions: z.number().int(),
  }),
});

export const authenticatedDiagnosticResultResponseSchema = z.object({
  data: z.object({
    sessionId: z.string().uuid(),
    attemptId: z.string().uuid().nullable(),
    status: z.string(),
    scorecard: diagnosticScorecardSchema.nullable(),
    runner: z
      .object({
        attemptId: z.string().uuid(),
        items: z.array(diagnosticQuestionSchema),
        totalQuestions: z.number().int(),
      })
      .nullable(),
  }),
});

export function assertPublicScorecardSafe(value: unknown): void {
  diagnosticScorecardSchema.parse(value);
}

export function assertNoAnswerKeysInQuestions(items: DiagnosticQuestion[]): void {
  for (const item of items) {
    const content = JSON.stringify(item.contentJson);
    const options = JSON.stringify(item.options);
    if (
      /correct_answer|answer_key|is_correct|correctOptionId/i.test(content) ||
      /correct_answer|answer_key|is_correct|correctOptionId/i.test(options)
    ) {
      throw new Error("Public diagnostic projection must not expose answer keys.");
    }
  }
}

type DiagnosticQuestion = z.infer<typeof diagnosticQuestionSchema>;
