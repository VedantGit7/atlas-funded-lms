import { z } from "zod";

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

export type ContentTrashActivityItem = z.infer<typeof contentTrashActivityItemSchema>;
export type ContentTrashActivityResponse = z.infer<typeof contentTrashActivityResponseSchema>;
