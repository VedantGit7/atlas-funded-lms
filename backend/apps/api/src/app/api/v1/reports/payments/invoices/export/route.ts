import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportPaymentRosterBodySchema,
  exportPaymentRosterResponseSchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { exportPaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { exportPaymentRoster } from "../../../../../../../server/reports/payments-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof exportPaymentRosterBodySchema>,
  z.output<typeof exportPaymentRosterResponseSchema>
>({
  metadata: exportPaymentsRosterMetadata,
  body: exportPaymentRosterBodySchema,
  output: exportPaymentRosterResponseSchema,
  handler: async ({ tx, ctx, input }) =>
    exportPaymentRoster(tx, ctx, { ...input, tab: "invoices" }),
});
