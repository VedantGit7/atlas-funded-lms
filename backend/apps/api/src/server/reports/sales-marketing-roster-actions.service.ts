import type { TenantTx } from "@atlas/db";
import {
  createSalesGroupBodySchema,
  exportSalesMarketingBodySchema,
  exportSalesMarketingResponseSchema,
  sendSalesMessageBodySchema,
  sendSalesMessageResponseSchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";
import { salesMarketingMessageFailed } from "@atlas/domain/reports/sales-marketing-roster.errors";
import {
  createSalesPurchaserGroup,
  resolveSalesPurchaserMembershipIds,
} from "@atlas/domain/reports/sales-marketing-roster.service";
import { createReportRun } from "@atlas/domain/reports/reports.service";
import { marketingEmailRepository } from "../marketing-email/marketing-email.repository";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function sendSalesMarketingMessage(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = sendSalesMessageBodySchema.parse(rawBody);
  const membershipIds = await resolveSalesPurchaserMembershipIds(tx, {
    ...(body.courseId ? { courseId: body.courseId } : {}),
    ...(body.couponId ? { couponId: body.couponId } : {}),
    ...(body.membershipIds ? { membershipIds: body.membershipIds } : {}),
    ...(body.learnerName ? { learnerName: body.learnerName } : {}),
    ...(body.email ? { email: body.email } : {}),
    ...(body.q ? { q: body.q } : {}),
    ...(body.enrolledType ? { enrolledType: body.enrolledType } : {}),
    ...(body.purchasedFrom ? { purchasedFrom: body.purchasedFrom } : {}),
    ...(body.purchasedTo ? { purchasedTo: body.purchasedTo } : {}),
    ...(body.appliedFrom ? { appliedFrom: body.appliedFrom } : {}),
    ...(body.appliedTo ? { appliedTo: body.appliedTo } : {}),
    ...(body.courseFilterId ? { courseFilterId: body.courseFilterId } : {}),
  });

  const provider = getEmailProvider();
  if (!provider.isConfigured()) {
    throw salesMarketingMessageFailed(
      "Email provider is not configured. Set NOTIFICATION_EMAIL_PROVIDER=mock for local delivery.",
    );
  }

  const targets = await marketingEmailRepository.listRecipientDeliveryTargets(tx, membershipIds);
  let deliveredCount = 0;
  let skippedCount = membershipIds.length - targets.length;

  for (const target of targets) {
    const idempotencyKey = `reports.sales-marketing.message:${ctx.requestId}:${target.membershipId}`;
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
      templateKey: "reports.sales-marketing.message",
      destination: target.email,
      idempotencyKey,
      status: "SENT",
      payloadJson: {
        email: { subject: body.subject, body: renderedBody },
        source: "reports.sales-marketing",
      },
    });
    deliveredCount += 1;
  }

  return sendSalesMessageResponseSchema.parse({
    data: {
      deliveredCount,
      skippedCount,
      recipientCount: membershipIds.length,
    },
  });
}

export async function createSalesMarketingGroup(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createSalesGroupBodySchema.parse(rawBody);
  return createSalesPurchaserGroup(tx, ctx, {
    ...(body.courseId ? { courseId: body.courseId } : {}),
    ...(body.couponId ? { couponId: body.couponId } : {}),
    title: body.title,
    ...(body.description ? { description: body.description } : {}),
    ...(body.membershipIds ? { membershipIds: body.membershipIds } : {}),
    ...(body.learnerName ? { learnerName: body.learnerName } : {}),
    ...(body.email ? { email: body.email } : {}),
    ...(body.q ? { q: body.q } : {}),
    ...(body.enrolledType ? { enrolledType: body.enrolledType } : {}),
    ...(body.purchasedFrom ? { purchasedFrom: body.purchasedFrom } : {}),
    ...(body.purchasedTo ? { purchasedTo: body.purchasedTo } : {}),
    ...(body.appliedFrom ? { appliedFrom: body.appliedFrom } : {}),
    ...(body.appliedTo ? { appliedTo: body.appliedTo } : {}),
    ...(body.courseFilterId ? { courseFilterId: body.courseFilterId } : {}),
  });
}

export async function exportSalesMarketingRoster(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = exportSalesMarketingBodySchema.parse(rawBody);
  const params: Record<string, unknown> = { section: body.section };
  if (body.courseId) params["courseId"] = body.courseId;
  if (body.couponId) params["couponId"] = body.couponId;
  if (body.q) params["q"] = body.q;
  if (body.learnerName) params["learnerName"] = body.learnerName;
  if (body.email) params["email"] = body.email;
  if (body.purchasedFrom) params["purchasedFrom"] = body.purchasedFrom;
  if (body.purchasedTo) params["purchasedTo"] = body.purchasedTo;
  if (body.columns) params["columns"] = body.columns;

  const run = await createReportRun(tx, ctx, {
    definitionKey: "sales-marketing",
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
        subject: "Your Sales & Marketing export is ready",
        body: [
          "Your Sales & Marketing report export has been queued.",
          "",
          `Section: ${body.section}`,
          `Run ID: ${run.data.id}`,
          "Open Reports → Exports once processing completes.",
        ].join("\n"),
        requestId: `reports.sales-marketing.export:${run.data.id}`,
      });
      emailed = true;
    }
  }

  return exportSalesMarketingResponseSchema.parse({
    data: {
      runId: run.data.id,
      status: run.data.status,
      emailed,
    },
  });
}
