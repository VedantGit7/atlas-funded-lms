import type { TenantTx } from "@atlas/db";
import {
  exportZoomInsightsRosterBodySchema,
  exportZoomInsightsRosterResponseSchema,
} from "@atlas/domain/reports/zoom-insights-roster.dto";
import { createReportRun } from "@atlas/domain/reports/reports.service";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function exportZoomInsightsRoster(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = exportZoomInsightsRosterBodySchema.parse(rawBody);
  const params: Record<string, unknown> = {};
  if (body.meetingId) params["meetingId"] = body.meetingId;
  if (body.displayName) params["displayName"] = body.displayName;
  if (body.email) params["email"] = body.email;
  if (body.joinedFrom) params["joinedFrom"] = body.joinedFrom;
  if (body.joinedTo) params["joinedTo"] = body.joinedTo;
  if (body.columns) params["columns"] = body.columns;

  const run = await createReportRun(tx, ctx, {
    definitionKey: "zoom-insights",
    format: "csv",
    params,
  });

  let emailed = false;
  if (body.emailDownloadLink) {
    const provider = getEmailProvider();
    const adminEmail = await notificationRepository.findMembershipEmail(tx, ctx.actorMembershipId);
    if (provider.isConfigured() && adminEmail) {
      await provider.send({
        to: adminEmail,
        subject: "Your Zoom Insights export is ready",
        body: [
          "Your Zoom Insights report export has been queued.",
          "",
          `Run ID: ${run.data.id}`,
          "Open Reports → Exports (or download from Zoom Insights) once processing completes.",
        ].join("\n"),
        requestId: `reports.zoom-insights.export:${run.data.id}`,
      });
      emailed = true;
    }
  }

  return exportZoomInsightsRosterResponseSchema.parse({
    data: {
      runId: run.data.id,
      status: run.data.status,
      emailed,
    },
  });
}
