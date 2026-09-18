import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  pushMessageResponseSchema,
  setPushMessageAudienceBodySchema,
} from "../../../../../../../server/push-messages/push-messages.schemas";
import { mutatePushMessagesMetadata } from "../../../../../../../server/push-messages/push-messages.route-metadata";
import { setPushMessageAudience } from "../../../../../../../server/push-messages/push-messages.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof setPushMessageAudienceBodySchema>,
  z.output<typeof pushMessageResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutatePushMessagesMetadata,
  params: paramsSchema,
  body: setPushMessageAudienceBodySchema,
  output: pushMessageResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    setPushMessageAudience(tx, ctx, params["id"], input),
});
