export type PromoSliderStatus = "DRAFT" | "LIVE" | "UNPUBLISHED";
export type PromoSlideImageFit = "COVER" | "CONTAIN" | "FILL";

export type PromoSlideDto = {
  id: string;
  sliderId: string;
  name: string;
  imageUrl: string | null;
  imageFit: PromoSlideImageFit;
  linkUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PromoSliderDto = {
  id: string;
  title: string;
  description: string | null;
  status: PromoSliderStatus;
  slideCount: number;
  slides: PromoSlideDto[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PromoSliderListItem = {
  id: string;
  title: string;
  description: string | null;
  status: PromoSliderStatus;
  slideCount: number;
  thumbnailUrl: string | null;
  primaryLinkUrl: string | null;
  hasSchedule: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PromoSliderListSummary = {
  liveCount: number;
  draftCount: number;
  unpublishedCount: number;
  totalCount: number;
  totalSlides: number;
  scheduledSliderCount: number;
};

export type PublicPromoSlideDto = {
  id: string;
  name: string;
  imageUrl: string | null;
  imageFit: PromoSlideImageFit;
  linkUrl: string | null;
  sortOrder: number;
};

export const PROMO_SLIDER_LIST_HREF = "/admin/marketing/promo-slider";
export const PROMO_SLIDER_CREATE_HREF = "/admin/marketing/promo-slider/create";
export const MARKETING_HREF = "/admin/marketing";

export function promoSliderHref(id: string) {
  return `/admin/marketing/promo-slider/${id}`;
}

export function formatPromoDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPromoRelativeTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const deltaMs = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (deltaMs < minute) return "Just now";
  if (deltaMs < hour) {
    const mins = Math.max(1, Math.floor(deltaMs / minute));
    return mins === 1 ? "1 min ago" : `${String(mins)} mins ago`;
  }
  if (deltaMs < day) {
    const hours = Math.max(1, Math.floor(deltaMs / hour));
    return hours === 1 ? "1 hour ago" : `${String(hours)} hours ago`;
  }
  if (deltaMs < 2 * day) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatPromoCount(value: number): string {
  return new Intl.NumberFormat(undefined).format(value);
}

export function promoStatusLabel(status: PromoSliderStatus): string {
  if (status === "LIVE") return "Live";
  if (status === "UNPUBLISHED") return "Unpublished";
  return "Draft";
}

export function promoImageFitLabel(fit: PromoSlideImageFit): string {
  if (fit === "CONTAIN") return "Contain";
  if (fit === "FILL") return "Fill";
  return "Cover";
}

export function slideHasSchedule(slide: {
  startsAt?: string | null;
  endsAt?: string | null;
}): boolean {
  return Boolean(slide.startsAt || slide.endsAt);
}

export function newDraftSlide(sortOrder: number): Omit<
  PromoSlideDto,
  "sliderId" | "createdAt" | "updatedAt"
> & {
  id?: string;
  sliderId?: string;
} {
  return {
    id: `draft_${Date.now()}_${sortOrder}`,
    name: `Slide ${sortOrder + 1}`,
    imageUrl: null,
    imageFit: "COVER",
    linkUrl: null,
    startsAt: null,
    endsAt: null,
    sortOrder,
  };
}
