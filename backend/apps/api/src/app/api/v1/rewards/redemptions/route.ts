import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  redemptionLogQuerySchema,
  redemptionLogResponseSchema,
} from "../../../../../server/gamification/rewards.schemas";
import { listRedemptionLog } from "../../../../../server/gamification/rewards.service";
import { routeMetadata } from "./route.metadata";

type RedemptionLogQuery = z.output<typeof redemptionLogQuerySchema>;
type RedemptionLogResponse = z.output<typeof redemptionLogResponseSchema>;

export const GET = createTenantRoute<RedemptionLogQuery, RedemptionLogResponse>({
  metadata: routeMetadata,
  input: redemptionLogQuerySchema,
  output: redemptionLogResponseSchema,
  handler: async ({ tx, input }) => listRedemptionLog(tx, input),
});
