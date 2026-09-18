import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";
import { readTenantEmailChannel } from "../tenant-settings/tenant-settings.service";
import {
  composeMarketingEmailBodySchema,
  createMarketingEmailCampaignBodySchema,
  deleteMarketingEmailBodySchema,
  deleteMarketingEmailResponseSchema,
  marketingEmailCampaignResponseSchema,
  marketingEmailCampaignsListQuerySchema,
  marketingEmailCampaignsListResponseSchema,
  marketingEmailCampaignsSummaryResponseSchema,
  marketingEmailRecipientsResponseSchema,
  marketingEmailTemplatesResponseSchema,
  sendMarketingEmailBodySchema,
  sendMarketingEmailResponseSchema,
  setMarketingEmailAudienceBodySchema,
  spamCheckBodySchema,
  spamCheckResponseSchema,
  updateMarketingEmailCampaignTitleBodySchema,
} from "./marketing-email.schemas";
import {
  marketingEmailRepository,
  type MarketingEmailCampaignRow,
} from "./marketing-email.repository";
import {
  detectMarketingEmailSpam,
  MARKETING_EMAIL_TEMPLATES,
  renderMarketingEmailBody,
} from "./marketing-email.templates";

function notFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Marketing email campaign not found.",
  });
}

function validationError(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

function toDto(row: MarketingEmailCampaignRow) {
  return {
    id: row.id,
    title: row.title,
    status: row.status as "DRAFT" | "SCHEDULED" | "SENT",
    audienceType: (row.audience_type as "ALL" | "GROUP" | null) ?? null,
    audienceBatchId: row.audience_batch_id,
    audienceLabel:
      row.audience_type === "ALL"
        ? "All learners"
        : row.audience_batch_name
          ? `Group: ${row.audience_batch_name}`
          : row.audience_type === "GROUP"
            ? "Group"
            : null,
    subject: row.subject,
    bodyHtml: row.body_html,
    templateKey: row.template_key,
    recipientCount: row.recipient_count,
    scheduledAt: row.scheduled_at?.toISOString() ?? null,
    sentAt: row.sent_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function requireCampaign(tx: TenantTx, id: string) {
  const row = await marketingEmailRepository.findById(tx, id);
  if (!row) throw notFound();
  return row;
}

async function resolveRecipientIds(
  tx: TenantTx,
  row: MarketingEmailCampaignRow,
): Promise<string[]> {
  if (!row.audience_type) {
    throw validationError("Select recipients before sending.");
  }
  if (row.audience_type === "GROUP") {
    if (!row.audience_batch_id) {
      throw validationError("Group audience is missing a batch.");
    }
    return marketingEmailRepository.listBatchMembershipIds(tx, row.audience_batch_id);
  }
  return marketingEmailRepository.listActiveMembershipIds(tx);
}

async function requireSenderChannel(tx: TenantTx) {
  const channel = await readTenantEmailChannel(tx, "marketingEmail");
  const fromEmail = channel.fromEmail.trim();
  const fromName = channel.fromName.trim();
  const provider = getEmailProvider();
  if ((!fromEmail || !fromName) && !provider.isConfigured()) {
    throw validationError(
      "Configure Marketing Email channel settings (From name and From email) before sending.",
    );
  }
  if (!fromEmail || !fromName) {
    // Allow local/mock delivery with safe defaults when channel settings are empty.
    return {
      fromName: fromName || "Academy",
      fromEmail: fromEmail || "noreply@localhost.test",
      replyToEmail: channel.replyToEmail,
    };
  }
  return channel;
}

async function deliverCampaign(
  tx: TenantTx,
  ctx: ServiceCtx,
  row: MarketingEmailCampaignRow,
): Promise<{ deliveredCount: number; skippedCount: number }> {
  if (!row.subject?.trim() || !row.body_html?.trim()) {
    throw validationError("Compose subject and email body before sending.");
  }

  const provider = getEmailProvider();
  if (!provider.isConfigured()) {
    throw validationError(
      "Email provider is not configured. Set NOTIFICATION_EMAIL_PROVIDER=mock for local delivery.",
    );
  }

  const channel = await requireSenderChannel(tx);
  const membershipIds = await resolveRecipientIds(tx, row);
  const targets = await marketingEmailRepository.listRecipientDeliveryTargets(tx, membershipIds);

  let deliveredCount = 0;
  let skippedCount = membershipIds.length - targets.length;

  for (const target of targets) {
    const idempotencyKey = `marketing.email_campaign:${row.id}:${target.membershipId}`;
    const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
      tenantId: ctx.tenantId,
      idempotencyKey,
    });
    if (existing) {
      skippedCount += 1;
      continue;
    }

    const renderedBody = renderMarketingEmailBody(row.body_html, {
      learnerName: target.displayName?.trim() || "there",
    });

    try {
      await provider.send({
        to: target.email,
        subject: row.subject,
        body: renderedBody,
        requestId: idempotencyKey,
        fromName: channel.fromName,
        fromEmail: channel.fromEmail,
        replyToEmail: channel.replyToEmail,
      });

      await notificationRepository.insertDispatch(tx, {
        tenantId: ctx.tenantId,
        membershipId: target.membershipId,
        channel: "email",
        templateKey: "marketing.email_campaign",
        destination: target.email,
        idempotencyKey,
        status: "SENT",
        payloadJson: {
          email: {
            subject: row.subject,
            body: renderedBody,
            fromName: channel.fromName,
            fromEmail: channel.fromEmail,
            replyToEmail: channel.replyToEmail,
            campaignId: row.id,
          },
        },
        sentAt: new Date(),
      });
      deliveredCount += 1;
    } catch {
      await notificationRepository.insertDispatch(tx, {
        tenantId: ctx.tenantId,
        membershipId: target.membershipId,
        channel: "email",
        templateKey: "marketing.email_campaign",
        destination: target.email,
        idempotencyKey,
        status: "FAILED",
        payloadJson: {
          email: {
            subject: row.subject,
            body: renderedBody,
            campaignId: row.id,
          },
        },
      });
      skippedCount += 1;
    }
  }

  await marketingEmailRepository.markSent(tx, row.id, deliveredCount);
  return { deliveredCount, skippedCount };
}

export async function processDueScheduledMarketingEmails(tx: TenantTx, ctx: ServiceCtx) {
  const due = await marketingEmailRepository.listDueScheduled(tx);
  for (const row of due) {
    await deliverCampaign(tx, ctx, row);
  }
}

export async function listMarketingEmailCampaigns(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawQuery: unknown,
) {
  await processDueScheduledMarketingEmails(tx, ctx);
  const query = marketingEmailCampaignsListQuerySchema.parse(rawQuery ?? {});
  const listArgs = {
    status: query.status,
    ...(query.q ? { q: query.q } : {}),
    ...(query.createdOn ? { createdOn: query.createdOn } : {}),
    limit: query.limit,
    offset: query.offset,
  };
  const [rows, total] = await Promise.all([
    marketingEmailRepository.list(tx, listArgs),
    marketingEmailRepository.count(tx, listArgs),
  ]);
  return marketingEmailCampaignsListResponseSchema.parse({
    data: { items: rows.map(toDto), total },
  });
}

export async function getMarketingEmailCampaignsSummary(tx: TenantTx, ctx: ServiceCtx) {
  await processDueScheduledMarketingEmails(tx, ctx);
  const summary = await marketingEmailRepository.summary(tx);
  const reachTrendPercent =
    summary.reach_prev_30d <= 0
      ? summary.reach_30d > 0
        ? 100
        : null
      : Math.round(((summary.reach_30d - summary.reach_prev_30d) / summary.reach_prev_30d) * 100);

  return marketingEmailCampaignsSummaryResponseSchema.parse({
    data: {
      draftCount: summary.draft_count,
      scheduledCount: summary.scheduled_count,
      sentCount: summary.sent_count,
      totalReach: summary.total_reach,
      reach30d: summary.reach_30d,
      reachTrendPercent,
      campaignCount: summary.campaign_count,
    },
  });
}

export async function getMarketingEmailCampaign(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const row = await requireCampaign(tx, id);
  return marketingEmailCampaignResponseSchema.parse({ data: toDto(row) });
}

export async function createMarketingEmailCampaign(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = createMarketingEmailCampaignBodySchema.parse(rawBody);
  const id = await marketingEmailRepository.insertDraft(tx, {
    title: body.title,
    createdByMembershipId: ctx.actorMembershipId,
  });
  const row = await requireCampaign(tx, id);
  return marketingEmailCampaignResponseSchema.parse({ data: toDto(row) });
}

export async function updateMarketingEmailCampaignTitle(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateMarketingEmailCampaignTitleBodySchema.parse(rawBody);
  await requireCampaign(tx, id);
  await marketingEmailRepository.updateTitle(tx, id, body.title);
  const row = await requireCampaign(tx, id);
  return marketingEmailCampaignResponseSchema.parse({ data: toDto(row) });
}

export async function setMarketingEmailAudience(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = setMarketingEmailAudienceBodySchema.parse(rawBody);
  const existing = await requireCampaign(tx, id);
  if (existing.status !== "DRAFT") {
    throw validationError("Recipients can only be set while the campaign is a draft.");
  }
  if (existing.audience_type) {
    throw validationError("Recipients cannot be changed once selected.");
  }

  let audienceBatchId: string | null = null;
  if (body.audienceType === "GROUP") {
    audienceBatchId = body.audienceBatchId ?? null;
    if (!audienceBatchId || !(await marketingEmailRepository.batchExists(tx, audienceBatchId))) {
      throw validationError("Selected group was not found.");
    }
  }

  const preview = await marketingEmailRepository.previewRecipients(tx, {
    audienceType: body.audienceType,
    audienceBatchId,
  });

  await marketingEmailRepository.updateAudience(tx, {
    id: existing.id,
    audienceType: body.audienceType,
    audienceBatchId,
    recipientCount: preview.totalCount,
  });

  const row = await requireCampaign(tx, id);
  return marketingEmailCampaignResponseSchema.parse({ data: toDto(row) });
}

export async function listMarketingEmailRecipients(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const existing = await requireCampaign(tx, id);
  if (!existing.audience_type) {
    return marketingEmailRecipientsResponseSchema.parse({
      data: { totalCount: 0, items: [] },
    });
  }

  const preview = await marketingEmailRepository.previewRecipients(tx, {
    audienceType: existing.audience_type,
    audienceBatchId: existing.audience_batch_id,
    limit: 100,
  });

  return marketingEmailRecipientsResponseSchema.parse({
    data: {
      totalCount: preview.totalCount,
      items: preview.items.map((item) => ({
        membershipId: item.membership_id,
        displayName: item.display_name,
        email: item.email,
      })),
    },
  });
}

export async function composeMarketingEmail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = composeMarketingEmailBodySchema.parse(rawBody);
  const existing = await requireCampaign(tx, id);
  if (!existing.audience_type) {
    throw validationError("Select recipients before composing the email.");
  }
  if (existing.status === "SENT") {
    throw validationError("Sent campaigns cannot be edited.");
  }

  await marketingEmailRepository.updateCompose(tx, {
    id: existing.id,
    subject: body.subject,
    bodyHtml: body.bodyHtml,
    templateKey: body.templateKey?.trim() || null,
  });

  const row = await requireCampaign(tx, id);
  return marketingEmailCampaignResponseSchema.parse({ data: toDto(row) });
}

export function listMarketingEmailTemplates() {
  return marketingEmailTemplatesResponseSchema.parse({
    data: { items: MARKETING_EMAIL_TEMPLATES.map((t) => ({ ...t })) },
  });
}

export function checkMarketingEmailSpam(_tx: TenantTx, rawBody: unknown) {
  const body = spamCheckBodySchema.parse(rawBody);
  const result = detectMarketingEmailSpam(body.subject, body.bodyHtml);
  return spamCheckResponseSchema.parse({ data: result });
}

export async function sendMarketingEmail(
  tx: TenantTx,
  ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  await processDueScheduledMarketingEmails(tx, ctx);
  const body = sendMarketingEmailBodySchema.parse(rawBody);
  const existing = await requireCampaign(tx, id);

  if (body.mode !== "test" && existing.status === "SENT") {
    throw validationError("This campaign has already been sent.");
  }
  if (!existing.audience_type && body.mode !== "test") {
    throw validationError("Select recipients before sending.");
  }
  if (!existing.subject || !existing.body_html) {
    throw validationError("Compose the email before sending.");
  }

  const spam = detectMarketingEmailSpam(existing.subject, existing.body_html);
  if (spam.spamDetected && !body.acknowledgeSpam && body.mode !== "test") {
    return sendMarketingEmailResponseSchema.parse({
      data: {
        ...toDto(existing),
        spamDetected: true,
        spamWords: spam.spamWords,
        deliveredCount: 0,
        skippedCount: 0,
      },
    });
  }

  if (body.mode === "test") {
    const provider = getEmailProvider();
    if (!provider.isConfigured()) {
      throw validationError(
        "Email provider is not configured. Set NOTIFICATION_EMAIL_PROVIDER=mock for local delivery.",
      );
    }
    const channel = await requireSenderChannel(tx);
    const testEmail = body.testEmail;
    if (!testEmail) throw validationError("A test email address is required in test mode.");
    const renderedBody = renderMarketingEmailBody(existing.body_html, {
      learnerName: "there",
    });
    await provider.send({
      to: testEmail,
      subject: `[TEST] ${existing.subject}`,
      body: renderedBody,
      requestId: `marketing.email_campaign.test:${existing.id}:${Date.now()}`,
      fromName: channel.fromName,
      fromEmail: channel.fromEmail,
      replyToEmail: channel.replyToEmail,
    });
    return sendMarketingEmailResponseSchema.parse({
      data: {
        ...toDto(existing),
        deliveredCount: 1,
        skippedCount: 0,
        spamDetected: spam.spamDetected,
        spamWords: spam.spamWords,
      },
    });
  }

  if (body.mode === "schedule") {
    if (!body.scheduledAt) throw validationError("A schedule time is required in schedule mode.");
    const scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      throw validationError("Schedule time must be in the future.");
    }
    await marketingEmailRepository.markScheduled(tx, existing.id, scheduledAt);
    const row = await requireCampaign(tx, id);
    return sendMarketingEmailResponseSchema.parse({
      data: { ...toDto(row), spamDetected: false, spamWords: [] },
    });
  }

  const result = await deliverCampaign(tx, ctx, existing);
  const row = await requireCampaign(tx, id);
  return sendMarketingEmailResponseSchema.parse({
    data: {
      ...toDto(row),
      deliveredCount: result.deliveredCount,
      skippedCount: result.skippedCount,
      spamDetected: false,
      spamWords: [],
    },
  });
}

export async function deleteMarketingEmailCampaign(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = deleteMarketingEmailBodySchema.parse(rawBody);
  const existing = await requireCampaign(tx, id);
  if (body.titleConfirmation !== existing.title) {
    throw validationError("Title confirmation does not match.");
  }
  const deleted = await marketingEmailRepository.deleteById(tx, existing.id);
  if (!deleted) throw notFound();
  return deleteMarketingEmailResponseSchema.parse({
    data: { id: existing.id, deleted: true },
  });
}
