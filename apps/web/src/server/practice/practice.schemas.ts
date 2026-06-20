import { z } from "zod";

const rejectTenantId = z.object({ tenant_id: z.never().optional() }).passthrough();
const rejectMembershipId = z.object({ membershipId: z.never().optional() }).passthrough();
const rejectClientScoring = z
  .object({
    isCorrect: z.never().optional(),
    score: z.never().optional(),
    correctAnswer: z.never().optional(),
    itemIds: z.never().optional(),
    selectedItemIds: z.never().optional(),
  })
  .passthrough();

export const PracticeSessionParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const StartPracticeSessionBodySchema = z
  .object({
    mode: z.enum(["due", "collection"]),
    collectionId: z.string().uuid().optional(),
    maxItems: z.number().int().min(1).max(30).optional(),
  })
  .strict()
  .and(rejectTenantId)
  .and(rejectMembershipId)
  .and(rejectClientScoring)
  .superRefine((value, ctx) => {
    if (value.mode === "collection" && !value.collectionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "collectionId is required when mode is collection.",
        path: ["collectionId"],
      });
    }

    if (value.mode === "due" && value.collectionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "collectionId is not allowed when mode is due.",
        path: ["collectionId"],
      });
    }
  });

export const SubmitPracticeResponseBodySchema = z
  .object({
    itemId: z.string().uuid(),
    action: z.enum(["known", "unknown"]),
    latencyMs: z.number().int().min(0).max(300_000).optional(),
  })
  .strict()
  .and(rejectTenantId)
  .and(rejectMembershipId)
  .and(rejectClientScoring);

export const CompletePracticeSessionBodySchema = z.object({}).strict().and(rejectTenantId);

export const DueQueueQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    collectionId: z.string().uuid().optional(),
  })
  .strict()
  .and(rejectTenantId);

export const safePracticeCardSchema = z.object({
  itemId: z.string().uuid(),
  itemTypeKey: z.literal("swipe"),
  rendererKey: z.literal("swipe"),
  contentJson: z.record(z.string(), z.unknown()),
});

export const practiceDeckOptionSchema = z.object({
  collectionId: z.string().uuid(),
  title: z.string(),
  itemCount: z.number().int().nonnegative(),
});

export const dueQueueItemSchema = z.object({
  itemId: z.string().uuid(),
  dueAt: z.string(),
  card: safePracticeCardSchema,
});

export const dueQueueResponseSchema = z.object({
  data: z.object({
    items: z.array(dueQueueItemSchema),
    nextCursor: z.string().uuid().nullable(),
    availableDecks: z.array(practiceDeckOptionSchema),
  }),
});

export const practiceSessionSummarySchema = z.object({
  mode: z.enum(["due", "collection"]),
  selectedItemIds: z.array(z.string().uuid()),
  answeredItemIds: z.array(z.string().uuid()),
  responseIdempotency: z
    .record(
      z.string(),
      z.object({
        itemId: z.string().uuid(),
        isCorrect: z.boolean(),
        action: z.enum(["known", "unknown"]),
        occurredAt: z.string(),
      }),
    )
    .optional(),
  completeIdempotency: z
    .record(
      z.string(),
      z.object({
        completedAt: z.string(),
        answeredCount: z.number().int(),
        correctCount: z.number().int(),
      }),
    )
    .optional(),
});

export const startPracticeSessionResponseSchema = z.object({
  data: z.object({
    session: z.object({
      id: z.string().uuid(),
      status: z.enum(["started", "completed"]),
      mode: z.enum(["due", "collection"]),
      collectionId: z.string().uuid().nullable(),
      totalItems: z.number().int().nonnegative(),
      answeredCount: z.number().int().nonnegative(),
      startedAt: z.string(),
    }),
    card: safePracticeCardSchema.nullable(),
  }),
});

export const submitPracticeResponseResponseSchema = z.object({
  data: z.object({
    response: z.object({
      itemId: z.string().uuid(),
      isCorrect: z.boolean(),
      feedbackLabel: z.string(),
      occurredAt: z.string(),
    }),
    progress: z.object({
      answeredCount: z.number().int().nonnegative(),
      totalItems: z.number().int().nonnegative(),
    }),
    nextCard: safePracticeCardSchema.nullable(),
  }),
});

export const completePracticeSessionResponseSchema = z.object({
  data: z.object({
    sessionId: z.string().uuid(),
    status: z.literal("completed"),
    completedAt: z.string(),
    summary: z.object({
      totalItems: z.number().int().nonnegative(),
      answeredCount: z.number().int().nonnegative(),
      correctCount: z.number().int().nonnegative(),
      practiceRecorded: z.literal(true),
    }),
  }),
});

export type PracticeSessionSummary = z.infer<typeof practiceSessionSummarySchema>;
export type StartPracticeSessionInput = z.infer<typeof StartPracticeSessionBodySchema>;
export type SubmitPracticeResponseInput = z.infer<typeof SubmitPracticeResponseBodySchema>;
