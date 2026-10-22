"use client";

import { type ViewerLocale } from "./viewer-time";

export function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

export type StatusFilter = "all" | "ACTIVE" | "INACTIVE";

export type TierFilter = "any" | "STANDARD" | "PREMIUM";

export type UnpaidBand = "any" | "has_unpaid" | "zero" | "above_1000";

export type ViewTab = "all" | "owed" | "pending" | "top" | "suspended";

export const VIEW_TO_QUERY: Record<Exclude<ViewTab, "pending">, string> = {
  all: "all",
  owed: "owed",
  top: "top",
  suspended: "suspended",
};

export function formatMoneyAmountFor(cents: number, viewer: ViewerLocale): string {
  return (cents / 100).toLocaleString(viewer.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatShortDateFor(iso: string | null, viewer: ViewerLocale): string {
  if (!iso) return "—";
  const date = new Date(iso.includes("T") ? iso : `${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(viewer.locale, {
    timeZone: iso.includes("T") ? viewer.timeZone : "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function initials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${defined(parts[0])[0] ?? ""}${defined(parts[1])[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function isSuspendedStatus(status: string): boolean {
  return status.toUpperCase() === "INACTIVE" || status.toUpperCase() === "SUSPENDED";
}

export function statusLabel(status: string): string {
  if (isSuspendedStatus(status)) return "Suspended";
  if (status.toUpperCase() === "ACTIVE") return "Active";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export function statusPillClass(status: string): string {
  if (isSuspendedStatus(status)) {
    return "bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  if (status.toUpperCase() === "ACTIVE") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

export function tierPillClass(tier: string): string {
  if (tier.toUpperCase() === "PREMIUM") {
    return "bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

export function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
}

export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

export function AffiliatesSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading affiliates">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="space-y-2">
          <Shimmer className="h-8 w-40" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-44" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className={[
              "bg-[var(--admin-surface)] p-4",
              index === 0 ? "col-span-2 sm:col-span-1 lg:col-span-2" : "",
            ].join(" ")}
          >
            <Shimmer className="mb-3 h-3 w-24" />
            <Shimmer className="h-8 w-28" />
            <Shimmer className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-wrap gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <Shimmer className="h-9 w-48" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-40" />
        </div>
        <div className="divide-y divide-[var(--admin-border)]">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex h-11 items-center gap-4 px-4">
              <Shimmer className="h-4 w-4" />
              <Shimmer className="h-8 w-8 rounded-full" />
              <Shimmer className="h-4 flex-1" />
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-4 w-20" />
              <Shimmer className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InitialsAvatar({
  name,
  email,
  size = "md",
}: {
  name: string | null;
  email: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "h-12 w-12 text-sm" : size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs";
  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono font-semibold text-[var(--admin-on-surface-variant)]",
        sizeClass,
      ].join(" ")}
      aria-hidden="true"
    >
      {initials(name, email)}
    </div>
  );
}
