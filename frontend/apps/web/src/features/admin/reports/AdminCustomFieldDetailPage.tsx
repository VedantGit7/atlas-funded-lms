"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, type MouseEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  createCustomFieldReportGroup,
  exportCustomFieldReport,
  fetchCustomFieldDetail,
  formatMoney,
  sendCustomFieldReportMessage,
  type CustomFieldDetailBoolean,
  type CustomFieldDetailCrossTab,
  type CustomFieldDetailData,
  type CustomFieldDetailLearner,
  type CustomFieldDetailNumber,
  type CustomFieldDetailSelect,
  type CustomFieldDetailText,
} from "./admin-custom-field-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { CustomFieldReportTabs } from "./CustomFieldReportTabs";

const PAGE_SIZE = 10;

const selectClassName =
  "h-9 min-w-[160px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const filterInputClassName =
  "h-9 w-full rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)]/70 focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]";

const labelClassName =
  "mb-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

function Shimmer({ className }: { className?: string }) {
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

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatDateShort(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatRelativeDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = date.getTime() - Date.now();
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
  return formatDateShort(value);
}

function formatStatNumber(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fieldTypeMarker(fieldType: string): string {
  const normalized = fieldType.toLowerCase();
  if (normalized === "number") return "num";
  if (normalized === "boolean") return "bol";
  if (normalized === "select") return "sel";
  if (normalized === "date") return "dat";
  return "txt";
}

function statusPillClass(status: string): string {
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

function learnerInitials(row: CustomFieldDetailLearner): string {
  const source = row.learnerName?.trim() || row.email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function isTruthyBoolean(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return lower === "true" || lower === "yes" || lower === "1";
}

function FieldValueCell({ value, fieldType }: { value: string | null; fieldType: string }) {
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

function CopyKeyButton({ value }: { value: string }) {
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

function DetailSkeleton() {
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

function DistributionBar({
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

function SelectDistribution({
  data,
  onFilterValue,
  valueFilter,
}: {
  data: CustomFieldDetailSelect;
  onFilterValue: (value: string | null) => void;
  valueFilter: string;
}) {
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

function CrossTabulationPanel({
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

function NumberDistribution({ data }: { data: CustomFieldDetailNumber }) {
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

function BooleanSparkline({ points }: { points: CustomFieldDetailBoolean["trend"] }) {
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

function BooleanDistribution({ data }: { data: CustomFieldDetailBoolean }) {
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

function TextTopValues({ data }: { data: CustomFieldDetailText }) {
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

function downloadLearnersCsv(learners: CustomFieldDetailLearner[], fieldKey: string) {
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

export function AdminCustomFieldDetailPage({ fieldKey }: { fieldKey: string }) {
  const router = useRouter();
  const searchId = useId();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<CustomFieldDetailData | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [valueFilter, setValueFilter] = useState("");
  const [minValueInput, setMinValueInput] = useState("");
  const [maxValueInput, setMaxValueInput] = useState("");
  const [appliedMinValue, setAppliedMinValue] = useState<number | undefined>(undefined);
  const [appliedMaxValue, setAppliedMaxValue] = useState<number | undefined>(undefined);
  const [compareWith, setCompareWith] = useState("");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionsOpen, setActionsOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [groupTitle, setGroupTitle] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
    setCompareWith("");
    setValueFilter("");
    setSearchInput("");
    setDebouncedSearch("");
    setMinValueInput("");
    setMaxValueInput("");
    setAppliedMinValue(undefined);
    setAppliedMaxValue(undefined);
  }, [fieldKey]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, valueFilter, appliedMinValue, appliedMaxValue]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCustomFieldDetail(fieldKey, {
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        ...(valueFilter ? { valueFilter } : {}),
        ...(appliedMinValue != null ? { minValue: appliedMinValue } : {}),
        ...(appliedMaxValue != null ? { maxValue: appliedMaxValue } : {}),
        ...(compareWith ? { compareWith } : {}),
        page,
        limit: PAGE_SIZE,
      });
      setDetail(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load field detail.",
      );
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [appliedMaxValue, appliedMinValue, compareWith, debouncedSearch, fieldKey, page, valueFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const learners = detail?.learners.items ?? [];
  const pageInfo = detail?.learners.pageInfo;
  const field = detail?.field;
  const summary = detail?.summary;
  const fieldType = field?.fieldType.toLowerCase() ?? "";
  const selectedCompare =
    compareWith || detail?.crossTab?.otherField.key || detail?.compareFields[0]?.key || "";
  const selectOptionValues = useMemo(() => {
    if (!detail?.select) return field?.options ?? [];
    const fromOptions = detail.select.options.map((option) => option.value);
    const orphans = detail.select.orphaned.map((orphan) => orphan.value);
    return [...new Set([...fromOptions, ...orphans])];
  }, [detail?.select, field?.options]);

  const allOnPageSelected =
    learners.length > 0 && learners.every((row) => selectedIds.has(row.membershipId));

  const selectedLearners = useMemo(
    () => learners.filter((row) => selectedIds.has(row.membershipId)),
    [learners, selectedIds],
  );

  function toggleSelectAllOnPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allOnPageSelected) {
        for (const row of learners) next.delete(row.membershipId);
      } else {
        for (const row of learners) next.add(row.membershipId);
      }
      return next;
    });
  }

  function toggleRowSelection(membershipId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(membershipId)) next.delete(membershipId);
      else next.add(membershipId);
      return next;
    });
  }

  function applyNumberRange() {
    const minRaw = minValueInput.trim();
    const maxRaw = maxValueInput.trim();
    const minParsed = minRaw === "" ? undefined : Number(minRaw);
    const maxParsed = maxRaw === "" ? undefined : Number(maxRaw);
    setAppliedMinValue(minParsed != null && !Number.isNaN(minParsed) ? minParsed : undefined);
    setAppliedMaxValue(maxParsed != null && !Number.isNaN(maxParsed) ? maxParsed : undefined);
    setPage(1);
  }

  async function handleServerExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportCustomFieldReport({
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        columns: [
          "learner_name",
          "email",
          "enrollment_count",
          "total_spent_cents",
          "last_active_at",
          "signed_up_at",
          "status",
          `cf:${fieldKey}`,
        ],
        emailDownloadLink: true,
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      if (completed.status === "completed") {
        await downloadReportExport(completed.id, "csv");
      }
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export report.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleClientCsvExport(selectionOnly: boolean) {
    if (!field) return;
    const rows = selectionOnly ? selectedLearners : learners;
    downloadLearnersCsv(rows, field.key);
  }

  async function handleSendMessage() {
    if (!messageSubject.trim() || !messageBody.trim()) return;
    if (selectedIds.size === 0) {
      setError("Select learners first, then send a message.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendCustomFieldReportMessage({
        subject: messageSubject.trim(),
        message: messageBody.trim(),
        membershipIds: [...selectedIds],
      });
      setMessageSubject("");
      setMessageBody("");
      setActionsOpen(false);
    } catch (messageError) {
      setError(
        messageError instanceof ClientApiError
          ? messageError.message
          : messageError instanceof Error
            ? messageError.message
            : "Unable to send message.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateGroup() {
    if (!groupTitle.trim()) return;
    if (selectedIds.size === 0) {
      setError("Select learners first, then create a group.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createCustomFieldReportGroup({
        title: groupTitle.trim(),
        membershipIds: [...selectedIds],
      });
      setGroupTitle("");
      setActionsOpen(false);
      router.push("/admin/batches");
    } catch (groupError) {
      setError(
        groupError instanceof ClientApiError
          ? groupError.message
          : groupError instanceof Error
            ? groupError.message
            : "Unable to create group.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading && !detail && !error) {
    return (
      <div className="space-y-6">
        <CustomFieldReportTabs active="fields" />
        <DetailSkeleton />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="space-y-6">
        <CustomFieldReportTabs active="fields" />
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex items-center justify-between gap-4 border-b border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--admin-danger)]" aria-hidden />
              <p className="text-sm font-medium text-[var(--admin-danger)]">
                Couldn&apos;t load field detail.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-sm border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[var(--admin-surface)] px-3 text-[13px] font-medium text-[var(--admin-danger)] transition-transform active:translate-y-px"
              onClick={() => void load()}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Retry
            </button>
          </div>
          <div className="pointer-events-none p-4 opacity-50">
            <DetailSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!detail || !field || !summary) {
    return null;
  }

  const audienceCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-6 pb-16">
      <CustomFieldReportTabs active="fields" />

      <Link
        href="/admin/reports/custom-field/fields"
        className="inline-flex w-fit items-center gap-1.5 text-[13px] text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All fields
      </Link>

      <div className="flex flex-col justify-between gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:flex-row md:items-start md:p-6">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            {field.label}
          </h1>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
              {field.key}
            </span>
            <CopyKeyButton value={field.key} />
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="rounded-sm bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
              {fieldTypeMarker(field.fieldType)}
            </span>
            <span
              className={[
                "inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase",
                statusPillClass(field.status),
              ].join(" ")}
            >
              {field.status}
            </span>
            <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              Created {formatDateShort(field.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            className={ghostButtonClassName}
            disabled={busy || learners.length === 0}
            onClick={() => {
              handleClientCsvExport(false);
            }}
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
          <Link href="/admin/custom-fields" className={ghostButtonClassName}>
            <Settings2 className="h-4 w-4" aria-hidden />
            Edit field
          </Link>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => {
              setActionsOpen((open) => !open);
            }}
          >
            Cohort actions
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3">
          <p className="text-sm font-medium text-[var(--admin-danger)]">{error}</p>
          <button type="button" className={ghostButtonClassName} onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Retry
          </button>
        </div>
      ) : null}

      {actionsOpen ? (
        <div className="grid gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--admin-on-surface)]">Send message</p>
            <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
              {audienceCount > 0 ? (
                <>
                  Will reach{" "}
                  <strong className="font-medium text-[var(--admin-on-surface)]">
                    {formatCount(audienceCount)}
                  </strong>{" "}
                  selected learner{audienceCount === 1 ? "" : "s"}.
                </>
              ) : (
                <>Select learners in the table below to message them.</>
              )}
            </p>
            <input
              className={filterInputClassName}
              placeholder="Subject"
              value={messageSubject}
              onChange={(event) => {
                setMessageSubject(event.target.value);
              }}
            />
            <textarea
              className={`${filterInputClassName} min-h-[80px] py-2`}
              placeholder="Message"
              value={messageBody}
              onChange={(event) => {
                setMessageBody(event.target.value);
              }}
            />
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={
                busy || audienceCount === 0 || !messageSubject.trim() || !messageBody.trim()
              }
              onClick={() => void handleSendMessage()}
            >
              Send message
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--admin-on-surface)]">Create group</p>
            <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
              {audienceCount > 0 ? (
                <>
                  Creates a batch from{" "}
                  <strong className="font-medium text-[var(--admin-on-surface)]">
                    {formatCount(audienceCount)}
                  </strong>{" "}
                  selected learners.
                </>
              ) : (
                <>Select learners in the table below to create a group.</>
              )}
            </p>
            <input
              className={filterInputClassName}
              placeholder="Group title"
              value={groupTitle}
              onChange={(event) => {
                setGroupTitle(event.target.value);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={busy || audienceCount === 0 || !groupTitle.trim()}
                onClick={() => void handleCreateGroup()}
              >
                Create group
              </button>
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={busy}
                onClick={() => void handleServerExport()}
              >
                <Download className="h-4 w-4" aria-hidden />
                Queue export
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-5">
        <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4 md:col-span-2">
          <span className={labelClassName}>Coverage</span>
          <span className="font-mono text-[32px] leading-none font-medium tabular-nums text-[var(--admin-on-surface)]">
            {formatPct(summary.coveragePct)}
          </span>
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
            <div
              className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, summary.coveragePct ?? 0))}%`,
              }}
            />
          </div>
          <span className="mt-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {formatCount(summary.filledCount)} of {formatCount(summary.learnerCount)} learners
          </span>
        </div>

        <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
          <span className={labelClassName}>Distinct values</span>
          <span className="font-mono text-[32px] leading-none font-medium tabular-nums text-[var(--admin-on-surface)]">
            {formatCount(summary.distinctValueCount)}
          </span>
        </div>

        <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
          <span className={labelClassName}>Most common</span>
          {summary.mostCommonValue ? (
            <>
              <span className="truncate text-lg font-medium text-[var(--admin-on-surface)]">
                {summary.mostCommonValue}
              </span>
              <span className="mt-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {formatPct(summary.mostCommonSharePct)}
              </span>
            </>
          ) : (
            <span className="text-sm text-[var(--admin-on-surface-variant)]">No values</span>
          )}
        </div>

        <div className="flex flex-col justify-between gap-2 bg-[var(--admin-surface)] p-4">
          <button
            type="button"
            className="group text-left"
            onClick={() => {
              setValueFilter(valueFilter === "missing" ? "" : "missing");
            }}
          >
            <span className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--admin-warning)]">
              Missing
            </span>
            <span className="font-mono text-[28px] leading-none font-medium tabular-nums text-[var(--admin-warning)] group-hover:underline">
              {formatCount(summary.missingCount)}
            </span>
          </button>
          <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            Last updated {formatRelativeDate(summary.lastUpdatedAt)}
          </span>
        </div>
      </div>

      {detail.neverUsed ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
            <FileText className="h-10 w-10 opacity-60" strokeWidth={1.5} />
          </div>
          <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
            No learner has a value for this field yet
          </h2>
          <p className="mb-8 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
            Created {formatDateShort(field.createdAt)}. Values will appear here once learners fill
            this field in.
          </p>
          <Link href="/admin/custom-fields" className={ghostButtonClassName}>
            <Settings2 className="h-4 w-4" aria-hidden />
            Edit field
          </Link>
        </div>
      ) : (
        <>
          {fieldType === "select" && detail.select ? (
            <SelectDistribution
              data={detail.select}
              valueFilter={valueFilter}
              onFilterValue={(value) => {
                setValueFilter(value ?? "");
              }}
            />
          ) : null}
          {fieldType === "select" ? (
            <CrossTabulationPanel
              compareFields={detail.compareFields}
              compareWith={selectedCompare}
              onCompareChange={(value) => {
                setCompareWith(value);
              }}
              crossTab={detail.crossTab}
            />
          ) : null}
          {fieldType === "number" && detail.number ? (
            <NumberDistribution data={detail.number} />
          ) : null}
          {fieldType === "boolean" && detail.boolean ? (
            <BooleanDistribution data={detail.boolean} />
          ) : null}
          {(fieldType === "text" || fieldType === "date") && detail.text ? (
            <TextTopValues data={detail.text} />
          ) : null}
        </>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 md:p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label htmlFor={searchId} className={labelClassName}>
                Search
              </label>
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
                <input
                  id={searchId}
                  className={`${filterInputClassName} pl-8`}
                  placeholder="Name or email"
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                  }}
                />
              </div>
            </div>

            {fieldType === "select" ? (
              <div className="w-full">
                <span className={labelClassName}>Value</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={[
                      "rounded-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                      !valueFilter
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]"
                        : "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-primary)]",
                    ].join(" ")}
                    onClick={() => {
                      setValueFilter("");
                    }}
                  >
                    All
                  </button>
                  {selectOptionValues.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={[
                        "rounded-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                        valueFilter === value
                          ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]"
                          : "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-primary)]",
                      ].join(" ")}
                      onClick={() => {
                        setValueFilter(valueFilter === value ? "" : value);
                      }}
                    >
                      {value}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={[
                      "rounded-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                      valueFilter === "missing"
                        ? "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]"
                        : "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-warning)]",
                    ].join(" ")}
                    onClick={() => {
                      setValueFilter(valueFilter === "missing" ? "" : "missing");
                    }}
                  >
                    No value
                  </button>
                </div>
              </div>
            ) : null}

            {fieldType === "number" ? (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className={labelClassName} htmlFor="cf-detail-min">
                    Min
                  </label>
                  <input
                    id="cf-detail-min"
                    type="number"
                    className={`${filterInputClassName} w-28`}
                    value={minValueInput}
                    onChange={(event) => {
                      setMinValueInput(event.target.value);
                    }}
                  />
                </div>
                <div>
                  <label className={labelClassName} htmlFor="cf-detail-max">
                    Max
                  </label>
                  <input
                    id="cf-detail-max"
                    type="number"
                    className={`${filterInputClassName} w-28`}
                    value={maxValueInput}
                    onChange={(event) => {
                      setMaxValueInput(event.target.value);
                    }}
                  />
                </div>
                <button type="button" className={ghostButtonClassName} onClick={applyNumberRange}>
                  Apply
                </button>
              </div>
            ) : null}

            {fieldType === "boolean" ? (
              <div>
                <span className={labelClassName}>Value</span>
                <div className="inline-flex overflow-hidden rounded-sm border border-[var(--admin-outline)]">
                  {[
                    { key: "", label: "All" },
                    { key: "true", label: "Yes" },
                    { key: "false", label: "No" },
                    { key: "missing", label: "No value" },
                  ].map((option) => (
                    <button
                      key={option.key || "all"}
                      type="button"
                      className={[
                        "h-9 px-3 text-[12px] font-medium transition-colors",
                        valueFilter === option.key
                          ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                          : "bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                      ].join(" ")}
                      onClick={() => {
                        setValueFilter(option.key);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {selectedIds.size > 0 ? (
          <div className="sticky top-0 z-20 flex h-10 items-center justify-between border-b border-[color-mix(in_srgb,var(--admin-primary)_20%,var(--admin-border))] bg-[var(--admin-primary-container)] px-4">
            <span className="text-[13px] font-medium text-[var(--admin-primary)]">
              {formatCount(selectedIds.size)} learners selected
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="text-[13px] text-[var(--admin-primary)] hover:underline"
                onClick={() => {
                  setActionsOpen(true);
                }}
              >
                Create group
              </button>
              <button
                type="button"
                className="text-[13px] text-[var(--admin-primary)] hover:underline"
                onClick={() => {
                  setActionsOpen(true);
                }}
              >
                Message learners
              </button>
              <button
                type="button"
                className="text-[13px] text-[var(--admin-primary)] hover:underline"
                disabled={selectedLearners.length === 0}
                onClick={() => {
                  handleClientCsvExport(true);
                }}
              >
                Export selection
              </button>
              <button
                type="button"
                className="text-[13px] text-[var(--admin-primary)] hover:underline"
                onClick={() => {
                  setSelectedIds(new Set());
                }}
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}

        <div className="relative overflow-x-auto">
          {loading ? (
            <div className="p-4" aria-busy="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="mb-3 flex gap-4">
                  <Shimmer className="h-4 w-4" />
                  <Shimmer className="h-4 w-40" />
                  <Shimmer className="h-4 w-24" />
                  <Shimmer className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : learners.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                No learners match these filters
              </h3>
              <p className="mb-6 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                Adjust the search or value filter to find learners for this field.
              </p>
              <button
                type="button"
                className={primaryButtonClassName}
                onClick={() => {
                  setSearchInput("");
                  setDebouncedSearch("");
                  setValueFilter("");
                  setMinValueInput("");
                  setMaxValueInput("");
                  setAppliedMinValue(undefined);
                  setAppliedMaxValue(undefined);
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 cursor-pointer rounded-[3px] border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllOnPage}
                      aria-label="Select all on page"
                    />
                  </th>
                  <th className="px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Learner
                  </th>
                  <th className="px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    {field.label}
                  </th>
                  <th className="px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Enrolments
                  </th>
                  <th className="px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Total spent
                  </th>
                  <th className="px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Last active
                  </th>
                  <th className="px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Signed up
                  </th>
                  <th className="px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {learners.map((row) => {
                  const selected = selectedIds.has(row.membershipId);
                  return (
                    <tr
                      key={row.membershipId}
                      className={[
                        "h-12 transition-colors hover:bg-[var(--admin-surface-high)]",
                        selected
                          ? "bg-[color-mix(in_srgb,var(--admin-primary)_5%,var(--admin-surface))]"
                          : "",
                      ].join(" ")}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 cursor-pointer rounded-[3px] border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                          checked={selected}
                          onChange={() => {
                            toggleRowSelection(row.membershipId);
                          }}
                          aria-label={`Select ${row.learnerName || row.email || "learner"}`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
                            {learnerInitials(row)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                              {row.learnerName || "—"}
                            </div>
                            <div className="truncate font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                              {row.email || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <FieldValueCell value={row.fieldValue} fieldType={field.fieldType} />
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-[13px] tabular-nums text-[var(--admin-on-surface)]">
                        {formatCount(row.enrollmentCount)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-[13px] tabular-nums text-[var(--admin-on-surface)]">
                        {formatMoney(row.totalSpentCents, row.currency)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="text-[13px] text-[var(--admin-on-surface)]">
                          {formatRelativeDate(row.lastActiveAt)}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                        {formatDateShort(row.signedUpAt)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={[
                            "inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase",
                            statusPillClass(row.status),
                          ].join(" ")}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {pageInfo ? (
          <div className="flex h-12 items-center justify-between border-t border-[var(--admin-border)] px-4">
            <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
              {formatCount(pageInfo.totalCount)} learner
              {pageInfo.totalCount === 1 ? "" : "s"}
              {pageInfo.totalPages > 1
                ? ` · page ${formatCount(pageInfo.page)} of ${formatCount(pageInfo.totalPages)}`
                : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={!pageInfo.hasPreviousPage || loading}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Prev
              </button>
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={!pageInfo.hasNextPage || loading}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
