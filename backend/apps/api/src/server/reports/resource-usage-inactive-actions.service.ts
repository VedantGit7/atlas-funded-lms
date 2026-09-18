import type { TenantTx } from "@atlas/db";
import {
  resourceUsageInactiveMessageBodySchema,
  resourceUsageInactiveMessageResponseSchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";
import { resourceUsageRosterRepository } from "@atlas/domain/reports/resource-usage-roster.repository";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { marketingEmailRepository } from "../marketing-email/marketing-email.repository";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function inactiveMessageFailed(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

function renderInactiveTemplate(
  template: string,
  vars: {
    learnerName: string;
    daysInactive: string;
    enrolmentCount: string;
  },
) {
  return template
    .replaceAll("{{learner_name}}", vars.learnerName)
    .replaceAll("{{days_inactive}}", vars.daysInactive)
    .replaceAll("{{enrolment_count}}", vars.enrolmentCount)
    .replaceAll("{{last_course_opened}}", "your courses");
}

export async function sendResourceUsageInactiveMessage(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = resourceUsageInactiveMessageBodySchema.parse(rawBody);
  let membershipIds = body.sendTestToSelf
    ? [ctx.actorMembershipId]
    : [...new Set(body.membershipIds)];

  if (membershipIds.length === 0) {
    throw inactiveMessageFailed("Select at least one learner to message.");
  }

  let excludedRecentCount = 0;
  if (!body.sendTestToSelf && body.excludeMessagedWithinDays > 0) {
    const recent = await resourceUsageRosterRepository.listRecentlyMessagedMembershipIds(
      tx,
      membershipIds,
      body.excludeMessagedWithinDays,
    );
    if (recent.length > 0) {
      const recentSet = new Set(recent);
      membershipIds = membershipIds.filter((id) => !recentSet.has(id));
      excludedRecentCount = recent.length;
    }
  }

  if (membershipIds.length === 0) {
    return resourceUsageInactiveMessageResponseSchema.parse({
      data: {
        deliveredCount: 0,
        skippedCount: 0,
        recipientCount: 0,
        excludedRecentCount,
      },
    });
  }

  const channels = body.channels;
  const wantsEmail = channels.includes("email");
  const wantsInApp = channels.includes("in_app");
  let deliveredCount = 0;
  let skippedCount = 0;

  if (wantsEmail) {
    const provider = getEmailProvider();
    if (!provider.isConfigured()) {
      throw inactiveMessageFailed(
        "Email provider is not configured. Set NOTIFICATION_EMAIL_PROVIDER=mock for local delivery.",
      );
    }

    const targets = await marketingEmailRepository.listRecipientDeliveryTargets(tx, membershipIds);
    skippedCount += membershipIds.length - targets.length;

    for (const target of targets) {
      const idempotencyKey = `reports.resource-usage.inactive.message:${ctx.requestId}:${target.membershipId}:email`;
      const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
        tenantId: ctx.tenantId,
        idempotencyKey,
      });
      if (existing) {
        skippedCount += 1;
        continue;
      }

      const learnerName = target.displayName?.trim() || "there";
      const renderedBody = renderInactiveTemplate(body.message, {
        learnerName,
        daysInactive: "several",
        enrolmentCount: "your",
      });

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
        templateKey: "reports.resource-usage.inactive.message",
        destination: target.email,
        idempotencyKey,
        status: "SENT",
        sentAt: new Date(),
        payloadJson: {
          email: { subject: body.subject, body: renderedBody },
          source: "reports.resource-usage.inactive",
        },
      });
      deliveredCount += 1;
    }
  }

  if (wantsInApp) {
    for (const membershipId of membershipIds) {
      const idempotencyKey = `reports.resource-usage.inactive.message:${ctx.requestId}:${membershipId}:in_app`;
      const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
        tenantId: ctx.tenantId,
        idempotencyKey,
      });
      if (existing) {
        skippedCount += 1;
        continue;
      }

      const renderedBody = renderInactiveTemplate(body.message, {
        learnerName: "there",
        daysInactive: "several",
        enrolmentCount: "your",
      });

      await notificationRepository.insertDispatch(tx, {
        tenantId: ctx.tenantId,
        membershipId,
        channel: "in_app",
        templateKey: "reports.resource-usage.inactive.message",
        destination: membershipId,
        idempotencyKey,
        status: "SENT",
        sentAt: new Date(),
        payloadJson: {
          inApp: { subject: body.subject, body: renderedBody },
          source: "reports.resource-usage.inactive",
        },
      });
      deliveredCount += 1;
    }
  }

  return resourceUsageInactiveMessageResponseSchema.parse({
    data: {
      deliveredCount,
      skippedCount,
      recipientCount: membershipIds.length,
      excludedRecentCount,
    },
  });
}
