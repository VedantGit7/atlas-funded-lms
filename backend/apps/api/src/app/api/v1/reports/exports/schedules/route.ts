import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  schedulesRosterListQuerySchema,
  schedulesRosterListResponseSchema,
} from "@atlas/domain/reports/schedules-roster.dto";
import { listSchedulesRosterMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";
import { listSchedulesRoster } from "@atlas/domain/reports/schedules-roster.service";

export const GET = createTenantRoute<
  z.output<typeof schedulesRosterListQuerySchema>,
  z.output<typeof schedulesRosterListResponseSchema>
>({
  metadata: listSchedulesRosterMetadata,
  input: schedulesRosterListQuerySchema,
  output: schedulesRosterListResponseSchema,
  handler: async ({ tx, ctx, input }) => listSchedulesRoster(tx, ctx, input),
});
