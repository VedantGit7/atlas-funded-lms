import { z } from "zod";

const rejectTenantId = z.object({ tenant_id: z.never().optional() }).loose();
const rejectMembershipId = z.object({ membershipId: z.never().optional() }).loose();
const rejectClientScoring = z
  .object({
    isCorrect: z.never().optional(),
    score: z.never().optional(),
    correctAnswer: z.never().optional(),
    itemIds: z.never().optional(),
    selectedItemIds: z.never().optional(),
  })
  .loose();

export const PracticeSessionParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

/**
 * Practice engines. `swipe` rates a stem, `flashcards` reveals the author's
 * explanation before self-rating, `match` grades submitted pairs server-side,
 * `learn` is an adaptive graded quiz over choice items, and `test` is a timed
 * graded run that withholds per-answer correctness until it is submitted.
 */
export const practiceEngineSchema = z.enum(["swipe", "flashcards", "match", "learn", "test"]);

export const StartPracticeSessionBodySchema = z
  .object({
    mode: z.enum(["due", "collection"]),
    engine: practiceEngineSchema.default("swipe"),
    collectionId: z.uuid().optional(),
    maxItems: z.number().int().min(1).max(30).optional(),
  })
  .strict()
  .and(rejectTenantId)
  .and(rejectMembershipId)
  .and(rejectClientScoring)
  .superRefine((value, ctx) => {
    if (value.mode === "collection" && !value.collectionId) {
      ctx.addIssue({
        code: "custom",
        message: "collectionId is required when mode is collection.",
        path: ["collectionId"],
      });
    }

    if (value.mode === "due" && value.collectionId) {
      ctx.addIssue({
        code: "custom",
        message: "collectionId is not allowed when mode is due.",
        path: ["collectionId"],
      });
    }
  });

/** Self-rated response used by the swipe and flashcards engines. */
export const submitSwipeResponseSchema = z
  .object({
    itemId: z.uuid(),
    action: z.enum(["known", "unknown"]),
    latencyMs: z.number().int().min(0).max(300_000).optional(),
  })
  .strict();

/** Server-graded response used by the match engine: leftId -> rightId. */
export const submitMatchResponseSchema = z
  .object({
    itemId: z.uuid(),
    pairs: z.record(z.string().min(1), z.string().min(1)),
    latencyMs: z.number().int().min(0).max(300_000).optional(),
  })
  .strict();

/** Server-graded response used by the learn engine. */
export const submitChoiceResponseSchema = z
  .object({
    itemId: z.uuid(),
    selectedOptionId: z.string().min(1),
    latencyMs: z.number().int().min(0).max(300_000).optional(),
  })
  .strict();

export const SubmitPracticeResponseBodySchema = z
  .union([submitSwipeResponseSchema, submitMatchResponseSchema, submitChoiceResponseSchema])
  .and(rejectTenantId)
  .and(rejectMembershipId)
  .and(rejectClientScoring);

export const CompletePracticeSessionBodySchema = z.object({}).strict().and(rejectTenantId);

export const DueQueueQuerySchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    collectionId: z.uuid().optional(),
  })
  // Do not `.and(rejectTenantId)` here: `.strict()` already rejects unknown keys
  // (including tenant_id), and intersecting a passthrough schema breaks the
  // `z.coerce` on `limit` — the coerced number and the raw query string cannot
  // be merged (invalid_intersection_types), so any `?limit=` request would 400.
  .strict();

export const safeSwipeCardSchema = z.object({
  itemId: z.uuid(),
  itemTypeKey: z.literal("swipe"),
  rendererKey: z.enum(["swipe", "flashcard"]),
  contentJson: z.record(z.string(), z.unknown()),
  /**
   * Author-written explanation used as the flashcard back. Only populated for
   * the flashcards engine; the raw answer key is never sent to the client.
   */
  explanation: z.string().nullable().optional(),
});

export const matchOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
});

/**
 * Matching card. Exposes the left and right labels only: the correct pairing is
 * never sent to the client, and the right column is shuffled so its order
 * cannot be used to infer the answer.
 */
export const safeMatchCardSchema = z.object({
  itemId: z.uuid(),
  itemTypeKey: z.literal("matching"),
  rendererKey: z.literal("matching"),
  contentJson: z.record(z.string(), z.unknown()),
  leftItems: z.array(matchOptionSchema),
  rightItems: z.array(matchOptionSchema),
});

export const choiceOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
});

const choiceCardFields = {
  itemId: z.uuid(),
  rendererKey: z.literal("choice"),
  contentJson: z.record(z.string(), z.unknown()),
  /** Selectable options. `isCorrect` is deliberately never included. */
  options: z.array(choiceOptionSchema),
};

export const safeMcqCardSchema = z.object({
  ...choiceCardFields,
  itemTypeKey: z.literal("mcq_single"),
});

export const safeTrueFalseCardSchema = z.object({
  ...choiceCardFields,
  itemTypeKey: z.literal("true_false"),
});

export const safePracticeCardSchema = z.discriminatedUnion("itemTypeKey", [
  safeSwipeCardSchema,
  safeMatchCardSchema,
  safeMcqCardSchema,
  safeTrueFalseCardSchema,
]);

export const practiceDeckOptionSchema = z.object({
  collectionId: z.uuid(),
  title: z.string(),
  itemCount: z.number().int().nonnegative(),
  category: z.string().nullable(),
  dueCount: z.number().int().nonnegative(),
  masteryPercent: z.number().int().min(0).max(100),
  /** True when the caller owns this deck (learner-created), false for tenant decks. */
  owned: z.boolean(),
});

export const dueQueueItemSchema = z.object({
  itemId: z.uuid(),
  dueAt: z.string(),
  card: safePracticeCardSchema,
});

export const dueQueueResponseSchema = z.object({
  data: z.object({
    items: z.array(dueQueueItemSchema),
    nextCursor: z.uuid().nullable(),
    availableDecks: z.array(practiceDeckOptionSchema),
    dueTotal: z.number().int().nonnegative(),
  }),
});

export const practiceSessionSummarySchema = z.object({
  mode: z.enum(["due", "collection"]),
  // Defaulted so sessions stored before engines existed still parse.
  engine: practiceEngineSchema.default("swipe"),
  /** Server-set deadline for timed engines (test). ISO string. */
  expiresAt: z.string().optional(),
  selectedItemIds: z.array(z.uuid()),
  answeredItemIds: z.array(z.uuid()),
  responseIdempotency: z
    .record(
      z.string(),
      z.object({
        itemId: z.uuid(),
        isCorrect: z.boolean(),
        // Absent for graded engines (match) which submit pairs, not an action.
        action: z.enum(["known", "unknown"]).optional(),
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
      id: z.uuid(),
      status: z.enum(["started", "completed"]),
      mode: z.enum(["due", "collection"]),
      engine: practiceEngineSchema,
      collectionId: z.uuid().nullable(),
      totalItems: z.number().int().nonnegative(),
      answeredCount: z.number().int().nonnegative(),
      startedAt: z.string(),
      expiresAt: z.string().nullable(),
    }),
    card: safePracticeCardSchema.nullable(),
  }),
});

export const submitPracticeResponseResponseSchema = z.object({
  data: z.object({
    response: z.object({
      itemId: z.uuid(),
      /** Null while a timed test is in progress: results are revealed on submit. */
      isCorrect: z.boolean().nullable(),
      feedbackLabel: z.string(),
      /** Author explanation shown after a graded answer. */
      explanation: z.string().nullable().optional(),
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
    sessionId: z.uuid(),
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

export type PracticeEngine = z.infer<typeof practiceEngineSchema>;
export type PracticeSessionSummary = z.infer<typeof practiceSessionSummarySchema>;
export type StartPracticeSessionInput = z.infer<typeof StartPracticeSessionBodySchema>;
export type SubmitPracticeResponseInput = z.infer<typeof SubmitPracticeResponseBodySchema>;
