import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  deletePushMessageBodySchema,
  deletePushMessageResponseSchema,
} from "../../../../../../../server/push-messages/push-messages.schemas";
import { mutatePushMessagesMetadata } from "../../../../../../../server/push-messages/push-messages.route-metadata";
import { deletePushMessage } from "../../../../../../../server/push-messages/push-messages.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  z.output<typeof deletePushMessageBodySchema>,
  z.output<typeof deletePushMessageResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutatePushMessagesMetadata,
  params: paramsSchema,
  body: deletePushMessageBodySchema,
  output: deletePushMessageResponseSchema,
  handler: async ({ tx, ctx, params, input }) => deletePushMessage(tx, ctx, params.id, input),
});
