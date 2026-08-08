import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  announcementResponseSchema,
  announcementsListQuerySchema,
  announcementsListResponseSchema,
  createAnnouncementBodySchema,
} from "../../../../../server/announcements/announcements.schemas";
import {
  listAnnouncementsMetadata,
  mutateAnnouncementsMetadata,
} from "../../../../../server/announcements/announcements.route-metadata";
import {
  createAndSendAnnouncement,
  listAnnouncements,
} from "../../../../../server/announcements/announcements.service";

export const GET = createTenantRoute<
  z.output<typeof announcementsListQuerySchema>,
  z.output<typeof announcementsListResponseSchema>
>({
  metadata: listAnnouncementsMetadata,
  input: announcementsListQuerySchema,
  output: announcementsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listAnnouncements(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createAnnouncementBodySchema>,
  z.output<typeof announcementResponseSchema>
>({
  metadata: mutateAnnouncementsMetadata,
  body: createAnnouncementBodySchema,
  output: announcementResponseSchema,
  handler: async ({ tx, ctx, input }) => createAndSendAnnouncement(tx, ctx, input),
});
