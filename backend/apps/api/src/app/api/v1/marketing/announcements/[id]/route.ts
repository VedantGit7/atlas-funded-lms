import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { announcementResponseSchema } from "../../../../../../server/announcements/announcements.schemas";
import { listAnnouncementsMetadata } from "../../../../../../server/announcements/announcements.route-metadata";
import { getAnnouncement } from "../../../../../../server/announcements/announcements.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof announcementResponseSchema>,
  typeof paramsSchema
>({
  metadata: listAnnouncementsMetadata,
  params: paramsSchema,
  output: announcementResponseSchema,
  handler: async ({ tx, ctx, params }) => getAnnouncement(tx, ctx, params["id"]),
});
