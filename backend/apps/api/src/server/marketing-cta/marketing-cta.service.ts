import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import {
  createMarketingCtaBodySchema,
  deleteMarketingCtaBodySchema,
  deleteMarketingCtaResponseSchema,
  marketingCtaResponseSchema,
  marketingCtasListQuerySchema,
  marketingCtasListResponseSchema,
  publicMarketingCtaMetricResponseSchema,
  publicMarketingCtasListResponseSchema,
  updateMarketingCtaBasicsBodySchema,
  updateMarketingCtaDesignBodySchema,
  updateMarketingCtaTargetingBodySchema,
} from "./marketing-cta.schemas";
import {
  marketingCtaRepository,
  parseTargeting,
  type MarketingCtaRow,
} from "./marketing-cta.repository";

function notFound(message = "CTA not found.") {
  return new AtlasHttpError({ code: "PERMISSION_DENIED", status: 404, message });
}

function validationError(message: string) {
  return new AtlasHttpError({ code: "VALIDATION_ERROR", status: 400, message });
}

function toDto(row: MarketingCtaRow) {
  const views = Number(row.view_count ?? 0);
  const clicks = Number(row.click_count ?? 0);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    ctaType: row.cta_type as "POPUP" | "STICKY" | "SLIDE_IN" | "EMBEDDED_BUTTON",
    status: row.status as "DRAFT" | "LIVE" | "UNPUBLISHED",
    headline: row.headline,
    bodyHtml: row.body_html,
    imageUrl: row.image_url,
    buttonText: row.button_text,
    buttonColor: row.button_color,
    buttonTextColor: row.button_text_color,
    backgroundColor: row.background_color,
    linkUrl: row.link_url,
    formId: row.form_id,
    formTitle: row.form_title,
    formShareToken: row.form_share_token,
    linkedPopupCtaId: row.linked_popup_cta_id,
    linkedPopupTitle: row.linked_popup_title,
    targeting: parseTargeting(row.targeting_json),
    viewCount: views,
    clickCount: clicks,
    clickRate: views > 0 ? Math.round((clicks / views) * 10000) / 100 : 0,
    publishedAt: row.published_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toPublicDto(row: MarketingCtaRow) {
  return {
    id: row.id,
    ctaType: row.cta_type as "POPUP" | "STICKY" | "SLIDE_IN" | "EMBEDDED_BUTTON",
    headline: row.headline,
    bodyHtml: row.body_html,
    imageUrl: row.image_url,
    buttonText: row.button_text,
    buttonColor: row.button_color,
    buttonTextColor: row.button_text_color,
    backgroundColor: row.background_color,
    linkUrl: row.link_url,
    formShareToken: row.form_share_token,
    linkedPopupCtaId: row.linked_popup_cta_id,
    targeting: parseTargeting(row.targeting_json),
  };
}

async function requireCta(tx: TenantTx, id: string) {
  const row = await marketingCtaRepository.findById(tx, id);
  if (!row) throw notFound();
  return row;
}

function assertEditable(row: MarketingCtaRow) {
  if (row.status === "LIVE") {
    throw validationError("Unpublish the CTA before editing design or targeting.");
  }
}

function emptyToNull(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function listMarketingCtas(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = marketingCtasListQuerySchema.parse(rawQuery ?? {});
  const [rows, summary] = await Promise.all([
    marketingCtaRepository.list(tx, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.ctaType ? { ctaType: query.ctaType } : {}),
      ...(query.q ? { q: query.q } : {}),
      limit: query.limit,
    }),
    marketingCtaRepository.summary(tx),
  ]);
  const avgClickRate =
    summary.total_views > 0
      ? Math.round((summary.total_clicks / summary.total_views) * 10000) / 100
      : 0;
  const topType =
    summary.top_type === "POPUP" ||
    summary.top_type === "STICKY" ||
    summary.top_type === "SLIDE_IN" ||
    summary.top_type === "EMBEDDED_BUTTON"
      ? summary.top_type
      : null;
  return marketingCtasListResponseSchema.parse({
    data: {
      items: rows.map(toDto),
      summary: {
        liveCount: summary.live_count,
        draftCount: summary.draft_count,
        unpublishedCount: summary.unpublished_count,
        totalCount: summary.total_count,
        totalViews: summary.total_views,
        totalClicks: summary.total_clicks,
        avgClickRate,
        topType,
      },
    },
  });
}

export async function getMarketingCta(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  return marketingCtaResponseSchema.parse({ data: toDto(await requireCta(tx, id)) });
}

export async function createMarketingCta(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createMarketingCtaBodySchema.parse(rawBody);
  const id = await marketingCtaRepository.insert(tx, {
    title: body.title,
    description: body.description ?? null,
    ctaType: body.ctaType,
    buttonText: body.buttonText?.trim() || "Learn more",
    createdByMembershipId: ctx.actorMembershipId,
  });
  return marketingCtaResponseSchema.parse({ data: toDto(await requireCta(tx, id)) });
}

export async function updateMarketingCtaBasics(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateMarketingCtaBasicsBodySchema.parse(rawBody);
  await requireCta(tx, id);
  await marketingCtaRepository.updateBasics(tx, {
    id,
    title: body.title,
    description: body.description ?? null,
  });
  return marketingCtaResponseSchema.parse({ data: toDto(await requireCta(tx, id)) });
}

export async function updateMarketingCtaDesign(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateMarketingCtaDesignBodySchema.parse(rawBody);
  const existing = await requireCta(tx, id);
  assertEditable(existing);

  const formId = body.formId ?? null;
  const linkedPopupCtaId = body.linkedPopupCtaId ?? null;

  if (existing.cta_type === "POPUP" && formId) {
    const live = await marketingCtaRepository.formIsLive(tx, formId);
    if (!live) throw validationError("Connect a Live form only.");
  }
  if (existing.cta_type !== "POPUP" && formId) {
    throw validationError("Only pop-up CTAs can embed a form.");
  }
  if (existing.cta_type === "EMBEDDED_BUTTON" && linkedPopupCtaId) {
    if (linkedPopupCtaId === id) throw validationError("A button cannot link to itself.");
    const ok = await marketingCtaRepository.popupIsCompatible(tx, linkedPopupCtaId);
    if (!ok) throw validationError("Link To must reference a pop-up CTA.");
  }
  if (existing.cta_type !== "EMBEDDED_BUTTON" && linkedPopupCtaId) {
    throw validationError("Only embedded button CTAs can link to a pop-up.");
  }

  await marketingCtaRepository.updateDesign(tx, {
    id,
    headline: body.headline,
    bodyHtml: emptyToNull(body.bodyHtml),
    imageUrl: emptyToNull(body.imageUrl),
    buttonText: body.buttonText,
    buttonColor: body.buttonColor,
    buttonTextColor: body.buttonTextColor,
    backgroundColor: body.backgroundColor,
    linkUrl: emptyToNull(body.linkUrl),
    formId: existing.cta_type === "POPUP" ? formId : null,
    linkedPopupCtaId: existing.cta_type === "EMBEDDED_BUTTON" ? linkedPopupCtaId : null,
  });
  return marketingCtaResponseSchema.parse({ data: toDto(await requireCta(tx, id)) });
}

export async function updateMarketingCtaTargeting(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateMarketingCtaTargetingBodySchema.parse(rawBody);
  const existing = await requireCta(tx, id);
  assertEditable(existing);
  await marketingCtaRepository.updateTargeting(tx, { id, targeting: body.targeting });
  return marketingCtaResponseSchema.parse({ data: toDto(await requireCta(tx, id)) });
}

export async function publishMarketingCta(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const existing = await requireCta(tx, id);
  const targeting = parseTargeting(existing.targeting_json);
  if (targeting.includeUrls.length === 0) {
    throw validationError("Add at least one targeting URL (or *) before publishing.");
  }
  if (existing.cta_type === "EMBEDDED_BUTTON" && !existing.linked_popup_cta_id && !existing.link_url) {
    throw validationError("Embedded button needs a linked pop-up CTA or link URL.");
  }
  if (existing.cta_type === "POPUP" && !existing.form_id && !existing.link_url) {
    throw validationError("Pop-up needs a connected Live form or a link URL before publishing.");
  }
  if (
    (existing.cta_type === "STICKY" || existing.cta_type === "SLIDE_IN") &&
    !existing.link_url
  ) {
    throw validationError("Add a link URL before publishing this CTA.");
  }
  await marketingCtaRepository.setStatus(tx, id, "LIVE");
  return marketingCtaResponseSchema.parse({ data: toDto(await requireCta(tx, id)) });
}

export async function unpublishMarketingCta(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  await requireCta(tx, id);
  await marketingCtaRepository.setStatus(tx, id, "UNPUBLISHED");
  return marketingCtaResponseSchema.parse({ data: toDto(await requireCta(tx, id)) });
}

export async function deleteMarketingCta(tx: TenantTx, _ctx: ServiceCtx, id: string, rawBody: unknown) {
  const body = deleteMarketingCtaBodySchema.parse(rawBody);
  const existing = await requireCta(tx, id);
  if (existing.status === "LIVE") {
    throw validationError("Unpublish the CTA before deleting it.");
  }
  if (body.titleConfirmation.trim() !== existing.title.trim()) {
    throw validationError("Type the CTA title to confirm delete.");
  }
  await marketingCtaRepository.delete(tx, id);
  return deleteMarketingCtaResponseSchema.parse({ data: { id, deleted: true as const } });
}

export async function listPublicMarketingCtas(tx: TenantTx) {
  const rows = await marketingCtaRepository.listLive(tx);
  return publicMarketingCtasListResponseSchema.parse({
    data: { items: rows.map(toPublicDto) },
  });
}

export async function recordPublicMarketingCtaView(tx: TenantTx, id: string) {
  const existing = await requireCta(tx, id);
  if (existing.status !== "LIVE") throw notFound();
  await marketingCtaRepository.incrementView(tx, id);
  return publicMarketingCtaMetricResponseSchema.parse({
    data: { id, recorded: true as const },
  });
}

export async function recordPublicMarketingCtaClick(tx: TenantTx, id: string) {
  const existing = await requireCta(tx, id);
  if (existing.status !== "LIVE") throw notFound();
  await marketingCtaRepository.incrementClick(tx, id);
  return publicMarketingCtaMetricResponseSchema.parse({
    data: { id, recorded: true as const },
  });
}
