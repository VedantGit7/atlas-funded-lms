import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  markNotificationArchivedResponseSchema,
  notificationParamsSchema,
} from "../../../../../../../server/notifications/notification.dto";
import { markNotificationArchived } from "../../../../../../../server/notifications/notification.service";
import { markNotificationArchivedMetadata } from "../../../../../../../server/notifications/notification.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof markNotificationArchivedResponseSchema>,
  typeof notificationParamsSchema
>({
  metadata: markNotificationArchivedMetadata,
  params: notificationParamsSchema,
  body: noBodySchema,
  output: markNotificationArchivedResponseSchema,
  handler: async ({ tx, ctx, params }) => markNotificationArchived(tx, ctx, params["id"]),
});
