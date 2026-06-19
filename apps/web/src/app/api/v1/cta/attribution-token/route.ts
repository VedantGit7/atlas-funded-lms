import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { createAttributionToken } from "../../../../../server/readiness/cta-attribution.service";
import {
  attributionTokenResponseSchema,
  createAttributionTokenBodySchema,
} from "../../../../../server/readiness/readiness.schemas";
import { postRouteMetadata } from "./route.metadata";

type CreateAttributionTokenBody = z.output<typeof createAttributionTokenBodySchema>;
type AttributionTokenResponse = z.output<typeof attributionTokenResponseSchema>;

export const POST = createTenantRoute<CreateAttributionTokenBody, AttributionTokenResponse>({
  metadata: postRouteMetadata,
  body: createAttributionTokenBodySchema,
  output: attributionTokenResponseSchema,
  handler: async ({ tx, ctx, input }) => createAttributionToken(tx, ctx, input),
});
