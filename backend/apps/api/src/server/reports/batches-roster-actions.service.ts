import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import {
  exportBatchRosterBodySchema,
  exportBatchRosterResponseSchema,
  sendBatchMessageBodySchema,
  sendBatchMessageResponseSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { batchRosterMessageFailed } from "@atlas/domain/reports/batches-roster.errors";
import { batchesRosterRepository } from "@atlas/domain/reports/batches-roster.repository";
import { resolveBatchMembershipIds } from "@atlas/domain/reports/batches-roster.service";
import { createReportRun } from "@atlas/domain/reports/reports.service";
import { marketingEmailRepository } from "../marketing-email/marketing-email.repository";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

async function resolveActorLabel(tx: TenantTx, membershipId: string): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ label: string | null }>>`
    select coalesce(mp.display_name, ap.email, m.invited_email_normalized) as label
    from memberships m
    left join member_profiles mp
      on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
    left join auth_principals ap on ap.id = m.auth_principal_id
    where m.id = ${membershipId}::uuid
    limit 1
  `;
  return rows[0]?.label ?? null;
}

export async function sendBatchRosterMessage(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = sendBatchMessageBodySchema.parse(rawBody);
  const sendGroupId = randomUUID();
  const channels = body.channels;
  const wantsEmail = channels.includes("email");
  const wantsInApp = channels.includes("in_app");
  const scheduleAt = body.scheduleAt ? new Date(body.scheduleAt) : null;
  const isScheduled = scheduleAt != null && scheduleAt.getTime() > Date.now();

  let membershipIds = await resolveBatchMembershipIds(tx, {
    batchId: body.batchId,
    ...(body.membershipIds ? { membershipIds: body.membershipIds } : {}),
    ...(body.learnerName ? { learnerName: body.learnerName } : {}),
    ...(body.joinedFrom ? { joinedFrom: body.joinedFrom } : {}),
    ...(body.joinedTo ? { joinedTo: body.joinedTo } : {}),
    ...(body.minCompletion != null ? { minCompletion: body.minCompletion } : {}),
    ...(body.maxCompletion != null ? { maxCompletion: body.maxCompletion } : {}),
  });

  if (body.excludeMessagedWithinDays && body.excludeMessagedWithinDays > 0) {
    const recentlyMessaged = await batchesRosterRepository.listRecentlyMessagedMembershipIds(
      tx,
      body.batchId,
      body.excludeMessagedWithinDays,
    );
    const exclude = new Set(recentlyMessaged);
    membershipIds = membershipIds.filter((id) => !exclude.has(id));
  }

  if (membershipIds.length === 0) {
    throw batchRosterMessageFailed("No learners matched the current audience.");
  }

  const sentByLabel = await resolveActorLabel(tx, ctx.actorMembershipId);
  const audienceLabel =
    body.audienceLabel?.trim() ||
    (body.membershipIds?.length ? `${membershipIds.length} learners` : "Whole batch");

  const basePayload = {
    batchId: body.batchId,
    sendGroupId,
    audienceLabel,
    channels,
    sentByLabel,
    isAutomated: false,
    ...(scheduleAt ? { scheduleAt: scheduleAt.toISOString() } : {}),
    source: "reports.batches",
  };

  let deliveredCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  if (wantsEmail) {
    const provider = getEmailProvider();
    if (!provider.isConfigured()) {
      throw batchRosterMessageFailed(
        "Email provider is not configured. Set NOTIFICATION_EMAIL_PROVIDER=mock for local delivery.",
      );
    }

    const targets = await marketingEmailRepository.listRecipientDeliveryTargets(tx, membershipIds);
    skippedCount += membershipIds.length - targets.length;

    for (const target of targets) {
      const idempotencyKey = `reports.batches.message:${sendGroupId}:${target.membershipId}:email`;
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

      if (isScheduled) {
        await notificationRepository.insertDispatch(tx, {
          tenantId: ctx.tenantId,
          membershipId: target.membershipId,
          channel: "email",
          templateKey: "reports.batches.message",
          destination: target.email,
          idempotencyKey,
          status: "QUEUED",
          payloadJson: {
            ...basePayload,
            email: { subject: body.subject, body: renderedBody },
          },
        });
        continue;
      }

      try {
        await provider.send({
          tenantId: ctx.tenantId,
          to: target.email,
          subject: body.subject,
          body: renderedBody,
          requestId: idempotencyKey,
        });
        await notificationRepository.insertDispatch(tx, {
          tenantId: ctx.tenantId,
          membershipId: target.membershipId,
          channel: "email",
          templateKey: "reports.batches.message",
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
          templateKey: "reports.batches.message",
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
      const idempotencyKey = `reports.batches.message:${sendGroupId}:${membershipId}:in_app`;
      const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
        tenantId: ctx.tenantId,
        idempotencyKey,
      });
      if (existing) {
        skippedCount += 1;
        continue;
      }

      if (isScheduled) {
        await notificationRepository.insertDispatch(tx, {
          tenantId: ctx.tenantId,
          membershipId,
          channel: "in_app",
          templateKey: "reports.batches.message",
          destination: null,
          idempotencyKey,
          status: "QUEUED",
          payloadJson: {
            ...basePayload,
            inApp: { subject: body.subject, body: body.message },
          },
        });
        continue;
      }

      await notificationRepository.insertDispatch(tx, {
        tenantId: ctx.tenantId,
        membershipId,
        channel: "in_app",
        templateKey: "reports.batches.message",
        destination: null,
        idempotencyKey,
        status: "SENT",
        sentAt: new Date(),
        payloadJson: {
          ...basePayload,
          inApp: { subject: body.subject, body: body.message },
        },
      });
      if (!wantsEmail) deliveredCount += 1;
    }
  }

  let status: "sent" | "partially_failed" | "scheduled" | "failed" = "sent";
  if (isScheduled) status = "scheduled";
  else if (failedCount > 0 && deliveredCount > 0) status = "partially_failed";
  else if (failedCount > 0 && deliveredCount === 0) status = "failed";

  return sendBatchMessageResponseSchema.parse({
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

export async function retryBatchRosterMessage(
  tx: TenantTx,
  ctx: ServiceCtx,
  batchId: string,
  sendGroupId: string,
) {
  const failedIds = await batchesRosterRepository.listFailedMembershipIdsForSendGroup(
    tx,
    batchId,
    sendGroupId,
  );
  if (failedIds.length === 0) {
    throw batchRosterMessageFailed("No failed deliveries to retry for this message.");
  }

  const history = await batchesRosterRepository.listBatchMessageHistory(tx, batchId, {
    page: 1,
    limit: 50,
  });
  const original = history.items.find((item) => item.send_group_id === sendGroupId);
  const subject = original?.subject ?? "Follow-up message";

  return sendBatchRosterMessage(tx, ctx, {
    batchId,
    membershipIds: failedIds,
    subject: `Retry: ${subject}`,
    message:
      "This is a retry of a previous message that failed to deliver. Please check your inbox for the original details, or contact your instructor if you need help.",
    audienceLabel: `Retry failed (${failedIds.length})`,
    channels: ["email"],
  });
}

export async function exportBatchRoster(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = exportBatchRosterBodySchema.parse(rawBody);
  const params: Record<string, unknown> = {};
  if (body.batchId) params["batchId"] = body.batchId;
  if (body.learnerName) params["learnerName"] = body.learnerName;
  if (body.joinedFrom) params["joinedFrom"] = body.joinedFrom;
  if (body.joinedTo) params["joinedTo"] = body.joinedTo;
  if (body.columns) params["columns"] = body.columns;

  const run = await createReportRun(tx, ctx, {
    definitionKey: "batches",
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
        subject: "Your Batches export is ready",
        body: [
          "Your Batches report export has been queued.",
          "",
          `Run ID: ${run.data.id}`,
          "Open Reports → Exports (or download from Batches) once processing completes.",
        ].join("\n"),
        requestId: `reports.batches.export:${run.data.id}`,
      });
      emailed = true;
    }
  }

  return exportBatchRosterResponseSchema.parse({
    data: {
      runId: run.data.id,
      status: run.data.status,
      emailed,
    },
  });
}
