import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { exportDestinationsResponseSchema } from "@atlas/domain/reports/destinations-roster.dto";
import { exportDestinationsListMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";
import { exportDestinationsList } from "@atlas/domain/reports/destinations-roster.service";
import { rejectClientTenantFields } from "@atlas/domain/shared/domain.dto";

const exportBodySchema = rejectClientTenantFields.extend({}).strict();

export const POST = createTenantRoute<
  z.output<typeof exportBodySchema>,
  z.output<typeof exportDestinationsResponseSchema>
>({
  metadata: exportDestinationsListMetadata,
  input: exportBodySchema,
  output: exportDestinationsResponseSchema,
  handler: async ({ tx, ctx }) => exportDestinationsList(tx, ctx),
});
