import { z } from "zod";

export const deckIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createDeckBodySchema = z
  .object({
    title: z.string().trim().min(1).max(160),
  })
  .strict();

export const updateDeckBodySchema = z
  .object({
    title: z.string().trim().min(1).max(160),
  })
  .strict();

export const addDeckItemBodySchema = z
  .object({
    itemId: z.string().uuid(),
  })
  .strict();

export const deckItemQuerySchema = z
  .object({
    itemId: z.string().uuid(),
  })
  .strict();

export const practiceItemTypeSchema = z.enum(["swipe", "matching", "mcq_single", "true_false"]);

/** Browsable item summary. Stems only: answer keys never reach the client. */
export const practiceItemSchema = z.object({
  itemId: z.string().uuid(),
  stem: z.string(),
  itemTypeKey: practiceItemTypeSchema,
});

export const practiceItemsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const practiceItemsResponseSchema = z.object({
  data: z.object({
    items: z.array(practiceItemSchema),
  }),
});

export const myDeckSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  itemCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const myDecksResponseSchema = z.object({
  data: z.object({
    items: z.array(myDeckSchema),
  }),
});

export const deckResponseSchema = z.object({
  data: myDeckSchema,
});

export const deckDeletedResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    deleted: z.literal(true),
  }),
});

export type CreateDeckBody = z.output<typeof createDeckBodySchema>;
export type UpdateDeckBody = z.output<typeof updateDeckBodySchema>;
export type AddDeckItemBody = z.output<typeof addDeckItemBodySchema>;
export type DeckItemQuery = z.output<typeof deckItemQuerySchema>;
export type PracticeItemsQuery = z.output<typeof practiceItemsQuerySchema>;
