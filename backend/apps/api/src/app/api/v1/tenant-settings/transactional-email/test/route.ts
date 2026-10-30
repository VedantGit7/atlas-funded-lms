import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  channelTestEmailResponseSchema,
  sendChannelTestEmailBodySchema,
} from "../../../../../../server/notifications/channel-test-email.contract";
import { sendChannelTestEmail } from "../../../../../../server/notifications/channel-test-email.service";
import { routeMetadata } from "./route.metadata";

type Body = z.output<typeof sendChannelTestEmailBodySchema>;
type Response = z.output<typeof channelTestEmailResponseSchema>;

export const POST = createTenantRoute<Body, Response>({
  metadata: routeMetadata.POST,
  body: sendChannelTestEmailBodySchema,
  output: channelTestEmailResponseSchema,
  handler: async ({ tx, ctx, input }) => ({ data: await sendChannelTestEmail(tx, ctx, input) }),
});
