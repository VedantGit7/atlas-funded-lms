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
  id: z.uuid(),
  kind: contentTrashKindSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  deletedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
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
    id: z.uuid(),
  })
  .strict();

export const contentTrashActionResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
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
  id: z.uuid(),
  occurredAt: z.iso.datetime(),
  action: z.string(),
  actionLabel: z.string(),
  targetType: z.string(),
  targetId: z.uuid().nullable(),
  adminName: z.string(),
  actorMembershipId: z.uuid().nullable(),
});

export const contentTrashActivityResponseSchema = z.object({
  data: z.object({
    items: z.array(contentTrashActivityItemSchema),
  }),
});

export type ContentTrashListResponse = z.infer<typeof contentTrashListResponseSchema>;
export type ContentTrashItem = z.infer<typeof contentTrashItemSchema>;
export type ContentTrashActivityItem = z.infer<typeof contentTrashActivityItemSchema>;
export type ContentTrashActionBody = z.infer<typeof contentTrashActionBodySchema>;
export type ContentTrashActionResponse = z.infer<typeof contentTrashActionResponseSchema>;
export type ContentTrashActivityResponse = z.infer<typeof contentTrashActivityResponseSchema>;
