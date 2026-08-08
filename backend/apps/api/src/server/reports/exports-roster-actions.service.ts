import type { TenantTx } from "@atlas/db";
import {
  exportExportsHistoryBodySchema,
  exportExportsHistoryResponseSchema,
} from "@atlas/domain/reports/exports-roster.dto";
import { createReportRun } from "@atlas/domain/reports/reports.service";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function exportExportsHistory(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = exportExportsHistoryBodySchema.parse(rawBody);
  const params: Record<string, unknown> = {};
  if (body.sourceType) params["sourceType"] = body.sourceType;
  if (body.status) params["status"] = body.status;
  if (body.definitionKey) params["definitionKey"] = body.definitionKey;
  if (body.createdFrom) params["createdFrom"] = body.createdFrom;
  if (body.createdTo) params["createdTo"] = body.createdTo;
  if (body.q) params["q"] = body.q;
  if (body.columns) params["columns"] = body.columns;

  const run = await createReportRun(tx, ctx, {
    definitionKey: "exports",
    format: "csv",
    params,
  });

  let emailed = false;
  if (body.emailDownloadLink) {
    const provider = getEmailProvider();
    const adminEmail = await notificationRepository.findMembershipEmail(
      tx,
      ctx.actorMembershipId,
    );
    if (provider.isConfigured() && adminEmail) {
      await provider.send({
        to: adminEmail,
        subject: "Your Export History report is ready",
        body: [
          "Your Export History report export has been queued.",
          "",
          `Run ID: ${run.data.id}`,
          "Open Reports → Exports to re-download once processing completes.",
        ].join("\n"),
        requestId: `reports.exports.export:${run.data.id}`,
      });
      emailed = true;
    }
  }

  return exportExportsHistoryResponseSchema.parse({
    data: {
      runId: run.data.id,
      status: run.data.status,
      emailed,
    },
  });
}
