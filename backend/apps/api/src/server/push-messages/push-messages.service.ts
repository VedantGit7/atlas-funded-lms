import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { notificationRepository } from "../notifications/notification.repository";
import { buildSafeInboxPayload } from "../notifications/notification.service";
import {
  composePushMessageBodySchema,
  createPushMessageBodySchema,
  deletePushMessageBodySchema,
  deletePushMessageResponseSchema,
  pushAudienceEstimateQuerySchema,
  pushAudienceEstimateResponseSchema,
  pushMessageRecipientsResponseSchema,
  pushMessageResponseSchema,
  pushMessagesListQuerySchema,
  pushMessagesListResponseSchema,
  pushMessagesSummaryResponseSchema,
  sendPushMessageBodySchema,
  setPushMessageAudienceBodySchema,
  updatePushMessageTitleBodySchema,
} from "./push-messages.schemas";
import { pushMessagesRepository, type PushMessageRow } from "./push-messages.repository";

function notFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Push message not found.",
  });
}

function validationError(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

function toDto(row: PushMessageRow) {
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
    body: row.body,
    deepLink: row.deep_link,
    imageUrl: row.image_url,
    channels: {
      android: row.channel_android,
      ios: row.channel_ios,
      web: row.channel_web,
    },
    recipientCount: row.recipient_count,
    scheduledAt: row.scheduled_at?.toISOString() ?? null,
    sentAt: row.sent_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function requireMessage(tx: TenantTx, id: string) {
  const row = await pushMessagesRepository.findById(tx, id);
  if (!row) throw notFound();
  return row;
}

async function resolveRecipientIds(tx: TenantTx, row: PushMessageRow): Promise<string[]> {
  if (!row.audience_type) {
    throw validationError("Select recipients before sending.");
  }
  if (row.audience_type === "GROUP") {
    if (!row.audience_batch_id) {
      throw validationError("Group audience is missing a batch.");
    }
    return pushMessagesRepository.listBatchMembershipIds(tx, row.audience_batch_id);
  }
  return pushMessagesRepository.listActiveMembershipIds(tx);
}

async function deliverPushMessage(
  tx: TenantTx,
  ctx: ServiceCtx,
  row: PushMessageRow,
): Promise<number> {
  if (!row.subject?.trim() || !row.body?.trim()) {
    throw validationError("Compose subject and message body before sending.");
  }
  if (!row.channel_android && !row.channel_ios && !row.channel_web) {
    throw validationError("Select at least one delivery channel.");
  }

  const membershipIds = await resolveRecipientIds(tx, row);
  const actionPath = row.deep_link?.trim() || "/";
  const payload = buildSafeInboxPayload({
    title: row.subject,
    body: row.body,
    actionPath,
  });

  // Deliver as in-app notifications (working channel today). Android/iOS/web
  // flags are persisted for future FCM/APNs/web-push adapters.
  for (const membershipId of membershipIds) {
    const idempotencyKey = `marketing.push_message:${row.id}:${membershipId}`;
    const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
      tenantId: ctx.tenantId,
      idempotencyKey,
    });
    if (existing) continue;

    await notificationRepository.insertDispatch(tx, {
      tenantId: ctx.tenantId,
      membershipId,
      channel: "in_app",
      templateKey: "marketing.push_message",
      destination: null,
      idempotencyKey,
      status: "SENT",
      payloadJson: {
        ...payload,
        push: {
          messageId: row.id,
          imageUrl: row.image_url,
          channels: {
            android: row.channel_android,
            ios: row.channel_ios,
            web: row.channel_web,
          },
        },
      },
      sentAt: new Date(),
    });
  }

  await pushMessagesRepository.markSent(tx, row.id, membershipIds.length);
  return membershipIds.length;
}

export async function processDueScheduledPushMessages(tx: TenantTx, ctx: ServiceCtx) {
  const due = await pushMessagesRepository.listDueScheduled(tx);
  for (const row of due) {
    await deliverPushMessage(tx, ctx, row);
  }
}

export async function listPushMessages(tx: TenantTx, ctx: ServiceCtx, rawQuery: unknown) {
  await processDueScheduledPushMessages(tx, ctx);
  const query = pushMessagesListQuerySchema.parse(rawQuery ?? {});
  const listArgs = {
    status: query.status,
    ...(query.q ? { q: query.q } : {}),
    ...(query.createdOn ? { createdOn: query.createdOn } : {}),
    limit: query.limit,
    offset: query.offset,
  };
  const [rows, total] = await Promise.all([
    pushMessagesRepository.list(tx, listArgs),
    pushMessagesRepository.count(tx, listArgs),
  ]);
  return pushMessagesListResponseSchema.parse({
    data: { items: rows.map(toDto), total },
  });
}

export async function estimatePushAudience(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = pushAudienceEstimateQuerySchema.parse(rawQuery ?? {});
  let audienceBatchId: string | null = null;
  if (query.audienceType === "GROUP") {
    audienceBatchId = query.audienceBatchId ?? null;
    if (!audienceBatchId || !(await pushMessagesRepository.batchExists(tx, audienceBatchId))) {
      throw validationError("Selected group was not found.");
    }
  }

  const preview = await pushMessagesRepository.previewRecipients(tx, {
    audienceType: query.audienceType,
    audienceBatchId,
    limit: 1,
  });

  return pushAudienceEstimateResponseSchema.parse({
    data: {
      audienceType: query.audienceType,
      audienceBatchId,
      totalCount: preview.totalCount,
    },
  });
}

export async function getPushMessagesSummary(tx: TenantTx, ctx: ServiceCtx) {
  await processDueScheduledPushMessages(tx, ctx);
  const summary = await pushMessagesRepository.summary(tx);
  const messageCount = Math.max(summary.message_count, 1);
  const reachTrendPercent =
    summary.reach_prev_30d <= 0
      ? summary.reach_30d > 0
        ? 100
        : null
      : Math.round(((summary.reach_30d - summary.reach_prev_30d) / summary.reach_prev_30d) * 100);

  return pushMessagesSummaryResponseSchema.parse({
    data: {
      draftCount: summary.draft_count,
      scheduledCount: summary.scheduled_count,
      sentCount: summary.sent_count,
      totalReach: summary.total_reach,
      reach30d: summary.reach_30d,
      reachTrendPercent,
      channelCoverage: {
        androidPercent: Math.round((summary.android_enabled_count / messageCount) * 100),
        iosPercent: Math.round((summary.ios_enabled_count / messageCount) * 100),
        webPercent: Math.round((summary.web_enabled_count / messageCount) * 100),
      },
      messageCount: summary.message_count,
    },
  });
}

export async function getPushMessage(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const row = await requireMessage(tx, id);
  return pushMessageResponseSchema.parse({ data: toDto(row) });
}

export async function createPushMessage(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createPushMessageBodySchema.parse(rawBody);
  const id = await pushMessagesRepository.insertDraft(tx, {
    title: body.title,
    createdByMembershipId: ctx.actorMembershipId,
  });
  const row = await requireMessage(tx, id);
  return pushMessageResponseSchema.parse({ data: toDto(row) });
}

export async function updatePushMessageTitle(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updatePushMessageTitleBodySchema.parse(rawBody);
  const existing = await requireMessage(tx, id);
  await pushMessagesRepository.updateTitle(tx, existing.id, body.title);
  const row = await requireMessage(tx, id);
  return pushMessageResponseSchema.parse({ data: toDto(row) });
}

export async function setPushMessageAudience(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = setPushMessageAudienceBodySchema.parse(rawBody);
  const existing = await requireMessage(tx, id);
  if (existing.status !== "DRAFT") {
    throw validationError("Recipients can only be set while the message is a draft.");
  }
  if (existing.audience_type) {
    throw validationError("Recipients cannot be changed once selected.");
  }

  let audienceBatchId: string | null = null;
  if (body.audienceType === "GROUP") {
    audienceBatchId = body.audienceBatchId ?? null;
    if (!audienceBatchId || !(await pushMessagesRepository.batchExists(tx, audienceBatchId))) {
      throw validationError("Selected group was not found.");
    }
  }

  const preview = await pushMessagesRepository.previewRecipients(tx, {
    audienceType: body.audienceType,
    audienceBatchId,
  });

  await pushMessagesRepository.updateAudience(tx, {
    id: existing.id,
    audienceType: body.audienceType,
    audienceBatchId,
    recipientCount: preview.totalCount,
  });

  const row = await requireMessage(tx, id);
  return pushMessageResponseSchema.parse({ data: toDto(row) });
}

export async function listPushMessageRecipients(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const existing = await requireMessage(tx, id);
  if (!existing.audience_type) {
    return pushMessageRecipientsResponseSchema.parse({
      data: { totalCount: 0, items: [] },
    });
  }

  const preview = await pushMessagesRepository.previewRecipients(tx, {
    audienceType: existing.audience_type,
    audienceBatchId: existing.audience_batch_id,
    limit: 100,
  });

  return pushMessageRecipientsResponseSchema.parse({
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

export async function composePushMessage(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = composePushMessageBodySchema.parse(rawBody);
  const existing = await requireMessage(tx, id);
  if (!existing.audience_type) {
    throw validationError("Select recipients before composing the message.");
  }
  if (existing.status === "SENT") {
    throw validationError("Sent messages cannot be edited.");
  }
  if (body.channels.ios && body.imageUrl) {
    // Learnyst: images are not supported on iOS — keep image but leave flag as-is.
  }

  await pushMessagesRepository.updateCompose(tx, {
    id: existing.id,
    subject: body.subject,
    body: body.body,
    deepLink: body.deepLink?.trim() || null,
    imageUrl: body.imageUrl?.trim() || null,
    channelAndroid: body.channels.android,
    channelIos: body.channels.ios,
    channelWeb: body.channels.web,
  });

  const row = await requireMessage(tx, id);
  return pushMessageResponseSchema.parse({ data: toDto(row) });
}

export async function sendPushMessage(tx: TenantTx, ctx: ServiceCtx, id: string, rawBody: unknown) {
  await processDueScheduledPushMessages(tx, ctx);
  const body = sendPushMessageBodySchema.parse(rawBody);
  const existing = await requireMessage(tx, id);
  if (existing.status === "SENT") {
    throw validationError("This message has already been sent.");
  }
  if (!existing.audience_type) {
    throw validationError("Select recipients before sending.");
  }
  if (!existing.subject || !existing.body) {
    throw validationError("Compose the message before sending.");
  }

  if (body.mode === "schedule") {
    // Required in schedule mode by a schema refinement the emitted type does not
    // express; asserting instead would build `new Date(undefined)` = Invalid Date.
    if (!body.scheduledAt) throw validationError("A schedule time is required in schedule mode.");
    const scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      throw validationError("Schedule time must be in the future.");
    }
    await pushMessagesRepository.markScheduled(tx, existing.id, scheduledAt);
    const row = await requireMessage(tx, id);
    return pushMessageResponseSchema.parse({ data: toDto(row) });
  }

  await deliverPushMessage(tx, ctx, existing);
  const row = await requireMessage(tx, id);
  return pushMessageResponseSchema.parse({ data: toDto(row) });
}

export async function deletePushMessage(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = deletePushMessageBodySchema.parse(rawBody);
  const existing = await requireMessage(tx, id);
  if (body.titleConfirmation !== existing.title) {
    throw validationError("Title confirmation does not match.");
  }
  const deleted = await pushMessagesRepository.deleteById(tx, existing.id);
  if (!deleted) throw notFound();
  return deletePushMessageResponseSchema.parse({
    data: { id: existing.id, deleted: true },
  });
}
