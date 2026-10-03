import type { TenantTx } from "@atlas/db";
import {
  exportResourceUsageRosterBodySchema,
  exportResourceUsageRosterResponseSchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";
import { createReportRun } from "@atlas/domain/reports/reports.service";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function exportResourceUsageRoster(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = exportResourceUsageRosterBodySchema.parse(rawBody);
  const params: Record<string, unknown> = {
    reportTab: body.reportTab,
  };
  if (body.metricKey) params["metricKey"] = body.metricKey;
  if (body.q) params["q"] = body.q;
  if (body.columns) params["columns"] = body.columns;

  const run = await createReportRun(tx, ctx, {
    definitionKey: "resource-usage",
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
        subject: "Your Resource Usage export is ready",
        body: [
          "Your Resource Usage report export has been queued.",
          "",
          `Run ID: ${run.data.id}`,
          "Open Reports → Exports (or download from Resource Usage) once processing completes.",
        ].join("\n"),
        requestId: `reports.resource-usage.export:${run.data.id}`,
      });
      emailed = true;
    }
  }

  return exportResourceUsageRosterResponseSchema.parse({
    data: {
      runId: run.data.id,
      status: run.data.status,
      emailed,
    },
  });
}
