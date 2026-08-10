import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import {
  exportLiveClassAttendanceRosterBodySchema,
  exportLiveClassAttendanceRosterResponseSchema,
  sendLiveClassAttendanceMessageBodySchema,
  sendLiveClassAttendanceMessageResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";
import {
  liveClassAttendanceMessageFailed,
  liveClassSessionNotFound,
} from "@atlas/domain/reports/live-class-attendance-roster.errors";
import { liveClassAttendanceRosterRepository } from "@atlas/domain/reports/live-class-attendance-roster.repository";
import { createReportRun } from "@atlas/domain/reports/reports.service";
import { marketingEmailRepository } from "../marketing-email/marketing-email.repository";
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
    const adminEmail = await notificationRepository.findMembershipEmail(tx, ctx.actorMembershipId);
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

function renderMessageTemplate(
  template: string,
  vars: {
    learnerName: string;
    sessionTitle: string;
    recordingLink: string;
    nextSessionDate: string;
  },
) {
  return template
    .replaceAll("{{learner_name}}", vars.learnerName)
    .replaceAll("{{session_title}}", vars.sessionTitle)
    .replaceAll("{{recording_link}}", vars.recordingLink)
    .replaceAll("{{next_session_date}}", vars.nextSessionDate);
}

export async function sendLiveClassAttendanceMessage(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = sendLiveClassAttendanceMessageBodySchema.parse(rawBody);
  const session = body.sessionId
    ? await liveClassAttendanceRosterRepository.findSessionById(tx, body.sessionId)
    : null;
  if (body.sessionId && !session) throw liveClassSessionNotFound();

  const nextSession = body.sessionId
    ? await liveClassAttendanceRosterRepository.findNextSession(tx, body.sessionId)
    : null;

  let membershipIds: string[];
  if (body.sendTestToSelf) {
    membershipIds = [ctx.actorMembershipId];
  } else if (body.audience === "selected" && body.membershipIds?.length) {
    membershipIds = body.membershipIds;
  } else if (body.audience === "low_attendance") {
    membershipIds =
      body.membershipIds && body.membershipIds.length > 0
        ? body.membershipIds
        : await liveClassAttendanceRosterRepository.listLowAttendanceMembershipIds(tx, {
            limit: 200,
          });
  } else if (body.sessionId) {
    membershipIds = await liveClassAttendanceRosterRepository.listMembershipIdsByAudience(
      tx,
      body.sessionId,
      body.audience,
      body.membershipIds,
    );
  } else {
    membershipIds = body.membershipIds ?? [];
  }

  if (membershipIds.length === 0) {
    throw liveClassAttendanceMessageFailed("No learners matched the current audience.");
  }

  const sendGroupId = randomUUID();
  const channels = body.channels;
  const wantsEmail = channels.includes("email");
  const wantsInApp = channels.includes("in_app");
  const nextSessionDate = nextSession?.scheduled_at
    ? nextSession.scheduled_at.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "TBD";
  const recordingLink = "Recording link will be shared when available";
  const sessionTitle = session?.title ?? "your live sessions";

  const basePayload = {
    sessionId: body.sessionId ?? null,
    sendGroupId,
    channels,
    source: "reports.live-class-attendance",
    audience: body.audience,
  };

  let deliveredCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  if (wantsEmail) {
    const provider = getEmailProvider();
    if (!provider.isConfigured()) {
      throw liveClassAttendanceMessageFailed(
        "Email provider is not configured. Set NOTIFICATION_EMAIL_PROVIDER=mock for local delivery.",
      );
    }

    const targets = await marketingEmailRepository.listRecipientDeliveryTargets(tx, membershipIds);
    skippedCount += membershipIds.length - targets.length;

    for (const target of targets) {
      const idempotencyKey = `reports.live-class-attendance.message:${sendGroupId}:${target.membershipId}:email`;
      const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
        tenantId: ctx.tenantId,
        idempotencyKey,
      });
      if (existing) {
        skippedCount += 1;
        continue;
      }

      const learnerName = target.displayName?.trim() || "there";
      const renderedBody = renderMessageTemplate(body.message, {
        learnerName,
        sessionTitle,
        recordingLink,
        nextSessionDate,
      });

      try {
        await provider.send({
          to: target.email,
          subject: body.subject.replaceAll("{{session_title}}", sessionTitle),
          body: renderedBody,
          requestId: idempotencyKey,
        });
        await notificationRepository.insertDispatch(tx, {
          tenantId: ctx.tenantId,
          membershipId: target.membershipId,
          channel: "email",
          templateKey: "reports.live-class-attendance.message",
          destination: target.email,
          idempotencyKey,
          status: "SENT",
          sentAt: new Date(),
          payloadJson: {
            ...basePayload,
            email: { subject: body.subject, body: renderedBody },
          },
        });
        deliveredCount += 1;
      } catch (error) {
        await notificationRepository.insertDispatch(tx, {
          tenantId: ctx.tenantId,
          membershipId: target.membershipId,
          channel: "email",
          templateKey: "reports.live-class-attendance.message",
          destination: target.email,
          idempotencyKey,
          status: "FAILED",
          payloadJson: {
            ...basePayload,
            email: { subject: body.subject, body: renderedBody },
            error: error instanceof Error ? error.message : "Send failed",
          },
        });
        failedCount += 1;
      }
    }
  }

  if (wantsInApp) {
    for (const membershipId of membershipIds) {
      const idempotencyKey = `reports.live-class-attendance.message:${sendGroupId}:${membershipId}:in_app`;
      const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
        tenantId: ctx.tenantId,
        idempotencyKey,
      });
      if (existing) {
        skippedCount += 1;
        continue;
      }

      try {
        await notificationRepository.insertDispatch(tx, {
          tenantId: ctx.tenantId,
          membershipId,
          channel: "in_app",
          templateKey: "reports.live-class-attendance.message",
          destination: membershipId,
          idempotencyKey,
          status: "SENT",
          sentAt: new Date(),
          payloadJson: {
            ...basePayload,
            inApp: { subject: body.subject, body: body.message },
          },
        });
        deliveredCount += 1;
      } catch {
        failedCount += 1;
      }
    }
  }

  const status =
    failedCount > 0 && deliveredCount === 0
      ? ("failed" as const)
      : failedCount > 0
        ? ("partially_failed" as const)
        : ("sent" as const);

  return sendLiveClassAttendanceMessageResponseSchema.parse({
    data: {
      sendGroupId,
      deliveredCount,
      skippedCount,
      failedCount,
      recipientCount: membershipIds.length,
      status,
    },
  });
}
