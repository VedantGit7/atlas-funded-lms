// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import type {
  CreateNotificationTemplateBody,
  DeleteNotificationTemplateBody,
  NotificationInboxListQuery,
  UpdateNotificationTemplateBody,
} from "./notification.contract";
import {
  buildArchiveReceiptIdempotencyKey,
  buildReadReceiptIdempotencyKey,
  extractArchiveReceiptAt,
  extractInboxPayload,
  extractReadReceiptAt,
  isInboxSentinelTemplateKey,
  notificationSourceEventKeySchema,
  notificationVariablesJsonSchema,
  renderNotificationPlainText,
} from "./notification.dto";
import {
  notificationDispatchNotFound,
  notificationTemplateKeyConflict,
  notificationTemplateNotFound,
} from "./notification.errors";
import { notificationRepository } from "./notification.repository";
import type { NotificationTemplateRow, ServiceCtx } from "./notification.types";

function mapTemplateDto(row: NotificationTemplateRow) {
  const variablesJson = notificationVariablesJsonSchema.parse(
    row.variables_json ?? { variables: [] },
  );
  return {
    id: row.id,
    key: notificationSourceEventKeySchema.parse(row.key),
    channel: row.channel as "in_app" | "email",
    locale: row.locale,
    subject: row.subject,
    body: row.body,
    variablesJson,
    status: row.status as "ACTIVE" | "INACTIVE" | "ARCHIVED",
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function normalizeReadAt(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function mapInboxItem(row: {
  id: string;
  payload_json: unknown;
  created_at: Date;
  read_at?: string | null;
  archived_at?: string | null;
}) {
  const inbox = extractInboxPayload(row.payload_json);
  if (!inbox) {
    return null;
  }
  const readAt = normalizeReadAt(row.read_at ?? inbox.readAt);
  const archivedAt = normalizeReadAt(row.archived_at);
  return {
    id: row.id,
    title: inbox.title,
    body: inbox.body,
    actionPath: inbox.actionPath,
    read: readAt != null,
    readAt,
    archived: archivedAt != null,
    archivedAt,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listNotificationTemplates(tx: TenantTx, ctx: ServiceCtx) {
  const rows = await notificationRepository.listTemplates(tx, ctx.tenantId);
  return { data: rows.map(mapTemplateDto) };
}

export async function createNotificationTemplate(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateNotificationTemplateBody,
) {
  const existing = await notificationRepository.findTemplateByUniqueKey(tx, {
    tenantId: ctx.tenantId,
    key: input.key,
    channel: input.channel,
    locale: input.locale,
  });
  if (existing) {
    throw notificationTemplateKeyConflict();
  }

  const created = await notificationRepository.insertTemplate(tx, {
    tenantId: ctx.tenantId,
    key: input.key,
    channel: input.channel,
    locale: input.locale,
    subject: input.subject ?? null,
    body: input.body,
    variablesJson: input.variablesJson,
    status: input.status ?? "ACTIVE",
  });

  return { data: mapTemplateDto(created) };
}

export async function updateNotificationTemplate(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: UpdateNotificationTemplateBody,
) {
  const existing = await notificationRepository.findTemplateById(tx, input.id);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw notificationTemplateNotFound();
  }

  const nextKey = input.key ?? existing.key;
  const nextChannel = input.channel ?? existing.channel;
  const nextLocale = input.locale ?? existing.locale;

  if (
    nextKey !== existing.key ||
    nextChannel !== existing.channel ||
    nextLocale !== existing.locale
  ) {
    const conflict = await notificationRepository.findTemplateByUniqueKey(tx, {
      tenantId: ctx.tenantId,
      key: nextKey,
      channel: nextChannel,
      locale: nextLocale,
    });
    if (conflict && conflict.id !== existing.id) {
      throw notificationTemplateKeyConflict();
    }
  }

  const updated = await notificationRepository.updateTemplate(tx, {
    templateId: input.id,
    ...(input.key !== undefined ? { key: input.key } : {}),
    ...(input.channel !== undefined ? { channel: input.channel } : {}),
    ...(input.locale !== undefined ? { locale: input.locale } : {}),
    ...(input.subject !== undefined ? { subject: input.subject } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.variablesJson !== undefined ? { variablesJson: input.variablesJson } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  });

  if (!updated) {
    throw notificationTemplateNotFound();
  }

  return { data: mapTemplateDto(updated) };
}

export async function deleteNotificationTemplate(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: DeleteNotificationTemplateBody,
) {
  const existing = await notificationRepository.findTemplateById(tx, input.id);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw notificationTemplateNotFound();
  }

  await notificationRepository.deleteTemplate(tx, input.id);
  return { data: { id: input.id, deleted: true as const } };
}

export async function listMyNotifications(
  tx: TenantTx,
  ctx: ServiceCtx,
  query: NotificationInboxListQuery,
) {
  const limit = query.limit + 1;
  const rows = await notificationRepository.listInboxDispatches(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    limit,
    includeArchived: query.includeArchived,
    ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
  });

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const mapped = pageRows
    .map((row) => mapInboxItem(row))
    .filter((item): item is NonNullable<typeof item> => item != null);

  return {
    data: mapped,
    page: {
      nextCursor: hasMore ? (pageRows.at(-1)?.id ?? null) : null,
      hasMore,
    },
  };
}

export async function markNotificationRead(tx: TenantTx, ctx: ServiceCtx, dispatchId: string) {
  const dispatch = await notificationRepository.findDispatchById(tx, dispatchId);
  if (
    !dispatch ||
    dispatch.tenant_id !== ctx.tenantId ||
    dispatch.membership_id !== ctx.actorMembershipId ||
    dispatch.channel !== "in_app" ||
    isInboxSentinelTemplateKey(dispatch.template_key) ||
    dispatch.status !== "SENT"
  ) {
    throw notificationDispatchNotFound();
  }

  const inbox = extractInboxPayload(dispatch.payload_json);
  if (!inbox) {
    throw notificationDispatchNotFound();
  }

  const existingReceipt = await notificationRepository.findReadReceiptForDispatch(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    dispatchId,
  });

  if (existingReceipt) {
    return {
      data: {
        id: dispatch.id,
        read: true as const,
        readAt: extractReadReceiptAt(existingReceipt.payload_json) ?? new Date().toISOString(),
      },
    };
  }

  const readAt = new Date();
  const receiptKey = buildReadReceiptIdempotencyKey({
    dispatchId,
    membershipId: ctx.actorMembershipId,
  });

  const existingByKey = await notificationRepository.findDispatchByIdempotencyKey(tx, {
    tenantId: ctx.tenantId,
    idempotencyKey: receiptKey,
  });

  if (existingByKey) {
    return {
      data: {
        id: dispatch.id,
        read: true as const,
        readAt: extractReadReceiptAt(existingByKey.payload_json) ?? readAt.toISOString(),
      },
    };
  }

  await notificationRepository.insertReadReceipt(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    dispatchId,
    readAt,
    idempotencyKey: receiptKey,
  });

  return {
    data: {
      id: dispatch.id,
      read: true as const,
      readAt: readAt.toISOString(),
    },
  };
}

export async function markNotificationArchived(tx: TenantTx, ctx: ServiceCtx, dispatchId: string) {
  const dispatch = await notificationRepository.findDispatchById(tx, dispatchId);
  if (
    !dispatch ||
    dispatch.tenant_id !== ctx.tenantId ||
    dispatch.membership_id !== ctx.actorMembershipId ||
    dispatch.channel !== "in_app" ||
    isInboxSentinelTemplateKey(dispatch.template_key) ||
    dispatch.status !== "SENT"
  ) {
    throw notificationDispatchNotFound();
  }

  const inbox = extractInboxPayload(dispatch.payload_json);
  if (!inbox) {
    throw notificationDispatchNotFound();
  }

  const existingReceipt = await notificationRepository.findArchiveReceiptForDispatch(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    dispatchId,
  });

  if (existingReceipt) {
    return {
      data: {
        id: dispatch.id,
        archived: true as const,
        archivedAt:
          extractArchiveReceiptAt(existingReceipt.payload_json) ?? new Date().toISOString(),
      },
    };
  }

  const archivedAt = new Date();
  const receiptKey = buildArchiveReceiptIdempotencyKey({
    dispatchId,
    membershipId: ctx.actorMembershipId,
  });

  const existingByKey = await notificationRepository.findDispatchByIdempotencyKey(tx, {
    tenantId: ctx.tenantId,
    idempotencyKey: receiptKey,
  });

  if (existingByKey) {
    return {
      data: {
        id: dispatch.id,
        archived: true as const,
        archivedAt: extractArchiveReceiptAt(existingByKey.payload_json) ?? archivedAt.toISOString(),
      },
    };
  }

  await notificationRepository.insertArchiveReceipt(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    dispatchId,
    archivedAt,
    idempotencyKey: receiptKey,
  });

  return {
    data: {
      id: dispatch.id,
      archived: true as const,
      archivedAt: archivedAt.toISOString(),
    },
  };
}

export function buildSafeInboxPayload(args: { title: string; body: string; actionPath: string }): {
  inbox: { title: string; body: string; actionPath: string; readAt: null };
} {
  return {
    inbox: {
      title: args.title,
      body: args.body,
      actionPath: args.actionPath,
      readAt: null,
    },
  };
}

export function resolveTemplateVariablesForEvent(
  eventType: string,
  payload: Record<string, unknown>,
): Record<string, string> {
  if (eventType === "certificate.issued") {
    return {
      issuedAt:
        typeof payload["issuedAt"] === "string"
          ? new Date(payload["issuedAt"]).toLocaleDateString("en-US")
          : new Date().toLocaleDateString("en-US"),
    };
  }

  if (eventType === "certificate.revoked") {
    return {
      revokedAt:
        typeof payload["revokedAt"] === "string"
          ? new Date(payload["revokedAt"]).toLocaleDateString("en-US")
          : new Date().toLocaleDateString("en-US"),
    };
  }

  return {};
}

export function resolveDefaultActionPath(
  eventType: string,
  variablesJson: ReturnType<typeof notificationVariablesJsonSchema.parse>,
): string {
  if (variablesJson.defaultActionPath) {
    return variablesJson.defaultActionPath;
  }

  if (eventType === "certificate.issued" || eventType === "certificate.revoked") {
    return "/certificates";
  }

  return "/notifications";
}

export function buildRenderedTemplateContent(
  template: NotificationTemplateRow,
  eventType: string,
  payload: Record<string, unknown>,
): { title: string; body: string; actionPath: string; emailSubject: string | null } {
  const variablesJson = notificationVariablesJsonSchema.parse(
    template.variables_json ?? { variables: [] },
  );
  const variables = resolveTemplateVariablesForEvent(eventType, payload);
  const body = renderNotificationPlainText(template.body, variables);
  const actionPath = resolveDefaultActionPath(eventType, variablesJson);
  const title =
    eventType === "certificate.issued"
      ? "Certificate issued"
      : eventType === "certificate.revoked"
        ? "Certificate revoked"
        : "Notification";

  return {
    title,
    body,
    actionPath,
    emailSubject: template.subject,
  };
}

export async function publishNotificationQueuedEvent(
  tx: TenantTx,
  ctx: { tenantId: string; requestId: string },
  args: {
    dispatchId?: string;
    channel: string;
    templateId: string;
    templateKey: string;
    membershipId: string;
    sourceEventId: string;
    renderedPayload?: {
      title: string;
      body: string;
      actionPath: string;
      emailSubject: string | null;
    };
  },
) {
  const aggregateId = args.dispatchId ?? args.sourceEventId;
  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      requestId: ctx.requestId,
    },
    eventType: "notification.queued",
    aggregateType: "notification_dispatch",
    aggregateId,
    payload: {
      ...(args.dispatchId ? { dispatchId: args.dispatchId } : {}),
      channel: args.channel,
      templateId: args.templateId,
      templateKey: args.templateKey,
      membershipId: args.membershipId,
      sourceEventId: args.sourceEventId,
      ...(args.renderedPayload ? { renderedPayload: args.renderedPayload } : {}),
    },
    idempotencyKey: `notification.queued:${aggregateId}:${args.templateId}:${args.channel}`,
  });
}
