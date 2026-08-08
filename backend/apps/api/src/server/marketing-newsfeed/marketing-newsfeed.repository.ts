import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type NewsfeedSettingsRow = {
  tenant_id: string;
  enabled: boolean;
  updated_at: Date;
};

export type NewsfeedPostRow = {
  id: string;
  title: string;
  slug: string;
  post_type: string;
  status: string;
  body_html: string | null;
  cover_image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  author_name: string | null;
  tags_json: unknown;
  categories_json: unknown;
  pinned: boolean;
  product_id: string | null;
  product_title: string | null;
  created_by_membership_id: string;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  save_count?: number | bigint | null;
};

export const marketingNewsfeedRepository = {
  async getSettings(tx: TenantTx) {
    const rows = await tx.$queryRawUnsafe<NewsfeedSettingsRow[]>(
      `
      select tenant_id::text, enabled, updated_at
      from marketing_newsfeed_settings
      where tenant_id = app.current_tenant_id()
      limit 1
      `,
    );
    return rows[0] ?? null;
  },

  async upsertSettings(tx: TenantTx, enabled: boolean) {
    await tx.$executeRaw`
      insert into marketing_newsfeed_settings (tenant_id, enabled)
      values (app.current_tenant_id(), ${enabled})
      on conflict (tenant_id) do update
      set enabled = excluded.enabled, updated_at = now()
    `;
  },

  async list(
    tx: TenantTx,
    args: {
      q?: string;
      status?: string;
      postType?: string;
      productId?: string;
      limit: number;
    },
  ) {
    const q = args.q?.trim() ?? "";
    const status = args.status && args.status !== "ALL" ? args.status : null;
    const postType = args.postType && args.postType !== "ALL" ? args.postType : null;
    const productId = args.productId ?? null;
    return tx.$queryRawUnsafe<NewsfeedPostRow[]>(
      `
      select
        p.id::text, p.title, p.slug, p.post_type, p.status, p.body_html, p.cover_image_url,
        p.seo_title, p.seo_description, p.author_name, p.tags_json, p.categories_json,
        p.pinned, p.product_id::text, p.product_title, p.created_by_membership_id::text,
        p.published_at, p.created_at, p.updated_at,
        coalesce((select count(*)::int from marketing_newsfeed_saves s where s.post_id = p.id), 0) as save_count
      from marketing_newsfeed_posts p
      where ($1::text is null or p.status = $1)
        and ($2::text is null or p.post_type = $2)
        and ($3::uuid is null or p.product_id = $3::uuid)
        and (
          $4 = ''
          or p.title ilike '%' || $4 || '%'
          or coalesce(p.body_html, '') ilike '%' || $4 || '%'
          or coalesce(p.author_name, '') ilike '%' || $4 || '%'
        )
      order by p.pinned desc, coalesce(p.published_at, p.created_at) desc, p.created_at desc
      limit $5
      `,
      status,
      postType,
      productId,
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
        article_count: number;
        promo_count: number;
        pinned_count: number;
        total_saves: number;
      }>
    >(
      `
      select
        count(*) filter (where status = 'LIVE')::int as live_count,
        count(*) filter (where status = 'DRAFT')::int as draft_count,
        count(*) filter (where status = 'UNPUBLISHED')::int as unpublished_count,
        count(*)::int as total_count,
        count(*) filter (where post_type = 'ARTICLE')::int as article_count,
        count(*) filter (where post_type = 'PROMO')::int as promo_count,
        count(*) filter (where pinned)::int as pinned_count,
        coalesce((select count(*)::int from marketing_newsfeed_saves), 0) as total_saves
      from marketing_newsfeed_posts
      `,
    );
    return (
      rows[0] ?? {
        live_count: 0,
        draft_count: 0,
        unpublished_count: 0,
        total_count: 0,
        article_count: 0,
        promo_count: 0,
        pinned_count: 0,
        total_saves: 0,
      }
    );
  },

  async findById(tx: TenantTx, id: string) {
    const rows = await tx.$queryRawUnsafe<NewsfeedPostRow[]>(
      `
      select
        p.id::text, p.title, p.slug, p.post_type, p.status, p.body_html, p.cover_image_url,
        p.seo_title, p.seo_description, p.author_name, p.tags_json, p.categories_json,
        p.pinned, p.product_id::text, p.product_title, p.created_by_membership_id::text,
        p.published_at, p.created_at, p.updated_at,
        coalesce((select count(*)::int from marketing_newsfeed_saves s where s.post_id = p.id), 0) as save_count
      from marketing_newsfeed_posts p
      where p.id = $1::uuid
      limit 1
      `,
      id,
    );
    return rows[0] ?? null;
  },

  async findBySlug(tx: TenantTx, slug: string) {
    const rows = await tx.$queryRawUnsafe<NewsfeedPostRow[]>(
      `
      select
        p.id::text, p.title, p.slug, p.post_type, p.status, p.body_html, p.cover_image_url,
        p.seo_title, p.seo_description, p.author_name, p.tags_json, p.categories_json,
        p.pinned, p.product_id::text, p.product_title, p.created_by_membership_id::text,
        p.published_at, p.created_at, p.updated_at
      from marketing_newsfeed_posts p
      where p.slug = $1
      limit 1
      `,
      slug,
    );
    return rows[0] ?? null;
  },

  async slugExists(tx: TenantTx, slug: string, excludeId?: string) {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `
      select id::text
      from marketing_newsfeed_posts
      where slug = $1
        and ($2::uuid is null or id <> $2::uuid)
      limit 1
      `,
      slug,
      excludeId ?? null,
    );
    return rows.length > 0;
  },

  async listLive(
    tx: TenantTx,
    args: { postType?: "ARTICLE" | "PROMO"; tag?: string; category?: string; limit: number },
  ) {
    const postType = args.postType ?? null;
    const tag = args.tag?.trim() ?? "";
    const category = args.category?.trim() ?? "";
    return tx.$queryRawUnsafe<NewsfeedPostRow[]>(
      `
      select
        p.id::text, p.title, p.slug, p.post_type, p.status, p.body_html, p.cover_image_url,
        p.seo_title, p.seo_description, p.author_name, p.tags_json, p.categories_json,
        p.pinned, p.product_id::text, p.product_title, p.created_by_membership_id::text,
        p.published_at, p.created_at, p.updated_at
      from marketing_newsfeed_posts p
      where p.status = 'LIVE'
        and ($1::text is null or p.post_type = $1)
        and ($2 = '' or p.tags_json @> to_jsonb($2::text))
        and ($3 = '' or p.categories_json @> to_jsonb($3::text))
      order by p.pinned desc, coalesce(p.published_at, p.created_at) desc
      limit $4
      `,
      postType,
      tag,
      category,
      args.limit,
    );
  },

  async insert(
    tx: TenantTx,
    args: {
      title: string;
      slug: string;
      postType: "ARTICLE" | "PROMO";
      createdByMembershipId: string;
    },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into marketing_newsfeed_posts (
        id, tenant_id, title, slug, post_type, status, created_by_membership_id
      ) values (
        ${id}::uuid, app.current_tenant_id(), ${args.title}, ${args.slug},
        ${args.postType}, 'DRAFT', ${args.createdByMembershipId}::uuid
      )
    `;
    return id;
  },

  async update(
    tx: TenantTx,
    args: {
      id: string;
      title: string;
      slug: string;
      bodyHtml: string | null;
      coverImageUrl: string | null;
      seoTitle: string | null;
      seoDescription: string | null;
      authorName: string | null;
      tagsJson: unknown;
      categoriesJson: unknown;
      pinned: boolean;
      productId: string | null;
      productTitle: string | null;
    },
  ) {
    const tagsJson = JSON.stringify(args.tagsJson ?? []);
    const categoriesJson = JSON.stringify(args.categoriesJson ?? []);
    await tx.$executeRaw`
      update marketing_newsfeed_posts set
        title = ${args.title},
        slug = ${args.slug},
        body_html = ${args.bodyHtml},
        cover_image_url = ${args.coverImageUrl},
        seo_title = ${args.seoTitle},
        seo_description = ${args.seoDescription},
        author_name = ${args.authorName},
        tags_json = ${tagsJson}::jsonb,
        categories_json = ${categoriesJson}::jsonb,
        pinned = ${args.pinned},
        product_id = ${args.productId}::uuid,
        product_title = ${args.productTitle},
        updated_at = now()
      where id = ${args.id}::uuid
    `;
  },

  async setStatus(tx: TenantTx, id: string, status: "LIVE" | "UNPUBLISHED" | "DRAFT") {
    if (status === "LIVE") {
      await tx.$executeRaw`
        update marketing_newsfeed_posts
        set status = 'LIVE', published_at = coalesce(published_at, now()), updated_at = now()
        where id = ${id}::uuid
      `;
      return;
    }
    await tx.$executeRaw`
      update marketing_newsfeed_posts
      set status = ${status}, updated_at = now()
      where id = ${id}::uuid
    `;
  },

  async delete(tx: TenantTx, id: string) {
    await tx.$executeRaw`delete from marketing_newsfeed_saves where post_id = ${id}::uuid`;
    await tx.$executeRaw`delete from marketing_newsfeed_posts where id = ${id}::uuid`;
  },

  async findProductTitle(tx: TenantTx, productId: string) {
    const rows = await tx.$queryRawUnsafe<Array<{ title: string }>>(
      `
      select title
      from courses
      where id = $1::uuid
      limit 1
      `,
      productId,
    );
    return rows[0]?.title ?? null;
  },

  async isSaved(tx: TenantTx, postId: string, membershipId: string) {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `
      select id::text
      from marketing_newsfeed_saves
      where post_id = $1::uuid and membership_id = $2::uuid
      limit 1
      `,
      postId,
      membershipId,
    );
    return rows.length > 0;
  },

  async listSavedPostIds(tx: TenantTx, membershipId: string, postIds: string[]) {
    if (postIds.length === 0) return new Set<string>();
    const rows = await tx.$queryRawUnsafe<Array<{ post_id: string }>>(
      `
      select post_id::text
      from marketing_newsfeed_saves
      where membership_id = $1::uuid
        and post_id = any($2::uuid[])
      `,
      membershipId,
      postIds,
    );
    return new Set(rows.map((row) => row.post_id));
  },

  async save(tx: TenantTx, postId: string, membershipId: string) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into marketing_newsfeed_saves (id, tenant_id, post_id, membership_id)
      values (${id}::uuid, app.current_tenant_id(), ${postId}::uuid, ${membershipId}::uuid)
      on conflict (tenant_id, post_id, membership_id) do nothing
    `;
  },

  async unsave(tx: TenantTx, postId: string, membershipId: string) {
    await tx.$executeRaw`
      delete from marketing_newsfeed_saves
      where post_id = ${postId}::uuid and membership_id = ${membershipId}::uuid
    `;
  },
};
