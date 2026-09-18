import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { pushMessageRecipientsResponseSchema } from "../../../../../../../server/push-messages/push-messages.schemas";
import { listPushMessagesMetadata } from "../../../../../../../server/push-messages/push-messages.route-metadata";
import { listPushMessageRecipients } from "../../../../../../../server/push-messages/push-messages.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof pushMessageRecipientsResponseSchema>,
  typeof paramsSchema
>({
  metadata: listPushMessagesMetadata,
  params: paramsSchema,
  output: pushMessageRecipientsResponseSchema,
  handler: async ({ tx, ctx, params }) => listPushMessageRecipients(tx, ctx, params["id"]),
});
