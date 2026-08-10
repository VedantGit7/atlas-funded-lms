"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Moon,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchResourceUsageStorage,
  type ResourceUsageStorageAssetType,
  type ResourceUsageStorageHolder,
  type ResourceUsageStorageReclaim,
  type ResourceUsageStorageResponse,
  type ResourceUsageStorageSegment,
  type ResourceUsageStorageSort,
} from "./admin-resource-usage-roster-api";

const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 text-sm font-medium text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const ASSET_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All asset types" },
  { value: "video", label: "Video" },
  { value: "documents", label: "Documents" },
  { value: "images", label: "Images" },
  { value: "audio", label: "Audio" },
  { value: "scorm", label: "SCORM" },
  { value: "attachments", label: "Attachments" },
  { value: "backups", label: "Backups" },
];

const SORT_OPTIONS: Array<{ value: ResourceUsageStorageSort; label: string }> = [
  { value: "size_desc", label: "Sort: Largest first" },
  { value: "files_desc", label: "Sort: Most files" },
  { value: "activity_asc", label: "Sort: Least active" },
  { value: "title_asc", label: "Sort: Title A-Z" },
];

const SEGMENT_TONE: Record<string, string> = {
  video: "bg-[var(--admin-primary)]",
  documents: "bg-[var(--admin-primary-strong)]",
  images: "bg-[var(--admin-warning)]",
  audio: "bg-[var(--admin-success)]",
  scorm: "bg-[var(--admin-outline)]",
  attachments: "bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)]",
  backups: "bg-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-outline))]",
};

function segmentTone(key: string): string {
  return SEGMENT_TONE[key] ?? "bg-[var(--admin-surface-high)]";
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:-translate-x-full",
        "motion-safe:after:animate-[shimmer_1.8s_infinite]",
        "motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent",
        "motion-safe:after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] motion-safe:after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function formatGb(value: number): string {
  if (value < 0.01 && value > 0) return "<0.01";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value >= 100 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatRelative(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 30) return `${String(days)} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function downloadHoldersCsv(holders: ResourceUsageStorageHolder[]) {
  const header = [
    "course_id",
    "title",
    "status",
    "storage_gb",
    "share_pct",
    "file_count",
    "dormant",
    "last_activity",
  ];
  const rows = holders.map((row) =>
    [
      row.courseId,
      JSON.stringify(row.title),
      row.status,
      String(row.storageGb),
      String(row.sharePct),
      String(row.fileCount),
      row.dormant ? "true" : "false",
      row.lastLearnerActivityAt ?? "",
    ].join(","),
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `storage-holders-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StorageLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading storage breakdown">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-2">
          <Shimmer className="h-8 w-40" />
          <Shimmer className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-44" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex h-32 flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <Shimmer className="h-3 w-20" />
            <div className="space-y-2">
              <Shimmer className="h-7 w-24" />
              <Shimmer className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
        <Shimmer className="mb-4 h-5 w-40" />
        <Shimmer className="h-8 w-full" />
        <div className="mt-4 flex gap-4">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-4 w-28" />
          <Shimmer className="h-4 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 lg:col-span-2">
          <Shimmer className="mb-6 h-5 w-48" />
          <Shimmer className="min-h-[240px] w-full" />
        </div>
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <Shimmer className="h-5 w-36" />
          </div>
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex h-11 items-center gap-3 border-b border-[var(--admin-border)] px-4 last:border-b-0"
            >
              <Shimmer className="h-4 w-1/2" />
              <Shimmer className="ml-auto h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyStorage({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
        <FolderOpen className="h-12 w-12 text-[var(--admin-outline)]" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-[var(--admin-on-surface)]">
        No stored assets yet
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Your storage bucket is currently empty. Upload course assets or sync with an external
        provider to begin tracking usage.
      </p>
      <button type="button" className={`${primaryButtonClassName} mt-6`} onClick={onUpload}>
        <Upload className="h-4 w-4" aria-hidden />
        Open courses
      </button>
    </div>
  );
}

function StorageErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" aria-hidden />
        <div>
          <p className="text-sm font-medium text-[var(--admin-danger)]">Sync failed</p>
          <p className="mt-0.5 text-sm text-[var(--admin-on-surface)]">{message}</p>
        </div>
      </div>
      <button type="button" className={secondaryButtonClassName} onClick={onRetry}>
        <RefreshCw className="h-4 w-4" aria-hidden />
        Retry
      </button>
    </div>
  );
}

function MiniSparkline({ points }: { points: number[] }) {
  const values = points.length > 0 ? points : [0];
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-6 items-end gap-0.5" aria-hidden>
      {values.map((value, index) => (
        <div
          key={index}
          className="w-1 rounded-t-sm bg-[var(--admin-primary)]"
          style={{ height: `${String(Math.max(12, (value / max) * 100))}%` }}
        />
      ))}
    </div>
  );
}

function CompositionBand({
  composition,
  dominantLabel,
  dominantShare,
}: {
  composition: ResourceUsageStorageSegment[];
  dominantLabel: string | null;
  dominantShare: number | null;
}) {
  if (composition.length === 0) {
    return (
      <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
        <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Composition</h3>
        <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
          No asset-type breakdown is available yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Composition</h3>
        {dominantLabel && dominantShare != null ? (
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Dominant:{" "}
            <span className="font-medium text-[var(--admin-on-surface)]">{dominantLabel}</span> (
            {dominantShare.toFixed(1)}%)
          </p>
        ) : null}
      </div>
      <div
        className="flex h-8 w-full overflow-hidden rounded-sm bg-[var(--admin-surface-low)]"
        role="img"
        aria-label="Storage composition by asset type"
      >
        {composition.map((segment) => (
          <div
            key={segment.key}
            className={`${segmentTone(segment.key)} transition-opacity hover:opacity-90`}
            style={{ width: `${String(Math.max(segment.sharePct, 0.5))}%` }}
            title={`${segment.label}: ${formatGb(segment.valueGb)} GB (${segment.sharePct.toFixed(1)}%)`}
          />
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {composition.map((segment) => (
          <li
            key={segment.key}
            className="flex items-center gap-2 text-xs text-[var(--admin-on-surface)]"
          >
            <span className={`h-2.5 w-2.5 rounded-sm ${segmentTone(segment.key)}`} aria-hidden />
            <span>{segment.label}</span>
            <span className="font-mono text-[var(--admin-on-surface-variant)]">
              {formatGb(segment.valueGb)} GB
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GrowthChart({ sparkline, deltaGb }: { sparkline: number[]; deltaGb: number }) {
  const values = sparkline.length > 0 ? sparkline : [0];
  const max = Math.max(1, ...values);
  const mid = max / 2;

  return (
    <section className="flex h-full min-h-[280px] flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Storage growth</h3>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            Total stored volume over recent months (not split by asset type).
          </p>
        </div>
        <p
          className={[
            "font-mono text-sm",
            deltaGb > 0
              ? "text-[var(--admin-warning)]"
              : deltaGb < 0
                ? "text-[var(--admin-success)]"
                : "text-[var(--admin-on-surface-variant)]",
          ].join(" ")}
        >
          {deltaGb > 0 ? "+" : ""}
          {formatGb(deltaGb)} GB
        </p>
      </div>
      <div className="relative min-h-0 flex-1 pl-8">
        <div className="pointer-events-none absolute top-0 left-0 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
          {formatGb(max)}
        </div>
        <div className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
          {formatGb(mid)}
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
          0
        </div>
        <div className="relative h-full border-b border-l border-[color-mix(in_srgb,var(--admin-border)_60%,transparent)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)]" />
          <div className="absolute inset-0 flex items-end justify-between gap-1 px-2 pt-4">
            {values.map((value, index) => {
              const height = Math.max(4, (value / max) * 100);
              const isLatest = index === values.length - 1;
              return (
                <div
                  key={index}
                  className="group relative flex h-full flex-1 items-end justify-center"
                >
                  <div
                    className={[
                      "w-full max-w-8 rounded-t-sm transition-colors",
                      isLatest
                        ? "bg-[var(--admin-primary)]"
                        : "bg-[var(--admin-surface-high)] group-hover:bg-[var(--admin-outline)]",
                    ].join(" ")}
                    style={{ height: `${String(height)}%` }}
                    aria-label={`Point ${String(index + 1)}: ${formatGb(value)} GB`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReclaimPanel({ items }: { items: ResourceUsageStorageReclaim[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">
          Reclaim opportunities
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
          No reclaim signals right now.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--admin-border)]">
          {items.map((item) => (
            <li key={item.key} className="flex items-start justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-mono text-sm text-[var(--admin-on-surface)]">
                  {formatGb(item.storageGb)} GB
                </p>
                <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                  {item.label}
                </p>
              </div>
              <Link
                href={item.href}
                prefetch={false}
                className="shrink-0 text-xs font-medium text-[var(--admin-primary)] hover:underline"
              >
                {item.actionLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminResourceUsageStoragePanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [data, setData] = useState<ResourceUsageStorageResponse | null>(null);
  const dataRef = useRef<ResourceUsageStorageResponse | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ResourceUsageStorageSort>("size_desc");
  const [assetType, setAssetType] = useState<string>("");

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchResourceUsageStorage({
        page,
        sort,
        ...(assetType ? { assetType: assetType as ResourceUsageStorageAssetType } : {}),
      });
      setData(response.data);
      setStale(false);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to fetch current storage metrics from the provider.",
      );
      if (dataRef.current) {
        setStale(true);
      } else {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [assetType, page, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;
  const pageInfo = data?.pageInfo;

  const headlineLimitWidth = useMemo(() => {
    if (summary?.limitPct == null) return 0;
    return Math.min(100, summary.limitPct);
  }, [summary?.limitPct]);

  if (loading && !data) {
    return <StorageLoadingSkeleton />;
  }

  if (!data && error) {
    return (
      <div className="space-y-4">
        <StorageErrorBanner
          message={error}
          onRetry={() => {
            void load();
          }}
        />
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 opacity-50">
          <p className="text-[11px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
            Total usage
          </p>
          <p className="mt-1 font-mono text-[28px] text-[var(--admin-on-surface)]">
            -- <span className="text-sm text-[var(--admin-on-surface-variant)]">GB</span>
          </p>
        </div>
      </div>
    );
  }

  if (data?.isEmpty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Storage
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            What is taking up space, and where it is attached.
          </p>
        </div>
        <EmptyStorage
          onUpload={() => {
            window.location.href = "/admin/courses";
          }}
        />
      </div>
    );
  }

  if (!data || !summary) return null;

  return (
    <div className={["space-y-6", stale ? "opacity-80" : ""].join(" ")}>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Storage
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            What is taking up space, and where it is attached.
          </p>
          {stale ? (
            <p className="mt-1 text-xs text-[var(--admin-warning)]">
              Showing last successful load. Fresh metrics could not be fetched.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              downloadHoldersCsv(data.holders);
            }}
            disabled={data.holders.length === 0}
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              void load();
            }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Recalculate now
          </button>
          <Link
            href="/admin/reports/resource-usage/dormant"
            prefetch={false}
            className={primaryButtonClassName}
          >
            <Moon className="h-4 w-4" aria-hidden />
            Review dormant content
          </Link>
        </div>
      </div>

      {error ? (
        <StorageErrorBanner
          message={error}
          onRetry={() => {
            void load();
          }}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="relative flex h-32 flex-col justify-between overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <p className="text-xs text-[var(--admin-on-surface-variant)]">Total storage</p>
          <div>
            <p className="flex items-end gap-2 font-mono text-[28px] leading-none text-[var(--admin-on-surface)]">
              {formatGb(summary.totalGb)}
              <span className="mb-0.5 text-sm font-normal text-[var(--admin-on-surface-variant)]">
                GB
              </span>
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={[
                  "inline-flex items-center gap-0.5 text-xs font-medium",
                  summary.delta30dGb > 0
                    ? "text-[var(--admin-warning)]"
                    : summary.delta30dGb < 0
                      ? "text-[var(--admin-success)]"
                      : "text-[var(--admin-on-surface-variant)]",
                ].join(" ")}
              >
                {summary.delta30dGb >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
                )}
                {summary.delta30dGb > 0 ? "+" : ""}
                {formatGb(summary.delta30dGb)} GB
              </span>
              <span className="text-[10px] text-[var(--admin-on-surface-variant)]">in 30 days</span>
            </div>
          </div>
          <div className="absolute right-4 bottom-5">
            <MiniSparkline points={summary.sparkline} />
          </div>
          {summary.limitPct != null ? (
            <div className="absolute right-0 bottom-0 left-0 h-[3px] bg-[var(--admin-surface-high)]">
              <div
                className="h-full bg-[var(--admin-primary)]"
                style={{ width: `${String(headlineLimitWidth)}%` }}
              />
            </div>
          ) : null}
        </div>

        <Link
          href="/admin/reports/resource-usage/dormant"
          prefetch={false}
          className="flex h-32 flex-col justify-between rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] border-b-2 border-b-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_6%,var(--admin-surface))] p-4 transition-colors hover:bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))]"
        >
          <p className="flex items-center gap-1 text-xs text-[var(--admin-warning)]">
            <Moon className="h-3.5 w-3.5" aria-hidden />
            Dormant
          </p>
          <div>
            <p className="flex items-end gap-2 font-mono text-[28px] leading-none text-[var(--admin-warning)]">
              {formatGb(summary.dormantGb)}
              <span className="mb-0.5 text-sm font-normal opacity-80">GB</span>
            </p>
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-[color-mix(in_srgb,var(--admin-warning)_80%,transparent)] uppercase">
              {summary.dormantPct.toFixed(1)}% of total
            </p>
          </div>
        </Link>

        <div className="flex h-32 flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <p className="text-xs text-[var(--admin-on-surface-variant)]">Largest course</p>
          {summary.largestCourse ? (
            <div>
              <Link
                href={`/studio/courses/${summary.largestCourse.courseId}`}
                prefetch={false}
                className="block truncate text-sm font-medium text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)]"
              >
                {summary.largestCourse.title}
              </Link>
              <p className="mt-1 font-mono text-sm text-[var(--admin-primary)]">
                {formatGb(summary.largestCourse.storageGb)} GB
              </p>
            </div>
          ) : (
            <p className="font-mono text-sm text-[var(--admin-on-surface-variant)]">-</p>
          )}
        </div>

        <div className="flex h-32 flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <p className="text-xs text-[var(--admin-on-surface-variant)]">Average per course</p>
          <p className="flex items-end gap-2 font-mono text-[28px] leading-none text-[var(--admin-on-surface)]">
            {formatGb(summary.avgPerCourseGb)}
            <span className="mb-0.5 text-sm font-normal text-[var(--admin-on-surface-variant)]">
              GB
            </span>
          </p>
        </div>

        <div className="flex h-32 flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <p className="text-xs text-[var(--admin-on-surface-variant)]">Total files</p>
          <p className="font-mono text-[28px] leading-none text-[var(--admin-on-surface)]">
            {formatCount(summary.fileCount)}
          </p>
        </div>
      </div>

      <CompositionBand
        composition={data.composition}
        dominantLabel={summary.dominantTypeLabel}
        dominantShare={summary.dominantTypeSharePct}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GrowthChart sparkline={summary.sparkline} deltaGb={summary.delta30dGb} />
        </div>
        <ReclaimPanel items={data.reclaim} />
      </div>

      <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Storage holders</h3>
          <div className="flex flex-wrap gap-2">
            <Select
              ariaLabel="Asset type filter"
              className={selectClassName}
              value={assetType}
              onValueChange={(value) => {
                setAssetType(value);
                setPage(1);
              }}
              options={ASSET_TYPE_OPTIONS}
            />
            <Select
              ariaLabel="Sort holders"
              className={selectClassName}
              value={sort}
              onValueChange={(value) => {
                setSort(value as ResourceUsageStorageSort);
                setPage(1);
              }}
              options={SORT_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--admin-surface)] text-[11px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Course</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Storage</th>
                <th className="px-4 py-2.5 font-semibold">Share</th>
                <th className="px-4 py-2.5 font-semibold">Files</th>
                <th className="px-4 py-2.5 font-semibold">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6">
                    <div className="space-y-2" aria-busy="true">
                      <Shimmer className="h-8 w-full" />
                      <Shimmer className="h-8 w-full" />
                      <Shimmer className="h-8 w-full" />
                    </div>
                  </td>
                </tr>
              ) : data.holders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-[var(--admin-on-surface-variant)]"
                  >
                    No courses match this asset filter.
                  </td>
                </tr>
              ) : (
                data.holders.map((row) => (
                  <tr
                    key={row.courseId}
                    className="border-t border-[var(--admin-border)] hover:bg-[var(--admin-surface-low)]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/studio/courses/${row.courseId}`}
                        prefetch={false}
                        className="font-medium text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)]"
                      >
                        {row.title}
                      </Link>
                      {row.dormant ? (
                        <span className="mt-1 block font-mono text-[10px] tracking-wide text-[var(--admin-warning)] uppercase">
                          Dormant
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                      {row.status}
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--admin-on-surface)]">
                      {formatGb(row.storageGb)} GB
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--admin-on-surface-variant)]">
                      {row.sharePct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--admin-on-surface)]">
                      {formatCount(row.fileCount)}
                    </td>
                    <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                      {formatRelative(row.lastLearnerActivityAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pageInfo && pageInfo.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 py-3">
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              Page {pageInfo.page} of {pageInfo.totalPages} · {formatCount(pageInfo.totalCount)}{" "}
              courses
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={secondaryButtonClassName}
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
                className={secondaryButtonClassName}
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
      </section>
    </div>
  );
}
