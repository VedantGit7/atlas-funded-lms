import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { notificationRepository } from "../notifications/notification.repository";
import { buildSafeInboxPayload } from "../notifications/notification.service";
import {
  connectWhatsappMetaBodySchema,
  connectWhatsappMockBodySchema,
  createWhatsappCampaignBodySchema,
  createWhatsappTemplateBodySchema,
  deleteWhatsappCampaignBodySchema,
  deleteWhatsappCampaignResponseSchema,
  replyWhatsappInboxBodySchema,
  selectWhatsappTemplateBodySchema,
  sendWhatsappCampaignBodySchema,
  setWhatsappCampaignAudienceBodySchema,
  simulateWhatsappInboundBodySchema,
  updateWhatsappCampaignTitleBodySchema,
  whatsappCampaignResponseSchema,
  whatsappCampaignsListQuerySchema,
  whatsappCampaignsListResponseSchema,
  whatsappConnectionResponseSchema,
  whatsappConversationDetailResponseSchema,
  whatsappConversationsListResponseSchema,
  whatsappRecipientsResponseSchema,
  whatsappTemplateResponseSchema,
  whatsappTemplatesListResponseSchema,
} from "./whatsapp.schemas";
import {
  whatsappRepository,
  type WhatsappCampaignRow,
  type WhatsappConnectionRow,
  type WhatsappTemplateRow,
} from "./whatsapp.repository";
import {
  decryptWhatsappSecret,
  encryptWhatsappSecret,
  whatsappSecretLast4,
} from "./whatsapp-secret-crypto";
import {
  getWhatsappProvider,
  type WhatsappProviderCredentials,
} from "./whatsapp.provider";

function notFound(message = "Not found.") {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message,
  });
}

function validationError(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

function parseButtons(raw: unknown): Array<{ type: "QUICK_REPLY" | "URL"; text: string; url?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const type = record.type === "URL" ? "URL" : "QUICK_REPLY";
      const text = typeof record.text === "string" ? record.text : "";
      if (!text) return null;
      const url = typeof record.url === "string" ? record.url : undefined;
      return type === "URL" ? { type, text, url } : { type, text };
    })
    .filter((item): item is { type: "QUICK_REPLY" | "URL"; text: string; url?: string } =>
      Boolean(item),
    );
}

function toConnectionDto(row: WhatsappConnectionRow | null) {
  if (!row || row.status !== "CONNECTED") {
    return {
      status: "DISCONNECTED" as const,
      providerMode: (row?.provider_mode === "meta" ? "meta" : "mock") as "mock" | "meta",
      displayName: row?.display_name ?? null,
      phoneNumber: row?.phone_number ?? null,
      phoneNumberId: row?.phone_number_id ?? null,
      wabaId: row?.waba_id ?? null,
      accessTokenLast4: row?.access_token_last4 ?? null,
      qualityRating: row?.quality_rating ?? null,
      messagingLimit: row?.messaging_limit ?? 250,
      connectedAt: row?.connected_at?.toISOString() ?? null,
      hasCredentials: Boolean(row?.access_token_ciphertext),
    };
  }
  return {
    status: "CONNECTED" as const,
    providerMode: (row.provider_mode === "meta" ? "meta" : "mock") as "mock" | "meta",
    displayName: row.display_name,
    phoneNumber: row.phone_number,
    phoneNumberId: row.phone_number_id,
    wabaId: row.waba_id,
    accessTokenLast4: row.access_token_last4,
    qualityRating: row.quality_rating,
    messagingLimit: row.messaging_limit,
    connectedAt: row.connected_at?.toISOString() ?? null,
    hasCredentials: Boolean(row.access_token_ciphertext),
  };
}

function toTemplateDto(row: WhatsappTemplateRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    language: row.language,
    headerType: row.header_type as "NONE" | "TEXT" | "IMAGE",
    headerText: row.header_text,
    headerImageUrl: row.header_image_url,
    body: row.body,
    footer: row.footer,
    buttons: parseButtons(row.buttons_json),
    status: row.status as "DRAFT" | "PENDING" | "APPROVED" | "REJECTED",
    metaTemplateId: row.meta_template_id,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toCampaignDto(row: WhatsappCampaignRow) {
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
    templateId: row.template_id,
    templateName: row.template_name,
    templateBody: row.template_body,
    recipientCount: row.recipient_count,
    deliveredCount: row.delivered_count,
    failedCount: row.failed_count,
    scheduledAt: row.scheduled_at?.toISOString() ?? null,
    sentAt: row.sent_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mockPhoneForMembership(membershipId: string): string {
  const digits = membershipId.replace(/-/g, "").replace(/\D/g, "").slice(0, 7).padEnd(7, "0");
  return `+1555${digits}`;
}

function resolveCredentials(row: WhatsappConnectionRow | null): WhatsappProviderCredentials | null {
  if (!row || row.status !== "CONNECTED") return null;
  if (row.provider_mode !== "meta") return null;
  if (!row.access_token_ciphertext || !row.phone_number_id || !row.waba_id) return null;
  return {
    accessToken: decryptWhatsappSecret(row.access_token_ciphertext),
    phoneNumberId: row.phone_number_id,
    wabaId: row.waba_id,
  };
}

async function requireConnected(tx: TenantTx) {
  const connection = await whatsappRepository.getConnection(tx);
  if (!connection || connection.status !== "CONNECTED") {
    throw validationError("Connect WhatsApp before continuing.");
  }
  return connection;
}

async function requireCampaign(tx: TenantTx, id: string) {
  const row = await whatsappRepository.findCampaign(tx, id);
  if (!row) throw notFound("WhatsApp message not found.");
  return row;
}

export async function getWhatsappConnection(tx: TenantTx, _ctx: ServiceCtx) {
  const row = await whatsappRepository.getConnection(tx);
  return whatsappConnectionResponseSchema.parse({ data: toConnectionDto(row) });
}

export async function connectWhatsappMock(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = connectWhatsappMockBodySchema.parse(rawBody);
  await whatsappRepository.upsertConnection(tx, {
    status: "CONNECTED",
    providerMode: "mock",
    displayName: body.displayName,
    phoneNumber: body.phoneNumber,
    phoneNumberId: null,
    wabaId: null,
    accessTokenCiphertext: null,
    accessTokenLast4: null,
  });
  const row = await whatsappRepository.getConnection(tx);
  return whatsappConnectionResponseSchema.parse({ data: toConnectionDto(row) });
}

export async function connectWhatsappMeta(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = connectWhatsappMetaBodySchema.parse(rawBody);
  const ciphertext = encryptWhatsappSecret(body.accessToken);
  await whatsappRepository.upsertConnection(tx, {
    status: "CONNECTED",
    providerMode: "meta",
    displayName: body.displayName,
    phoneNumber: body.phoneNumber,
    phoneNumberId: body.phoneNumberId,
    wabaId: body.wabaId,
    accessTokenCiphertext: ciphertext,
    accessTokenLast4: whatsappSecretLast4(body.accessToken),
  });
  const row = await whatsappRepository.getConnection(tx);
  return whatsappConnectionResponseSchema.parse({ data: toConnectionDto(row) });
}

export async function disconnectWhatsapp(tx: TenantTx, _ctx: ServiceCtx) {
  await whatsappRepository.disconnect(tx);
  const row = await whatsappRepository.getConnection(tx);
  return whatsappConnectionResponseSchema.parse({ data: toConnectionDto(row) });
}

export async function listWhatsappTemplates(tx: TenantTx, _ctx: ServiceCtx) {
  await requireConnected(tx);
  const rows = await whatsappRepository.listTemplates(tx);
  return whatsappTemplatesListResponseSchema.parse({
    data: { items: rows.map(toTemplateDto) },
  });
}

export async function createWhatsappTemplate(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const connection = await requireConnected(tx);
  const body = createWhatsappTemplateBodySchema.parse(rawBody);
  const provider = getWhatsappProvider(connection.provider_mode === "meta" ? "meta" : "mock");
  const credentials = resolveCredentials(connection);

  const submit = await provider.submitTemplate(credentials, {
    name: body.name,
    category: body.category,
    language: body.language,
    headerType: body.headerType,
    headerText: body.headerText ?? null,
    headerImageUrl: body.headerImageUrl ?? null,
    body: body.body,
    footer: body.footer ?? null,
    buttons: body.buttons,
  });

  const id = await whatsappRepository.insertTemplate(tx, {
    name: body.name,
    category: body.category,
    language: body.language,
    headerType: body.headerType,
    headerText: body.headerText ?? null,
    headerImageUrl: body.headerImageUrl ?? null,
    body: body.body,
    footer: body.footer ?? null,
    buttonsJson: body.buttons,
    status: submit.status,
    metaTemplateId: submit.metaTemplateId,
    rejectionReason: submit.rejectionReason,
    createdByMembershipId: ctx.actorMembershipId,
  });

  const row = await whatsappRepository.findTemplate(tx, id);
  if (!row) throw notFound("Template not found.");
  return whatsappTemplateResponseSchema.parse({ data: toTemplateDto(row) });
}

export async function listWhatsappCampaigns(tx: TenantTx, ctx: ServiceCtx, rawQuery: unknown) {
  await processDueScheduledCampaigns(tx, ctx);
  const query = whatsappCampaignsListQuerySchema.parse(rawQuery ?? {});
  const rows = await whatsappRepository.listCampaigns(tx, {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { q: query.q } : {}),
    ...(query.createdOn ? { createdOn: query.createdOn } : {}),
    limit: query.limit,
  });
  return whatsappCampaignsListResponseSchema.parse({
    data: { items: rows.map(toCampaignDto) },
  });
}

export async function getWhatsappCampaign(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const row = await requireCampaign(tx, id);
  return whatsappCampaignResponseSchema.parse({ data: toCampaignDto(row) });
}

export async function createWhatsappCampaign(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  await requireConnected(tx);
  const body = createWhatsappCampaignBodySchema.parse(rawBody);
  const id = await whatsappRepository.insertCampaign(tx, {
    title: body.title,
    createdByMembershipId: ctx.actorMembershipId,
  });
  const row = await requireCampaign(tx, id);
  return whatsappCampaignResponseSchema.parse({ data: toCampaignDto(row) });
}

export async function updateWhatsappCampaignTitle(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateWhatsappCampaignTitleBodySchema.parse(rawBody);
  await requireCampaign(tx, id);
  await whatsappRepository.updateCampaignTitle(tx, id, body.title);
  const row = await requireCampaign(tx, id);
  return whatsappCampaignResponseSchema.parse({ data: toCampaignDto(row) });
}

export async function setWhatsappCampaignAudience(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = setWhatsappCampaignAudienceBodySchema.parse(rawBody);
  const existing = await requireCampaign(tx, id);
  if (existing.status !== "DRAFT") {
    throw validationError("Recipients can only be set while the message is a draft.");
  }
  if (existing.audience_type) {
    throw validationError("Recipients cannot be changed once selected.");
  }

  let audienceBatchId: string | null = null;
  if (body.audienceType === "GROUP") {
    audienceBatchId = body.audienceBatchId ?? null;
    if (!audienceBatchId || !(await whatsappRepository.batchExists(tx, audienceBatchId))) {
      throw validationError("Selected group was not found.");
    }
  }

  const preview = await whatsappRepository.previewRecipients(tx, {
    audienceType: body.audienceType,
    audienceBatchId,
  });

  await whatsappRepository.updateCampaignAudience(tx, {
    id,
    audienceType: body.audienceType,
    audienceBatchId,
    recipientCount: preview.totalCount,
  });

  const row = await requireCampaign(tx, id);
  return whatsappCampaignResponseSchema.parse({ data: toCampaignDto(row) });
}

export async function listWhatsappCampaignRecipients(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
) {
  const existing = await requireCampaign(tx, id);
  if (!existing.audience_type) {
    return whatsappRecipientsResponseSchema.parse({
      data: { totalCount: 0, withPhoneCount: 0, items: [] },
    });
  }
  const preview = await whatsappRepository.previewRecipients(tx, {
    audienceType: existing.audience_type,
    audienceBatchId: existing.audience_batch_id,
    limit: 100,
  });
  return whatsappRecipientsResponseSchema.parse({
    data: {
      totalCount: preview.totalCount,
      withPhoneCount: preview.withPhoneCount,
      items: preview.items.map((item) => ({
        membershipId: item.membership_id,
        displayName: item.display_name,
        email: item.email,
        phone: item.phone,
      })),
    },
  });
}

export async function selectWhatsappCampaignTemplate(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = selectWhatsappTemplateBodySchema.parse(rawBody);
  const existing = await requireCampaign(tx, id);
  if (!existing.audience_type) {
    throw validationError("Select recipients before choosing a template.");
  }
  const template = await whatsappRepository.findTemplate(tx, body.templateId);
  if (!template) throw notFound("Template not found.");
  if (template.status !== "APPROVED") {
    throw validationError("Only Meta-approved templates can be selected.");
  }
  await whatsappRepository.updateCampaignTemplate(tx, id, body.templateId);
  const row = await requireCampaign(tx, id);
  return whatsappCampaignResponseSchema.parse({ data: toCampaignDto(row) });
}

async function deliverCampaign(
  tx: TenantTx,
  ctx: ServiceCtx,
  row: WhatsappCampaignRow,
): Promise<{ delivered: number; failed: number; recipientCount: number }> {
  if (!row.audience_type) throw validationError("Select recipients before sending.");
  if (!row.template_id || !row.template_name || !row.template_body) {
    throw validationError("Select an approved template before sending.");
  }
  if (row.template_status !== "APPROVED") {
    throw validationError("Template is not approved.");
  }

  const connection = await requireConnected(tx);
  const provider = getWhatsappProvider(connection.provider_mode === "meta" ? "meta" : "mock");
  const credentials = resolveCredentials(connection);
  const recipients = await whatsappRepository.listRecipientPhones(tx, {
    audienceType: row.audience_type,
    audienceBatchId: row.audience_batch_id,
  });

  let delivered = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const phone =
      recipient.phone?.trim() ||
      (connection.provider_mode === "mock"
        ? mockPhoneForMembership(recipient.membership_id)
        : null);
    if (!phone) {
      failed += 1;
      continue;
    }

    const idempotencyKey = `marketing.whatsapp:${row.id}:${recipient.membership_id}`;
    const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
      tenantId: ctx.tenantId,
      idempotencyKey,
    });
    if (existing) {
      delivered += 1;
      continue;
    }

    try {
      const sent = await provider.sendTemplate(credentials, {
        toPhone: phone,
        templateName: row.template_name,
        language: row.template_language ?? "en",
        body: row.template_body,
        requestId: ctx.requestId,
      });

      await notificationRepository.insertDispatch(tx, {
        tenantId: ctx.tenantId,
        membershipId: recipient.membership_id,
        channel: "in_app",
        templateKey: "marketing.whatsapp",
        destination: phone,
        idempotencyKey,
        status: "SENT",
        payloadJson: {
          ...buildSafeInboxPayload({
            title: row.title,
            body: row.template_body,
            actionPath: "/",
          }),
          whatsapp: {
            campaignId: row.id,
            templateName: row.template_name,
            metaMessageId: sent.metaMessageId,
            phone,
          },
        },
        sentAt: new Date(),
      });

      const conversationId = await whatsappRepository.upsertConversation(tx, {
        waPhone: phone,
        membershipId: recipient.membership_id,
        learnerName: recipient.display_name,
        incrementUnread: false,
      });
      await whatsappRepository.insertInboxMessage(tx, {
        conversationId,
        direction: "OUT",
        body: row.template_body,
        status: "SENT",
        metaMessageId: sent.metaMessageId,
      });

      delivered += 1;
    } catch {
      failed += 1;
    }
  }

  await whatsappRepository.markCampaignSent(tx, row.id, {
    recipientCount: recipients.length,
    deliveredCount: delivered,
    failedCount: failed,
  });

  return { delivered, failed, recipientCount: recipients.length };
}

export async function processDueScheduledCampaigns(tx: TenantTx, ctx: ServiceCtx) {
  const due = await whatsappRepository.listDueScheduled(tx);
  for (const row of due) {
    await deliverCampaign(tx, ctx, row);
  }
}

export async function sendWhatsappCampaign(
  tx: TenantTx,
  ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = sendWhatsappCampaignBodySchema.parse(rawBody);
  const existing = await requireCampaign(tx, id);

  if (body.mode === "test") {
    const connection = await requireConnected(tx);
    if (!existing.template_id || !existing.template_name || !existing.template_body) {
      throw validationError("Select an approved template before sending a test.");
    }
    const provider = getWhatsappProvider(connection.provider_mode === "meta" ? "meta" : "mock");
    const credentials = resolveCredentials(connection);
    await provider.sendTemplate(credentials, {
      toPhone: body.testPhone!,
      templateName: existing.template_name,
      language: existing.template_language ?? "en",
      body: existing.template_body,
      requestId: ctx.requestId,
    });
    return whatsappCampaignResponseSchema.parse({ data: toCampaignDto(existing) });
  }

  if (body.mode === "schedule") {
    const scheduledAt = new Date(body.scheduledAt!);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      throw validationError("scheduledAt must be a future time.");
    }
    if (!existing.template_id) throw validationError("Select a template before scheduling.");
    await whatsappRepository.markCampaignScheduled(tx, id, scheduledAt);
    const row = await requireCampaign(tx, id);
    return whatsappCampaignResponseSchema.parse({ data: toCampaignDto(row) });
  }

  await deliverCampaign(tx, ctx, existing);
  const row = await requireCampaign(tx, id);
  return whatsappCampaignResponseSchema.parse({ data: toCampaignDto(row) });
}

export async function deleteWhatsappCampaign(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = deleteWhatsappCampaignBodySchema.parse(rawBody);
  const existing = await requireCampaign(tx, id);
  if (existing.title.trim() !== body.titleConfirmation.trim()) {
    throw validationError("Title confirmation does not match.");
  }
  const deleted = await whatsappRepository.deleteCampaign(tx, id);
  if (!deleted) throw notFound("WhatsApp message not found.");
  return deleteWhatsappCampaignResponseSchema.parse({
    data: { id, deleted: true as const },
  });
}

export async function listWhatsappConversations(tx: TenantTx, _ctx: ServiceCtx) {
  await requireConnected(tx);
  const rows = await whatsappRepository.listConversations(tx);
  return whatsappConversationsListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        id: row.id,
        waPhone: row.wa_phone,
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        lastMessageAt: row.last_message_at.toISOString(),
        unreadCount: row.unread_count,
        lastMessagePreview: row.last_message_preview,
      })),
    },
  });
}

export async function getWhatsappConversation(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  await requireConnected(tx);
  const conversation = await whatsappRepository.findConversation(tx, id);
  if (!conversation) throw notFound("Conversation not found.");
  await whatsappRepository.markConversationRead(tx, id);
  const messages = await whatsappRepository.listInboxMessages(tx, id);
  return whatsappConversationDetailResponseSchema.parse({
    data: {
      conversation: {
        id: conversation.id,
        waPhone: conversation.wa_phone,
        membershipId: conversation.membership_id,
        learnerName: conversation.learner_name,
        lastMessageAt: conversation.last_message_at.toISOString(),
        unreadCount: 0,
        lastMessagePreview: conversation.last_message_preview,
      },
      messages: messages.map((message) => ({
        id: message.id,
        direction: message.direction as "IN" | "OUT",
        body: message.body,
        status: message.status,
        createdAt: message.created_at.toISOString(),
      })),
    },
  });
}

export async function replyWhatsappConversation(
  tx: TenantTx,
  ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = replyWhatsappInboxBodySchema.parse(rawBody);
  const connection = await requireConnected(tx);
  const conversation = await whatsappRepository.findConversation(tx, id);
  if (!conversation) throw notFound("Conversation not found.");

  const provider = getWhatsappProvider(connection.provider_mode === "meta" ? "meta" : "mock");
  const credentials = resolveCredentials(connection);
  const sent = await provider.sendFreeform(credentials, {
    toPhone: conversation.wa_phone,
    body: body.body,
    requestId: ctx.requestId,
  });

  await whatsappRepository.insertInboxMessage(tx, {
    conversationId: id,
    direction: "OUT",
    body: body.body,
    status: "SENT",
    metaMessageId: sent.metaMessageId,
  });
  await whatsappRepository.upsertConversation(tx, {
    waPhone: conversation.wa_phone,
    membershipId: conversation.membership_id,
    learnerName: conversation.learner_name,
    incrementUnread: false,
  });

  return getWhatsappConversation(tx, ctx, id);
}

export async function simulateWhatsappInbound(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  await requireConnected(tx);
  const body = simulateWhatsappInboundBodySchema.parse(rawBody);
  const conversationId = await whatsappRepository.upsertConversation(tx, {
    waPhone: body.waPhone,
    membershipId: null,
    learnerName: body.learnerName ?? null,
    incrementUnread: true,
  });
  await whatsappRepository.insertInboxMessage(tx, {
    conversationId,
    direction: "IN",
    body: body.body,
    status: "RECEIVED",
    metaMessageId: null,
  });
  return getWhatsappConversation(tx, ctx, conversationId);
}
