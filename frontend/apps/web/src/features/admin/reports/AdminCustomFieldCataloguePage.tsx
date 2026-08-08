"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState, type MouseEvent } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Plus,
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
  fetchCustomFieldCatalogue,
  type CustomFieldCatalogueItem,
  type CustomFieldCatalogueSummary,
} from "./admin-custom-field-roster-api";
import { CustomFieldReportTabs } from "./CustomFieldReportTabs";

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All types" },
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "select", label: "Select" },
  { value: "date", label: "Date" },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All status" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ARCHIVED", label: "Archived" },
];

const COVERAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "any", label: "Any coverage" },
  { value: "below_40", label: "Below 40%" },
  { value: "40_80", label: "40–80%" },
  { value: "above_80", label: "Above 80%" },
  { value: "never_used", label: "Never used" },
];

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "coverage_asc", label: "Coverage ↑" },
  { value: "coverage_desc", label: "Coverage ↓" },
  { value: "label_asc", label: "Label A–Z" },
  { value: "created_desc", label: "Recently created" },
];

const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

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
  return "border-[var(--admin-outline)] bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_8%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]";
}

function isLowCoverage(item: CustomFieldCatalogueItem): boolean {
  return item.coveragePct != null && item.coveragePct < 40;
}

function isNeverUsed(item: CustomFieldCatalogueItem): boolean {
  return item.filledCount === 0;
}

function CatalogueSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading field catalogue">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="space-y-3">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-3 bg-[var(--admin-surface)] p-4">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-8 w-16" />
            <Shimmer className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <Shimmer className="mb-4 h-4 w-40" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between">
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-4 w-12" />
              </div>
              <Shimmer className="h-[3px] w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
          <div className="flex flex-wrap gap-3">
            <Shimmer className="h-9 w-64" />
            <Shimmer className="h-9 w-36" />
            <Shimmer className="h-9 w-32" />
            <Shimmer className="h-9 w-40" />
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-4 w-12" />
            <Shimmer className="h-5 w-16" />
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryBand({
  summary,
  onBelow40Click,
  onNeverUsedClick,
}: {
  summary: CustomFieldCatalogueSummary;
  onBelow40Click: () => void;
  onNeverUsedClick: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-4">
      <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4 md:col-span-1">
        <span className={labelClassName}>Fields defined</span>
        <span className="font-mono text-[32px] leading-none font-medium tabular-nums text-[var(--admin-on-surface)]">
          {formatCount(summary.fieldsDefined)}
        </span>
        <span className="mt-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          {formatCount(summary.activeFieldCount)} active ·{" "}
          {formatCount(summary.archivedFieldCount)} archived
        </span>
      </div>

      <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
        <span className={labelClassName}>Average coverage</span>
        <span className="font-mono text-[32px] leading-none font-medium tabular-nums text-[var(--admin-on-surface)]">
          {formatPct(summary.averageCoveragePct)}
        </span>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
          <div
            className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, summary.averageCoveragePct ?? 0))}%`,
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
        <span className={labelClassName}>Fully covered fields</span>
        <span className="font-mono text-[32px] leading-none font-medium tabular-nums text-[var(--admin-success)]">
          {formatCount(summary.fullyCoveredFieldCount)}
        </span>
        <span className="mt-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          every learner has a value
        </span>
      </div>

      <div className="flex flex-col justify-between gap-4 bg-[var(--admin-surface)] p-4">
        <button
          type="button"
          onClick={onBelow40Click}
          className="group text-left transition-colors"
        >
          <span className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--admin-warning)]">
            Below 40% coverage
          </span>
          <span className="font-mono text-[28px] leading-none font-medium tabular-nums text-[var(--admin-warning)] group-hover:underline">
            {formatCount(summary.fieldsBelow40Coverage)}
          </span>
        </button>
        <button
          type="button"
          onClick={onNeverUsedClick}
          className="group border-t border-[var(--admin-border)] pt-3 text-left transition-colors"
        >
          <span className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--admin-warning)]">
            Never used
          </span>
          <span className="font-mono text-[20px] leading-none font-medium tabular-nums text-[var(--admin-warning)] group-hover:underline">
            {formatCount(summary.neverUsedFieldCount)}
          </span>
          <span className="mt-1 block font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            no learner has a value
          </span>
        </button>
      </div>
    </div>
  );
}

function CoverageOverview({ items }: { items: CustomFieldCatalogueItem[] }) {
  const ordered = useMemo(
    () =>
      [...items]
        .filter((item) => item.status === "ACTIVE")
        .sort((a, b) => (a.coveragePct ?? -1) - (b.coveragePct ?? -1)),
    [items],
  );

  if (ordered.length === 0) return null;

  return (
    <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:p-6">
      <h2 className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
        Coverage overview
      </h2>
      <div className="flex flex-col gap-4">
        {ordered.map((item) => {
          const low = isLowCoverage(item) || isNeverUsed(item);
          const pct = item.coveragePct ?? 0;
          return (
            <div key={item.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                      {item.label}
                    </span>
                    <span className="rounded-sm bg-[var(--admin-surface-high)] px-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                      {fieldTypeMarker(item.fieldType)}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                    {item.key}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={[
                      "font-mono text-[13px] tabular-nums",
                      low ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface)]",
                    ].join(" ")}
                  >
                    {formatPct(item.coveragePct)}
                  </span>
                  <span className="ml-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                    {formatCount(item.filledCount)}/{formatCount(item.learnerCount)}
                  </span>
                </div>
              </div>
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                <div
                  className={[
                    "h-full rounded-full transition-[width] duration-500",
                    low ? "bg-[var(--admin-warning)]" : "bg-[var(--admin-primary)]",
                  ].join(" ")}
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CopyKeyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(event: MouseEvent) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
      aria-label={`Copy key ${value}`}
      title="Copy key"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function downloadCatalogueCsv(items: CustomFieldCatalogueItem[]) {
  const header = [
    "label",
    "key",
    "fieldType",
    "status",
    "coveragePct",
    "filledCount",
    "learnerCount",
    "distinctValueCount",
    "mostCommonValue",
    "lastUpdatedAt",
    "createdAt",
  ];
  const lines = [
    header.join(","),
    ...items.map((item) =>
      [
        JSON.stringify(item.label),
        JSON.stringify(item.key),
        item.fieldType,
        item.status,
        item.coveragePct ?? "",
        item.filledCount,
        item.learnerCount,
        item.distinctValueCount,
        JSON.stringify(item.mostCommonValue ?? ""),
        item.lastUpdatedAt ?? "",
        item.createdAt,
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `custom-field-catalogue-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminCustomFieldCataloguePage() {
  const searchId = useId();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CustomFieldCatalogueItem[]>([]);
  const [summary, setSummary] = useState<CustomFieldCatalogueSummary | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fieldType, setFieldType] = useState("");
  const [status, setStatus] = useState("ALL");
  const [coverage, setCoverage] = useState("any");
  const [sortBy, setSortBy] = useState("coverage_asc");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCustomFieldCatalogue({
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        ...(fieldType ? { fieldType } : {}),
        status,
        coverage,
        sortBy,
      });
      setItems(response.data.items);
      setSummary(response.data.summary);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load the field catalogue.",
      );
      setItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [coverage, debouncedSearch, fieldType, sortBy, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasActiveFilters = Boolean(
    debouncedSearch || fieldType || status !== "ALL" || coverage !== "any",
  );

  const noFieldsDefined = summary != null && summary.fieldsDefined === 0 && !hasActiveFilters;

  if (loading && !summary && !error) {
    return (
      <div className="space-y-6">
        <CustomFieldReportTabs active="fields" />
        <CatalogueSkeleton />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="space-y-6">
        <CustomFieldReportTabs active="fields" />
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex items-center justify-between gap-4 border-b border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--admin-danger)]" aria-hidden />
              <p className="text-sm font-medium text-[var(--admin-danger)]">
                Couldn&apos;t load the field catalogue.
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
            <CatalogueSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <CustomFieldReportTabs active="fields" />

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Fields
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Every custom field, how well it is filled in, and what values it holds.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={ghostButtonClassName}
            disabled={items.length === 0}
            onClick={() => downloadCatalogueCsv(items)}
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
          <Link href="/admin/custom-fields" className={primaryButtonClassName}>
            <Settings2 className="h-4 w-4" aria-hidden />
            Manage fields
          </Link>
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

      {summary && !noFieldsDefined ? (
        <SummaryBand
          summary={summary}
          onBelow40Click={() => setCoverage("below_40")}
          onNeverUsedClick={() => setCoverage("never_used")}
        />
      ) : null}

      {noFieldsDefined ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
            <FileText className="h-10 w-10 opacity-60" strokeWidth={1.5} />
          </div>
          <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
            No custom fields are defined yet
          </h2>
          <p className="mb-8 max-w-[280px] text-sm text-[var(--admin-on-surface-variant)]">
            Define attributes like trading experience or preferred market to slice your learners by
            them.
          </p>
          <Link href="/admin/custom-fields" className={primaryButtonClassName}>
            <Plus className="h-4 w-4" aria-hidden />
            Manage fields
          </Link>
        </div>
      ) : (
        <>
          {!loading && items.length > 0 ? <CoverageOverview items={items} /> : null}

          <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex flex-wrap items-end gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
              <div className="min-w-[200px] flex-1">
                <label htmlFor={searchId} className={labelClassName}>
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
                  <input
                    id={searchId}
                    className={`${filterInputClassName} pl-8`}
                    placeholder="Search field label or key"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                </div>
              </div>
              <div>
                <span className={labelClassName}>Type</span>
                <Select
                  className={selectClassName}
                  value={fieldType}
                  onValueChange={setFieldType}
                  options={TYPE_OPTIONS}
                  ariaLabel="Field type"
                />
              </div>
              <div>
                <span className={labelClassName}>Status</span>
                <Select
                  className={selectClassName}
                  value={status}
                  onValueChange={setStatus}
                  options={STATUS_OPTIONS}
                  ariaLabel="Field status"
                />
              </div>
              <div>
                <span className={labelClassName}>Coverage</span>
                <Select
                  className={selectClassName}
                  value={coverage}
                  onValueChange={setCoverage}
                  options={COVERAGE_OPTIONS}
                  ariaLabel="Coverage band"
                />
              </div>
              <div>
                <span className={labelClassName}>Sort by</span>
                <Select
                  className={selectClassName}
                  value={sortBy}
                  onValueChange={setSortBy}
                  options={SORT_OPTIONS}
                  ariaLabel="Sort fields"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-4" aria-busy="true">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="mb-3 flex gap-4">
                    <Shimmer className="h-4 w-40" />
                    <Shimmer className="h-4 w-16" />
                    <Shimmer className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                  No fields match these filters
                </h3>
                <p className="mb-6 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                  Adjust type, status, or coverage filters to find fields in your catalogue.
                </p>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() => {
                    setSearchInput("");
                    setDebouncedSearch("");
                    setFieldType("");
                    setStatus("ALL");
                    setCoverage("any");
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                    <tr>
                      <th className="px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                        Field
                      </th>
                      <th className="w-24 px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                        Type
                      </th>
                      <th className="w-28 px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                        Status
                      </th>
                      <th className="w-48 px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                        Coverage
                      </th>
                      <th className="w-32 px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                        Distinct values
                      </th>
                      <th className="w-48 px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                        Most common value
                      </th>
                      <th className="w-40 px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                        Last updated
                      </th>
                      <th className="w-32 px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                        Created on
                      </th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {items.map((item) => {
                      const archived = item.status === "ARCHIVED";
                      const low = isLowCoverage(item) || isNeverUsed(item);
                      const full = item.coveragePct != null && item.coveragePct >= 100;
                      const detailHref = `/admin/reports/custom-field/fields/${encodeURIComponent(item.key)}`;

                      return (
                        <tr
                          key={item.id}
                          className={[
                            "group relative h-11 transition-colors hover:bg-[var(--admin-surface-high)]",
                            archived ? "bg-[color-mix(in_srgb,var(--admin-surface-low)_50%,transparent)] opacity-75" : "",
                          ].join(" ")}
                        >
                          {low && !archived ? (
                            <td className="absolute top-0 bottom-0 left-0 w-0.5 bg-[var(--admin-warning)] p-0" />
                          ) : null}
                          <td className="px-4 py-2">
                            <Link
                              href={detailHref}
                              className={[
                                "text-sm font-medium hover:underline",
                                archived
                                  ? "text-[var(--admin-on-surface-variant)] line-through"
                                  : "text-[var(--admin-primary)]",
                              ].join(" ")}
                            >
                              {item.label}
                            </Link>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                {item.key}
                              </span>
                              <CopyKeyButton value={item.key} />
                            </div>
                            {archived ? (
                              <p className="mt-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                Archived - values are kept but no longer collected
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-2">
                            <span className="rounded-sm bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                              {fieldTypeMarker(item.fieldType)}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={[
                                "inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase",
                                statusPillClass(item.status),
                              ].join(" ")}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={[
                                  "w-10 text-right font-mono text-[13px] tabular-nums",
                                  low
                                    ? "text-[var(--admin-warning)]"
                                    : full
                                      ? "text-[var(--admin-success)]"
                                      : archived
                                        ? "text-[var(--admin-on-surface-variant)]"
                                        : "text-[var(--admin-on-surface)]",
                                ].join(" ")}
                              >
                                {formatPct(item.coveragePct)}
                              </span>
                              <div className="h-[3px] w-20 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                                <div
                                  className={[
                                    "h-full rounded-full",
                                    low
                                      ? "bg-[var(--admin-warning)]"
                                      : full
                                        ? "bg-[var(--admin-success)]"
                                        : archived
                                          ? "bg-[var(--admin-on-surface-variant)]"
                                          : "bg-[var(--admin-primary)]",
                                  ].join(" ")}
                                  style={{
                                    width: `${Math.min(100, Math.max(0, item.coveragePct ?? 0))}%`,
                                  }}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                {formatCount(item.filledCount)}/{formatCount(item.learnerCount)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-[13px] tabular-nums text-[var(--admin-on-surface)]">
                            {item.fieldType === "select" &&
                            item.optionsUsedCount != null &&
                            item.options.length > 0 ? (
                              <div>
                                <div>
                                  {formatCount(item.optionsUsedCount)} of{" "}
                                  {formatCount(item.options.length)}
                                </div>
                                {item.unusedOptions.length > 0 ? (
                                  <div className="text-[10px] text-[var(--admin-on-surface-variant)]">
                                    {item.unusedOptions[0]}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              formatCount(item.distinctValueCount)
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {item.mostCommonValue ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-sm bg-[var(--admin-surface-high)] px-2 py-0.5 text-[13px] text-[var(--admin-on-surface)]">
                                  {item.mostCommonValue}
                                </span>
                                <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                  {formatPct(item.mostCommonSharePct)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[13px] text-[var(--admin-on-surface-variant)]">
                                No values recorded
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="text-[13px] text-[var(--admin-on-surface)]">
                              {formatRelativeDate(item.lastUpdatedAt)}
                            </div>
                            {item.lastUpdatedAt ? (
                              <div className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                {formatDateShort(item.lastUpdatedAt)}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                            {formatDateShort(item.createdAt)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Link
                              href={detailHref}
                              className="inline-flex text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
                              aria-label={`Open ${item.label} detail`}
                            >
                              <ChevronRight className="h-5 w-5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex h-12 items-center justify-between border-t border-[var(--admin-border)] px-4">
              <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                {formatCount(items.length)} field{items.length === 1 ? "" : "s"}
                {summary ? ` · ${formatCount(summary.learnerCount)} learners in coverage base` : ""}
              </span>
            </div>
          </div>

          <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
            Coverage counts a learner as covered when the field has any non-empty value.
          </p>
        </>
      )}
    </div>
  );
}
