import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import {
  ctaTargetingSchema,
  defaultCtaTargeting,
  type CtaTargeting,
} from "./marketing-cta.schemas";

export type MarketingCtaRow = {
  id: string;
  title: string;
  description: string | null;
  cta_type: string;
  status: string;
  headline: string;
  body_html: string | null;
  image_url: string | null;
  button_text: string;
  button_color: string;
  button_text_color: string;
  background_color: string;
  link_url: string | null;
  form_id: string | null;
  form_title: string | null;
  form_share_token: string | null;
  linked_popup_cta_id: string | null;
  linked_popup_title: string | null;
  targeting_json: unknown;
  view_count: number;
  click_count: number;
  created_by_membership_id: string;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const SELECT_CTA = `
  c.id::text, c.title, c.description, c.cta_type, c.status, c.headline, c.body_html,
  c.image_url, c.button_text, c.button_color, c.button_text_color, c.background_color,
  c.link_url, c.form_id::text, f.title as form_title, f.share_token as form_share_token,
  c.linked_popup_cta_id::text, p.title as linked_popup_title, c.targeting_json,
  c.view_count, c.click_count, c.created_by_membership_id::text, c.published_at,
  c.created_at, c.updated_at
`;

export function parseTargeting(raw: unknown): CtaTargeting {
  try {
    return ctaTargetingSchema.parse(raw ?? defaultCtaTargeting());
  } catch {
    return defaultCtaTargeting();
  }
}

export const marketingCtaRepository = {
  async list(tx: TenantTx, args: { q?: string; status?: string; ctaType?: string; limit: number }) {
    const q = args.q?.trim() ?? "";
    const status = args.status && args.status !== "ALL" ? args.status : null;
    const ctaType = args.ctaType && args.ctaType !== "ALL" ? args.ctaType : null;
    return tx.$queryRawUnsafe<MarketingCtaRow[]>(
      `
      select ${SELECT_CTA}
      from marketing_ctas c
      left join marketing_forms f on f.id = c.form_id
      left join marketing_ctas p on p.id = c.linked_popup_cta_id
      where ($1::text is null or c.status = $1)
        and ($2::text is null or c.cta_type = $2)
        and ($3 = '' or c.title ilike '%' || $3 || '%' or coalesce(c.description, '') ilike '%' || $3 || '%')
      order by c.updated_at desc
      limit $4
      `,
      status,
      ctaType,
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
        total_views: number;
        total_clicks: number;
        top_type: string | null;
      }>
    >(
      `
      with counts as (
        select
          count(*) filter (where status = 'LIVE')::int as live_count,
          count(*) filter (where status = 'DRAFT')::int as draft_count,
          count(*) filter (where status = 'UNPUBLISHED')::int as unpublished_count,
          count(*)::int as total_count,
          coalesce(sum(view_count), 0)::int as total_views,
          coalesce(sum(click_count), 0)::int as total_clicks
        from marketing_ctas
      ),
      top as (
        select cta_type
        from marketing_ctas
        group by cta_type
        order by sum(click_count) desc, sum(view_count) desc, count(*) desc
        limit 1
      )
      select
        counts.*,
        top.cta_type as top_type
      from counts
      left join top on true
      `,
    );
    return (
      rows[0] ?? {
        live_count: 0,
        draft_count: 0,
        unpublished_count: 0,
        total_count: 0,
        total_views: 0,
        total_clicks: 0,
        top_type: null,
      }
    );
  },

  async findById(tx: TenantTx, id: string) {
    const rows = await tx.$queryRawUnsafe<MarketingCtaRow[]>(
      `
      select ${SELECT_CTA}
      from marketing_ctas c
      left join marketing_forms f on f.id = c.form_id
      left join marketing_ctas p on p.id = c.linked_popup_cta_id
      where c.id = $1::uuid
      limit 1
      `,
      id,
    );
    return rows[0] ?? null;
  },

  async listLive(tx: TenantTx) {
    return tx.$queryRawUnsafe<MarketingCtaRow[]>(
      `
      select ${SELECT_CTA}
      from marketing_ctas c
      left join marketing_forms f on f.id = c.form_id and f.status = 'LIVE'
      left join marketing_ctas p on p.id = c.linked_popup_cta_id
      where c.status = 'LIVE'
      order by c.published_at desc nulls last, c.created_at desc
      `,
    );
  },

  async insert(
    tx: TenantTx,
    args: {
      title: string;
      description: string | null;
      ctaType: string;
      buttonText: string;
      createdByMembershipId: string;
    },
  ) {
    const id = randomUUID();
    const targeting = defaultCtaTargeting();
    await tx.$executeRaw`
      insert into marketing_ctas (
        id, tenant_id, title, description, cta_type, status, headline, button_text,
        targeting_json, created_by_membership_id
      ) values (
        ${id}::uuid, app.current_tenant_id(), ${args.title}, ${args.description},
        ${args.ctaType}, 'DRAFT', ${args.title}, ${args.buttonText},
        ${JSON.stringify(targeting)}::jsonb, ${args.createdByMembershipId}::uuid
      )
    `;
    return id;
  },

  async updateBasics(
    tx: TenantTx,
    args: { id: string; title: string; description: string | null },
  ) {
    await tx.$executeRaw`
      update marketing_ctas
      set title = ${args.title},
          description = ${args.description},
          updated_at = now()
      where id = ${args.id}::uuid
    `;
  },

  async updateDesign(
    tx: TenantTx,
    args: {
      id: string;
      headline: string;
      bodyHtml: string | null;
      imageUrl: string | null;
      buttonText: string;
      buttonColor: string;
      buttonTextColor: string;
      backgroundColor: string;
      linkUrl: string | null;
      formId: string | null;
      linkedPopupCtaId: string | null;
    },
  ) {
    await tx.$executeRawUnsafe(
      `
      update marketing_ctas
      set headline = $1,
          body_html = $2,
          image_url = $3,
          button_text = $4,
          button_color = $5,
          button_text_color = $6,
          background_color = $7,
          link_url = $8,
          form_id = $9::uuid,
          linked_popup_cta_id = $10::uuid,
          updated_at = now()
      where id = $11::uuid
      `,
      args.headline,
      args.bodyHtml,
      args.imageUrl,
      args.buttonText,
      args.buttonColor,
      args.buttonTextColor,
      args.backgroundColor,
      args.linkUrl,
      args.formId,
      args.linkedPopupCtaId,
      args.id,
    );
  },

  async updateTargeting(tx: TenantTx, args: { id: string; targeting: CtaTargeting }) {
    await tx.$executeRaw`
      update marketing_ctas
      set targeting_json = ${JSON.stringify(args.targeting)}::jsonb,
          updated_at = now()
      where id = ${args.id}::uuid
    `;
  },

  async setStatus(tx: TenantTx, id: string, status: "LIVE" | "UNPUBLISHED") {
    if (status === "LIVE") {
      await tx.$executeRaw`
        update marketing_ctas
        set status = 'LIVE', published_at = coalesce(published_at, now()), updated_at = now()
        where id = ${id}::uuid
      `;
      return;
    }
    await tx.$executeRaw`
      update marketing_ctas
      set status = 'UNPUBLISHED', updated_at = now()
      where id = ${id}::uuid
    `;
  },

  async delete(tx: TenantTx, id: string) {
    await tx.$executeRaw`delete from marketing_ctas where id = ${id}::uuid`;
  },

  async incrementView(tx: TenantTx, id: string) {
    await tx.$executeRaw`
      update marketing_ctas
      set view_count = view_count + 1, updated_at = now()
      where id = ${id}::uuid and status = 'LIVE'
    `;
  },

  async incrementClick(tx: TenantTx, id: string) {
    await tx.$executeRaw`
      update marketing_ctas
      set click_count = click_count + 1, updated_at = now()
      where id = ${id}::uuid and status = 'LIVE'
    `;
  },

  async formIsLive(tx: TenantTx, formId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      select id::text from marketing_forms
      where id = ${formId}::uuid and status = 'LIVE'
      limit 1
    `;
    return Boolean(rows[0]);
  },

  async popupIsCompatible(tx: TenantTx, popupId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      select id::text from marketing_ctas
      where id = ${popupId}::uuid and cta_type = 'POPUP'
      limit 1
    `;
    return Boolean(rows[0]);
  },
};
