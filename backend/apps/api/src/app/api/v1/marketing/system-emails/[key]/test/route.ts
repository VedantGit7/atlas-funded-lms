import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { notificationSourceEventKeySchema } from "../../../../../../../server/notifications/notification.dto";
import {
  testSystemEmailBodySchema,
  testSystemEmailResponseSchema,
} from "../../../../../../../server/system-email/system-email.schemas";
import { mutateSystemEmailsMetadata } from "../../../../../../../server/system-email/system-email.route-metadata";
import { testSystemEmail } from "../../../../../../../server/system-email/system-email.service";

const paramsSchema = zod.object({ key: notificationSourceEventKeySchema });

export const POST = createTenantRoute<
  z.output<typeof testSystemEmailBodySchema>,
  z.output<typeof testSystemEmailResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateSystemEmailsMetadata,
  params: paramsSchema,
  body: testSystemEmailBodySchema,
  output: testSystemEmailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => testSystemEmail(tx, ctx, params.key, input),
});
