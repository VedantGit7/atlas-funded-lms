import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { markNotificationReadResponseSchema } from "../../../../../../../server/notifications/notification.dto";
import { markNotificationRead } from "../../../../../../../server/notifications/notification.service";
import { markNotificationReadMetadata } from "../../../../../../../server/notifications/notification.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof markNotificationReadResponseSchema>
>({
  metadata: markNotificationReadMetadata,
  output: markNotificationReadResponseSchema,
  handler: async ({ tx, ctx, params }) => markNotificationRead(tx, ctx, params["id"] ?? ""),
});
