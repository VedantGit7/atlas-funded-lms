import type { TenantTx } from "@atlas/db";
import {
  exportPollRosterBodySchema,
  exportPollRosterResponseSchema,
} from "@atlas/domain/reports/polls-roster.dto";
import { createReportRun } from "@atlas/domain/reports/reports.service";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function exportPollRoster(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = exportPollRosterBodySchema.parse(rawBody);
  const params: Record<string, unknown> = {};
  if (body.pollId) params["pollId"] = body.pollId;
  if (body.learnerName) params["learnerName"] = body.learnerName;
  if (body.optionId) params["optionId"] = body.optionId;
  if (body.respondedFrom) params["respondedFrom"] = body.respondedFrom;
  if (body.respondedTo) params["respondedTo"] = body.respondedTo;
  if (body.columns) params["columns"] = body.columns;

  const run = await createReportRun(tx, ctx, {
    definitionKey: "polls",
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
        subject: "Your Polls export is ready",
        body: [
          "Your Polls report export has been queued.",
          "",
          `Run ID: ${run.data.id}`,
          "Open Reports → Exports (or download from Polls) once processing completes.",
        ].join("\n"),
        requestId: `reports.polls.export:${run.data.id}`,
      });
      emailed = true;
    }
  }

  return exportPollRosterResponseSchema.parse({
    data: {
      runId: run.data.id,
      status: run.data.status,
      emailed,
    },
  });
}
