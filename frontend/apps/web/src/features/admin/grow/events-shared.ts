export type MarketingEventStatus = "DRAFT" | "LIVE" | "UNPUBLISHED";
export type MarketingEventRegistrationSource = "FORM" | "WORKFLOW" | "LINK" | "ADMIN";

export type MarketingEventDto = {
  id: string;
  title: string;
  description: string | null;
  status: MarketingEventStatus;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  linkUrl: string | null;
  joinUrl: string | null;
  coverImageUrl: string | null;
  reminderMinutesBefore: number | null;
  registrationCount: number;
  isPast: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketingEventListSummary = {
  liveCount: number;
  draftCount: number;
  unpublishedCount: number;
  pastCount: number;
  totalCount: number;
  totalRegistrations: number;
  upcomingLiveCount: number;
};

export type MarketingEventRegistrationDto = {
  id: string;
  eventId: string;
  email: string;
  name: string | null;
  source: MarketingEventRegistrationSource;
  contactId: string | null;
  membershipId: string | null;
  createdAt: string;
};

export type PublicMarketingEventDto = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  linkUrl: string | null;
  joinUrl: string | null;
  coverImageUrl: string | null;
};

export const EVENTS_LIST_HREF = "/admin/marketing/events";
export const EVENTS_CREATE_HREF = "/admin/marketing/events/create";
export const MARKETING_HREF = "/admin/marketing";

export const REMINDER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "No reminder" },
  { value: "15", label: "15 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
  { value: "10080", label: "1 week before" },
];

export function eventHref(id: string) {
  return `/admin/marketing/events/${id}`;
}

export function formatEventDateTime(value: string | null | undefined): string {
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

export function formatEventRelativeFromNow(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const deltaMs = date.getTime() - Date.now();
  const abs = Math.abs(deltaMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const past = deltaMs < 0;

  if (abs < minute) return past ? "Just now" : "Starting now";
  if (abs < hour) {
    const mins = Math.max(1, Math.floor(abs / minute));
    return past
      ? mins === 1
        ? "1 min ago"
        : `${String(mins)} mins ago`
      : mins === 1
        ? "in 1 min"
        : `in ${String(mins)} mins`;
  }
  if (abs < day) {
    const hours = Math.max(1, Math.floor(abs / hour));
    return past
      ? hours === 1
        ? "1 hour ago"
        : `${String(hours)} hours ago`
      : hours === 1
        ? "in 1 hour"
        : `in ${String(hours)} hours`;
  }
  const days = Math.max(1, Math.floor(abs / day));
  if (days < 60) {
    return past
      ? days === 1
        ? "1 day ago"
        : `${String(days)} days ago`
      : days === 1
        ? "in 1 day"
        : `in ${String(days)} days`;
  }
  const months = Math.max(1, Math.floor(days / 30));
  return past
    ? months === 1
      ? "1 month ago"
      : `${String(months)} months ago`
    : months === 1
      ? "in 1 month"
      : `in ${String(months)} months`;
}

export function formatEventCount(value: number): string {
  return new Intl.NumberFormat(undefined).format(value);
}

export function eventStatusLabel(status: MarketingEventStatus): string {
  if (status === "LIVE") return "Live";
  if (status === "UNPUBLISHED") return "Unpublished";
  return "Draft";
}

export function registrationSourceLabel(source: MarketingEventRegistrationSource): string {
  if (source === "FORM") return "Form";
  if (source === "WORKFLOW") return "Workflow";
  if (source === "ADMIN") return "Admin";
  return "Link";
}

/** datetime-local input value from ISO string */
export function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInputValue(local: string): string | null {
  if (!local.trim()) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function countdownParts(startsAt: string): {
  days: number;
  hours: number;
  minutes: number;
  started: boolean;
} {
  const start = new Date(startsAt).getTime();
  const now = Date.now();
  if (Number.isNaN(start) || start <= now) {
    return { days: 0, hours: 0, minutes: 0, started: true };
  }
  let remaining = start - now;
  const day = 24 * 60 * 60 * 1000;
  const hour = 60 * 60 * 1000;
  const minute = 60 * 1000;
  const days = Math.floor(remaining / day);
  remaining -= days * day;
  const hours = Math.floor(remaining / hour);
  remaining -= hours * hour;
  const minutes = Math.floor(remaining / minute);
  return { days, hours, minutes, started: false };
}
