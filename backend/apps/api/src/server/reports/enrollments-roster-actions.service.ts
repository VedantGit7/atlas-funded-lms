import type { TenantTx } from "@atlas/db";
import {
  exportEnrollmentRosterBodySchema,
  exportEnrollmentRosterResponseSchema,
  sendEnrollmentMessageBodySchema,
  sendEnrollmentMessageResponseSchema,
} from "@atlas/domain/reports/enrollments-roster.dto";
import { enrollmentRosterMessageFailed } from "@atlas/domain/reports/enrollments-roster.errors";
import { resolveEnrollmentMembershipIds } from "@atlas/domain/reports/enrollments-roster.service";
import { createReportRun } from "@atlas/domain/reports/reports.service";
import { marketingEmailRepository } from "../marketing-email/marketing-email.repository";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function sendEnrollmentRosterMessage(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = sendEnrollmentMessageBodySchema.parse(rawBody);
  const membershipIds = await resolveEnrollmentMembershipIds(tx, body);
  const provider = getEmailProvider();
  if (!provider.isConfigured()) {
    throw enrollmentRosterMessageFailed(
      "Email provider is not configured. Set NOTIFICATION_EMAIL_PROVIDER=mock for local delivery.",
    );
  }

  const targets = await marketingEmailRepository.listRecipientDeliveryTargets(tx, membershipIds);
  let deliveredCount = 0;
  let skippedCount = membershipIds.length - targets.length;

  for (const target of targets) {
    const idempotencyKey = `reports.enrollments.message:${ctx.requestId}:${target.membershipId}`;
    const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
      tenantId: ctx.tenantId,
      idempotencyKey,
    });
    if (existing) {
      skippedCount += 1;
      continue;
    }

    const greeting = target.displayName?.trim() || "there";
    const renderedBody = `Hi ${greeting},\n\n${body.message}`;

    await provider.send({
      to: target.email,
      subject: body.subject,
      body: renderedBody,
      requestId: idempotencyKey,
    });

    await notificationRepository.insertDispatch(tx, {
      tenantId: ctx.tenantId,
      membershipId: target.membershipId,
      channel: "email",
      templateKey: "reports.enrollments.message",
      destination: target.email,
      idempotencyKey,
      status: "SENT",
      payloadJson: {
        email: {
          subject: body.subject,
          body: renderedBody,
        },
        source: "reports.enrollments",
      },
    });
    deliveredCount += 1;
  }

  return sendEnrollmentMessageResponseSchema.parse({
    data: {
      deliveredCount,
      skippedCount,
      recipientCount: membershipIds.length,
    },
  });
}

export async function exportEnrollmentRoster(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = exportEnrollmentRosterBodySchema.parse(rawBody);

  const params: Record<string, unknown> = {};
  if (body.enrolledFrom) params["startDate"] = body.enrolledFrom;
  if (body.enrolledTo) params["endDate"] = body.enrolledTo;
  if (body.email) params["email"] = body.email;
  if (body.enrolledType) params["enrolledType"] = body.enrolledType;
  if (body.status) params["status"] = body.status;
  if (body.courseId) params["courseId"] = body.courseId;
  if (body.sortBy) params["sortBy"] = body.sortBy;
  if (body.sortDir) params["sortDir"] = body.sortDir;

  const run = await createReportRun(tx, ctx, {
    definitionKey: "enrollments",
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
        subject: "Your enrollments report export is ready",
        body: [
          "Your enrollments report export has been queued.",
          "",
          `Run ID: ${run.data.id}`,
          "Open Reports → Exports (or download from the Enrollments report) once processing completes.",
          "",
          "If your academy has report download links enabled, use the download action on the completed run.",
        ].join("\n"),
        requestId: `reports.enrollments.export:${run.data.id}`,
      });
      emailed = true;
    }
  }

  return exportEnrollmentRosterResponseSchema.parse({
    data: {
      runId: run.data.id,
      status: run.data.status,
      emailed,
    },
  });
}
