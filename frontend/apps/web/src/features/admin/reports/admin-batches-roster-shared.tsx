"use client";

import { Settings2, Users } from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";
import {
  BATCHES_ROSTER_DEFAULTS,
  type BatchHealth,
  type BatchListItem,
  type BatchesRosterPayload,
} from "./admin-batches-roster-api";
import { type ViewerLocale } from "./viewer-time";

export type ModuleTab = "batches" | "compare" | "exports";

export type SavedView = "active" | "at_risk" | "ending_soon" | "archived";

export const PAGE_SIZE = BATCHES_ROSTER_DEFAULTS.limit;

export const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const fieldClassName =
  "h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function formatDate(value: string | null, viewer: ViewerLocale): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(viewer.locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: viewer.timeZone,
  });
}

export function formatDateTime(value: string | null, viewer: ViewerLocale): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(viewer.locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: viewer.timeZone,
  });
}

export function formatRelative(value: string | null, viewer: ViewerLocale): string {
  if (!value) return "No activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity";
  const diffMs = viewer.now - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${String(days)} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${String(months)} months ago`;
}

export function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function metricBarTone(value: number | null | undefined): string {
  if (value == null) return "bg-[var(--admin-outline)]";
  if (value >= 100) return "bg-[var(--admin-success)]";
  if (value < 40) return "bg-[var(--admin-warning)]";
  return "bg-[var(--admin-primary)]";
}

export function statusPillClass(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (normalized === "INACTIVE") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

export function healthRailClass(health: BatchHealth): string {
  if (health === "critical") return "bg-[var(--admin-danger)]";
  if (health === "at_risk") return "bg-[var(--admin-warning)]";
  return "bg-transparent";
}

export function windowCaption(batch: BatchListItem, now: number): string {
  if (batch.endsAt) {
    const ends = new Date(batch.endsAt).getTime();
    if (!Number.isNaN(ends) && ends < now) {
      const days = Math.max(1, Math.floor((now - ends) / (1000 * 60 * 60 * 24)));
      return `Ended ${String(days)} day${days === 1 ? "" : "s"} ago`;
    }
  }
  if (batch.startsAt && batch.endsAt) {
    const start = new Date(batch.startsAt).getTime();
    const end = new Date(batch.endsAt).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      const totalWeeks = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 7)));
      const elapsedWeeks = Math.min(
        totalWeeks,
        Math.max(1, Math.round((now - start) / (1000 * 60 * 60 * 24 * 7))),
      );
      if (now >= start && now <= end) {
        return `Week ${String(elapsedWeeks)} of ${String(totalWeeks)}`;
      }
    }
  }
  if (batch.startsAt) {
    const start = new Date(batch.startsAt).getTime();
    if (!Number.isNaN(start) && start > now) return "Starts soon";
  }
  return "Open window";
}

export function windowProgress(batch: BatchListItem, now: number): number | null {
  if (!batch.startsAt || !batch.endsAt) return null;
  const start = new Date(batch.startsAt).getTime();
  const end = new Date(batch.endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

export function TripleMetricCell({
  value,
  caption,
  linked = true,
}: {
  value: number | null | undefined;
  caption: string;
  linked?: boolean;
}) {
  if (!linked || value == null) {
    return (
      <div className="min-w-[7rem]">
        <p className="font-mono text-sm font-medium text-[var(--admin-on-surface-variant)]">-</p>
        <p className="mt-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
          {linked ? caption : "No linked course"}
        </p>
      </div>
    );
  }
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="min-w-[7rem]">
      <p className="font-mono text-sm font-medium text-[var(--admin-on-surface)]">
        {formatPct(value)}
      </p>
      <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${metricBarTone(value)}`}
          style={{ width: `${String(pct)}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">{caption}</p>
    </div>
  );
}

export function BatchesLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Shimmer className="mb-2 h-8 w-48" />
          <Shimmer className="h-4 w-72" />
        </div>
        <div className="flex gap-3">
          <Shimmer className="h-20 w-32" />
          <Shimmer className="h-20 w-32" />
          <Shimmer className="h-20 w-32" />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
        <div className="flex gap-2">
          <Shimmer className="h-8 w-24" />
          <Shimmer className="h-8 w-24" />
        </div>
        <Shimmer className="h-8 w-32" />
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="grid grid-cols-12 items-center gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
          <Shimmer className="col-span-3 h-3 w-24" />
          <Shimmer className="col-span-2 h-3 w-16" />
          <Shimmer className="col-span-2 h-3 w-16" />
          <Shimmer className="col-span-3 h-3 w-20" />
          <Shimmer className="col-span-2 h-3 w-12 justify-self-end" />
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="relative grid grid-cols-12 items-center gap-3 border-b border-[var(--admin-border)] px-4 py-3 last:border-b-0"
            style={{ animationDelay: `${String(index * 40)}ms` }}
          >
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-surface-high)]" />
            <div className="col-span-3 flex items-center gap-3">
              <Shimmer className="h-6 w-6 rounded-full" />
              <Shimmer className="h-4 w-32" />
            </div>
            <div className="col-span-2">
              <Shimmer className="h-4 w-20" />
            </div>
            <div className="col-span-2">
              <Shimmer className="h-5 w-16 rounded-full" />
            </div>
            <div className="col-span-3 space-y-1">
              <div className="flex justify-between">
                <Shimmer className="h-3 w-8" />
                <Shimmer className="h-3 w-12" />
              </div>
              <Shimmer className="h-1 w-full" />
            </div>
            <div className="col-span-2 justify-self-end">
              <Shimmer className="h-4 w-10" />
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between bg-[var(--admin-surface-low)] px-4 py-3">
          <Shimmer className="h-4 w-32" />
          <div className="flex gap-2">
            <Shimmer className="h-6 w-6" />
            <Shimmer className="h-6 w-6" />
            <Shimmer className="h-6 w-6" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmptyBatchesState({
  hasFilters,
  onClear,
  onManage,
}: {
  hasFilters: boolean;
  onClear: () => void;
  onManage: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-transparent to-[color-mix(in_srgb,var(--admin-primary)_4%,transparent)] px-6 py-16 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
        <Users
          className="h-10 w-10 text-[var(--admin-primary)]"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
        {hasFilters ? "No batches match these filters" : "No batches yet"}
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        {hasFilters
          ? "Batches are created in Admin - Batches, or generated from a filtered report. Adjust your search criteria to see active results."
          : "Create a cohort in Manage batches to start tracking content completion, live attendance, and test scores."}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {hasFilters ? (
          <button type="button" className={secondaryButtonClassName} onClick={onClear}>
            Clear filters
          </button>
        ) : null}
        <button type="button" className={primaryButtonClassName} onClick={onManage}>
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          Manage batches
        </button>
      </div>
    </div>
  );
}

export type BatchesRosterProps = {
  /** The first page of the Active view, loaded by the server; the first browser load is skipped when present. */
  initialRoster?: ReportInitialData<BatchesRosterPayload> | null;
};
