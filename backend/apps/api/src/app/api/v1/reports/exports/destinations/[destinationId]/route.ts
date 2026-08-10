import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  deleteDestinationResponseSchema,
  destinationParamsSchema,
  updateDestinationBodySchema,
  updateDestinationResponseSchema,
} from "@atlas/domain/reports/destinations-roster.dto";
import {
  deleteDestinationMetadata,
  updateDestinationMetadata,
} from "@atlas/domain/reports/exports-roster.route-metadata";
import {
  deleteDestination,
  updateDestination,
} from "@atlas/domain/reports/destinations-roster.service";

export const PATCH = createTenantRoute<
  z.output<typeof updateDestinationBodySchema>,
  z.output<typeof updateDestinationResponseSchema>,
  typeof destinationParamsSchema
>({
  metadata: updateDestinationMetadata,
  params: destinationParamsSchema,
  input: updateDestinationBodySchema,
  output: updateDestinationResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateDestination(tx, ctx, params["destinationId"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteDestinationResponseSchema>,
  typeof destinationParamsSchema
>({
  metadata: deleteDestinationMetadata,
  params: destinationParamsSchema,
  output: deleteDestinationResponseSchema,
  handler: async ({ tx, ctx, params }) => deleteDestination(tx, ctx, params["destinationId"]),
});
