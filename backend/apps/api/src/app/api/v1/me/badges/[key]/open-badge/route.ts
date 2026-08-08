import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  badgeKeyParamsSchema,
  openBadgeAssertionResponseSchema,
} from "../../../../../../../server/gamification/gamification.schemas";
import { getOpenBadgeAssertion } from "../../../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type OpenBadgeAssertionResponse = z.output<typeof openBadgeAssertionResponseSchema>;

export const GET = createTenantRoute<
  Record<string, never>,
  OpenBadgeAssertionResponse,
  typeof badgeKeyParamsSchema
>({
  metadata: routeMetadata,
  params: badgeKeyParamsSchema,
  output: openBadgeAssertionResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const badgeKey = params["key"];
    if (!badgeKey) {
      throw new Error("Missing badge key.");
    }
    return getOpenBadgeAssertion(tx, ctx, badgeKey);
  },
});
