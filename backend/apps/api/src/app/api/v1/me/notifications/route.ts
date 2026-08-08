import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  notificationInboxListQuerySchema,
  notificationInboxListResponseSchema,
} from "../../../../../server/notifications/notification.dto";
import { listMyNotifications } from "../../../../../server/notifications/notification.service";
import { listMyNotificationsMetadata } from "../../../../../server/notifications/notification.route-metadata";

export const GET = createTenantRoute<
  z.output<typeof notificationInboxListQuerySchema>,
  z.output<typeof notificationInboxListResponseSchema>
>({
  metadata: listMyNotificationsMetadata,
  input: notificationInboxListQuerySchema,
  output: notificationInboxListResponseSchema,
  handler: async ({ tx, ctx, input }) => listMyNotifications(tx, ctx, input),
});
