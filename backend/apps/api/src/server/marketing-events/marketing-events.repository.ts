import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type MarketingEventRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  starts_at: Date;
  ends_at: Date | null;
  location: string | null;
  link_url: string | null;
  join_url: string | null;
  cover_image_url: string | null;
  reminder_minutes_before: number | null;
  created_by_membership_id: string;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  registration_count?: bigint | number | null;
};

export type MarketingEventRegistrationRow = {
  id: string;
  event_id: string;
  contact_id: string | null;
  membership_id: string | null;
  email: string;
  name: string | null;
  source: string;
  created_at: Date;
};

export const marketingEventsRepository = {
  async list(tx: TenantTx, args: { q?: string; status?: string; limit: number }) {
    const q = args.q?.trim() ?? "";
    const statusFilter = args.status && args.status !== "ALL" ? args.status : null;
    const pastOnly = statusFilter === "PAST";
    const status = pastOnly ? null : statusFilter;
    return tx.$queryRawUnsafe<MarketingEventRow[]>(
      `
      select
        e.id::text, e.title, e.description, e.status,
        e.starts_at, e.ends_at, e.location, e.link_url, e.join_url, e.cover_image_url,
        e.reminder_minutes_before, e.created_by_membership_id::text,
        e.published_at, e.created_at, e.updated_at,
        (select count(*)::bigint from marketing_event_registrations r where r.event_id = e.id) as registration_count
      from marketing_events e
      where ($1::text is null or e.status = $1)
        and (
          case
            when $2::boolean then (e.ends_at is not null and e.ends_at < now())
            else true
          end
        )
        and ($3 = '' or e.title ilike '%' || $3 || '%' or coalesce(e.description, '') ilike '%' || $3 || '%')
      order by e.updated_at desc, e.starts_at asc
      limit $4
      `,
      status,
      pastOnly,
      q,
      args.limit,
    );
  },

  async summary(tx: TenantTx) {
    const rows = await tx.$queryRawUnsafe<
      Array<{
        live_count: number;
        draft_count: number;
        unpublished_count: number;
        past_count: number;
        total_count: number;
        total_registrations: number;
        upcoming_live_count: number;
      }>
    >(
      `
      select
        count(*) filter (where status = 'LIVE')::int as live_count,
        count(*) filter (where status = 'DRAFT')::int as draft_count,
        count(*) filter (where status = 'UNPUBLISHED')::int as unpublished_count,
        count(*) filter (where ends_at is not null and ends_at < now())::int as past_count,
        count(*)::int as total_count,
        coalesce((select count(*)::int from marketing_event_registrations), 0) as total_registrations,
        count(*) filter (
          where status = 'LIVE'
            and (ends_at is null or ends_at >= now())
            and starts_at >= now()
        )::int as upcoming_live_count
      from marketing_events
      `,
    );
    return (
      rows[0] ?? {
        live_count: 0,
        draft_count: 0,
        unpublished_count: 0,
        past_count: 0,
        total_count: 0,
        total_registrations: 0,
        upcoming_live_count: 0,
      }
    );
  },

  async findById(tx: TenantTx, id: string) {
    const rows = await tx.$queryRawUnsafe<MarketingEventRow[]>(
      `
      select
        e.id::text, e.title, e.description, e.status,
        e.starts_at, e.ends_at, e.location, e.link_url, e.join_url, e.cover_image_url,
        e.reminder_minutes_before, e.created_by_membership_id::text,
        e.published_at, e.created_at, e.updated_at,
        (select count(*)::bigint from marketing_event_registrations r where r.event_id = e.id) as registration_count
      from marketing_events e
      where e.id = $1::uuid
      limit 1
      `,
      id,
    );
    return rows[0] ?? null;
  },

  async listLiveUpcoming(tx: TenantTx, limit = 20) {
    return tx.$queryRawUnsafe<MarketingEventRow[]>(
      `
      select
        e.id::text, e.title, e.description, e.status,
        e.starts_at, e.ends_at, e.location, e.link_url, e.join_url, e.cover_image_url,
        e.reminder_minutes_before, e.created_by_membership_id::text,
        e.published_at, e.created_at, e.updated_at,
        (select count(*)::bigint from marketing_event_registrations r where r.event_id = e.id) as registration_count
      from marketing_events e
      where e.status = 'LIVE'
        and (e.ends_at is null or e.ends_at >= now())
      order by e.starts_at asc
      limit $1
      `,
      limit,
    );
  },

  async insert(
    tx: TenantTx,
    args: {
      title: string;
      description: string | null;
      startsAt: Date;
      endsAt: Date | null;
      createdByMembershipId: string;
    },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into marketing_events (
        id, tenant_id, title, description, status, starts_at, ends_at, created_by_membership_id
      ) values (
        ${id}::uuid, app.current_tenant_id(), ${args.title}, ${args.description},
        'DRAFT', ${args.startsAt}, ${args.endsAt}, ${args.createdByMembershipId}::uuid
      )
    `;
    return id;
  },

  async update(
    tx: TenantTx,
    args: {
      id: string;
      title: string;
      description: string | null;
      startsAt: Date;
      endsAt: Date | null;
      location: string | null;
      linkUrl: string | null;
      joinUrl: string | null;
      coverImageUrl: string | null;
      reminderMinutesBefore: number | null;
    },
  ) {
    await tx.$executeRaw`
      update marketing_events set
        title = ${args.title},
        description = ${args.description},
        starts_at = ${args.startsAt},
        ends_at = ${args.endsAt},
        location = ${args.location},
        link_url = ${args.linkUrl},
        join_url = ${args.joinUrl},
        cover_image_url = ${args.coverImageUrl},
        reminder_minutes_before = ${args.reminderMinutesBefore},
        updated_at = now()
      where id = ${args.id}::uuid
    `;
  },

  async setStatus(tx: TenantTx, id: string, status: "LIVE" | "UNPUBLISHED" | "DRAFT") {
    if (status === "LIVE") {
      await tx.$executeRaw`
        update marketing_events
        set status = 'LIVE', published_at = coalesce(published_at, now()), updated_at = now()
        where id = ${id}::uuid
      `;
      return;
    }
    await tx.$executeRaw`
      update marketing_events
      set status = ${status}, updated_at = now()
      where id = ${id}::uuid
    `;
  },

  async delete(tx: TenantTx, id: string) {
    await tx.$executeRaw`delete from marketing_event_registrations where event_id = ${id}::uuid`;
    await tx.$executeRaw`delete from marketing_events where id = ${id}::uuid`;
  },

  async listRegistrations(tx: TenantTx, eventId: string, limit = 200) {
    return tx.$queryRawUnsafe<MarketingEventRegistrationRow[]>(
      `
      select
        id::text, event_id::text, contact_id::text, membership_id::text,
        email, name, source, created_at
      from marketing_event_registrations
      where event_id = $1::uuid
      order by created_at desc
      limit $2
      `,
      eventId,
      limit,
    );
  },

  async findRegistrationByEmail(tx: TenantTx, eventId: string, email: string) {
    const rows = await tx.$queryRawUnsafe<MarketingEventRegistrationRow[]>(
      `
      select
        id::text, event_id::text, contact_id::text, membership_id::text,
        email, name, source, created_at
      from marketing_event_registrations
      where event_id = $1::uuid and lower(email) = lower($2)
      limit 1
      `,
      eventId,
      email,
    );
    return rows[0] ?? null;
  },

  async upsertRegistration(
    tx: TenantTx,
    args: {
      eventId: string;
      email: string;
      name: string | null;
      source: string;
      contactId?: string | null;
      membershipId?: string | null;
    },
  ) {
    const existing = await this.findRegistrationByEmail(tx, args.eventId, args.email);
    if (existing) {
      return { id: existing.id, alreadyRegistered: true as const };
    }
    const id = randomUUID();
    await tx.$executeRaw`
      insert into marketing_event_registrations (
        id, tenant_id, event_id, contact_id, membership_id, email, name, source
      ) values (
        ${id}::uuid, app.current_tenant_id(), ${args.eventId}::uuid,
        ${args.contactId ?? null}::uuid, ${args.membershipId ?? null}::uuid,
        ${args.email.trim().toLowerCase()}, ${args.name}, ${args.source}
      )
    `;
    return { id, alreadyRegistered: false as const };
  },
};
