import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  schedulesRosterBulkBodySchema,
  schedulesRosterBulkResponseSchema,
} from "@atlas/domain/reports/schedules-roster.dto";
import { bulkMutateSchedulesMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";
import { bulkMutateSchedules } from "@atlas/domain/reports/schedules-roster.service";

export const POST = createTenantRoute<
  z.output<typeof schedulesRosterBulkBodySchema>,
  z.output<typeof schedulesRosterBulkResponseSchema>
>({
  metadata: bulkMutateSchedulesMetadata,
  input: schedulesRosterBulkBodySchema,
  output: schedulesRosterBulkResponseSchema,
  handler: async ({ tx, ctx, input }) => bulkMutateSchedules(tx, ctx, input),
});
