import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import {
  createNewsfeedPostBodySchema,
  deleteNewsfeedPostBodySchema,
  deleteNewsfeedPostResponseSchema,
  newsfeedPostResponseSchema,
  newsfeedPostsListQuerySchema,
  newsfeedPostsListResponseSchema,
  newsfeedSettingsResponseSchema,
  publicNewsfeedFeedResponseSchema,
  publicNewsfeedPostResponseSchema,
  saveNewsfeedPostResponseSchema,
  updateNewsfeedPostBodySchema,
  updateNewsfeedSettingsBodySchema,
} from "./marketing-newsfeed.schemas";
import {
  marketingNewsfeedRepository,
  type NewsfeedPostRow,
} from "./marketing-newsfeed.repository";

function notFound(message = "Newsfeed post not found.") {
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

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
  return base.length > 0 ? base : "post";
}

async function uniqueSlug(tx: TenantTx, title: string, excludeId?: string) {
  const base = slugify(title);
  let candidate = base;
  let attempt = 0;
  while (await marketingNewsfeedRepository.slugExists(tx, candidate, excludeId)) {
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
  return candidate;
}

function toDto(row: NewsfeedPostRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    postType: row.post_type as "ARTICLE" | "PROMO",
    status: row.status as "DRAFT" | "LIVE" | "UNPUBLISHED",
    bodyHtml: row.body_html,
    coverImageUrl: row.cover_image_url,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    authorName: row.author_name,
    tags: parseStringList(row.tags_json),
    categories: parseStringList(row.categories_json),
    pinned: row.pinned,
    productId: row.product_id,
    productTitle: row.product_title,
    saveCount: Number(row.save_count ?? 0),
    publishedAt: row.published_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toPublicDto(row: NewsfeedPostRow, saved = false) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    postType: row.post_type as "ARTICLE" | "PROMO",
    bodyHtml: row.body_html,
    coverImageUrl: row.cover_image_url,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    authorName: row.author_name,
    tags: parseStringList(row.tags_json),
    categories: parseStringList(row.categories_json),
    pinned: row.pinned,
    productId: row.product_id,
    productTitle: row.product_title,
    publishedAt: row.published_at?.toISOString() ?? null,
    saved,
  };
}

async function requirePost(tx: TenantTx, id: string) {
  const row = await marketingNewsfeedRepository.findById(tx, id);
  if (!row) throw notFound();
  return row;
}

function assertEditable(row: NewsfeedPostRow) {
  if (row.status === "LIVE") {
    throw validationError("Unpublish the post before editing details.");
  }
}

async function isEnabled(tx: TenantTx) {
  const settings = await marketingNewsfeedRepository.getSettings(tx);
  return settings?.enabled === true;
}

export async function getMarketingNewsfeedSettings(tx: TenantTx) {
  const settings = await marketingNewsfeedRepository.getSettings(tx);
  return newsfeedSettingsResponseSchema.parse({
    data: {
      enabled: settings?.enabled === true,
      updatedAt: settings?.updated_at?.toISOString() ?? null,
    },
  });
}

export async function updateMarketingNewsfeedSettings(
  tx: TenantTx,
  _ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = updateNewsfeedSettingsBodySchema.parse(rawBody);
  await marketingNewsfeedRepository.upsertSettings(tx, body.enabled);
  return getMarketingNewsfeedSettings(tx);
}

export async function listMarketingNewsfeedPosts(
  tx: TenantTx,
  _ctx: ServiceCtx,
  rawQuery: unknown,
) {
  const query = newsfeedPostsListQuerySchema.parse(rawQuery ?? {});
  const [rows, summary] = await Promise.all([
    marketingNewsfeedRepository.list(tx, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.postType ? { postType: query.postType } : {}),
      ...(query.q ? { q: query.q } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      limit: query.limit,
    }),
    marketingNewsfeedRepository.summary(tx),
  ]);
  return newsfeedPostsListResponseSchema.parse({
    data: {
      items: rows.map(toDto),
      summary: {
        liveCount: summary.live_count,
        draftCount: summary.draft_count,
        unpublishedCount: summary.unpublished_count,
        totalCount: summary.total_count,
        articleCount: summary.article_count,
        promoCount: summary.promo_count,
        pinnedCount: summary.pinned_count,
        totalSaves: summary.total_saves,
      },
    },
  });
}

export async function getMarketingNewsfeedPost(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  return newsfeedPostResponseSchema.parse({
    data: toDto(await requirePost(tx, id)),
  });
}

export async function createMarketingNewsfeedPost(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = createNewsfeedPostBodySchema.parse(rawBody);
  const slug = await uniqueSlug(tx, body.title);
  const id = await marketingNewsfeedRepository.insert(tx, {
    title: body.title,
    slug,
    postType: body.postType,
    createdByMembershipId: ctx.actorMembershipId,
  });
  return newsfeedPostResponseSchema.parse({
    data: toDto(await requirePost(tx, id)),
  });
}

export async function updateMarketingNewsfeedPost(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateNewsfeedPostBodySchema.parse(rawBody);
  const existing = await requirePost(tx, id);
  assertEditable(existing);

  const requestedSlug = emptyToNull(body.slug);
  const slug =
    requestedSlug != null
      ? await (async () => {
          const normalized = slugify(requestedSlug);
          if (await marketingNewsfeedRepository.slugExists(tx, normalized, id)) {
            throw validationError("That URL slug is already in use.");
          }
          return normalized;
        })()
      : existing.slug;

  let productId: string | null =
    body.productId === undefined
      ? existing.product_id
      : emptyToNull(typeof body.productId === "string" ? body.productId : null);

  let productTitle: string | null =
    body.productTitle === undefined
      ? existing.product_title
      : emptyToNull(body.productTitle);

  if (productId) {
    const title = await marketingNewsfeedRepository.findProductTitle(tx, productId);
    if (!title) throw validationError("Embedded product was not found.");
    productTitle = emptyToNull(body.productTitle) ?? title;
  } else {
    productId = null;
    productTitle = null;
  }

  await marketingNewsfeedRepository.update(tx, {
    id,
    title: body.title,
    slug,
    bodyHtml: body.bodyHtml === undefined ? existing.body_html : emptyToNull(body.bodyHtml),
    coverImageUrl:
      body.coverImageUrl === undefined
        ? existing.cover_image_url
        : emptyToNull(body.coverImageUrl),
    seoTitle: body.seoTitle === undefined ? existing.seo_title : emptyToNull(body.seoTitle),
    seoDescription:
      body.seoDescription === undefined
        ? existing.seo_description
        : emptyToNull(body.seoDescription),
    authorName:
      body.authorName === undefined ? existing.author_name : emptyToNull(body.authorName),
    tagsJson: body.tags ?? parseStringList(existing.tags_json),
    categoriesJson: body.categories ?? parseStringList(existing.categories_json),
    pinned: body.pinned ?? existing.pinned,
    productId,
    productTitle,
  });

  return newsfeedPostResponseSchema.parse({
    data: toDto(await requirePost(tx, id)),
  });
}

export async function publishMarketingNewsfeedPost(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
) {
  const existing = await requirePost(tx, id);
  if (existing.post_type === "PROMO") {
    if (!existing.cover_image_url) {
      throw validationError("Promo posts require a cover image before publishing.");
    }
    if (!existing.product_id) {
      throw validationError("Promo posts require an embedded product before publishing.");
    }
  }
  if (!existing.title.trim()) {
    throw validationError("Title is required before publishing.");
  }
  await marketingNewsfeedRepository.setStatus(tx, existing.id, "LIVE");
  return newsfeedPostResponseSchema.parse({
    data: toDto(await requirePost(tx, id)),
  });
}

export async function unpublishMarketingNewsfeedPost(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
) {
  await requirePost(tx, id);
  await marketingNewsfeedRepository.setStatus(tx, id, "UNPUBLISHED");
  return newsfeedPostResponseSchema.parse({
    data: toDto(await requirePost(tx, id)),
  });
}

export async function deleteMarketingNewsfeedPost(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = deleteNewsfeedPostBodySchema.parse(rawBody);
  const existing = await requirePost(tx, id);
  if (existing.status === "LIVE") {
    throw validationError("Unpublish the post before deleting it.");
  }
  if (body.titleConfirmation.trim() !== existing.title.trim()) {
    throw validationError("Type the post title to confirm delete.");
  }
  await marketingNewsfeedRepository.delete(tx, id);
  return deleteNewsfeedPostResponseSchema.parse({ data: { id, deleted: true as const } });
}

export async function getPublicNewsfeedSettings(tx: TenantTx) {
  return getMarketingNewsfeedSettings(tx);
}

export async function listPublicNewsfeedFeed(
  tx: TenantTx,
  args?: { tag?: string; category?: string; membershipId?: string | null },
) {
  const enabled = await isEnabled(tx);
  if (!enabled) {
    return publicNewsfeedFeedResponseSchema.parse({
      data: { enabled: false, articles: [], promos: [], tags: [], categories: [] },
    });
  }

  const [articles, promos] = await Promise.all([
    marketingNewsfeedRepository.listLive(tx, {
      postType: "ARTICLE",
      ...(args?.tag ? { tag: args.tag } : {}),
      ...(args?.category ? { category: args.category } : {}),
      limit: 50,
    }),
    marketingNewsfeedRepository.listLive(tx, {
      postType: "PROMO",
      limit: 30,
    }),
  ]);

  const all = [...articles, ...promos];
  const savedIds =
    args?.membershipId != null
      ? await marketingNewsfeedRepository.listSavedPostIds(
          tx,
          args.membershipId,
          all.map((row) => row.id),
        )
      : new Set<string>();

  const tagSet = new Set<string>();
  const categorySet = new Set<string>();
  for (const row of articles) {
    for (const tag of parseStringList(row.tags_json)) tagSet.add(tag);
    for (const category of parseStringList(row.categories_json)) categorySet.add(category);
  }

  return publicNewsfeedFeedResponseSchema.parse({
    data: {
      enabled: true,
      articles: articles.map((row) => toPublicDto(row, savedIds.has(row.id))),
      promos: promos.map((row) => toPublicDto(row, savedIds.has(row.id))),
      tags: [...tagSet].sort(),
      categories: [...categorySet].sort(),
    },
  });
}

export async function getPublicNewsfeedPostBySlug(
  tx: TenantTx,
  slug: string,
  membershipId?: string | null,
) {
  const enabled = await isEnabled(tx);
  if (!enabled) throw notFound("Newsfeed is not enabled.");
  const row = await marketingNewsfeedRepository.findBySlug(tx, slug);
  if (!row || row.status !== "LIVE") throw notFound();
  const saved =
    membershipId != null
      ? await marketingNewsfeedRepository.isSaved(tx, row.id, membershipId)
      : false;
  return publicNewsfeedPostResponseSchema.parse({
    data: toPublicDto(row, saved),
  });
}

export async function savePublicNewsfeedPost(
  tx: TenantTx,
  ctx: ServiceCtx,
  id: string,
) {
  const enabled = await isEnabled(tx);
  if (!enabled) throw notFound("Newsfeed is not enabled.");
  const row = await requirePost(tx, id);
  if (row.status !== "LIVE") throw notFound();
  await marketingNewsfeedRepository.save(tx, id, ctx.actorMembershipId);
  return saveNewsfeedPostResponseSchema.parse({
    data: { postId: id, saved: true },
  });
}

export async function unsavePublicNewsfeedPost(
  tx: TenantTx,
  ctx: ServiceCtx,
  id: string,
) {
  await marketingNewsfeedRepository.unsave(tx, id, ctx.actorMembershipId);
  return saveNewsfeedPostResponseSchema.parse({
    data: { postId: id, saved: false },
  });
}
