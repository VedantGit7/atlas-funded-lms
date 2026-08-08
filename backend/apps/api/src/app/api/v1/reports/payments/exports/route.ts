import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createPaymentExportBodySchema,
  createPaymentExportResponseSchema,
  paymentExportsResponseSchema,
} from "@atlas/domain/reports/payments-exports.dto";
import {
  createPaymentExportMetadata,
  getPaymentExportsMetadata,
} from "@atlas/domain/reports/payments-exports.route-metadata";
import {
  createPaymentExport,
  getPaymentExports,
} from "@atlas/domain/reports/payments-exports.service";
import { schedulePaymentExportProcessing } from "../../../../../../server/reports/payments-exports-async";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof paymentExportsResponseSchema>
>({
  metadata: getPaymentExportsMetadata,
  input: noBodySchema,
  output: paymentExportsResponseSchema,
  handler: async ({ tx, ctx }) => getPaymentExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createPaymentExportBodySchema>,
  z.output<typeof createPaymentExportResponseSchema>
>({
  metadata: createPaymentExportMetadata,
  body: createPaymentExportBodySchema,
  output: createPaymentExportResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    const result = await createPaymentExport(tx, ctx, input);
    schedulePaymentExportProcessing({
      tenantId: ctx.tenantId,
      requestId: ctx.requestId,
      actorMembershipId: ctx.actorMembershipId,
      reportRunId: result.data.run.id,
      format: result.data.run.format === "pdf" ? "csv" : result.data.run.format,
      requestedAt: result.data.run.createdAt,
    });
    return result;
  },
});
