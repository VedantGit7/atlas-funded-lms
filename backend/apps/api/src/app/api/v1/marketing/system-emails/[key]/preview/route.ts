import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { notificationSourceEventKeySchema } from "../../../../../../../server/notifications/notification.dto";
import { previewSystemEmailResponseSchema } from "../../../../../../../server/system-email/system-email.schemas";
import { listSystemEmailsMetadata } from "../../../../../../../server/system-email/system-email.route-metadata";
import { previewSystemEmail } from "../../../../../../../server/system-email/system-email.service";

const paramsSchema = zod.object({ key: notificationSourceEventKeySchema });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof previewSystemEmailResponseSchema>,
  typeof paramsSchema
>({
  metadata: listSystemEmailsMetadata,
  params: paramsSchema,
  output: previewSystemEmailResponseSchema,
  handler: async ({ tx, ctx, params }) => previewSystemEmail(tx, ctx, params["key"]),
});
