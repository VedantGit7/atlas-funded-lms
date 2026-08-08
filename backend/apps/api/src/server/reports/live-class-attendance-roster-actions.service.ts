import type { TenantTx } from "@atlas/db";
import {
  exportLiveClassAttendanceRosterBodySchema,
  exportLiveClassAttendanceRosterResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";
import { createReportRun } from "@atlas/domain/reports/reports.service";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function exportLiveClassAttendanceRoster(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = exportLiveClassAttendanceRosterBodySchema.parse(rawBody);
  const params: Record<string, unknown> = {};
  if (body.sessionId) params["sessionId"] = body.sessionId;
  if (body.learnerName) params["learnerName"] = body.learnerName;
  if (body.email) params["email"] = body.email;
  if (body.status) params["status"] = body.status;
  if (body.joinedFrom) params["joinedFrom"] = body.joinedFrom;
  if (body.joinedTo) params["joinedTo"] = body.joinedTo;
  if (body.columns) params["columns"] = body.columns;

  const run = await createReportRun(tx, ctx, {
    definitionKey: "live-class-attendance",
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
        subject: "Your Live Class Attendance export is ready",
        body: [
          "Your Live Class Attendance report export has been queued.",
          "",
          `Run ID: ${run.data.id}`,
          "Open Reports → Exports (or download from Live Class Attendance) once processing completes.",
        ].join("\n"),
        requestId: `reports.live-class-attendance.export:${run.data.id}`,
      });
      emailed = true;
    }
  }

  return exportLiveClassAttendanceRosterResponseSchema.parse({
    data: {
      runId: run.data.id,
      status: run.data.status,
      emailed,
    },
  });
}
