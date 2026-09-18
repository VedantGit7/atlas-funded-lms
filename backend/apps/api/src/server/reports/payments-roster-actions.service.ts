import type { TenantTx } from "@atlas/db";
import {
  exportPaymentRosterBodySchema,
  exportPaymentRosterResponseSchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { createReportRun } from "@atlas/domain/reports/reports.service";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function exportPaymentRoster(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = exportPaymentRosterBodySchema.parse(rawBody);

  const params: Record<string, unknown> = {
    reportTab: body.tab,
  };
  if (body.paidFrom) params["startDate"] = body.paidFrom;
  if (body.paidTo) params["endDate"] = body.paidTo;
  if (body.learnerName) params["learnerName"] = body.learnerName;
  if (body.email) params["email"] = body.email;
  if (body.q) params["q"] = body.q;
  if (body.currency) params["currency"] = body.currency;
  if (body.productType) params["productType"] = body.productType;
  if (body.gatewayKey) params["gatewayKey"] = body.gatewayKey;
  if (body.status) params["status"] = body.status;
  if (body.sortBy) params["sortBy"] = body.sortBy;
  if (body.sortDir) params["sortDir"] = body.sortDir;
  if (body.columns) params["columns"] = body.columns;

  const run = await createReportRun(tx, ctx, {
    definitionKey: "payments",
    format: "csv",
    params,
  });

  let emailed = false;
  if (body.emailDownloadLink) {
    const provider = getEmailProvider();
    const adminEmail = await notificationRepository.findMembershipEmail(tx, ctx.actorMembershipId);
    if (provider.isConfigured() && adminEmail) {
      await provider.send({
        tenantId: ctx.tenantId,
        to: adminEmail,
        subject: "Your payments report export is ready",
        body: [
          `Your payments ${body.tab} export has been queued.`,
          "",
          `Run ID: ${run.data.id}`,
          "Open Reports → Exports (or download from the Payments report) once processing completes.",
        ].join("\n"),
        requestId: `reports.payments.export:${run.data.id}`,
      });
      emailed = true;
    }
  }

  return exportPaymentRosterResponseSchema.parse({
    data: {
      runId: run.data.id,
      status: run.data.status,
      emailed,
    },
  });
}
