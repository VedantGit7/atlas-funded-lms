import type { TenantTx } from "@atlas/db";
import {
  exportSuperLiveInsightsRosterBodySchema,
  exportSuperLiveInsightsRosterResponseSchema,
} from "@atlas/domain/reports/super-live-insights-roster.dto";
import { createReportRun } from "@atlas/domain/reports/reports.service";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function exportSuperLiveInsightsRoster(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = exportSuperLiveInsightsRosterBodySchema.parse(rawBody);
  const params: Record<string, unknown> = {};
  if (body.sessionId) params["sessionId"] = body.sessionId;
  if (body.q) params["q"] = body.q;
  if (body.status) params["status"] = body.status;
  if (body.courseId) params["courseId"] = body.courseId;
  if (body.batchId) params["batchId"] = body.batchId;
  if (body.startedFrom) params["startedFrom"] = body.startedFrom;
  if (body.startedTo) params["startedTo"] = body.startedTo;
  if (body.minAttended != null) params["minAttended"] = body.minAttended;
  if (body.columns) params["columns"] = body.columns;

  const run = await createReportRun(tx, ctx, {
    definitionKey: "super-live-insights",
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
        subject: "Your Super Live Insights export is ready",
        body: [
          "Your Super Live Insights report export has been queued.",
          "",
          `Run ID: ${run.data.id}`,
          "Open Reports → Exports (or download from Super Live Insights) once processing completes.",
        ].join("\n"),
        requestId: `reports.super-live-insights.export:${run.data.id}`,
      });
      emailed = true;
    }
  }

  return exportSuperLiveInsightsRosterResponseSchema.parse({
    data: {
      runId: run.data.id,
      status: run.data.status,
      emailed,
    },
  });
}
