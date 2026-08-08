import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { PutDimensionWeightsBodySchema } from "@atlas/api-server/item-registry/schemas";
import { itemRegistryService } from "../../../../../../server/item-registry/item-registry.service";
import { dimensionWeightListResponseSchema } from "@atlas/api-server/item-registry/item-registry-response-schemas";
import {
  getDimensionWeightsRouteMetadata,
  putDimensionWeightsRouteMetadata,
} from "./route.metadata";

type PutDimensionWeightsBody = z.output<typeof PutDimensionWeightsBodySchema>;

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof dimensionWeightListResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: getDimensionWeightsRouteMetadata,
  params: uuidParamSchema,
  output: dimensionWeightListResponseSchema,
  handler: async ({ tx, params }) => {
    const itemId = params["id"];
    if (!itemId) throw new Error("Missing item id");
    return itemRegistryService.listDimensionWeights(tx, itemId);
  },
});

export const PUT = createTenantRoute<
  PutDimensionWeightsBody,
  z.output<typeof dimensionWeightListResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: putDimensionWeightsRouteMetadata,
  params: uuidParamSchema,
  body: PutDimensionWeightsBodySchema,
  output: dimensionWeightListResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const itemId = params["id"];
    if (!itemId) throw new Error("Missing item id");
    return itemRegistryService.putDimensionWeights(tx, ctx, itemId, input);
  },
});
