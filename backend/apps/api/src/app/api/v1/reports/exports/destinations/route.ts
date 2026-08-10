import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createDestinationBodySchema,
  createDestinationResponseSchema,
  destinationsRosterListQuerySchema,
  destinationsRosterListResponseSchema,
} from "@atlas/domain/reports/destinations-roster.dto";
import {
  createDestinationMetadata,
  listDestinationsRosterMetadata,
} from "@atlas/domain/reports/exports-roster.route-metadata";
import {
  createDestination,
  listDestinationsRoster,
} from "@atlas/domain/reports/destinations-roster.service";

export const GET = createTenantRoute<
  z.output<typeof destinationsRosterListQuerySchema>,
  z.output<typeof destinationsRosterListResponseSchema>
>({
  metadata: listDestinationsRosterMetadata,
  input: destinationsRosterListQuerySchema,
  output: destinationsRosterListResponseSchema,
  handler: async ({ tx, ctx, input }) => listDestinationsRoster(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createDestinationBodySchema>,
  z.output<typeof createDestinationResponseSchema>
>({
  metadata: createDestinationMetadata,
  input: createDestinationBodySchema,
  output: createDestinationResponseSchema,
  handler: async ({ tx, ctx, input }) => createDestination(tx, ctx, input),
});
