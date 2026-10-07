import { AtlasHttpError } from "@atlas/core/http/errors";
import { toPlainText } from "@atlas/core/text/safe-text";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { createAndSendAnnouncement } from "../announcements/announcements.service";
import {
  composeMarketingEmail,
  createMarketingEmailCampaign,
  sendMarketingEmail,
  setMarketingEmailAudience,
} from "../marketing-email/marketing-email.service";
import { marketingEmailRepository } from "../marketing-email/marketing-email.repository";
import {
  composePushMessage,
  createPushMessage,
  sendPushMessage,
  setPushMessageAudience,
} from "../push-messages/push-messages.service";
import { pushMessagesRepository } from "../push-messages/push-messages.repository";
import {
  CAMPAIGN_GOALS,
  campaignChannelsSchema,
  campaignTouchpointSchema,
  createMarketingCampaignBodySchema,
  deleteMarketingCampaignBodySchema,
  deleteMarketingCampaignResponseSchema,
  launchMarketingCampaignBodySchema,
  marketingCampaignAnalyticsResponseSchema,
  marketingCampaignAudienceEstimateQuerySchema,
  marketingCampaignAudienceEstimateResponseSchema,
  marketingCampaignResponseSchema,
  marketingCampaignsListQuerySchema,
  marketingCampaignsListResponseSchema,
  setMarketingCampaignAudienceBodySchema,
  updateMarketingCampaignIdentityBodySchema,
  updateMarketingCampaignTouchpointsBodySchema,
} from "./marketing-campaigns.schemas";
import {
  marketingCampaignsRepository,
  type CampaignChannels,
  type CampaignTouchpoint,
  type MarketingCampaignRow,
} from "./marketing-campaigns.repository";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

type Touchpoint = CampaignTouchpoint;

function validationError(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

function notFoundError(message: string) {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message,
  });
}

function parseChannels(raw: unknown): CampaignChannels {
  const parsed = campaignChannelsSchema.safeParse(raw ?? {});
  return parsed.success
    ? parsed.data
    : { email: false, push: false, announcement: false, whatsapp: false };
}

function parseTouchpoints(raw: unknown): CampaignTouchpoint[] {
  if (!Array.isArray(raw)) return [];
  const items: CampaignTouchpoint[] = [];
  for (const entry of raw) {
    const parsed = campaignTouchpointSchema.safeParse(entry);
    if (parsed.success) items.push(parsed.data);
  }
  return items;
}

function parseGoal(value: string | null) {
  if (!value) return null;
  return (CAMPAIGN_GOALS as readonly string[]).includes(value)
    ? (value as (typeof CAMPAIGN_GOALS)[number])
    : null;
}

function toDto(row: MarketingCampaignRow) {
  return {
    id: row.id,
    title: row.title,
    goal: parseGoal(row.goal),
    status: row.status as "DRAFT" | "SCHEDULED" | "SENT",
    audienceType: (row.audience_type as "ALL" | "GROUP" | null) ?? null,
    audienceBatchId: row.audience_batch_id,
    audienceLabel: row.audience_label,
    recipientCount: row.recipient_count,
    channels: parseChannels(row.channels_json),
    touchpoints: parseTouchpoints(row.touchpoints_json),
    launchedAt: row.launched_at?.toISOString() ?? null,
    scheduledAt: row.scheduled_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function requireCampaign(tx: TenantTx, id: string) {
  const row = await marketingCampaignsRepository.findById(tx, id);
  if (!row) throw notFoundError("Campaign not found.");
  return row;
}

function defaultBodyForGoal(goal: string | null, channel: string): string {
  const label = goal?.toLowerCase() ?? "engagement";
  if (channel === "email") {
    return `<p>Hello,</p><p>We prepared this ${label} message for you. Open your academy to continue learning.</p>`;
  }
  return `A new ${label} update is waiting for you in the academy.`;
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function listMarketingCampaigns(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = marketingCampaignsListQuerySchema.parse(rawQuery ?? {});
  const [items, summary] = await Promise.all([
    marketingCampaignsRepository.list(tx, {
      status: query.status,
      q: query.q,
      limit: query.limit,
      offset: query.offset,
    }),
    marketingCampaignsRepository.summary(tx),
  ]);
  return marketingCampaignsListResponseSchema.parse({
    data: {
      items: items.map(toDto),
      summary: {
        draftCount: summary.draft_count,
        scheduledCount: summary.scheduled_count,
        sentCount: summary.sent_count,
        totalCount: summary.total_count,
        totalReach: summary.total_reach,
      },
    },
  });
}

export async function getMarketingCampaign(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const row = await requireCampaign(tx, id);
  return marketingCampaignResponseSchema.parse({ data: toDto(row) });
}

export async function createMarketingCampaign(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createMarketingCampaignBodySchema.parse(rawBody);
  const id = await marketingCampaignsRepository.insertDraft(tx, {
    title: body.title,
    goal: body.goal ?? null,
    createdByMembershipId: ctx.actorMembershipId,
  });
  const row = await requireCampaign(tx, id);
  return marketingCampaignResponseSchema.parse({ data: toDto(row) });
}

export async function updateMarketingCampaignIdentity(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateMarketingCampaignIdentityBodySchema.parse(rawBody);
  const existing = await requireCampaign(tx, id);
  if (existing.status !== "DRAFT") {
    throw validationError("Identity can only be edited while the campaign is a draft.");
  }
  await marketingCampaignsRepository.updateIdentity(tx, id, {
    title: body.title,
    goal: body.goal,
  });
  const row = await requireCampaign(tx, id);
  return marketingCampaignResponseSchema.parse({ data: toDto(row) });
}

export async function setMarketingCampaignAudience(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = setMarketingCampaignAudienceBodySchema.parse(rawBody);
  const existing = await requireCampaign(tx, id);
  if (existing.status !== "DRAFT") {
    throw validationError("Audience can only be set while the campaign is a draft.");
  }

  let audienceBatchId: string | null = null;
  if (body.audienceType === "GROUP") {
    audienceBatchId = body.audienceBatchId ?? null;
    if (
      !audienceBatchId ||
      !(await marketingCampaignsRepository.batchExists(tx, audienceBatchId))
    ) {
      throw validationError("Selected group was not found.");
    }
  }

  const preview = await marketingCampaignsRepository.previewRecipients(tx, {
    audienceType: body.audienceType,
    audienceBatchId,
  });

  await marketingCampaignsRepository.updateAudience(tx, id, {
    audienceType: body.audienceType,
    audienceBatchId,
    recipientCount: preview.totalCount,
  });

  const row = await requireCampaign(tx, id);
  return marketingCampaignResponseSchema.parse({ data: toDto(row) });
}

export async function updateMarketingCampaignTouchpoints(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateMarketingCampaignTouchpointsBodySchema.parse(rawBody);
  const existing = await requireCampaign(tx, id);
  if (existing.status !== "DRAFT") {
    throw validationError("Touchpoints can only be edited while the campaign is a draft.");
  }

  const enabled = body.channels;
  if (!enabled.email && !enabled.push && !enabled.announcement && !enabled.whatsapp) {
    throw validationError("Select at least one channel.");
  }

  for (const point of body.touchpoints) {
    if (!enabled[point.channel]) {
      throw validationError(
        `Touchpoint "${point.title}" uses ${point.channel}, which is not enabled.`,
      );
    }
  }

  await marketingCampaignsRepository.updateTouchpoints(tx, id, {
    channels: body.channels,
    touchpoints: body.touchpoints,
  });
  const row = await requireCampaign(tx, id);
  return marketingCampaignResponseSchema.parse({ data: toDto(row) });
}

export async function estimateMarketingCampaignAudience(
  tx: TenantTx,
  _ctx: ServiceCtx,
  rawQuery: unknown,
) {
  const query = marketingCampaignAudienceEstimateQuerySchema.parse(rawQuery ?? {});
  let audienceBatchId: string | null = null;
  if (query.audienceType === "GROUP") {
    audienceBatchId = query.audienceBatchId ?? null;
    if (
      !audienceBatchId ||
      !(await marketingCampaignsRepository.batchExists(tx, audienceBatchId))
    ) {
      throw validationError("Selected group was not found.");
    }
  }
  const preview = await marketingCampaignsRepository.previewRecipients(tx, {
    audienceType: query.audienceType,
    audienceBatchId,
  });
  return marketingCampaignAudienceEstimateResponseSchema.parse({
    data: {
      audienceType: query.audienceType,
      audienceBatchId,
      totalCount: preview.totalCount,
    },
  });
}

export async function launchMarketingCampaign(
  tx: TenantTx,
  ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = launchMarketingCampaignBodySchema.parse(rawBody);
  const existing = await requireCampaign(tx, id);
  if (existing.status !== "DRAFT") {
    throw validationError("Only draft campaigns can be launched.");
  }
  const dto = toDto(existing);
  if (!dto.goal) throw validationError("Set a campaign goal before launch.");
  if (!dto.audienceType) throw validationError("Set an audience before launch.");
  if (dto.touchpoints.length === 0) {
    throw validationError("Add at least one touchpoint before launch.");
  }

  const launchBase = body.mode === "schedule" ? new Date(defined(body.scheduledAt)) : new Date();
  if (
    Number.isNaN(launchBase.getTime()) ||
    (body.mode === "schedule" && launchBase.getTime() <= Date.now())
  ) {
    throw validationError("scheduledAt must be a future date.");
  }

  const nextTouchpoints: Touchpoint[] = [];
  let anyScheduled = body.mode === "schedule";
  let anySent = false;

  for (const point of dto.touchpoints) {
    const when = addDays(launchBase, point.delayDays);
    const sendNow = when.getTime() <= Date.now() + 5_000;
    if (!sendNow) anyScheduled = true;

    const subject = point.subject?.trim() || point.title || `${dto.title} · ${point.channel}`;
    const bodyText = point.body?.trim() || defaultBodyForGoal(dto.goal, point.channel);

    if (point.channel === "email") {
      const created = await createMarketingEmailCampaign(tx, ctx, {
        title: `${dto.title} · ${point.title}`,
      });
      const emailId = created.data.id;
      await setMarketingEmailAudience(tx, ctx, emailId, {
        audienceType: dto.audienceType,
        ...(dto.audienceBatchId ? { audienceBatchId: dto.audienceBatchId } : {}),
      });
      await composeMarketingEmail(tx, ctx, emailId, {
        subject,
        bodyHtml: bodyText.includes("<") ? bodyText : `<p>${bodyText}</p>`,
        templateKey: null,
      });
      const sendResult = await sendMarketingEmail(
        tx,
        ctx,
        emailId,
        sendNow
          ? { mode: "now", acknowledgeSpam: true }
          : { mode: "schedule", scheduledAt: when.toISOString(), acknowledgeSpam: true },
      );
      if (sendResult.data.status === "SENT") anySent = true;
      nextTouchpoints.push({
        ...point,
        linkedCampaignId: emailId,
        linkedStatus: sendResult.data.status,
      });
      continue;
    }

    if (point.channel === "push") {
      const created = await createPushMessage(tx, ctx, {
        title: `${dto.title} · ${point.title}`,
      });
      const pushId = created.data.id;
      await setPushMessageAudience(tx, ctx, pushId, {
        audienceType: dto.audienceType,
        ...(dto.audienceBatchId ? { audienceBatchId: dto.audienceBatchId } : {}),
      });
      await composePushMessage(tx, ctx, pushId, {
        subject,
        body: toPlainText(bodyText).slice(0, 4000) || subject,
        deepLink: null,
        imageUrl: null,
        channels: { android: true, ios: true, web: true },
      });
      const sendResult = await sendPushMessage(
        tx,
        ctx,
        pushId,
        sendNow ? { mode: "now" } : { mode: "schedule", scheduledAt: when.toISOString() },
      );
      if (sendResult.data.status === "SENT") anySent = true;
      nextTouchpoints.push({
        ...point,
        linkedCampaignId: pushId,
        linkedStatus: sendResult.data.status,
      });
      continue;
    }

    if (point.channel === "announcement") {
      if (!sendNow) {
        // Announcements have no schedule API; keep as planned without link.
        nextTouchpoints.push({ ...point, linkedCampaignId: null, linkedStatus: null });
        anyScheduled = true;
        continue;
      }
      const created = await createAndSendAnnouncement(tx, ctx, {
        title: point.title,
        message: toPlainText(bodyText).slice(0, 4000) || point.title,
        deepLink: null,
        imageUrl: null,
        batchId: dto.audienceType === "GROUP" ? dto.audienceBatchId : null,
      });
      anySent = true;
      nextTouchpoints.push({
        ...point,
        linkedCampaignId: created.data.id,
        linkedStatus: "SENT",
      });
      continue;
    }

    // WhatsApp: store planned step; template approval flow lives in Messenger.
    nextTouchpoints.push({
      ...point,
      linkedCampaignId: null,
      linkedStatus: null,
    });
  }

  const status = anySent && !anyScheduled ? "SENT" : anyScheduled ? "SCHEDULED" : "SENT";
  await marketingCampaignsRepository.markLaunched(tx, id, {
    status,
    touchpoints: nextTouchpoints,
    launchedAt: new Date(),
    scheduledAt: body.mode === "schedule" ? launchBase : null,
    recipientCount: dto.recipientCount,
  });

  const row = await requireCampaign(tx, id);
  return marketingCampaignResponseSchema.parse({ data: toDto(row) });
}

export async function deleteMarketingCampaign(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = deleteMarketingCampaignBodySchema.parse(rawBody);
  const existing = await requireCampaign(tx, id);
  if (body.titleConfirmation !== existing.title) {
    throw validationError("Title confirmation does not match.");
  }
  await marketingCampaignsRepository.delete(tx, id);
  return deleteMarketingCampaignResponseSchema.parse({
    data: { id, deleted: true },
  });
}

export async function getMarketingCampaignAnalytics(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const row = await requireCampaign(tx, id);
  const dto = toDto(row);
  const channels = [];

  for (const point of dto.touchpoints) {
    let recipientCount = 0;
    const deliveredCount: number | null = null;
    const failedCount: number | null = null;
    let scheduledAt: string | null = null;
    let sentAt: string | null = null;
    let linkedStatus = point.linkedStatus ?? null;
    let href = `/admin/marketing/campaign/${id}`;

    if (point.channel === "email" && point.linkedCampaignId) {
      const linked = await marketingEmailRepository.findById(tx, point.linkedCampaignId);
      if (linked) {
        recipientCount = linked.recipient_count;
        scheduledAt = linked.scheduled_at?.toISOString() ?? null;
        sentAt = linked.sent_at?.toISOString() ?? null;
        linkedStatus = (linked.status as Touchpoint["linkedStatus"]) ?? null;
        href = `/admin/marketing/messenger/email/${point.linkedCampaignId}`;
      }
    } else if (point.channel === "push" && point.linkedCampaignId) {
      const linked = await pushMessagesRepository.findById(tx, point.linkedCampaignId);
      if (linked) {
        recipientCount = linked.recipient_count;
        scheduledAt = linked.scheduled_at?.toISOString() ?? null;
        sentAt = linked.sent_at?.toISOString() ?? null;
        linkedStatus = (linked.status as Touchpoint["linkedStatus"]) ?? null;
        href = `/admin/marketing/messenger/push/${point.linkedCampaignId}`;
      }
    } else if (point.channel === "announcement" && point.linkedCampaignId) {
      href = `/admin/marketing/messenger/announcements`;
      recipientCount = dto.recipientCount;
      linkedStatus = "SENT";
    } else if (point.channel === "whatsapp") {
      href = `/admin/marketing/messenger/whatsapp`;
    }

    channels.push({
      channel: point.channel,
      linkedCampaignId: point.linkedCampaignId ?? null,
      title: point.title,
      status: linkedStatus,
      recipientCount,
      deliveredCount,
      failedCount,
      scheduledAt,
      sentAt,
      href,
    });
  }

  const totalReach = channels.reduce((sum, c) => sum + c.recipientCount, 0);

  return marketingCampaignAnalyticsResponseSchema.parse({
    data: {
      campaignId: dto.id,
      title: dto.title,
      status: dto.status,
      goal: dto.goal,
      launchedAt: dto.launchedAt,
      audienceLabel:
        dto.audienceType === "ALL" ? "All learners" : (dto.audienceLabel ?? "Selected group"),
      totalReach: totalReach || dto.recipientCount,
      touchpointCount: dto.touchpoints.length,
      channels,
      note: "Open and click rates are not tracked. Reach reflects delivered or targeted recipients from linked channel sends.",
    },
  });
}
