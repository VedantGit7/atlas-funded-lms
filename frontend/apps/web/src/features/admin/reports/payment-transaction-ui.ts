import type { ViewerLocale } from "./viewer-time";

export function formatMoneyFor(cents: number, currency: string, viewer: ViewerLocale): string {
  return `${(cents / 100).toLocaleString(viewer.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency.toUpperCase()}`;
}

export function formatAmountFor(cents: number, viewer: ViewerLocale): string {
  return (cents / 100).toLocaleString(viewer.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAbsoluteFor(iso: string | null, viewer: ViewerLocale): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(viewer.locale, {
    timeZone: viewer.timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatClockFor(iso: string | null, viewer: ViewerLocale): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(viewer.locale, {
    timeZone: viewer.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDayClockFor(
  iso: string | null,
  viewer: ViewerLocale,
): { day: string; time: string } {
  if (!iso) return { day: "—", time: "" };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { day: "—", time: "" };
  return {
    day: date.toLocaleDateString(viewer.locale, {
      timeZone: viewer.timeZone,
      month: "short",
      day: "numeric",
    }),
    time: date.toLocaleTimeString(viewer.locale, {
      timeZone: viewer.timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
}

export function statusBadge(status: string): { className: string; label: string } {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "succeeded" || normalized === "success") {
    return {
      label: "PAID",
      className:
        "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)] border-[color-mix(in_srgb,var(--admin-success)_35%,transparent)]",
    };
  }
  if (normalized === "failed" || normalized === "failure" || normalized === "declined") {
    return {
      label: "FAILED",
      className:
        "bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)] border-[color-mix(in_srgb,var(--admin-danger)_35%,transparent)]",
    };
  }
  if (normalized.includes("refund")) {
    return {
      label: "REFUNDED",
      className:
        "bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)] border-[color-mix(in_srgb,var(--admin-warning)_35%,transparent)]",
    };
  }
  return {
    label: status.toUpperCase() || "PENDING",
    className:
      "bg-[var(--admin-surface-variant)] text-[var(--admin-on-surface-variant)] border-[var(--admin-border)]",
  };
}
