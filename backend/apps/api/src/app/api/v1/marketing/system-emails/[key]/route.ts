import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { notificationSourceEventKeySchema } from "../../../../../../server/notifications/notification.dto";
import {
  systemEmailResponseSchema,
  updateSystemEmailBodySchema,
} from "../../../../../../server/system-email/system-email.schemas";
import {
  listSystemEmailsMetadata,
  mutateSystemEmailsMetadata,
} from "../../../../../../server/system-email/system-email.route-metadata";
import {
  getSystemEmail,
  updateSystemEmail,
} from "../../../../../../server/system-email/system-email.service";

const paramsSchema = zod.object({ key: notificationSourceEventKeySchema });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof systemEmailResponseSchema>,
  typeof paramsSchema
>({
  metadata: listSystemEmailsMetadata,
  params: paramsSchema,
  output: systemEmailResponseSchema,
  handler: async ({ tx, ctx, params }) => getSystemEmail(tx, ctx, params.key),
});

export const PUT = createTenantRoute<
  z.output<typeof updateSystemEmailBodySchema>,
  z.output<typeof systemEmailResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateSystemEmailsMetadata,
  params: paramsSchema,
  body: updateSystemEmailBodySchema,
  output: systemEmailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => updateSystemEmail(tx, ctx, params.key, input),
});
