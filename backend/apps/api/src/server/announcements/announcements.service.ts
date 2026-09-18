import { randomUUID } from "node:crypto";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { notificationRepository } from "../notifications/notification.repository";
import { buildSafeInboxPayload } from "../notifications/notification.service";
import {
  announcementResponseSchema,
  announcementsListQuerySchema,
  announcementsListResponseSchema,
  createAnnouncementBodySchema,
  deleteAnnouncementBodySchema,
  deleteAnnouncementResponseSchema,
  testAnnouncementResponseSchema,
} from "./announcements.schemas";
import { announcementsRepository, type AnnouncementRow } from "./announcements.repository";

function notFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Announcement not found.",
  });
}

function validationError(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

function toDto(row: AnnouncementRow) {
  const type = row.type as "GENERAL" | "BATCH";
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type,
    audienceBatchId: row.audience_batch_id,
    audienceLabel:
      type === "BATCH"
        ? row.audience_batch_name
          ? row.audience_batch_name
          : "Batch"
        : "All learners",
    deepLink: row.deep_link,
    imageUrl: row.image_url,
    status: row.status as "SENT",
    recipientCount: row.recipient_count,
    sentAt: row.sent_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function requireAnnouncement(tx: TenantTx, id: string) {
  const row = await announcementsRepository.findById(tx, id);
  if (!row) throw notFound();
  return row;
}

function resolveActionPath(deepLink: string | null): string {
  const trimmed = deepLink?.trim() ?? "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  return "/";
}

async function deliverAnnouncement(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    id: string;
    title: string;
    message: string;
    deepLink: string | null;
    imageUrl: string | null;
    membershipIds: string[];
  },
): Promise<void> {
  const actionPath = resolveActionPath(args.deepLink);
  const payload = buildSafeInboxPayload({
    title: args.title,
    body: args.message,
    actionPath,
  });

  for (const membershipId of args.membershipIds) {
    const idempotencyKey = `marketing.announcement:${args.id}:${membershipId}`;
    const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
      tenantId: ctx.tenantId,
      idempotencyKey,
    });
    if (existing) continue;

    await notificationRepository.insertDispatch(tx, {
      tenantId: ctx.tenantId,
      membershipId,
      channel: "in_app",
      templateKey: "marketing.announcement",
      destination: null,
      idempotencyKey,
      status: "SENT",
      payloadJson: {
        ...payload,
        announcement: {
          announcementId: args.id,
          imageUrl: args.imageUrl,
          deepLink: args.deepLink,
        },
      },
      sentAt: new Date(),
    });
  }
}

export async function listAnnouncements(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = announcementsListQuerySchema.parse(rawQuery ?? {});
  const rows = await announcementsRepository.list(tx, {
    type: query.type,
    ...(query.q ? { q: query.q } : {}),
    ...(query.createdOn ? { createdOn: query.createdOn } : {}),
    ...(query.createdMonth ? { createdMonth: query.createdMonth } : {}),
    limit: query.limit,
  });
  return announcementsListResponseSchema.parse({
    data: { items: rows.map(toDto) },
  });
}

export async function getAnnouncement(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const row = await requireAnnouncement(tx, id);
  return announcementResponseSchema.parse({ data: toDto(row) });
}

export async function createAndSendAnnouncement(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createAnnouncementBodySchema.parse(rawBody);
  const batchId = body.batchId?.trim() || null;
  const type = batchId ? "BATCH" : "GENERAL";

  if (batchId && !(await announcementsRepository.batchExists(tx, batchId))) {
    throw validationError("Selected batch was not found.");
  }

  const membershipIds = batchId
    ? await announcementsRepository.listBatchMembershipIds(tx, batchId)
    : await announcementsRepository.listActiveMembershipIds(tx);

  const id = await announcementsRepository.insertSent(tx, {
    title: body.title,
    message: body.message,
    type,
    audienceBatchId: batchId,
    deepLink: body.deepLink ?? null,
    imageUrl: body.imageUrl ?? null,
    recipientCount: membershipIds.length,
    createdByMembershipId: ctx.actorMembershipId,
  });

  await deliverAnnouncement(tx, ctx, {
    id,
    title: body.title,
    message: body.message,
    deepLink: body.deepLink ?? null,
    imageUrl: body.imageUrl ?? null,
    membershipIds,
  });

  const row = await requireAnnouncement(tx, id);
  return announcementResponseSchema.parse({ data: toDto(row) });
}

export async function deleteAnnouncement(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = deleteAnnouncementBodySchema.parse(rawBody);
  const existing = await requireAnnouncement(tx, id);
  if (existing.title.trim() !== body.titleConfirmation.trim()) {
    throw validationError("Title confirmation does not match.");
  }
  const deleted = await announcementsRepository.deleteById(tx, id);
  if (!deleted) throw notFound();
  return deleteAnnouncementResponseSchema.parse({
    data: { id, deleted: true as const },
  });
}

/**
 * Delivers the draft announcement to the acting admin only.
 * Does not create a catalog announcement or fan out to learners.
 */
export async function testAnnouncementToSelf(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createAnnouncementBodySchema.parse(rawBody);

  await deliverAnnouncement(tx, ctx, {
    id: randomUUID(),
    title: body.title,
    message: body.message,
    deepLink: body.deepLink ?? null,
    imageUrl: body.imageUrl ?? null,
    membershipIds: [ctx.actorMembershipId],
  });

  return testAnnouncementResponseSchema.parse({
    data: { sent: true as const },
  });
}
