import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createAnnouncementBodySchema,
  testAnnouncementResponseSchema,
} from "../../../../../../server/announcements/announcements.schemas";
import { mutateAnnouncementsMetadata } from "../../../../../../server/announcements/announcements.route-metadata";
import { testAnnouncementToSelf } from "../../../../../../server/announcements/announcements.service";

export const POST = createTenantRoute<
  z.output<typeof createAnnouncementBodySchema>,
  z.output<typeof testAnnouncementResponseSchema>
>({
  metadata: mutateAnnouncementsMetadata,
  body: createAnnouncementBodySchema,
  output: testAnnouncementResponseSchema,
  handler: async ({ tx, ctx, input }) => testAnnouncementToSelf(tx, ctx, input),
});
