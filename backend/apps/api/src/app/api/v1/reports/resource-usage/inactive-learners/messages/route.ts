import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  resourceUsageInactiveMessageBodySchema,
  resourceUsageInactiveMessageResponseSchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";
import { messageResourceUsageInactiveMetadata } from "@atlas/domain/reports/resource-usage-roster.route-metadata";
import { sendResourceUsageInactiveMessage } from "../../../../../../../server/reports/resource-usage-inactive-actions.service";

export const POST = createTenantRoute<
  z.output<typeof resourceUsageInactiveMessageBodySchema>,
  z.output<typeof resourceUsageInactiveMessageResponseSchema>
>({
  metadata: messageResourceUsageInactiveMetadata,
  body: resourceUsageInactiveMessageBodySchema,
  output: resourceUsageInactiveMessageResponseSchema,
  handler: async ({ tx, ctx, input }) => sendResourceUsageInactiveMessage(tx, ctx, input),
});
