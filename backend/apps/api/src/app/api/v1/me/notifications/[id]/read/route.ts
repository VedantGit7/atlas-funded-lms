import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  markNotificationReadResponseSchema,
  notificationParamsSchema,
} from "../../../../../../../server/notifications/notification.dto";
import { markNotificationRead } from "../../../../../../../server/notifications/notification.service";
import { markNotificationReadMetadata } from "../../../../../../../server/notifications/notification.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof markNotificationReadResponseSchema>,
  typeof notificationParamsSchema
>({
  metadata: markNotificationReadMetadata,
  params: notificationParamsSchema,
  body: noBodySchema,
  output: markNotificationReadResponseSchema,
  handler: async ({ tx, ctx, params }) => markNotificationRead(tx, ctx, params["id"]),
});
