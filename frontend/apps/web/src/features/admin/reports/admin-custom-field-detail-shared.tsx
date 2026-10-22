"use client";

import { useState, type MouseEvent } from "react";
import { Check, CheckCircle2, Copy } from "lucide-react";
import { Select } from "@atlas/design-system";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";
import {
  CUSTOM_FIELD_DETAIL_PAGE_SIZE,
  type CustomFieldDetailBoolean,
  type CustomFieldDetailCrossTab,
  type CustomFieldDetailData,
  type CustomFieldDetailLearner,
  type CustomFieldDetailNumber,
  type CustomFieldDetailSelect,
  type CustomFieldDetailText,
} from "./admin-custom-field-roster-api";
import { useViewerLocale, withViewer, type ViewerLocale } from "./viewer-time";

export const PAGE_SIZE = CUSTOM_FIELD_DETAIL_PAGE_SIZE;

export const selectClassName =
  "h-9 min-w-[160px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const filterInputClassName =
  "h-9 w-full rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)]/70 focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]";

export const labelClassName =
  "mb-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

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

export function formatCountFor(value: number, viewer: ViewerLocale): string {
  return value.toLocaleString(viewer.locale);
}

export function formatPctFor(value: number | null, viewer: ViewerLocale): string {
  if (value == null) return "—";
  return `${value.toLocaleString(viewer.locale, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function formatDateShortFor(value: string | null, viewer: ViewerLocale): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(viewer.locale, {
    timeZone: viewer.timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeDateFor(value: string | null, viewer: ViewerLocale): string {
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
  if (absDays < 60) {
    const weeks = Math.round(absDays / 7);
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * weeks,
      "week",
    );
  }
  return formatDateShortFor(value, viewer);
}

export function formatStatNumberFor(value: number | null, viewer: ViewerLocale): string {
  if (value == null) return "—";
  return value.toLocaleString(viewer.locale, { maximumFractionDigits: 2 });
}

export function fieldTypeMarker(fieldType: string): string {
  const normalized = fieldType.toLowerCase();
  if (normalized === "number") return "num";
  if (normalized === "boolean") return "bol";
  if (normalized === "select") return "sel";
  if (normalized === "date") return "dat";
  return "txt";
}

export function statusPillClass(status: string): string {
  const upper = status.toUpperCase();
  if (upper === "ACTIVE") {
    return "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (upper === "INACTIVE") {
    return "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (upper === "INVITED" || upper === "PENDING") {
    return "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (upper === "SUSPENDED" || upper === "REMOVED") {
    return "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  return "border-[var(--admin-outline)] bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_8%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]";
}

export function learnerInitials(row: CustomFieldDetailLearner): string {
  const source = row.learnerName?.trim() || row.email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function isTruthyBoolean(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return lower === "true" || lower === "yes" || lower === "1";
}

export function FieldValueCell({ value, fieldType }: { value: string | null; fieldType: string }) {
  const viewer = useViewerLocale();
  const formatDateShort = withViewer(formatDateShortFor, viewer);
  if (value == null || value.trim() === "") {
    return <span className="text-[var(--admin-on-surface-variant)]">—</span>;
  }

  const type = fieldType.toLowerCase();
  if (type === "boolean") {
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

  if (type === "select") {
    return (
      <span className="inline-flex max-w-[160px] truncate rounded-sm bg-[var(--admin-surface-high)] px-2 py-0.5 text-[12px] text-[var(--admin-on-surface)]">
        {value}
      </span>
    );
  }

  if (type === "number") {
    return (
      <span className="font-mono text-[13px] tabular-nums text-[var(--admin-on-surface)]">
        {value}
      </span>
    );
  }

  if (type === "date") {
    return (
      <span className="font-mono text-[13px] tabular-nums text-[var(--admin-on-surface-variant)]">
        {formatDateShort(value)}
      </span>
    );
  }

  return (
    <span
      className="max-w-[180px] truncate text-[13px] text-[var(--admin-on-surface)]"
      title={value}
    >
      {value}
    </span>
  );
}

export function CopyKeyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(event: MouseEvent) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1200);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => void handleCopy(event)}
      className="inline-flex items-center text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
      aria-label={`Copy key ${value}`}
      title="Copy key"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading field detail">
      <Shimmer className="h-4 w-24" />
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="space-y-3">
          <Shimmer className="h-8 w-64" />
          <Shimmer className="h-4 w-40" />
          <div className="flex gap-2">
            <Shimmer className="h-6 w-14" />
            <Shimmer className="h-6 w-16" />
            <Shimmer className="h-6 w-28" />
          </div>
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className={[
              "space-y-3 bg-[var(--admin-surface)] p-4",
              index === 0 ? "md:col-span-2" : "",
            ].join(" ")}
          >
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-8 w-16" />
            <Shimmer className="h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <Shimmer className="mb-4 h-4 w-40" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between">
                <Shimmer className="h-4 w-28" />
                <Shimmer className="h-4 w-16" />
              </div>
              <Shimmer className="h-[3px] w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
          <Shimmer className="h-9 w-64" />
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-3.5 w-3.5" />
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DistributionBar({
  label,
  count,
  sharePct,
  leading,
  unused,
  onClick,
  active,
}: {
  label: string;
  count: number;
  sharePct: number | null;
  leading?: boolean;
  unused?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  const viewer = useViewerLocale();
  const formatCount = withViewer(formatCountFor, viewer);
  const formatPct = withViewer(formatPctFor, viewer);
  const width = Math.min(100, Math.max(0, sharePct ?? 0));
  const content = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
            {label}
          </span>
          {unused ? (
            <span className="ml-2 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
              Defined but unused
            </span>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-[12px] tabular-nums text-[var(--admin-on-surface-variant)]">
          {formatCount(count)} · {formatPct(sharePct)}
        </span>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
        <div
          className={[
            "h-full rounded-full transition-[width] duration-500",
            leading
              ? "bg-[var(--admin-primary)]"
              : "bg-[color-mix(in_srgb,var(--admin-primary)_60%,transparent)]",
          ].join(" ")}
          style={{ width: unused ? "0%" : `${width}%` }}
        />
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          "flex w-full flex-col gap-1.5 rounded-sm text-left transition-colors",
          active
            ? "bg-[color-mix(in_srgb,var(--admin-primary)_6%,transparent)]"
            : "hover:bg-[var(--admin-surface-high)]",
        ].join(" ")}
      >
        {content}
      </button>
    );
  }

  return <div className="flex flex-col gap-1.5">{content}</div>;
}

export function SelectDistribution({
  data,
  onFilterValue,
  valueFilter,
}: {
  data: CustomFieldDetailSelect;
  onFilterValue: (value: string | null) => void;
  valueFilter: string;
}) {
  const viewer = useViewerLocale();
  const formatCount = withViewer(formatCountFor, viewer);
  const maxCount = Math.max(0, ...data.options.map((option) => option.count));
  const used = data.options.filter((option) => !option.unused);
  const unused = data.options.filter((option) => option.unused);

  return (
    <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:p-6">
      <h2 className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
        Value distribution
      </h2>
      <div className="flex flex-col gap-4">
        {used.map((option) => (
          <DistributionBar
            key={option.value}
            label={option.value}
            count={option.count}
            sharePct={option.sharePct}
            leading={option.count === maxCount && option.count > 0}
            active={valueFilter === option.value}
            onClick={() => {
              onFilterValue(valueFilter === option.value ? null : option.value);
            }}
          />
        ))}
        {unused.map((option) => (
          <DistributionBar
            key={option.value}
            label={option.value}
            count={option.count}
            sharePct={option.sharePct}
            unused
          />
        ))}
      </div>

      <div className="mt-6 border-t border-[var(--admin-border)] pt-4">
        <h3 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
          Values not in the option list
        </h3>
        {data.orphaned.length === 0 ? (
          <div className="flex items-center gap-2 rounded-sm border border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_8%,var(--admin-surface))] px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--admin-success)]" aria-hidden />
            <p className="text-sm text-[var(--admin-success)]">
              All stored values match the current option list.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.orphaned.map((orphan) => (
              <li
                key={orphan.value}
                className="flex items-center justify-between gap-3 rounded-sm border border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_6%,var(--admin-surface))] px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="truncate text-sm text-[var(--admin-on-surface)]">
                    {orphan.value}
                  </span>
                  <span className="ml-2 inline-flex items-center rounded-sm border border-[var(--admin-warning)] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-[var(--admin-warning)]">
                    Orphaned value
                  </span>
                </div>
                <span className="shrink-0 font-mono text-[12px] tabular-nums text-[var(--admin-on-surface-variant)]">
                  {formatCount(orphan.count)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function CrossTabulationPanel({
  compareFields,
  compareWith,
  onCompareChange,
  crossTab,
}: {
  compareFields: Array<{ key: string; label: string; fieldType: string }>;
  compareWith: string;
  onCompareChange: (value: string) => void;
  crossTab: CustomFieldDetailCrossTab | null;
}) {
  const viewer = useViewerLocale();
  const formatCount = withViewer(formatCountFor, viewer);
  if (compareFields.length === 0) return null;

  const maxCell = crossTab
    ? Math.max(
        1,
        ...crossTab.cells.flatMap((row) => row),
        ...crossTab.rowTotals,
        ...crossTab.columnTotals,
      )
    : 1;

  return (
    <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
          Cross-tabulation
        </h2>
        <div>
          <span className={labelClassName}>Compare with</span>
          <Select
            className={selectClassName}
            value={compareWith}
            onValueChange={onCompareChange}
            options={compareFields.map((field) => ({
              value: field.key,
              label: field.label,
            }))}
            ariaLabel="Compare with field"
          />
        </div>
      </div>

      <p className="mb-3 text-sm text-[var(--admin-on-surface-variant)] md:hidden">
        Open on a larger screen to see the cross-tabulation.
      </p>

      {crossTab ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-[var(--admin-border)] px-2 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    {crossTab.otherField.label}
                  </th>
                  {crossTab.columnValues.map((col) => (
                    <th
                      key={col}
                      className="border-b border-[var(--admin-border)] px-2 py-2 text-center font-mono text-[10px] font-medium text-[var(--admin-on-surface)]"
                    >
                      {col}
                    </th>
                  ))}
                  <th className="border-b border-[var(--admin-border)] px-2 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {crossTab.rowValues.map((rowValue, rowIndex) => (
                  <tr key={rowValue}>
                    <td className="border-b border-[var(--admin-border)] px-2 py-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                      {rowValue}
                    </td>
                    {(crossTab.cells[rowIndex] ?? []).map((cell, colIndex) => {
                      const intensity = cell / maxCell;
                      return (
                        <td
                          key={`${rowValue}-${colIndex}`}
                          className="border-b border-[var(--admin-border)] px-2 py-2 text-center font-mono text-[12px] tabular-nums text-[var(--admin-on-surface)]"
                          style={{
                            backgroundColor: `color-mix(in srgb, var(--admin-primary) ${Math.round(intensity * 28)}%, var(--admin-surface))`,
                          }}
                        >
                          {formatCount(cell)}
                        </td>
                      );
                    })}
                    <td className="border-b border-[var(--admin-border)] px-2 py-2 text-right font-mono text-[12px] font-semibold tabular-nums text-[var(--admin-on-surface)]">
                      {formatCount(crossTab.rowTotals[rowIndex] ?? 0)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="px-2 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Total
                  </td>
                  {crossTab.columnTotals.map((total, index) => (
                    <td
                      key={`col-total-${index}`}
                      className="px-2 py-2 text-center font-mono text-[12px] font-semibold tabular-nums text-[var(--admin-on-surface)]"
                    >
                      {formatCount(total)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right font-mono text-[12px] font-semibold tabular-nums text-[var(--admin-on-surface)]">
                    {formatCount(crossTab.grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {crossTab.strongestAssociation ? (
            <p className="mt-3 text-[12px] text-[var(--admin-on-surface-variant)]">
              {crossTab.strongestAssociation}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Select another select field to compare.
        </p>
      )}
    </section>
  );
}

export function NumberDistribution({ data }: { data: CustomFieldDetailNumber }) {
  const viewer = useViewerLocale();
  const formatCount = withViewer(formatCountFor, viewer);
  const formatStatNumber = withViewer(formatStatNumberFor, viewer);
  const maxCount = Math.max(1, ...data.buckets.map((bucket) => bucket.count));
  const { stats } = data;
  const rangeMin = stats.min ?? data.buckets[0]?.min ?? 0;
  const rangeMax = stats.max ?? data.buckets[data.buckets.length - 1]?.max ?? 1;
  const span = rangeMax - rangeMin || 1;
  const medianLeft =
    stats.median == null
      ? null
      : Math.min(100, Math.max(0, ((stats.median - rangeMin) / span) * 100));

  return (
    <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:p-6">
      <h2 className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
        Value distribution
      </h2>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="relative flex h-40 items-end gap-1 border-b border-[var(--admin-border)] pb-0">
            {data.buckets.map((bucket) => (
              <div
                key={bucket.label}
                className="group relative flex min-w-0 flex-1 flex-col items-center justify-end"
                title={`${bucket.label}: ${formatCount(bucket.count)}`}
              >
                <div
                  className="w-full rounded-t-sm bg-[var(--admin-primary)] transition-[height] duration-500"
                  style={{
                    height: `${Math.max(4, (bucket.count / maxCount) * 100)}%`,
                    opacity: bucket.count === 0 ? 0.25 : 1,
                  }}
                />
              </div>
            ))}
            {medianLeft != null ? (
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-px border-l border-dashed border-[var(--admin-on-surface)]"
                style={{ left: `${medianLeft}%` }}
                aria-hidden
              />
            ) : null}
          </div>
          <div className="mt-2 flex justify-between gap-2 overflow-x-auto font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
            {data.buckets.map((bucket) => (
              <span key={bucket.label} className="min-w-0 flex-1 truncate text-center">
                {bucket.label}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            <span>
              min{" "}
              <strong className="font-medium text-[var(--admin-on-surface)]">
                {formatStatNumber(stats.min)}
              </strong>
            </span>
            <span>
              median{" "}
              <strong className="font-medium text-[var(--admin-on-surface)]">
                {formatStatNumber(stats.median)}
              </strong>
            </span>
            <span>
              mean{" "}
              <strong className="font-medium text-[var(--admin-on-surface)]">
                {formatStatNumber(stats.mean)}
              </strong>
            </span>
            <span>
              max{" "}
              <strong className="font-medium text-[var(--admin-on-surface)]">
                {formatStatNumber(stats.max)}
              </strong>
            </span>
            <span>
              σ{" "}
              <strong className="font-medium text-[var(--admin-on-surface)]">
                {formatStatNumber(stats.stdDev)}
              </strong>
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
              Outliers · high
            </h3>
            <ul className="flex flex-col gap-1.5">
              {data.outliersHigh.length === 0 ? (
                <li className="text-[12px] text-[var(--admin-on-surface-variant)]">None</li>
              ) : (
                data.outliersHigh.map((row) => (
                  <li
                    key={`high-${row.membershipId}`}
                    className="flex items-baseline justify-between gap-2 text-[12px]"
                  >
                    <span className="truncate text-[var(--admin-on-surface)]">
                      {row.learnerName || row.email || "Learner"}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-[var(--admin-on-surface-variant)]">
                      {formatStatNumber(row.value)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
              Outliers · low
            </h3>
            <ul className="flex flex-col gap-1.5">
              {data.outliersLow.length === 0 ? (
                <li className="text-[12px] text-[var(--admin-on-surface-variant)]">None</li>
              ) : (
                data.outliersLow.map((row) => (
                  <li
                    key={`low-${row.membershipId}`}
                    className="flex items-baseline justify-between gap-2 text-[12px]"
                  >
                    <span className="truncate text-[var(--admin-on-surface)]">
                      {row.learnerName || row.email || "Learner"}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-[var(--admin-on-surface-variant)]">
                      {formatStatNumber(row.value)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BooleanSparkline({ points }: { points: CustomFieldDetailBoolean["trend"] }) {
  const width = 280;
  const height = 64;
  const values = points.map((point) => point.yesSharePct ?? 0);
  if (values.length < 2) {
    return (
      <p className="text-sm text-[var(--admin-on-surface-variant)]">Not enough trend data yet.</p>
    );
  }
  const max = Math.max(100, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 8) - 4;
    return `${x},${y}`;
  });
  const polyline = coords.join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-16 w-full max-w-[280px] text-[var(--admin-primary)]"
      role="img"
      aria-label="Yes share trend"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={polyline}
      />
    </svg>
  );
}

export function BooleanDistribution({ data }: { data: CustomFieldDetailBoolean }) {
  const viewer = useViewerLocale();
  const formatCount = withViewer(formatCountFor, viewer);
  const formatPct = withViewer(formatPctFor, viewer);
  const total = Math.max(1, data.yesCount + data.noCount + data.missingCount);
  const yesPct = (data.yesCount / total) * 100;
  const noPct = (data.noCount / total) * 100;
  const missingPct = (data.missingCount / total) * 100;

  return (
    <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:p-6">
      <h2 className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
        Value distribution
      </h2>
      <div className="flex h-10 w-full overflow-hidden rounded-sm border border-[var(--admin-border)]">
        {data.yesCount > 0 ? (
          <div
            className="flex items-center justify-center bg-[var(--admin-success)] px-2 text-[11px] font-medium text-[var(--admin-on-success)]"
            style={{ width: `${yesPct}%` }}
            title={`Yes ${formatCount(data.yesCount)}`}
          >
            {yesPct >= 12 ? `Yes ${formatPct(data.yesSharePct)}` : null}
          </div>
        ) : null}
        {data.noCount > 0 ? (
          <div
            className="flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_35%,var(--admin-surface))] px-2 text-[11px] font-medium text-[var(--admin-on-surface)]"
            style={{ width: `${noPct}%` }}
            title={`No ${formatCount(data.noCount)}`}
          >
            {noPct >= 12 ? `No ${formatPct(data.noSharePct)}` : null}
          </div>
        ) : null}
        {data.missingCount > 0 ? (
          <div
            className="flex items-center justify-center border-l border-[var(--admin-outline)] bg-[var(--admin-surface)] px-2 text-[11px] font-medium text-[var(--admin-on-surface-variant)]"
            style={{ width: `${missingPct}%` }}
            title={`Missing ${formatCount(data.missingCount)}`}
          >
            {missingPct >= 12 ? `Missing ${formatPct(data.missingSharePct)}` : null}
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
        <span>
          Yes{" "}
          <strong className="text-[var(--admin-on-surface)]">
            {formatCount(data.yesCount)} · {formatPct(data.yesSharePct)}
          </strong>
        </span>
        <span>
          No{" "}
          <strong className="text-[var(--admin-on-surface)]">
            {formatCount(data.noCount)} · {formatPct(data.noSharePct)}
          </strong>
        </span>
        <span>
          Missing{" "}
          <strong className="text-[var(--admin-on-surface)]">
            {formatCount(data.missingCount)} · {formatPct(data.missingSharePct)}
          </strong>
        </span>
      </div>

      <div className="mt-6 border-t border-[var(--admin-border)] pt-4">
        <h3 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
          Trend
        </h3>
        <BooleanSparkline points={data.trend} />
        {data.trendCaption ? (
          <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
            {data.trendCaption}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function TextTopValues({ data }: { data: CustomFieldDetailText }) {
  const maxCount = Math.max(0, ...data.topValues.map((item) => item.count));

  return (
    <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:p-6">
      <h2 className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
        Top values
      </h2>
      {data.topValues.length === 0 ? (
        <p className="text-sm text-[var(--admin-on-surface-variant)]">No values recorded.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {data.topValues.map((item) => (
            <DistributionBar
              key={item.value}
              label={item.value}
              count={item.count}
              sharePct={item.sharePct}
              leading={item.count === maxCount && item.count > 0}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function downloadLearnersCsv(learners: CustomFieldDetailLearner[], fieldKey: string) {
  const header = [
    "learnerName",
    "email",
    "fieldValue",
    "enrollmentCount",
    "totalSpentCents",
    "currency",
    "lastActiveAt",
    "signedUpAt",
    "status",
  ];
  const lines = [
    header.join(","),
    ...learners.map((row) =>
      [
        JSON.stringify(row.learnerName ?? ""),
        JSON.stringify(row.email ?? ""),
        JSON.stringify(row.fieldValue ?? ""),
        row.enrollmentCount,
        row.totalSpentCents,
        row.currency,
        row.lastActiveAt ?? "",
        row.signedUpAt ?? "",
        row.status,
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `custom-field-${fieldKey}-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type CustomFieldDetailPageProps = {
  fieldKey: string;
  /** The field and its first page of learners, loaded by the server; the first browser load is skipped when present. */
  initialDetail?: ReportInitialData<CustomFieldDetailData> | null;
};
