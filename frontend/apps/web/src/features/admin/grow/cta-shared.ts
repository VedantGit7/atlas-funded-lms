export type CtaStatus = "DRAFT" | "LIVE" | "UNPUBLISHED";
export type CtaType = "POPUP" | "STICKY" | "SLIDE_IN" | "EMBEDDED_BUTTON";
export type CtaAudience = "ALL" | "ANONYMOUS" | "LEARNERS";
export type CtaFrequency = "REPEAT" | "ONCE";
export type CtaTrigger = "PAGE_LOAD" | "ELAPSED";

export type CtaTargeting = {
  includeUrls: string[];
  exceptionUrls: string[];
  audience: CtaAudience;
  frequency: CtaFrequency;
  trigger: CtaTrigger;
  elapsedSeconds: number;
};

export type CtaDto = {
  id: string;
  title: string;
  description: string | null;
  ctaType: CtaType;
  status: CtaStatus;
  headline: string;
  bodyHtml: string | null;
  imageUrl: string | null;
  buttonText: string;
  buttonColor: string;
  buttonTextColor: string;
  backgroundColor: string;
  linkUrl: string | null;
  formId: string | null;
  formTitle: string | null;
  formShareToken: string | null;
  linkedPopupCtaId: string | null;
  linkedPopupTitle: string | null;
  targeting: CtaTargeting;
  viewCount: number;
  clickCount: number;
  clickRate: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicCtaDto = {
  id: string;
  ctaType: CtaType;
  headline: string;
  bodyHtml: string | null;
  imageUrl: string | null;
  buttonText: string;
  buttonColor: string;
  buttonTextColor: string;
  backgroundColor: string;
  linkUrl: string | null;
  formShareToken: string | null;
  linkedPopupCtaId: string | null;
  targeting: CtaTargeting;
};

export const CTA_LIST_HREF = "/admin/marketing/cta";
export const CTA_CREATE_HREF = "/admin/marketing/cta/create";
export const MARKETING_HREF = "/admin/marketing";

export function ctaHref(id: string) {
  return `/admin/marketing/cta/${id}`;
}

export function formatCtaDateTime(value: string | null | undefined): string {
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

export function formatCtaRelativeTime(value: string | null | undefined): string {
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

export function formatCtaCount(value: number): string {
  return new Intl.NumberFormat(undefined).format(value);
}

export function formatCompactCtaCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(value);
}

export function ctaStatusLabel(status: CtaStatus): string {
  if (status === "LIVE") return "Live";
  if (status === "UNPUBLISHED") return "Unpublished";
  return "Draft";
}

export function ctaTypeLabel(type: CtaType): string {
  switch (type) {
    case "POPUP":
      return "Pop-up";
    case "STICKY":
      return "Sticky banner";
    case "SLIDE_IN":
      return "Slide-in";
    case "EMBEDDED_BUTTON":
      return "Embedded button";
    default:
      return type;
  }
}

export type CtaListSummary = {
  liveCount: number;
  draftCount: number;
  unpublishedCount: number;
  totalCount: number;
  totalViews: number;
  totalClicks: number;
  avgClickRate: number;
  topType: CtaType | null;
};

export function defaultTargeting(): CtaTargeting {
  return {
    includeUrls: ["*"],
    exceptionUrls: [],
    audience: "ALL",
    frequency: "REPEAT",
    trigger: "PAGE_LOAD",
    elapsedSeconds: 0,
  };
}

export function embedButtonSnippet(cta: Pick<CtaDto, "id" | "buttonText">): string {
  return `<button type="button" data-atlas-cta-button="${cta.id}">${cta.buttonText}</button>`;
}
