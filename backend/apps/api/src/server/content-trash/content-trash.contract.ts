import { z } from "zod";

export const TRASH_RETENTION_DAYS = 7;

export const contentTrashKindSchema = z.enum(["courses", "sections", "lessons"]);
export type ContentTrashKind = z.infer<typeof contentTrashKindSchema>;

export const contentTrashListQuerySchema = z
  .object({
    kind: contentTrashKindSchema.default("courses"),
  })
  .strict();

export const contentTrashItemSchema = z.object({
  id: z.string().uuid(),
  kind: contentTrashKindSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  deletedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  daysRemaining: z.number().int(),
  restoreEligible: z.boolean(),
});

export const contentTrashListResponseSchema = z.object({
  data: z.object({
    kind: contentTrashKindSchema,
    retentionDays: z.number().int().positive(),
    items: z.array(contentTrashItemSchema),
  }),
});

export const contentTrashActionBodySchema = z
  .object({
    kind: contentTrashKindSchema,
    id: z.string().uuid(),
  })
  .strict();

export const contentTrashActionResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    kind: contentTrashKindSchema,
    action: z.enum(["restore", "purge"]),
  }),
});

export const contentTrashActivityQuerySchema = z
  .object({
    q: z.string().max(120).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const contentTrashActivityItemSchema = z.object({
  id: z.string().uuid(),
  occurredAt: z.string().datetime(),
  action: z.string(),
  actionLabel: z.string(),
  targetType: z.string(),
  targetId: z.string().uuid().nullable(),
  adminName: z.string(),
  actorMembershipId: z.string().uuid().nullable(),
});

export const contentTrashActivityResponseSchema = z.object({
  data: z.object({
    items: z.array(contentTrashActivityItemSchema),
  }),
});

export type ContentTrashListResponse = z.infer<typeof contentTrashListResponseSchema>;
export type ContentTrashActionBody = z.infer<typeof contentTrashActionBodySchema>;
export type ContentTrashActionResponse = z.infer<typeof contentTrashActionResponseSchema>;
export type ContentTrashActivityResponse = z.infer<typeof contentTrashActivityResponseSchema>;
