import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  deleteAnnouncementBodySchema,
  deleteAnnouncementResponseSchema,
} from "../../../../../../../server/announcements/announcements.schemas";
import { mutateAnnouncementsMetadata } from "../../../../../../../server/announcements/announcements.route-metadata";
import { deleteAnnouncement } from "../../../../../../../server/announcements/announcements.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  z.output<typeof deleteAnnouncementBodySchema>,
  z.output<typeof deleteAnnouncementResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateAnnouncementsMetadata,
  params: paramsSchema,
  body: deleteAnnouncementBodySchema,
  output: deleteAnnouncementResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    deleteAnnouncement(tx, ctx, params.id, input),
});
