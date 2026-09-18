import { createPlatformRoute } from "@atlas/api/create-platform-route";
import {
  CostReportQuerySchema,
  CostReportResponseSchema,
} from "@atlas/domain-config/schemas/cost-attribution";
import { getCostAttributionReport } from "@atlas/domain-config/services/cost-attribution.service";
import { routeMetadata } from "./route.metadata";

/** Per-tenant cost attribution for one month (DoD item 8). */
export const GET = createPlatformRoute({
  metadata: routeMetadata,
  query: CostReportQuerySchema,
  output: CostReportResponseSchema,
  handler: async ({ tx, query }) => getCostAttributionReport(tx, { month: query.month }),
});
