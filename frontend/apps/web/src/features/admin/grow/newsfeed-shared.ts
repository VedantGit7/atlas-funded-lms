export type NewsfeedPostType = "ARTICLE" | "PROMO";
export type NewsfeedPostStatus = "DRAFT" | "LIVE" | "UNPUBLISHED";

export type NewsfeedSettingsDto = {
  enabled: boolean;
  updatedAt: string | null;
};

export type NewsfeedPostDto = {
  id: string;
  title: string;
  slug: string;
  postType: NewsfeedPostType;
  status: NewsfeedPostStatus;
  bodyHtml: string | null;
  coverImageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  authorName: string | null;
  tags: string[];
  categories: string[];
  pinned: boolean;
  productId: string | null;
  productTitle: string | null;
  saveCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewsfeedListSummary = {
  liveCount: number;
  draftCount: number;
  unpublishedCount: number;
  totalCount: number;
  articleCount: number;
  promoCount: number;
  pinnedCount: number;
  totalSaves: number;
};

export type PublicNewsfeedPostDto = {
  id: string;
  title: string;
  slug: string;
  postType: NewsfeedPostType;
  bodyHtml: string | null;
  coverImageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  authorName: string | null;
  tags: string[];
  categories: string[];
  pinned: boolean;
  productId: string | null;
  productTitle: string | null;
  publishedAt: string | null;
  saved?: boolean;
};

export const NEWSFEED_LIST_HREF = "/admin/marketing/newsfeed";
export const NEWSFEED_CREATE_HREF = "/admin/marketing/newsfeed/create";
export const MARKETING_HREF = "/admin/marketing";

export function newsfeedHref(id: string) {
  return `/admin/marketing/newsfeed/${id}`;
}

export function newsfeedStatusLabel(status: NewsfeedPostStatus): string {
  if (status === "LIVE") return "Live";
  if (status === "DRAFT") return "Draft";
  return "Unpublished";
}

export function newsfeedTypeLabel(type: NewsfeedPostType): string {
  return type === "PROMO" ? "Promo" : "Article";
}

export function formatNewsfeedCount(value: number): string {
  if (value >= 1000) {
    const scaled = value / 1000;
    const text = scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1);
    return `${text.replace(/\.0$/, "")}k`;
  }
  return String(value);
}

export function formatNewsfeedDate(value: string | null | undefined): string {
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

export function formatNewsfeedRelativeTime(value: string | null | undefined): string {
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

export function newsfeedExcerpt(bodyHtml: string | null | undefined, max = 72): string {
  if (!bodyHtml) return "";
  const text = bodyHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function parseCsvList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
