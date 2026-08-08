import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  automationRunListQuerySchema,
  automationRunListResponseSchema,
} from "../../../../server/automation/automation.contract";
import { listAutomationRuns } from "../../../../server/automation/automation.service";
import { routeMetadata } from "./route.metadata";

type AutomationRunListQuery = z.output<typeof automationRunListQuerySchema>;
type AutomationRunListResponse = z.output<typeof automationRunListResponseSchema>;

export const GET = createTenantRoute<AutomationRunListQuery, AutomationRunListResponse>({
  metadata: routeMetadata,
  input: automationRunListQuerySchema,
  output: automationRunListResponseSchema,
  handler: async ({ tx, ctx, input }) => listAutomationRuns(tx, ctx, input),
});
