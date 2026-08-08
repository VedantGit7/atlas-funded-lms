import { z } from "zod";

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

export type ContentTrashActivityItem = z.infer<typeof contentTrashActivityItemSchema>;
export type ContentTrashActivityResponse = z.infer<typeof contentTrashActivityResponseSchema>;
