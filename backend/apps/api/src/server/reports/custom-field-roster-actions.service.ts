import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import {
  createCustomFieldGroupBodySchema,
  exportCustomFieldRosterBodySchema,
  exportCustomFieldRosterResponseSchema,
  retryCustomFieldCohortMessageBodySchema,
  retryCustomFieldCohortMessageResponseSchema,
  sendCustomFieldMessageBodySchema,
  sendCustomFieldMessageResponseSchema,
} from "@atlas/domain/reports/custom-field-roster.dto";
import {
  customFieldCohortCampaignNotFound,
  customFieldCohortRetryFailed,
  customFieldRosterMessageFailed,
} from "@atlas/domain/reports/custom-field-roster.errors";
import { customFieldCohortsRepository } from "@atlas/domain/reports/custom-field-cohorts.repository";
import {
  createCustomFieldLearnerGroup,
  resolveCustomFieldMembershipIds,
} from "@atlas/domain/reports/custom-field-roster.service";
import {
  customFieldSegmentEmptyAudience,
  customFieldSegmentNotFound,
} from "@atlas/domain/reports/custom-field-segments.errors";
import { customFieldSegmentsRepository } from "@atlas/domain/reports/custom-field-segments.repository";
import { segmentConditionsTreeSchema } from "@atlas/domain/reports/custom-field-segments.dto";
import { createReportRun } from "@atlas/domain/reports/reports.service";
import { marketingEmailRepository } from "../marketing-email/marketing-email.repository";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

async function resolveAudienceMembershipIds(
  tx: TenantTx,
  ctx: ServiceCtx,
  body: {
    membershipIds?: string[];
    q?: string;
    email?: string;
    status?: string;
    signedUpFrom?: string;
    signedUpTo?: string;
    minTotalSpentCents?: number;
    maxTotalSpentCents?: number;
    segmentId?: string;
  },
): Promise<string[]> {
  if (body.segmentId) {
    const existing = await customFieldSegmentsRepository.getSegment(
      tx,
      body.segmentId,
      ctx.actorMembershipId,
    );
    if (!existing) throw customFieldSegmentNotFound();
    const fieldTypes = await customFieldSegmentsRepository.listFieldTypes(tx);
    const conditions = segmentConditionsTreeSchema.parse(existing.conditions_json);
    const membershipIds = await customFieldSegmentsRepository.listMatchingMembershipIds(
      tx,
      conditions,
      fieldTypes,
    );
    if (membershipIds.length === 0) throw customFieldSegmentEmptyAudience();
    return membershipIds;
  }
  return resolveCustomFieldMembershipIds(tx, {
    ...(body.membershipIds ? { membershipIds: body.membershipIds } : {}),
    ...(body.q ? { q: body.q } : {}),
    ...(body.email ? { email: body.email } : {}),
    ...(body.status ? { status: body.status } : {}),
    ...(body.signedUpFrom ? { signedUpFrom: body.signedUpFrom } : {}),
    ...(body.signedUpTo ? { signedUpTo: body.signedUpTo } : {}),
    ...(body.minTotalSpentCents != null
      ? { minTotalSpentCents: body.minTotalSpentCents }
      : {}),
    ...(body.maxTotalSpentCents != null
      ? { maxTotalSpentCents: body.maxTotalSpentCents }
      : {}),
  });
}

async function sendCustomFieldAudienceMessage(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    membershipIds: string[];
    subject: string;
    message: string;
    audienceCaption?: string | null;
    excludeMessagedWithinDays?: number;
    segmentId?: string | null;
    segmentName?: string | null;
    campaignId?: string;
  },
) {
  const provider = getEmailProvider();
  if (!provider.isConfigured()) {
    throw customFieldRosterMessageFailed(
      "Email provider is not configured. Set NOTIFICATION_EMAIL_PROVIDER=mock for local delivery.",
    );
  }

  let membershipIds = [...args.membershipIds];
  let skippedCount = 0;

  if (args.excludeMessagedWithinDays && args.excludeMessagedWithinDays > 0) {
    const recent = await customFieldCohortsRepository.listRecentlyMessagedMembershipIds(
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
  const sentByLabel = await customFieldCohortsRepository.findActorDisplayName(
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
    source: "reports.custom-field",
    audienceCaption:
      args.audienceCaption ??
      `${args.membershipIds.length} learner${args.membershipIds.length === 1 ? "" : "s"} from custom field report`,
    segmentId: args.segmentId ?? null,
    segmentName: args.segmentName ?? null,
    recipientCount: args.membershipIds.length,
    skippedCount,
    sentByLabel,
  };

  for (const target of targets) {
    const idempotencyKey = `reports.custom-field.message:${campaignId}:${target.membershipId}`;
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
        to: target.email,
        subject: args.subject,
        body: renderedBody,
        requestId: idempotencyKey,
      });

      await notificationRepository.insertDispatch(tx, {
        tenantId: ctx.tenantId,
        membershipId: target.membershipId,
        channel: "email",
        templateKey: "reports.custom-field.message",
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
        templateKey: "reports.custom-field.message",
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

  return sendCustomFieldMessageResponseSchema.parse({
    data: {
      campaignId,
      deliveredCount,
      skippedCount,
      failedCount,
      recipientCount: args.membershipIds.length,
    },
  });
}

export async function sendCustomFieldRosterMessage(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = sendCustomFieldMessageBodySchema.parse(rawBody);
  const membershipIds = await resolveAudienceMembershipIds(tx, ctx, body);

  return sendCustomFieldAudienceMessage(tx, ctx, {
    membershipIds,
    subject: body.subject,
    message: body.message,
    audienceCaption: body.audienceCaption ?? null,
    ...(body.excludeMessagedWithinDays != null
      ? { excludeMessagedWithinDays: body.excludeMessagedWithinDays }
      : {}),
    segmentId: body.segmentId ?? null,
    segmentName: body.segmentName ?? null,
  });
}

export async function retryCustomFieldCohortMessage(
  tx: TenantTx,
  ctx: ServiceCtx,
  campaignId: string,
  rawBody: unknown,
) {
  retryCustomFieldCohortMessageBodySchema.parse(rawBody ?? {});
  const failedIds = await customFieldCohortsRepository.findFailedMembershipIdsForCampaign(
    tx,
    campaignId,
  );
  if (failedIds.length === 0) {
    throw customFieldCohortRetryFailed("No failed deliveries to retry for this campaign.");
  }
  const meta = await customFieldCohortsRepository.findCampaignMeta(tx, campaignId);
  if (!meta?.subject || !meta.message) {
    throw customFieldCohortCampaignNotFound();
  }

  const message = meta.message.replace(/^Hi [^,\n]+,\n\n/i, "");

  return sendCustomFieldAudienceMessage(tx, ctx, {
    membershipIds: failedIds,
    subject: meta.subject,
    message,
    audienceCaption: meta.audience_caption,
    segmentId: meta.segment_id,
    segmentName: meta.segment_name,
    campaignId,
  });
}

export async function createCustomFieldRosterGroup(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = createCustomFieldGroupBodySchema.parse(rawBody);
  return createCustomFieldLearnerGroup(tx, ctx, {
    title: body.title,
    ...(body.description ? { description: body.description } : {}),
    ...(body.syncType ? { syncType: body.syncType } : {}),
    ...(body.criteriaSummary ? { criteriaSummary: body.criteriaSummary } : {}),
    ...(body.membershipIds ? { membershipIds: body.membershipIds } : {}),
    ...(body.q ? { q: body.q } : {}),
    ...(body.email ? { email: body.email } : {}),
    ...(body.status ? { status: body.status } : {}),
    ...(body.signedUpFrom ? { signedUpFrom: body.signedUpFrom } : {}),
    ...(body.signedUpTo ? { signedUpTo: body.signedUpTo } : {}),
    ...(body.minTotalSpentCents != null
      ? { minTotalSpentCents: body.minTotalSpentCents }
      : {}),
    ...(body.maxTotalSpentCents != null
      ? { maxTotalSpentCents: body.maxTotalSpentCents }
      : {}),
  });
}

export async function exportCustomFieldRoster(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = exportCustomFieldRosterBodySchema.parse(rawBody);
  const params: Record<string, unknown> = {};
  if (body.q) params["q"] = body.q;
  if (body.email) params["email"] = body.email;
  if (body.status) params["status"] = body.status;
  if (body.signedUpFrom) params["signedUpFrom"] = body.signedUpFrom;
  if (body.signedUpTo) params["signedUpTo"] = body.signedUpTo;
  if (body.minTotalSpentCents != null) params["minTotalSpentCents"] = body.minTotalSpentCents;
  if (body.maxTotalSpentCents != null) params["maxTotalSpentCents"] = body.maxTotalSpentCents;
  if (body.columns) params["columns"] = body.columns;

  const run = await createReportRun(tx, ctx, {
    definitionKey: "custom-field",
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
        subject: "Your Custom Field learners export is ready",
        body: [
          "Your Custom Field (Learners) report export has been queued.",
          "",
          `Run ID: ${run.data.id}`,
          "Open Reports → Exports once processing completes.",
        ].join("\n"),
        requestId: `reports.custom-field.export:${run.data.id}`,
      });
      emailed = true;
    }
  }

  return exportCustomFieldRosterResponseSchema.parse({
    data: {
      runId: run.data.id,
      status: run.data.status,
      emailed,
    },
  });
}
