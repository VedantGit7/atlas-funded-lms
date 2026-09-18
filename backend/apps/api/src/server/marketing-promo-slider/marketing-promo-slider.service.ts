import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import {
  createPromoSliderBodySchema,
  deletePromoSliderBodySchema,
  deletePromoSliderResponseSchema,
  promoSlideDtoSchema,
  promoSliderResponseSchema,
  promoSlidersListQuerySchema,
  promoSlidersListResponseSchema,
  publicPromoSlidesResponseSchema,
  replacePromoSlidesBodySchema,
  updatePromoSliderBasicsBodySchema,
} from "./marketing-promo-slider.schemas";
import {
  marketingPromoSliderRepository,
  type PromoSlideRow,
  type PromoSliderRow,
  type SlideInput,
} from "./marketing-promo-slider.repository";

function notFound(message = "Promo slider not found.") {
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

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw validationError("Invalid date.");
  return date;
}

function toSlideDto(row: PromoSlideRow) {
  return promoSlideDtoSchema.parse({
    id: row.id,
    sliderId: row.slider_id,
    name: row.name,
    imageUrl: row.image_url,
    imageFit: row.image_fit,
    linkUrl: row.link_url,
    startsAt: row.starts_at?.toISOString() ?? null,
    endsAt: row.ends_at?.toISOString() ?? null,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
}

async function toSliderDto(tx: TenantTx, row: PromoSliderRow) {
  const slides = await marketingPromoSliderRepository.listSlides(tx, row.id);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as "DRAFT" | "LIVE" | "UNPUBLISHED",
    slideCount: Number(row.slide_count ?? slides.length),
    slides: slides.map(toSlideDto),
    publishedAt: row.published_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function requireSlider(tx: TenantTx, id: string) {
  const row = await marketingPromoSliderRepository.findById(tx, id);
  if (!row) throw notFound();
  return row;
}

function assertEditable(row: PromoSliderRow) {
  if (row.status === "LIVE") {
    throw validationError("Unpublish the promo slider before editing slides.");
  }
}

function toListItemDto(row: PromoSliderRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as "DRAFT" | "LIVE" | "UNPUBLISHED",
    slideCount: Number(row.slide_count ?? 0),
    thumbnailUrl: row.thumbnail_url ?? null,
    primaryLinkUrl: row.primary_link_url ?? null,
    hasSchedule: Boolean(row.has_schedule),
    publishedAt: row.published_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listPromoSliders(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = promoSlidersListQuerySchema.parse(rawQuery ?? {});
  const [rows, summary] = await Promise.all([
    marketingPromoSliderRepository.list(tx, {
      status: query.status,
      ...(query.q ? { q: query.q } : {}),
      limit: query.limit,
    }),
    marketingPromoSliderRepository.summary(tx),
  ]);
  return promoSlidersListResponseSchema.parse({
    data: {
      items: rows.map(toListItemDto),
      summary: {
        liveCount: summary.live_count,
        draftCount: summary.draft_count,
        unpublishedCount: summary.unpublished_count,
        totalCount: summary.total_count,
        totalSlides: summary.total_slides,
        scheduledSliderCount: summary.scheduled_slider_count,
      },
    },
  });
}

export async function getPromoSlider(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  return promoSliderResponseSchema.parse({
    data: await toSliderDto(tx, await requireSlider(tx, id)),
  });
}

export async function createPromoSlider(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createPromoSliderBodySchema.parse(rawBody);
  const id = await marketingPromoSliderRepository.insert(tx, {
    title: body.title,
    description: body.description ?? null,
    createdByMembershipId: ctx.actorMembershipId,
  });
  // Seed one empty slide so the builder has something to edit.
  await marketingPromoSliderRepository.replaceSlides(tx, id, [
    {
      name: "Slide 1",
      imageUrl: null,
      imageFit: "COVER",
      linkUrl: null,
      startsAt: null,
      endsAt: null,
      sortOrder: 0,
    },
  ]);
  return promoSliderResponseSchema.parse({
    data: await toSliderDto(tx, await requireSlider(tx, id)),
  });
}

export async function updatePromoSliderBasics(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updatePromoSliderBasicsBodySchema.parse(rawBody);
  await requireSlider(tx, id);
  await marketingPromoSliderRepository.updateBasics(tx, {
    id,
    title: body.title,
    description: body.description ?? null,
  });
  return promoSliderResponseSchema.parse({
    data: await toSliderDto(tx, await requireSlider(tx, id)),
  });
}

export async function replacePromoSlides(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = replacePromoSlidesBodySchema.parse(rawBody);
  const existing = await requireSlider(tx, id);
  assertEditable(existing);

  const slides: SlideInput[] = body.slides.map((slide, _index) => {
    const startsAt = parseOptionalDate(slide.startsAt);
    const endsAt = parseOptionalDate(slide.endsAt);
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw validationError("Slide end date must be after start date.");
    }
    return {
      ...(slide.id ? { id: slide.id } : {}),
      name: slide.name,
      imageUrl: emptyToNull(slide.imageUrl),
      imageFit: slide.imageFit,
      linkUrl: emptyToNull(slide.linkUrl),
      startsAt,
      endsAt,
      sortOrder: slide.sortOrder,
    };
  });

  await marketingPromoSliderRepository.replaceSlides(tx, id, slides);
  return promoSliderResponseSchema.parse({
    data: await toSliderDto(tx, await requireSlider(tx, id)),
  });
}

export async function publishPromoSlider(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const existing = await requireSlider(tx, id);
  const slides = await marketingPromoSliderRepository.listSlides(tx, id);
  if (slides.length === 0) {
    throw validationError("Add at least one slide before publishing.");
  }
  if (!slides.some((slide) => slide.image_url)) {
    throw validationError("At least one slide needs an image before publishing.");
  }
  await marketingPromoSliderRepository.setStatus(tx, existing.id, "LIVE");
  return promoSliderResponseSchema.parse({
    data: await toSliderDto(tx, await requireSlider(tx, id)),
  });
}

export async function unpublishPromoSlider(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  await requireSlider(tx, id);
  await marketingPromoSliderRepository.setStatus(tx, id, "UNPUBLISHED");
  return promoSliderResponseSchema.parse({
    data: await toSliderDto(tx, await requireSlider(tx, id)),
  });
}

export async function deletePromoSlider(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = deletePromoSliderBodySchema.parse(rawBody);
  const existing = await requireSlider(tx, id);
  if (existing.status === "LIVE") {
    throw validationError("Unpublish the promo slider before deleting it.");
  }
  if (body.titleConfirmation.trim() !== existing.title.trim()) {
    throw validationError("Type the slider name to confirm delete.");
  }
  await marketingPromoSliderRepository.delete(tx, id);
  return deletePromoSliderResponseSchema.parse({ data: { id, deleted: true as const } });
}

export async function listPublicPromoSlides(tx: TenantTx) {
  const rows = await marketingPromoSliderRepository.listActivePublicSlides(tx);
  // Prefer slides from the most recently published Live slider (already ordered).
  const primarySliderId = rows[0]?.slider_id ?? null;
  const items = rows
    .filter((row) => !primarySliderId || row.slider_id === primarySliderId)
    .map((row) => ({
      id: row.id,
      name: row.name,
      imageUrl: row.image_url,
      imageFit: row.image_fit as "COVER" | "CONTAIN" | "FILL",
      linkUrl: row.link_url,
      sortOrder: row.sort_order,
    }));
  return publicPromoSlidesResponseSchema.parse({
    data: { sliderId: primarySliderId, items },
  });
}
