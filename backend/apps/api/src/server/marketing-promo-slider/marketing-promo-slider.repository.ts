import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type PromoSliderRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_by_membership_id: string;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  slide_count?: bigint | number | null;
  thumbnail_url?: string | null;
  primary_link_url?: string | null;
  has_schedule?: boolean | null;
};

export type PromoSlideRow = {
  id: string;
  slider_id: string;
  name: string;
  image_url: string | null;
  image_fit: string;
  link_url: string | null;
  starts_at: Date | null;
  ends_at: Date | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type SlideInput = {
  id?: string;
  name: string;
  imageUrl: string | null;
  imageFit: string;
  linkUrl: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  sortOrder: number;
};

export const marketingPromoSliderRepository = {
  async list(tx: TenantTx, args: { q?: string; status?: string; limit: number }) {
    const q = args.q?.trim() ?? "";
    const status = args.status && args.status !== "ALL" ? args.status : null;
    return tx.$queryRawUnsafe<PromoSliderRow[]>(
      `
      select
        s.id::text, s.title, s.description, s.status,
        s.created_by_membership_id::text, s.published_at, s.created_at, s.updated_at,
        (select count(*)::bigint from marketing_promo_slides sl where sl.slider_id = s.id) as slide_count,
        (
          select sl.image_url
          from marketing_promo_slides sl
          where sl.slider_id = s.id and coalesce(sl.image_url, '') <> ''
          order by sl.sort_order asc, sl.created_at asc
          limit 1
        ) as thumbnail_url,
        (
          select sl.link_url
          from marketing_promo_slides sl
          where sl.slider_id = s.id and coalesce(sl.link_url, '') <> ''
          order by sl.sort_order asc, sl.created_at asc
          limit 1
        ) as primary_link_url,
        exists(
          select 1
          from marketing_promo_slides sl
          where sl.slider_id = s.id
            and (sl.starts_at is not null or sl.ends_at is not null)
        ) as has_schedule
      from marketing_promo_sliders s
      where ($1::text is null or s.status = $1)
        and ($2 = '' or s.title ilike '%' || $2 || '%' or coalesce(s.description, '') ilike '%' || $2 || '%')
      order by s.updated_at desc
      limit $3
      `,
      status,
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
        total_count: number;
        total_slides: number;
        scheduled_slider_count: number;
      }>
    >(
      `
      select
        count(*) filter (where status = 'LIVE')::int as live_count,
        count(*) filter (where status = 'DRAFT')::int as draft_count,
        count(*) filter (where status = 'UNPUBLISHED')::int as unpublished_count,
        count(*)::int as total_count,
        coalesce(
          (select count(*)::int from marketing_promo_slides),
          0
        ) as total_slides,
        (
          select count(distinct sl.slider_id)::int
          from marketing_promo_slides sl
          where sl.starts_at is not null or sl.ends_at is not null
        ) as scheduled_slider_count
      from marketing_promo_sliders
      `,
    );
    return (
      rows[0] ?? {
        live_count: 0,
        draft_count: 0,
        unpublished_count: 0,
        total_count: 0,
        total_slides: 0,
        scheduled_slider_count: 0,
      }
    );
  },

  async findById(tx: TenantTx, id: string) {
    const rows = await tx.$queryRawUnsafe<PromoSliderRow[]>(
      `
      select
        s.id::text, s.title, s.description, s.status,
        s.created_by_membership_id::text, s.published_at, s.created_at, s.updated_at,
        (select count(*)::bigint from marketing_promo_slides sl where sl.slider_id = s.id) as slide_count
      from marketing_promo_sliders s
      where s.id = $1::uuid
      limit 1
      `,
      id,
    );
    return rows[0] ?? null;
  },

  async listSlides(tx: TenantTx, sliderId: string) {
    return tx.$queryRawUnsafe<PromoSlideRow[]>(
      `
      select
        id::text, slider_id::text, name, image_url, image_fit, link_url,
        starts_at, ends_at, sort_order, created_at, updated_at
      from marketing_promo_slides
      where slider_id = $1::uuid
      order by sort_order asc, created_at asc
      `,
      sliderId,
    );
  },

  async listActivePublicSlides(tx: TenantTx) {
    return tx.$queryRawUnsafe<(PromoSlideRow & { slider_id: string })[]>(
      `
      select
        sl.id::text, sl.slider_id::text, sl.name, sl.image_url, sl.image_fit, sl.link_url,
        sl.starts_at, sl.ends_at, sl.sort_order, sl.created_at, sl.updated_at
      from marketing_promo_slides sl
      inner join marketing_promo_sliders s on s.id = sl.slider_id
      where s.status = 'LIVE'
        and (sl.starts_at is null or sl.starts_at <= now())
        and (sl.ends_at is null or sl.ends_at >= now())
        and coalesce(sl.image_url, '') <> ''
      order by s.published_at desc nulls last, sl.sort_order asc, sl.created_at asc
      `,
    );
  },

  async insert(
    tx: TenantTx,
    args: { title: string; description: string | null; createdByMembershipId: string },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into marketing_promo_sliders (
        id, tenant_id, title, description, status, created_by_membership_id
      ) values (
        ${id}::uuid, app.current_tenant_id(), ${args.title}, ${args.description},
        'DRAFT', ${args.createdByMembershipId}::uuid
      )
    `;
    return id;
  },

  async updateBasics(
    tx: TenantTx,
    args: { id: string; title: string; description: string | null },
  ) {
    await tx.$executeRaw`
      update marketing_promo_sliders
      set title = ${args.title},
          description = ${args.description},
          updated_at = now()
      where id = ${args.id}::uuid
    `;
  },

  async setStatus(tx: TenantTx, id: string, status: "LIVE" | "UNPUBLISHED") {
    if (status === "LIVE") {
      await tx.$executeRaw`
        update marketing_promo_sliders
        set status = 'LIVE', published_at = coalesce(published_at, now()), updated_at = now()
        where id = ${id}::uuid
      `;
      return;
    }
    await tx.$executeRaw`
      update marketing_promo_sliders
      set status = 'UNPUBLISHED', updated_at = now()
      where id = ${id}::uuid
    `;
  },

  async delete(tx: TenantTx, id: string) {
    await tx.$executeRaw`delete from marketing_promo_slides where slider_id = ${id}::uuid`;
    await tx.$executeRaw`delete from marketing_promo_sliders where id = ${id}::uuid`;
  },

  async replaceSlides(tx: TenantTx, sliderId: string, slides: SlideInput[]) {
    await tx.$executeRaw`delete from marketing_promo_slides where slider_id = ${sliderId}::uuid`;
    for (const slide of slides) {
      const id = slide.id ?? randomUUID();
      await tx.$executeRawUnsafe(
        `
        insert into marketing_promo_slides (
          id, tenant_id, slider_id, name, image_url, image_fit, link_url,
          starts_at, ends_at, sort_order
        ) values (
          $1::uuid, app.current_tenant_id(), $2::uuid, $3, $4, $5, $6,
          $7::timestamptz, $8::timestamptz, $9
        )
        `,
        id,
        sliderId,
        slide.name,
        slide.imageUrl,
        slide.imageFit,
        slide.linkUrl,
        slide.startsAt,
        slide.endsAt,
        slide.sortOrder,
      );
    }
  },
};
