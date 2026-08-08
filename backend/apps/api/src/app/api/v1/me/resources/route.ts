import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { listMyResources } from "../../../../../server/resources/resources.service";
import {
  resourceListQuerySchema,
  resourceListResponseSchema,
} from "../../../../../server/resources/schemas";
import { routeMetadata } from "./route.metadata";

type ResourceListQuery = z.output<typeof resourceListQuerySchema>;
type ResourceListResponse = z.output<typeof resourceListResponseSchema>;

export const GET = createTenantRoute<ResourceListQuery, ResourceListResponse>({
  metadata: routeMetadata,
  input: resourceListQuerySchema,
  output: resourceListResponseSchema,
  handler: async ({ tx, ctx, input }) => listMyResources(tx, ctx, input),
});
