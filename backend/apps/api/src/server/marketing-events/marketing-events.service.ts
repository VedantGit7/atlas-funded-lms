import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import {
  createMarketingEventBodySchema,
  deleteMarketingEventBodySchema,
  deleteMarketingEventResponseSchema,
  marketingEventRegistrationsListResponseSchema,
  marketingEventResponseSchema,
  marketingEventsListQuerySchema,
  marketingEventsListResponseSchema,
  publicMarketingEventResponseSchema,
  publicMarketingEventsListResponseSchema,
  registerPublicMarketingEventBodySchema,
  registerPublicMarketingEventResponseSchema,
  updateMarketingEventBodySchema,
} from "./marketing-events.schemas";
import {
  marketingEventsRepository,
  type MarketingEventRow,
} from "./marketing-events.repository";

function notFound(message = "Event not found.") {
  return new AtlasHttpError({ code: "PERMISSION_DENIED", status: 404, message });
}

function validationError(message: string) {
  return new AtlasHttpError({ code: "VALIDATION_ERROR", status: 400, message });
}

function emptyToNull(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseRequiredDate(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw validationError(`Invalid ${label}.`);
  return date;
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return parseRequiredDate(value, "end date");
}

function toDto(row: MarketingEventRow) {
  const endsAt = row.ends_at;
  const isPast = endsAt != null && endsAt.getTime() < Date.now();
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as "DRAFT" | "LIVE" | "UNPUBLISHED",
    startsAt: row.starts_at.toISOString(),
    endsAt: endsAt?.toISOString() ?? null,
    location: row.location,
    linkUrl: row.link_url,
    joinUrl: row.join_url,
    coverImageUrl: row.cover_image_url,
    reminderMinutesBefore: row.reminder_minutes_before,
    registrationCount: Number(row.registration_count ?? 0),
    isPast,
    publishedAt: row.published_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toPublicDto(row: MarketingEventRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at?.toISOString() ?? null,
    location: row.location,
    linkUrl: row.link_url,
    joinUrl: row.join_url,
    coverImageUrl: row.cover_image_url,
  };
}

async function requireEvent(tx: TenantTx, id: string) {
  const row = await marketingEventsRepository.findById(tx, id);
  if (!row) throw notFound();
  return row;
}

function assertEditable(row: MarketingEventRow) {
  if (row.status === "LIVE") {
    throw validationError("Unpublish the event before editing details.");
  }
}

function assertSchedule(startsAt: Date, endsAt: Date | null) {
  if (endsAt && endsAt <= startsAt) {
    throw validationError("Event end time must be after start time.");
  }
}

export async function listMarketingEvents(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = marketingEventsListQuerySchema.parse(rawQuery ?? {});
  const [rows, summary] = await Promise.all([
    marketingEventsRepository.list(tx, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { q: query.q } : {}),
      limit: query.limit,
    }),
    marketingEventsRepository.summary(tx),
  ]);
  return marketingEventsListResponseSchema.parse({
    data: {
      items: rows.map(toDto),
      summary: {
        liveCount: summary.live_count,
        draftCount: summary.draft_count,
        unpublishedCount: summary.unpublished_count,
        pastCount: summary.past_count,
        totalCount: summary.total_count,
        totalRegistrations: summary.total_registrations,
        upcomingLiveCount: summary.upcoming_live_count,
      },
    },
  });
}

export async function getMarketingEvent(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  return marketingEventResponseSchema.parse({
    data: toDto(await requireEvent(tx, id)),
  });
}

export async function createMarketingEvent(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createMarketingEventBodySchema.parse(rawBody);
  const startsAt = parseRequiredDate(body.startsAt, "start date");
  const endsAt = parseOptionalDate(body.endsAt);
  assertSchedule(startsAt, endsAt);
  const id = await marketingEventsRepository.insert(tx, {
    title: body.title,
    description: body.description ?? null,
    startsAt,
    endsAt,
    createdByMembershipId: ctx.actorMembershipId,
  });
  return marketingEventResponseSchema.parse({
    data: toDto(await requireEvent(tx, id)),
  });
}

export async function updateMarketingEvent(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateMarketingEventBodySchema.parse(rawBody);
  const existing = await requireEvent(tx, id);
  assertEditable(existing);
  const startsAt = parseRequiredDate(body.startsAt, "start date");
  const endsAt = parseOptionalDate(body.endsAt);
  assertSchedule(startsAt, endsAt);
  await marketingEventsRepository.update(tx, {
    id,
    title: body.title,
    description: body.description ?? null,
    startsAt,
    endsAt,
    location: emptyToNull(body.location),
    linkUrl: emptyToNull(body.linkUrl),
    joinUrl: emptyToNull(body.joinUrl),
    coverImageUrl: emptyToNull(body.coverImageUrl),
    reminderMinutesBefore:
      body.reminderMinutesBefore === undefined ? null : body.reminderMinutesBefore,
  });
  return marketingEventResponseSchema.parse({
    data: toDto(await requireEvent(tx, id)),
  });
}

export async function publishMarketingEvent(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const existing = await requireEvent(tx, id);
  if (!existing.starts_at) {
    throw validationError("Set a start date before publishing.");
  }
  await marketingEventsRepository.setStatus(tx, existing.id, "LIVE");
  return marketingEventResponseSchema.parse({
    data: toDto(await requireEvent(tx, id)),
  });
}

export async function unpublishMarketingEvent(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  await requireEvent(tx, id);
  await marketingEventsRepository.setStatus(tx, id, "UNPUBLISHED");
  return marketingEventResponseSchema.parse({
    data: toDto(await requireEvent(tx, id)),
  });
}

export async function deleteMarketingEvent(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = deleteMarketingEventBodySchema.parse(rawBody);
  const existing = await requireEvent(tx, id);
  if (existing.status === "LIVE") {
    throw validationError("Unpublish the event before deleting it.");
  }
  if (body.titleConfirmation.trim() !== existing.title.trim()) {
    throw validationError("Type the event title to confirm delete.");
  }
  await marketingEventsRepository.delete(tx, id);
  return deleteMarketingEventResponseSchema.parse({ data: { id, deleted: true as const } });
}

export async function listMarketingEventRegistrations(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
) {
  await requireEvent(tx, id);
  const rows = await marketingEventsRepository.listRegistrations(tx, id);
  return marketingEventRegistrationsListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        id: row.id,
        eventId: row.event_id,
        email: row.email,
        name: row.name,
        source: row.source as "FORM" | "WORKFLOW" | "LINK" | "ADMIN",
        contactId: row.contact_id,
        membershipId: row.membership_id,
        createdAt: row.created_at.toISOString(),
      })),
    },
  });
}

export async function listPublicMarketingEvents(tx: TenantTx) {
  const rows = await marketingEventsRepository.listLiveUpcoming(tx, 20);
  return publicMarketingEventsListResponseSchema.parse({
    data: { items: rows.map(toPublicDto) },
  });
}

export async function getPublicMarketingEvent(tx: TenantTx, id: string) {
  const row = await requireEvent(tx, id);
  if (row.status !== "LIVE") throw notFound();
  return publicMarketingEventResponseSchema.parse({ data: toPublicDto(row) });
}

export async function registerPublicMarketingEvent(
  tx: TenantTx,
  id: string,
  rawBody: unknown,
) {
  const body = registerPublicMarketingEventBodySchema.parse(rawBody);
  const event = await requireEvent(tx, id);
  if (event.status !== "LIVE") throw notFound("Event is not open for registration.");
  if (event.ends_at && event.ends_at.getTime() < Date.now()) {
    throw validationError("This event has already ended.");
  }
  const result = await marketingEventsRepository.upsertRegistration(tx, {
    eventId: id,
    email: body.email,
    name: emptyToNull(body.name),
    source: body.source ?? "LINK",
  });
  return registerPublicMarketingEventResponseSchema.parse({
    data: {
      registered: true as const,
      eventId: id,
      alreadyRegistered: result.alreadyRegistered,
    },
  });
}

/** Used by workflow engine — no Zod body, internal call. */
export async function registerMarketingEventFromWorkflow(
  tx: TenantTx,
  args: {
    eventId: string;
    email: string;
    name?: string | null;
    membershipId?: string | null;
    contactId?: string | null;
  },
) {
  const event = await marketingEventsRepository.findById(tx, args.eventId);
  if (!event || event.status !== "LIVE") {
    return { ok: false as const, reason: "Event not found or not Live." };
  }
  const result = await marketingEventsRepository.upsertRegistration(tx, {
    eventId: args.eventId,
    email: args.email,
    name: emptyToNull(args.name),
    source: "WORKFLOW",
    membershipId: args.membershipId ?? null,
    contactId: args.contactId ?? null,
  });
  return { ok: true as const, alreadyRegistered: result.alreadyRegistered };
}
