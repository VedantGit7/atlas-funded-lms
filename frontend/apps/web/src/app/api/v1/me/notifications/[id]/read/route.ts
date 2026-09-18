import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  markNotificationReadResponseSchema,
  notificationParamsSchema,
} from "../../../../../../../server/notifications/notification.dto";
import { markNotificationRead } from "../../../../../../../server/notifications/notification.service";
import { markNotificationReadMetadata } from "../../../../../../../server/notifications/notification.route-metadata";

// This route previously declared no `params` schema, so the handler saw
// `Record<string, never>`: `params["id"]` was `undefined` at the type level and
// the code fell back to "". The backend twin already validated the param with
// notificationParamsSchema; this brings the proxy in line.
export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof markNotificationReadResponseSchema>,
  typeof notificationParamsSchema
>({
  metadata: markNotificationReadMetadata,
  params: notificationParamsSchema,
  output: markNotificationReadResponseSchema,
  handler: async ({ tx, ctx, params }) => markNotificationRead(tx, ctx, params.id),
});
