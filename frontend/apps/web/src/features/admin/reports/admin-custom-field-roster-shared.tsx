"use client";

import { AlertTriangle } from "lucide-react";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";
import {
  type CustomFieldDefinitionColumn,
  type CustomFieldRosterItem,
  type CustomFieldRosterSummary,
  type CustomFieldDefinitionsPayload,
  type CustomFieldRosterPayload,
} from "./admin-custom-field-roster-api";
import { useViewerLocale, type ViewerLocale } from "./viewer-time";

export function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

export const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Any status" },
  { value: "ACTIVE", label: "Active" },
  { value: "INVITED", label: "Invited" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "REMOVED", label: "Removed" },
];

export const PAGE_SIZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "25", label: "25 rows" },
  { value: "50", label: "50 rows" },
  { value: "100", label: "100 rows" },
];

export const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const filterInputClassName =
  "h-9 w-full rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)]/70 focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]";

export const labelClassName =
  "ml-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

export type ExtraFilter = {
  id: string;
  field: "email" | "status" | "minTotalSpent" | "maxTotalSpent";
  value: string;
};

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

export function formatCount(value: number, viewer: ViewerLocale): string {
  return value.toLocaleString(viewer.locale);
}

export function formatPct(value: number | null, viewer: ViewerLocale): string {
  if (value == null) return "—";
  return `${value.toLocaleString(viewer.locale, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function formatDateShort(value: string | null, viewer: ViewerLocale): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(viewer.locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: viewer.timeZone,
  });
}

export function formatRelativeDate(value: string | null, viewer: ViewerLocale): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = date.getTime() - viewer.now;
  const absDays = Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
  if (absDays < 1) {
    const absHours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
    if (absHours < 1) return "Just now";
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * absHours,
      "hour",
    );
  }
  if (absDays < 14) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * absDays,
      "day",
    );
  }
  return formatDateShort(value, viewer);
}

export function moneyToCents(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const amount = Number(trimmed);
  if (Number.isNaN(amount) || amount < 0) return undefined;
  return Math.round(amount * 100);
}

export function fieldTypeMarker(fieldType: string): string {
  const normalized = fieldType.toLowerCase();
  if (normalized === "number" || normalized === "num") return "num";
  if (normalized === "boolean" || normalized === "bool") return "bol";
  if (normalized === "select" || normalized === "sel") return "sel";
  if (normalized === "date" || normalized === "dat") return "dat";
  return "txt";
}

export function statusPillClass(status: string): string {
  const upper = status.toUpperCase();
  if (upper === "ACTIVE") {
    return "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (upper === "INVITED" || upper === "PENDING") {
    return "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (upper === "SUSPENDED" || upper === "REMOVED") {
    return "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  return "border-[var(--admin-outline)] bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_8%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]";
}

export function learnerInitials(row: CustomFieldRosterItem): string {
  const source = row.learnerName?.trim() || row.email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${defined(parts[0])[0] ?? ""}${defined(parts[1])[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function isTruthyBoolean(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return lower === "true" || lower === "yes" || lower === "1";
}

export function CustomFieldCell({ value, fieldType }: { value: string | null; fieldType: string }) {
  const viewer = useViewerLocale();
  if (value == null || value.trim() === "") {
    return <span className="text-[var(--admin-on-surface-variant)]">—</span>;
  }

  const type = fieldType.toLowerCase();
  if (type === "boolean" || type === "bool") {
    const yes = isTruthyBoolean(value);
    return (
      <span
        className={[
          "inline-flex items-center justify-center rounded-sm border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase",
          yes
            ? "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]"
            : "border-[var(--admin-outline)] bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_8%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]",
        ].join(" ")}
      >
        {yes ? "Yes" : "No"}
      </span>
    );
  }

  if (type === "select" || type === "sel") {
    return (
      <span className="inline-flex max-w-[160px] truncate rounded-sm bg-[var(--admin-surface-high)] px-2 py-0.5 text-[12px] text-[var(--admin-on-surface-variant)]">
        {value}
      </span>
    );
  }

  if (type === "number" || type === "num") {
    return (
      <span className="block text-right font-mono text-[13px] tabular-nums text-[var(--admin-on-surface)]">
        {value}
      </span>
    );
  }

  if (type === "date" || type === "dat") {
    return (
      <span className="block text-right font-mono text-[13px] tabular-nums text-[var(--admin-on-surface-variant)]">
        {formatDateShort(value, viewer)}
      </span>
    );
  }

  return (
    <span
      className="block max-w-[160px] truncate text-[13px] text-[var(--admin-on-surface)]"
      title={value}
    >
      {value}
    </span>
  );
}

export function RosterSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading custom field roster">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="space-y-3">
          <Shimmer className="h-3 w-48" />
          <Shimmer className="h-8 w-64 max-w-full" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-36" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-3 bg-[var(--admin-surface)] p-4">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-7 w-16" />
            <Shimmer className="h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <div className="flex flex-wrap gap-3">
            <Shimmer className="h-9 w-52" />
            <Shimmer className="h-9 w-36" />
            <Shimmer className="h-9 w-36" />
            <Shimmer className="h-9 w-40" />
          </div>
        </div>
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
          <Shimmer className="h-3 w-full max-w-4xl" />
        </div>
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-3.5 w-3.5 shrink-0" />
            <Shimmer className="h-4 w-48 shrink-0" />
            <Shimmer className="h-4 w-12" />
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-5 w-16" />
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SummaryBand({ summary }: { summary: CustomFieldRosterSummary }) {
  const viewer = useViewerLocale();
  const filledShare =
    summary.learnerCount > 0
      ? (summary.learnersWithAllFieldsFilled / summary.learnerCount) * 100
      : 0;

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-5">
      <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4 md:col-span-1">
        <span className={labelClassName}>Learners</span>
        <span className="font-mono text-[20px] font-medium tabular-nums text-[var(--admin-on-surface)]">
          {formatCount(summary.learnerCount, viewer)}
        </span>
        <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          {formatCount(summary.activeLearnerCount, viewer)} active ·{" "}
          {formatCount(summary.inactiveLearnerCount, viewer)} inactive
        </span>
      </div>

      <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
        <span className={labelClassName}>Custom fields</span>
        <span className="font-mono text-[20px] font-medium tabular-nums text-[var(--admin-on-surface)]">
          {formatCount(summary.customFieldCount, viewer)}
        </span>
      </div>

      <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
        <span className={labelClassName}>Average coverage</span>
        <div className="flex items-end gap-2">
          <span className="font-mono text-[20px] font-medium tabular-nums text-[var(--admin-on-surface)]">
            {formatPct(summary.averageCoveragePct, viewer)}
          </span>
          <div className="mb-1.5 h-[3px] w-16 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
            <div
              className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-500"
              style={{
                width: `${String(Math.min(100, Math.max(0, summary.averageCoveragePct ?? 0)))}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
        <span className={labelClassName}>Learners w/ 100% fields</span>
        <span className="font-mono text-[20px] font-medium tabular-nums text-[var(--admin-on-surface)]">
          {formatCount(summary.learnersWithAllFieldsFilled, viewer)}
        </span>
        <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          {formatPct(filledShare, viewer)}
        </span>
      </div>

      <div
        className={[
          "relative flex flex-col gap-1 overflow-hidden p-4",
          summary.fieldsBelow40Coverage > 0
            ? "bg-[color-mix(in_srgb,var(--admin-warning)_4%,var(--admin-surface))]"
            : "bg-[var(--admin-surface)]",
        ].join(" ")}
      >
        <span
          className={[
            "inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em]",
            summary.fieldsBelow40Coverage > 0
              ? "text-[var(--admin-warning)]"
              : "text-[var(--admin-on-surface-variant)]",
          ].join(" ")}
        >
          {summary.fieldsBelow40Coverage > 0 ? (
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          ) : null}
          Fields &lt; 40% coverage
        </span>
        <span
          className={[
            "font-mono text-[20px] font-medium tabular-nums",
            summary.fieldsBelow40Coverage > 0
              ? "text-[var(--admin-warning)]"
              : "text-[var(--admin-on-surface)]",
          ].join(" ")}
        >
          {formatCount(summary.fieldsBelow40Coverage, viewer)}
        </span>
      </div>
    </div>
  );
}

/**
 * The definitions the page starts with: the full list first, then the ones
 * the roster page reported (which win on conflicts), as the two loads merge
 * when the browser makes them.
 */
export function mergeInitialDefinitions(
  definitions: CustomFieldDefinitionColumn[],
  rosterDefinitions: CustomFieldDefinitionColumn[],
): CustomFieldDefinitionColumn[] {
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
  for (const definition of rosterDefinitions) byKey.set(definition.key, definition);
  return [...byKey.values()];
}

/** The first eight custom fields are shown as columns until the operator picks otherwise. */
export function seedCustomColumns(
  current: string[],
  definitions: CustomFieldDefinitionColumn[],
): string[] {
  if (current.some((column) => column.startsWith("cf:"))) return current;
  return [...current, ...definitions.slice(0, 8).map((definition) => `cf:${definition.key}`)];
}

export type CustomFieldRosterProps = {
  /** The first roster page, loaded by the server; the first browser load is skipped when present. */
  initialRoster?: ReportInitialData<CustomFieldRosterPayload> | null;
  /** The full custom field definition list, loaded by the server. */
  initialDefinitions?: ReportInitialData<CustomFieldDefinitionsPayload> | null;
};
