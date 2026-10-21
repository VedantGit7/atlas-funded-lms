"use client";

import type { ReportInitialData } from "../../../lib/server/report-initial-data";
import {
  type BatchDetailTab,
  type BatchLearnersPayload,
  BATCH_LEARNER_COLUMN_OPTIONS,
  type BatchDetail,
  type BatchHealth,
  type BatchLearnerColumnKey,
} from "./admin-batches-roster-api";
import { type ViewerLocale } from "./viewer-time";

export type DetailTab = BatchDetailTab;

export type LearnerPanelTab = "live" | "exams" | "course";

export type CompletionOp = "gte" | "lte";

export const PAGE_SIZE = 25;

export const DEFAULT_COLUMNS: BatchLearnerColumnKey[] = BATCH_LEARNER_COLUMN_OPTIONS.map(
  (column) => column.key,
);

export const DETAIL_TABS: Array<{ key: DetailTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "learners", label: "Learners" },
  { key: "live_sessions", label: "Live sessions" },
  { key: "exams", label: "Exams" },
  { key: "content", label: "Content" },
  { key: "messages", label: "Messages" },
];

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

export function formatCountFor(value: number, viewer: ViewerLocale): string {
  return value.toLocaleString(viewer.locale);
}

export function formatDateFor(value: string | null | undefined, viewer: ViewerLocale): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(viewer.locale, {
    timeZone: viewer.timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTimeFor(value: string | null | undefined, viewer: ViewerLocale): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(viewer.locale, {
    timeZone: viewer.timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeFor(value: string | null, viewer: ViewerLocale): string {
  if (!value) return "No activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity";
  const diffMs = viewer.now - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export function isStaleActivityFor(value: string | null, viewer: ViewerLocale): boolean {
  if (!value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  return viewer.now - date.getTime() > 14 * 24 * 60 * 60 * 1000;
}

export function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function metricBarTone(
  value: number | null | undefined,
  passMark: number | null | undefined = 70,
): string {
  if (value == null) return "bg-[var(--admin-outline)]";
  const pass = passMark ?? 70;
  if (value >= pass) return "bg-[var(--admin-success)]";
  if (value >= 40) return "bg-[var(--admin-warning)]";
  return "bg-[var(--admin-danger)]";
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

export function healthLabel(health: BatchHealth): string {
  if (health === "critical") return "Critical";
  if (health === "at_risk") return "At risk";
  return "On track";
}

export function weekCaptionFor(
  startsAt: string | null,
  endsAt: string | null,
  viewer: ViewerLocale,
): string {
  const now = viewer.now;
  if (endsAt) {
    const ends = new Date(endsAt).getTime();
    if (!Number.isNaN(ends) && ends < now) {
      const days = Math.max(1, Math.floor((now - ends) / (1000 * 60 * 60 * 24)));
      return `Ended ${days} day${days === 1 ? "" : "s"} ago`;
    }
  }
  if (startsAt && endsAt) {
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      const totalWeeks = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 7)));
      const elapsedWeeks = Math.min(
        totalWeeks,
        Math.max(1, Math.round((now - start) / (1000 * 60 * 60 * 24 * 7))),
      );
      if (now >= start && now <= end) {
        return `Week ${elapsedWeeks} of ${totalWeeks}`;
      }
    }
  }
  if (startsAt) {
    const start = new Date(startsAt).getTime();
    if (!Number.isNaN(start) && start > now) return "Starts soon";
  }
  return "Open window";
}

export function learnerInitials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function TripleMetricCell({
  value,
  caption,
  linked = true,
  passMark,
}: {
  value: number | null | undefined;
  caption: string;
  linked?: boolean;
  passMark?: number | null;
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
          className={`h-full rounded-full transition-[width] duration-200 ${metricBarTone(value, passMark)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">{caption}</p>
    </div>
  );
}

export function SummaryMetricCard({
  label,
  value,
  caption,
  barValue,
  passMark,
  span2,
  warning,
  onClick,
}: {
  label: string;
  value: string;
  caption: string;
  barValue?: number | null;
  passMark?: number | null;
  span2?: boolean;
  warning?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <p
        className={[
          "text-[11px] font-semibold uppercase tracking-[0.06em]",
          warning ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface-variant)]",
        ].join(" ")}
      >
        {label}
      </p>
      <p
        className={[
          "mt-2 font-mono font-medium leading-none",
          span2 ? "text-[32px]" : "text-2xl",
          warning ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface)]",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">{caption}</p>
      {barValue != null ? (
        <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
          <div
            className={`h-full rounded-full ${metricBarTone(barValue, passMark)}`}
            style={{ width: `${Math.max(0, Math.min(100, barValue))}%` }}
          />
        </div>
      ) : null}
    </>
  );

  const className = [
    "rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left",
    span2 ? "md:col-span-2" : "",
    warning ? "border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))]" : "",
    onClick ? "transition-colors hover:bg-[var(--admin-surface-high)]" : "",
  ].join(" ");

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

export function DetailLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-3">
        <Shimmer className="h-3 w-64" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Shimmer className="h-8 w-72" />
            <Shimmer className="h-4 w-40" />
            <div className="flex gap-2">
              <Shimmer className="h-6 w-16 rounded-md" />
              <Shimmer className="h-6 w-24 rounded-md" />
              <Shimmer className="h-6 w-20 rounded-md" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Shimmer className="h-9 w-24" />
            <Shimmer className="h-9 w-28" />
            <Shimmer className="h-9 w-32" />
            <Shimmer className="h-9 w-36" />
          </div>
        </div>
      </div>
      <div className="flex gap-1 border-b border-[var(--admin-border)] pb-0">
        {Array.from({ length: 6 }).map((_, index) => (
          <Shimmer key={index} className="mb-2 h-8 w-24" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <Shimmer className="h-28 md:col-span-2" />
        <Shimmer className="h-28" />
        <Shimmer className="h-28" />
        <div className="grid gap-3">
          <Shimmer className="h-[3.25rem]" />
          <Shimmer className="h-[3.25rem]" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Shimmer className="h-72 lg:col-span-7" />
        <div className="space-y-4 lg:col-span-5">
          <Shimmer className="h-40" />
          <Shimmer className="h-40" />
        </div>
      </div>
    </div>
  );
}

export type BatchDetailPageProps = {
  batchId: string;
  /** The batch, loaded by the server; the first browser load is skipped when present. */
  initialDetail?: ReportInitialData<BatchDetail> | null;
  /** The first page of learners, loaded by the server when the address opens that tab. */
  initialLearners?: ReportInitialData<BatchLearnersPayload> | null;
};
