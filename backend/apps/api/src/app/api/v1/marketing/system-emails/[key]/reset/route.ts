import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { notificationSourceEventKeySchema } from "../../../../../../../server/notifications/notification.dto";
import { systemEmailResponseSchema } from "../../../../../../../server/system-email/system-email.schemas";
import { mutateSystemEmailsMetadata } from "../../../../../../../server/system-email/system-email.route-metadata";
import { resetSystemEmail } from "../../../../../../../server/system-email/system-email.service";

const paramsSchema = zod.object({ key: notificationSourceEventKeySchema });

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof systemEmailResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateSystemEmailsMetadata,
  params: paramsSchema,
  output: systemEmailResponseSchema,
  handler: async ({ tx, ctx, params }) => resetSystemEmail(tx, ctx, params["key"]),
});
