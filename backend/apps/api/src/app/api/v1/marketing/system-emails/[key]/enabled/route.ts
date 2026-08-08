import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { notificationSourceEventKeySchema } from "../../../../../../../server/notifications/notification.dto";
import {
  setSystemEmailEnabledBodySchema,
  systemEmailResponseSchema,
} from "../../../../../../../server/system-email/system-email.schemas";
import { mutateSystemEmailsMetadata } from "../../../../../../../server/system-email/system-email.route-metadata";
import { setSystemEmailEnabled } from "../../../../../../../server/system-email/system-email.service";

const paramsSchema = zod.object({ key: notificationSourceEventKeySchema });

export const POST = createTenantRoute<
  z.output<typeof setSystemEmailEnabledBodySchema>,
  z.output<typeof systemEmailResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateSystemEmailsMetadata,
  params: paramsSchema,
  body: setSystemEmailEnabledBodySchema,
  output: systemEmailResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    setSystemEmailEnabled(tx, ctx, params.key, input),
});
