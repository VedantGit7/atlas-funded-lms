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
import { marketingEventsRepository, type MarketingEventRow } from "./marketing-events.repository";
import { readTenantDefaultTimezone } from "../tenant-settings/tenant-settings.service";
import { resolveTenantPublicSiteUrl } from "../../lib/account-security-orchestrator";
import { queueMarketingEventEmail } from "./marketing-event-email";
import { safeTimeZone } from "./marketing-event-time";

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

/** The academy's time zone: event times are shown and emailed in it (QA review 2 H29). */
async function academyTimeZone(tx: TenantTx): Promise<string> {
  return safeTimeZone(await readTenantDefaultTimezone(tx));
}

function toDto(row: MarketingEventRow, timeZone: string) {
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
    timeZone,
    registrationCount: Number(row.registration_count ?? 0),
    isPast,
    publishedAt: row.published_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toPublicDto(row: MarketingEventRow, timeZone: string) {
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
    timeZone,
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
  const [rows, summary, timeZone] = await Promise.all([
    marketingEventsRepository.list(tx, {
      status: query.status,
      ...(query.q ? { q: query.q } : {}),
      limit: query.limit,
    }),
    marketingEventsRepository.summary(tx),
    academyTimeZone(tx),
  ]);
  return marketingEventsListResponseSchema.parse({
    data: {
      items: rows.map((row) => toDto(row, timeZone)),
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
    data: toDto(await requireEvent(tx, id), await academyTimeZone(tx)),
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
    data: toDto(await requireEvent(tx, id), await academyTimeZone(tx)),
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
  const reminder = body.reminderMinutesBefore ?? null;
  if (
    existing.starts_at.getTime() !== startsAt.getTime() ||
    existing.reminder_minutes_before !== reminder
  ) {
    // Reminders already sent were for the old time; each one is due again.
    await marketingEventsRepository.resetReminders(tx, id);
  }
  return marketingEventResponseSchema.parse({
    data: toDto(await requireEvent(tx, id), await academyTimeZone(tx)),
  });
}

export async function publishMarketingEvent(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  // `starts_at` is NOT NULL and required by both the create and update
  // paths, so there is no missing-start-date state to guard against here.
  const existing = await requireEvent(tx, id);
  await marketingEventsRepository.setStatus(tx, existing.id, "LIVE");
  return marketingEventResponseSchema.parse({
    data: toDto(await requireEvent(tx, id), await academyTimeZone(tx)),
  });
}

export async function unpublishMarketingEvent(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  await requireEvent(tx, id);
  await marketingEventsRepository.setStatus(tx, id, "UNPUBLISHED");
  return marketingEventResponseSchema.parse({
    data: toDto(await requireEvent(tx, id), await academyTimeZone(tx)),
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

export async function listMarketingEventRegistrations(tx: TenantTx, _ctx: ServiceCtx, id: string) {
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
  const [rows, timeZone] = await Promise.all([
    marketingEventsRepository.listLiveUpcoming(tx, 20),
    academyTimeZone(tx),
  ]);
  return publicMarketingEventsListResponseSchema.parse({
    data: { items: rows.map((row) => toPublicDto(row, timeZone)) },
  });
}

export async function getPublicMarketingEvent(tx: TenantTx, id: string) {
  const row = await requireEvent(tx, id);
  if (row.status !== "LIVE") throw notFound();
  return publicMarketingEventResponseSchema.parse({
    data: toPublicDto(row, await academyTimeZone(tx)),
  });
}

/**
 * Public registration. A new registration queues its confirmation email in the
 * same transaction (QA review 2 H29: the page said "Check your email" and no
 * email was sent). Registering again sends nothing, so the form can't be used
 * to email someone over and over.
 */
export async function registerPublicMarketingEvent(
  tx: TenantTx,
  ctx: { tenantId: string; requestId: string },
  id: string,
  rawBody: unknown,
  options: { siteUrl: string | null },
) {
  const body = registerPublicMarketingEventBodySchema.parse(rawBody);
  const event = await requireEvent(tx, id);
  if (event.status !== "LIVE") throw notFound("Event is not open for registration.");
  if (event.ends_at && event.ends_at.getTime() < Date.now()) {
    throw validationError("This event has already ended.");
  }
  const name = emptyToNull(body.name);
  const result = await marketingEventsRepository.upsertRegistration(tx, {
    eventId: id,
    email: body.email,
    name,
    source: body.source,
  });
  if (!result.alreadyRegistered) {
    await queueMarketingEventEmail(tx, ctx, {
      kind: "confirmation",
      event,
      registration: { id: result.id, email: body.email.trim().toLowerCase(), name },
      siteUrl: options.siteUrl,
    });
  }
  return registerPublicMarketingEventResponseSchema.parse({
    data: {
      registered: true as const,
      eventId: id,
      alreadyRegistered: result.alreadyRegistered,
    },
  });
}

/** The academy's site for links in event emails; null when it has none. */
async function siteUrlFor(tx: TenantTx, tenantId: string): Promise<string | null> {
  try {
    return await resolveTenantPublicSiteUrl(tx, tenantId);
  } catch {
    return null;
  }
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
  ctx?: { tenantId: string; requestId: string; actorMembershipId?: string | null },
) {
  const event = await marketingEventsRepository.findById(tx, args.eventId);
  if (!event || event.status !== "LIVE") {
    return { ok: false as const, reason: "Event not found or not Live." };
  }
  const name = emptyToNull(args.name);
  const result = await marketingEventsRepository.upsertRegistration(tx, {
    eventId: args.eventId,
    email: args.email,
    name,
    source: "WORKFLOW",
    membershipId: args.membershipId ?? null,
    contactId: args.contactId ?? null,
  });
  if (!result.alreadyRegistered && ctx) {
    await queueMarketingEventEmail(tx, ctx, {
      kind: "confirmation",
      event,
      registration: { id: result.id, email: args.email.trim().toLowerCase(), name },
      siteUrl: await siteUrlFor(tx, ctx.tenantId),
    });
  }
  return { ok: true as const, alreadyRegistered: result.alreadyRegistered };
}

/**
 * Queues the reminders now due for one academy (the worker calls this every
 * sweep). Each registration's reminder is queued once; the mark is written in
 * the same transaction as the queued email.
 */
export async function queueDueMarketingEventReminders(
  tx: TenantTx,
  ctx: { tenantId: string; requestId: string },
  limit = 50,
): Promise<number> {
  const due = await marketingEventsRepository.lockDueReminders(tx, limit);
  if (due.length === 0) return 0;
  const siteUrl = await siteUrlFor(tx, ctx.tenantId);
  const events = new Map<string, MarketingEventRow | null>();
  let queued = 0;
  for (const row of due) {
    if (!events.has(row.event_id)) {
      events.set(row.event_id, await marketingEventsRepository.findById(tx, row.event_id));
    }
    const event = events.get(row.event_id);
    if (!event) continue;
    await queueMarketingEventEmail(tx, ctx, {
      kind: "reminder",
      event,
      registration: { id: row.registration_id, email: row.email, name: row.name },
      siteUrl,
    });
    await marketingEventsRepository.markReminderQueued(tx, row.registration_id);
    queued += 1;
  }
  return queued;
}
