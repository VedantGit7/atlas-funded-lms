import { z } from "zod";

export const TRASH_RETENTION_DAYS = 7;

export const contentTrashKindSchema = z.enum(["courses", "sections", "lessons"]);
export type ContentTrashKind = z.infer<typeof contentTrashKindSchema>;

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

export type ContentTrashListResponse = z.infer<typeof contentTrashListResponseSchema>;
export type ContentTrashItem = z.infer<typeof contentTrashItemSchema>;
