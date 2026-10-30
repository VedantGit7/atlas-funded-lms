import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  channelTestEmailParamsSchema,
  channelTestEmailResponseSchema,
} from "../../../../../../../server/notifications/channel-test-email.contract";
import { readChannelTestEmail } from "../../../../../../../server/notifications/channel-test-email.service";
import { routeMetadata } from "./route.metadata";

type Response = z.output<typeof channelTestEmailResponseSchema>;

export const GET = createTenantRoute<
  Record<string, never>,
  Response,
  typeof channelTestEmailParamsSchema
>({
  metadata: routeMetadata.GET,
  input: noBodySchema,
  params: channelTestEmailParamsSchema,
  output: channelTestEmailResponseSchema,
  handler: async ({ tx, ctx, params }) => ({
    data: await readChannelTestEmail(tx, ctx, params["testId"]),
  }),
});
