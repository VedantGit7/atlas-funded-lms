import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import {
  exportProgressScoreBodySchema,
  exportProgressScoreResponseSchema,
  retryCohortMessageBodySchema,
  retryCohortMessageResponseSchema,
  sendProgressMessageBodySchema,
  sendProgressMessageResponseSchema,
  sendScoreMessageBodySchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import {
  progressScoreCohortCampaignNotFound,
  progressScoreCohortRetryFailed,
  progressScoreMessageFailed,
} from "@atlas/domain/reports/progress-score-roster.errors";
import { progressScoreCohortsRepository } from "@atlas/domain/reports/progress-score-cohorts.repository";
import {
  resolveProgressMembershipIds,
  resolveScoreMembershipIds,
} from "@atlas/domain/reports/progress-score-roster.service";
import { progressScoreRosterRepository } from "@atlas/domain/reports/progress-score-roster.repository";
import { createReportRun } from "@atlas/domain/reports/reports.service";
import { marketingEmailRepository } from "../marketing-email/marketing-email.repository";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

async function sendAudienceMessage(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    membershipIds: string[];
    subject: string;
    message: string;
    templateKey: string;
    source: string;
    audienceCaption?: string | null;
    excludeMessagedWithinDays?: number;
    productId?: string | null;
    productType?: string | null;
    productTitle?: string | null;
    assessmentId?: string | null;
    assessmentTitle?: string | null;
    campaignId?: string;
  },
) {
  const provider = getEmailProvider();
  if (!provider.isConfigured()) {
    throw progressScoreMessageFailed(
      "Email provider is not configured. Set NOTIFICATION_EMAIL_PROVIDER=mock for local delivery.",
    );
  }

  let membershipIds = [...args.membershipIds];
  let skippedCount = 0;

  if (args.excludeMessagedWithinDays && args.excludeMessagedWithinDays > 0) {
    const recent = await progressScoreCohortsRepository.listRecentlyMessagedMembershipIds(
      tx,
      membershipIds,
      args.excludeMessagedWithinDays,
    );
    if (recent.size > 0) {
      membershipIds = membershipIds.filter((id) => !recent.has(id));
      skippedCount += recent.size;
    }
  }

  const campaignId = args.campaignId ?? randomUUID();
  const sentByLabel = await progressScoreCohortsRepository.findActorDisplayName(
    tx,
    ctx.actorMembershipId,
  );
  const targets = await marketingEmailRepository.listRecipientDeliveryTargets(tx, membershipIds);
  skippedCount += membershipIds.length - targets.length;

  let deliveredCount = 0;
  let failedCount = 0;

  const basePayload = {
    campaignId,
    subject: args.subject,
    message: args.message,
    source: args.source,
    audienceCaption: args.audienceCaption ?? null,
    productId: args.productId ?? null,
    productType: args.productType ?? null,
    productTitle: args.productTitle ?? null,
    assessmentId: args.assessmentId ?? null,
    assessmentTitle: args.assessmentTitle ?? null,
    recipientCount: args.membershipIds.length,
    skippedCount,
    sentByLabel,
  };

  for (const target of targets) {
    const idempotencyKey = `${args.templateKey}:${campaignId}:${target.membershipId}`;
    const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
      tenantId: ctx.tenantId,
      idempotencyKey,
    });
    if (existing) {
      if (existing.status === "SENT") {
        skippedCount += 1;
      }
      continue;
    }

    const greeting = target.displayName?.trim() || "there";
    const renderedBody = `Hi ${greeting},\n\n${args.message}`;

    try {
      await provider.send({
        tenantId: ctx.tenantId,
        to: target.email,
        subject: args.subject,
        body: renderedBody,
        requestId: idempotencyKey,
      });

      await notificationRepository.insertDispatch(tx, {
        tenantId: ctx.tenantId,
        membershipId: target.membershipId,
        channel: "email",
        templateKey: args.templateKey,
        destination: target.email,
        idempotencyKey,
        status: "SENT",
        sentAt: new Date(),
        payloadJson: {
          ...basePayload,
          email: { subject: args.subject, body: renderedBody },
        },
      });
      deliveredCount += 1;
    } catch {
      await notificationRepository.insertDispatch(tx, {
        tenantId: ctx.tenantId,
        membershipId: target.membershipId,
        channel: "email",
        templateKey: args.templateKey,
        destination: target.email,
        idempotencyKey,
        status: "FAILED",
        payloadJson: {
          ...basePayload,
          email: { subject: args.subject, body: renderedBody },
        },
      });
      failedCount += 1;
    }
  }

  return sendProgressMessageResponseSchema.parse({
    data: {
      campaignId,
      deliveredCount,
      skippedCount,
      failedCount,
      recipientCount: args.membershipIds.length,
    },
  });
}

export async function sendProgressRosterMessage(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = sendProgressMessageBodySchema.parse(rawBody);
  const membershipIds = await resolveProgressMembershipIds(tx, body);
  const productType = body.productType;
  const productId = body.productId ?? (productType === "course" ? body.courseId : undefined);
  const productTitle =
    productId != null
      ? await progressScoreRosterRepository.findProductTitle(tx, productType, productId)
      : null;
  return sendAudienceMessage(tx, ctx, {
    membershipIds,
    subject: body.subject,
    message: body.message,
    templateKey: "reports.progress-score.progress.message",
    source: "reports.progress-score.progress",
    audienceCaption:
      body.audienceCaption ??
      `${String(membershipIds.length)} learner${membershipIds.length === 1 ? "" : "s"} from progress roster`,
    ...(body.excludeMessagedWithinDays != null
      ? { excludeMessagedWithinDays: body.excludeMessagedWithinDays }
      : {}),
    productId: productId ?? null,
    productType,
    productTitle,
  });
}

export async function sendScoreRosterMessage(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = sendScoreMessageBodySchema.parse(rawBody);
  const membershipIds = await resolveScoreMembershipIds(tx, body);
  const meta = await progressScoreRosterRepository.findAssessmentMeta(tx, body.assessmentId);
  return sendAudienceMessage(tx, ctx, {
    membershipIds,
    subject: body.subject,
    message: body.message,
    templateKey: "reports.progress-score.scores.message",
    source: "reports.progress-score.scores",
    audienceCaption:
      body.audienceCaption ??
      `${String(membershipIds.length)} learner${membershipIds.length === 1 ? "" : "s"} from score roster`,
    ...(body.excludeMessagedWithinDays != null
      ? { excludeMessagedWithinDays: body.excludeMessagedWithinDays }
      : {}),
    assessmentId: body.assessmentId,
    assessmentTitle: meta?.title ?? null,
    productId: meta?.product_id ?? null,
    productType: meta?.product_type ?? null,
    productTitle: meta?.product_title ?? null,
  });
}

export async function retryCohortMessage(
  tx: TenantTx,
  ctx: ServiceCtx,
  campaignId: string,
  rawBody: unknown,
) {
  retryCohortMessageBodySchema.parse(rawBody ?? {});
  const failedIds = await progressScoreCohortsRepository.findFailedMembershipIdsForCampaign(
    tx,
    campaignId,
  );
  if (failedIds.length === 0) {
    throw progressScoreCohortRetryFailed("No failed deliveries to retry for this campaign.");
  }
  const meta = await progressScoreCohortsRepository.findCampaignMeta(tx, campaignId);
  if (!meta?.subject || !meta.message) {
    throw progressScoreCohortCampaignNotFound();
  }

  const isScores = (meta.source ?? "").includes("scores") || Boolean(meta.assessment_id);
  const templateKey = isScores
    ? "reports.progress-score.scores.message"
    : "reports.progress-score.progress.message";
  const source = isScores ? "reports.progress-score.scores" : "reports.progress-score.progress";

  // Strip prior greeting if present so we don't double-greet on retry
  const message = meta.message.replace(/^Hi [^,\n]+,\n\n/i, "");

  const result = await sendAudienceMessage(tx, ctx, {
    membershipIds: failedIds,
    subject: meta.subject,
    message,
    templateKey,
    source,
    audienceCaption: meta.audience_caption,
    productId: meta.product_id,
    productType: meta.product_type,
    productTitle: meta.product_title,
    assessmentId: meta.assessment_id,
    assessmentTitle: meta.assessment_title,
    campaignId,
  });

  return retryCohortMessageResponseSchema.parse({
    data: {
      campaignId: result.data.campaignId,
      deliveredCount: result.data.deliveredCount,
      skippedCount: result.data.skippedCount,
      failedCount: result.data.failedCount,
      recipientCount: result.data.recipientCount,
    },
  });
}

export async function exportProgressScoreRoster(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = exportProgressScoreBodySchema.parse(rawBody);
  const params: Record<string, unknown> = {
    reportTab: body.tab,
  };
  if (body.courseId) params["courseId"] = body.courseId;
  if (body.productId) params["productId"] = body.productId;
  if (body.productType) params["productType"] = body.productType;
  if (body.assessmentId) params["assessmentId"] = body.assessmentId;
  if (body.enrolledFrom) params["enrolledFrom"] = body.enrolledFrom;
  if (body.enrolledTo) params["enrolledTo"] = body.enrolledTo;
  if (body.submittedFrom) params["submittedFrom"] = body.submittedFrom;
  if (body.submittedTo) params["submittedTo"] = body.submittedTo;
  if (body.learnerName) params["learnerName"] = body.learnerName;
  if (body.enrolledType) params["enrolledType"] = body.enrolledType;
  if (body.status) params["status"] = body.status;
  if (body.resultStatus) params["resultStatus"] = body.resultStatus;
  if (body.sortBy) params["sortBy"] = body.sortBy;
  if (body.sortDir) params["sortDir"] = body.sortDir;
  if (body.columns) params["columns"] = body.columns;

  const run = await createReportRun(tx, ctx, {
    definitionKey: "progress-score",
    format: "csv",
    params: {
      ...params,
      emailDownloadLink: body.emailDownloadLink,
    },
  });

  return exportProgressScoreResponseSchema.parse({
    data: {
      runId: run.data.id,
      status: run.data.status,
      emailed: body.emailDownloadLink,
    },
  });
}
