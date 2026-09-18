"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  Info,
  Minus,
  RefreshCw,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  archiveResourceUsageDormant,
  exportResourceUsageReport,
  fetchResourceUsageDormantCourse,
  type ResourceUsageDormantCourseDetail,
} from "./admin-resource-usage-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 text-sm font-medium text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const dangerButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-danger)] px-4 text-sm font-medium text-[var(--admin-on-danger)] transition-all hover:opacity-90 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const dangerOutlineButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-danger)] bg-transparent px-4 text-sm font-medium text-[var(--admin-danger)] transition-all hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const selectClassName =
  "h-9 min-w-[160px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const REASON_OPTIONS = [
  { value: "", label: "Select a reason" },
  { value: "outdated", label: "Outdated content" },
  { value: "consolidated", label: "Consolidated into another course" },
  { value: "low_engagement", label: "Low engagement" },
  { value: "other", label: "Other" },
];

type ArchiveReason = "outdated" | "consolidated" | "low_engagement" | "other";

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

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatGb(value: number): string {
  if (value < 0.01 && value > 0) return "<0.01";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value >= 100 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
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

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warning" | "success" | "muted";
}) {
  const toneClass =
    tone === "warning"
      ? "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]"
      : tone === "success"
        ? "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]"
        : tone === "muted"
          ? "border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]"
          : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]";
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase ${toneClass}`}
    >
      {children}
    </span>
  );
}

function MeterCard({
  label,
  value,
  unit,
  caption,
  barPct,
  valueTone,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  caption?: ReactNode;
  barPct?: number;
  valueTone?: "warning" | "default";
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <div>
        <p className="text-xs text-[var(--admin-on-surface-variant)]">{label}</p>
        <p
          className={`mt-1 font-mono text-[28px] font-medium leading-8 ${
            valueTone === "warning"
              ? "text-[var(--admin-warning)]"
              : "text-[var(--admin-on-surface)]"
          }`}
        >
          {value}
          {unit ? (
            <span className="ml-1 text-lg text-[var(--admin-on-surface-variant)]">{unit}</span>
          ) : null}
        </p>
      </div>
      <div className="mt-4">
        {caption ? (
          <p className="mb-1 font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
            {caption}
          </p>
        ) : (
          <p className="mb-1 select-none text-xs text-transparent">-</p>
        )}
        {barPct != null ? (
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
            <div
              className="h-full rounded-full bg-[var(--admin-primary)]"
              style={{ width: `${String(Math.min(100, Math.max(2, barPct)))}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailLoadingSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[1440px] space-y-8 pb-16"
      aria-busy="true"
      aria-label="Loading dormant course"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shimmer className="h-4 w-16" />
          <span className="text-[var(--admin-border)]">/</span>
          <Shimmer className="h-4 w-24" />
          <span className="text-[var(--admin-border)]">/</span>
          <Shimmer className="h-4 w-32" />
        </div>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="space-y-3">
            <Shimmer className="h-8 w-96 max-w-full" />
            <div className="flex gap-2">
              <Shimmer className="h-6 w-28 rounded-full" />
              <Shimmer className="h-6 w-20 rounded-full" />
              <Shimmer className="h-6 w-24 rounded-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <Shimmer className="h-10 w-28" />
            <Shimmer className="h-10 w-32" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"
          >
            <Shimmer className="mb-4 h-3 w-16" />
            <Shimmer className="mb-2 h-8 w-24" />
            <Shimmer className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="min-w-0 flex-1 space-y-6 xl:w-[70%]">
          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <Shimmer className="mb-6 h-6 w-48" />
            <Shimmer className="mb-3 h-3 w-full" />
            <div className="flex flex-wrap gap-3">
              <Shimmer className="h-4 w-28" />
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-4 w-24" />
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
              <Shimmer className="h-4 w-40" />
            </div>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-4 border-b border-[var(--admin-border)] px-4 py-3"
              >
                <Shimmer className="h-4 w-48" />
                <Shimmer className="ml-auto h-4 w-16" />
                <Shimmer className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
        <div className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 xl:w-[30%]">
          <Shimmer className="mb-8 h-6 w-40" />
          <div className="space-y-6">
            <Shimmer className="h-16 w-full" />
            <Shimmer className="h-16 w-full" />
            <Shimmer className="h-16 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SingleArchiveModal({
  detail,
  busy,
  onClose,
  onConfirm,
}: {
  detail: ResourceUsageDormantCourseDetail;
  busy: boolean;
  onClose: () => void;
  onConfirm: (input: { reason: ArchiveReason; deleteAssets: boolean }) => void;
}) {
  const [reason, setReason] = useState("");
  const [deleteAssets, setDeleteAssets] = useState(false);
  const titleId = useId();
  const { course, summary, impact } = detail;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close archive dialog overlay"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="admin-theme relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_12px_40px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)] motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-5">
          <div>
            <h2
              id={titleId}
              className="text-xl font-semibold tracking-tight text-[var(--admin-on-surface)]"
            >
              Archive course
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{course.title}</p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Storage", value: formatGb(summary.storageGb), unit: "GB" },
              { label: "Lessons", value: formatCount(summary.lessonCount) },
              { label: "Enrolled", value: formatCount(summary.enrolmentTotal) },
            ].map((meter) => (
              <div
                key={meter.label}
                className="flex flex-col justify-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3"
              >
                <span className="mb-1 text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  {meter.label}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-2xl font-medium text-[var(--admin-on-surface)]">
                    {meter.value}
                  </span>
                  {meter.unit ? (
                    <span className="font-mono text-sm text-[var(--admin-on-surface-variant)]">
                      {meter.unit}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
              What happens when you archive?
            </h3>
            <ul className="space-y-2.5 text-sm text-[var(--admin-on-surface)]">
              <li className="flex items-start gap-3">
                <EyeOff
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
                  aria-hidden
                />
                <span>Currently enrolled learners will lose immediate access.</span>
              </li>
              <li className="flex items-start gap-3">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
                  aria-hidden
                />
                <span>Historical completion records and analytics are retained.</span>
              </li>
              <li className="flex items-start gap-3">
                <Archive
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
                  aria-hidden
                />
                <span>Course assets remain in storage unless deleted below.</span>
              </li>
              {impact.certificatesRemainValid > 0 ? (
                <li className="flex items-start gap-3">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-success)]"
                    aria-hidden
                  />
                  <span>
                    {formatCount(impact.certificatesRemainValid)} issued certificate
                    {impact.certificatesRemainValid === 1 ? "" : "s"} remain valid.
                  </span>
                </li>
              ) : null}
            </ul>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
              Reason (required)
            </span>
            <Select
              ariaLabel="Archive reason"
              className={selectClassName}
              value={reason}
              onValueChange={setReason}
              options={REASON_OPTIONS}
            />
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--admin-danger)]"
              checked={deleteAssets}
              onChange={(event) => {
                setDeleteAssets(event.target.checked);
              }}
            />
            <span>
              <span className="block text-base font-semibold text-[var(--admin-on-surface)]">
                Also delete stored assets
              </span>
              <span
                className={`mt-1 block text-sm ${
                  deleteAssets
                    ? "text-[var(--admin-danger)]"
                    : "text-[var(--admin-on-surface-variant)]"
                }`}
              >
                {deleteAssets
                  ? `This frees ${formatGb(summary.storageGb)} GB of storage and cannot be undone.`
                  : "Assets stay available in your resource pool after archive."}
              </span>
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={deleteAssets ? dangerButtonClassName : primaryButtonClassName}
            disabled={busy || !reason}
            onClick={() => {
              if (
                reason !== "outdated" &&
                reason !== "consolidated" &&
                reason !== "low_engagement" &&
                reason !== "other"
              ) {
                return;
              }
              onConfirm({ reason, deleteAssets });
            }}
          >
            <Archive className="h-4 w-4" aria-hidden />
            {deleteAssets
              ? `Archive and delete ${formatGb(summary.storageGb)} GB`
              : "Archive course"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type Props = {
  courseId: string;
};

export function AdminResourceUsageDormantCourseDetailPage({ courseId }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResourceUsageDormantCourseDetail | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchResourceUsageDormantCourse(courseId);
      setData(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Could not load dormant course detail.",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!copyHint) return;
    const timer = window.setTimeout(() => {
      setCopyHint(null);
    }, 1800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [copyHint]);

  async function handleExport() {
    setBusy(true);
    try {
      const queued = await exportResourceUsageReport({ reportTab: "dormant" });
      const completed = await pollReportRunUntilComplete(queued.data.runId);
      await downloadReportExport(completed.id, "csv");
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Could not export dormant courses.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUnpublish() {
    if (!data?.course.selectable) return;
    setBusy(true);
    setError(null);
    try {
      await archiveResourceUsageDormant({
        courseIds: [courseId],
        action: "unpublish",
        reason: "low_engagement",
        deleteAssets: false,
      });
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof ClientApiError
          ? actionError.message
          : actionError instanceof Error
            ? actionError.message
            : "Could not unpublish course.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveConfirm(input: { reason: ArchiveReason; deleteAssets: boolean }) {
    setBusy(true);
    setError(null);
    try {
      await archiveResourceUsageDormant({
        courseIds: [courseId],
        action: "archive",
        reason: input.reason,
        deleteAssets: input.deleteAssets,
      });
      setArchiveOpen(false);
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof ClientApiError
          ? actionError.message
          : actionError instanceof Error
            ? actionError.message
            : "Could not archive course.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return <DetailLoadingSkeleton />;
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-16">
        <Link
          href="/admin/reports/resource-usage/dormant"
          className="inline-flex items-center gap-2 text-sm text-[var(--admin-primary)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to dormant content
        </Link>
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--admin-danger)]" aria-hidden />
            <div className="flex-1">
              <p className="font-medium text-[var(--admin-on-surface)]">
                {error ?? "Course not found."}
              </p>
              <button
                type="button"
                className={`${secondaryButtonClassName} mt-4`}
                onClick={() => {
                  void load();
                }}
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { course, summary, composition, topFiles, impact, lessons } = data;
  const neverOpened = course.neverOpened;
  const archived = !course.selectable || course.status.toUpperCase() === "ARCHIVED";

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-16">
      {neverOpened ? (
        <div className="flex items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--admin-warning)]" aria-hidden />
          <p className="text-sm font-medium text-[var(--admin-warning)]">
            No learner has ever opened this course. Consider archiving or unpublishing.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--admin-on-surface-variant)]">
          <ol className="inline-flex flex-wrap items-center gap-1.5">
            <li>
              <Link
                href="/admin/reports/resource-usage"
                className="hover:text-[var(--admin-on-surface)]"
              >
                Resource Usage
              </Link>
            </li>
            <li aria-hidden className="text-[var(--admin-border)]">
              /
            </li>
            <li>
              <Link
                href="/admin/reports/resource-usage/dormant"
                className="hover:text-[var(--admin-on-surface)]"
              >
                Dormant
              </Link>
            </li>
            <li aria-hidden className="text-[var(--admin-border)]">
              /
            </li>
            <li className="font-medium text-[var(--admin-on-surface)]">{course.title}</li>
          </ol>
        </nav>

        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
                {course.title}
              </h1>
              <div className="inline-flex items-center gap-1 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                <span>{course.shortCode}</span>
                <button
                  type="button"
                  className="rounded p-0.5 transition-colors hover:text-[var(--admin-primary)]"
                  aria-label="Copy short code"
                  onClick={() => {
                    void copyToClipboard(course.shortCode).then((ok) => {
                      if (ok) setCopyHint("Copied");
                    });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              {copyHint ? (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--admin-success)]">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  {copyHint}
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill tone="warning">
                {neverOpened ? "Never opened" : `Dormant ${formatCount(course.dormantDays)} days`}
              </StatusPill>
              <StatusPill>{formatGb(summary.storageGb)} GB</StatusPill>
              <StatusPill>{formatCount(summary.lessonCount)} lessons</StatusPill>
              <StatusPill tone="muted">{course.status}</StatusPill>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={busy}
              onClick={() => {
                void handleExport();
              }}
            >
              <Download className="h-4 w-4" aria-hidden />
              Export CSV
            </button>
            {!archived ? (
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={busy}
                onClick={() => {
                  void handleUnpublish();
                }}
              >
                Unpublish
              </button>
            ) : null}
            {!archived ? (
              <button
                type="button"
                className={dangerOutlineButtonClassName}
                disabled={busy}
                onClick={() => {
                  setArchiveOpen(true);
                }}
              >
                Archive course
              </button>
            ) : null}
            <Link href={course.openCourseHref} prefetch={false} className={primaryButtonClassName}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open course
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--admin-danger)]" aria-hidden />
          <div className="flex-1">
            <p className="text-sm text-[var(--admin-on-surface)]">{error}</p>
            <button
              type="button"
              className={`${secondaryButtonClassName} mt-3`}
              onClick={() => {
                void load();
              }}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Retry
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MeterCard
          label="Storage"
          value={formatGb(summary.storageGb)}
          unit="GB"
          caption={`${summary.storageShareOfTenantPct.toFixed(1)}% of tenant storage`}
          barPct={summary.storageShareOfTenantPct}
        />
        <MeterCard
          label="Lessons"
          value={formatCount(summary.lessonCount)}
          caption={`${formatCount(summary.lessonsWithAssetsCount)} with assets`}
        />
        <MeterCard label="Files" value={formatCount(summary.fileCount)} />
        <MeterCard
          label="Last learner activity"
          value={
            neverOpened ? (
              <span className="inline-flex items-center gap-2 text-[22px]">
                <EyeOff className="h-5 w-5" aria-hidden />
                Never
              </span>
            ) : (
              formatCount(course.dormantDays)
            )
          }
          {...(neverOpened ? {} : { unit: "days ago" })}
          valueTone="warning"
        />
        <MeterCard
          label="Enrolments"
          value={formatCount(summary.enrolmentTotal)}
          caption={`${formatCount(summary.enrolmentActiveIn90d)} active in 90 days`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-8">
          <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
              Storage composition
            </h2>
            {composition.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                No stored assets are attached to this course.
              </p>
            ) : (
              <>
                <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full">
                  {composition.map((segment) => (
                    <div
                      key={segment.key}
                      className={segmentTone(segment.key)}
                      style={{ width: `${String(Math.max(segment.sharePct, 0.5))}%` }}
                      title={`${segment.label}: ${formatGb(segment.valueGb)} GB`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  {composition.map((segment) => (
                    <div key={segment.key} className="inline-flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${segmentTone(segment.key)}`} />
                      {segment.label} ({formatGb(segment.valueGb)} GB)
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {neverOpened ? (
            <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
                <h2 className="text-xs font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  Course composition
                </h2>
              </div>
              {lessons.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
                  No lessons in this course.
                </p>
              ) : (
                <div className="divide-y divide-[var(--admin-border)]">
                  <div className="grid grid-cols-12 gap-4 px-4 py-2.5 text-[11px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    <div className="col-span-6">Lesson title</div>
                    <div className="col-span-3 text-right">Type and duration</div>
                    <div className="col-span-3 text-right">Learner status</div>
                  </div>
                  {lessons.map((lesson) => (
                    <div
                      key={lesson.lessonId}
                      className="grid grid-cols-12 gap-4 px-4 py-3 text-sm transition-colors hover:bg-[var(--admin-surface-low)]"
                    >
                      <div className="col-span-6 truncate text-[var(--admin-on-surface)]">
                        {lesson.position}. {lesson.title}
                      </div>
                      <div className="col-span-3 text-right font-mono text-xs text-[var(--admin-on-surface-variant)]">
                        {lesson.lessonTypeLabel}
                        {lesson.durationLabel ? ` · ${lesson.durationLabel}` : ""}
                      </div>
                      <div className="col-span-3 text-right">
                        <StatusPill tone="warning">Never opened</StatusPill>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
                <h2 className="text-xs font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  Top 10 largest files
                </h2>
              </div>
              {topFiles.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
                  No files found for this course.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full text-left text-sm">
                    <thead className="bg-[var(--admin-surface-low)] text-[11px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Filename</th>
                        <th className="px-2 py-2.5 font-semibold">Type</th>
                        <th className="px-2 py-2.5 text-right font-semibold">Size</th>
                        <th className="px-2 py-2.5 font-semibold">Lesson link</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Uploaded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topFiles.map((file) => (
                        <tr
                          key={`${file.fileName}-${file.uploadedAt ?? ""}-${file.sizeBytes}`}
                          className="border-t border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-low)]"
                        >
                          <td
                            className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-[var(--admin-on-surface)]"
                            title={file.fileName}
                          >
                            {file.fileName}
                          </td>
                          <td className="px-2 py-3">
                            <StatusPill tone="muted">{file.assetTypeLabel}</StatusPill>
                          </td>
                          <td className="px-2 py-3 text-right font-mono text-xs">
                            {file.sizeLabel}
                          </td>
                          <td className="max-w-[160px] truncate px-2 py-3 text-[var(--admin-primary)]">
                            {file.lessonTitle ?? "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-[var(--admin-on-surface-variant)]">
                            {formatDateShort(file.uploadedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {neverOpened && composition.length > 0 ? (
            <section>
              <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
                Storage impact breakdown
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {composition.slice(0, 3).map((segment) => (
                  <div
                    key={segment.key}
                    className="flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
                  >
                    <span className="mb-2 font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                      {segment.label}
                    </span>
                    <span className="mb-3 font-mono text-[28px] font-medium text-[var(--admin-on-surface)]">
                      {formatGb(segment.valueGb)}
                      <span className="ml-1 text-sm text-[var(--admin-on-surface-variant)]">
                        GB
                      </span>
                    </span>
                    <div className="mt-auto h-1 w-full rounded bg-[var(--admin-surface-high)]">
                      <div
                        className={`h-full rounded ${segmentTone(segment.key)}`}
                        style={{
                          width: `${String(Math.min(100, Math.max(4, segment.sharePct)))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="xl:col-span-4">
          <div className="h-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
            <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
              <Info className="h-4 w-4 text-[var(--admin-warning)]" aria-hidden />
              If you archive this course
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  Learners lose
                </h3>
                <ul className="space-y-2 text-sm text-[var(--admin-on-surface)]">
                  <li className="flex items-start gap-2">
                    <Minus
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
                      aria-hidden
                    />
                    <span>
                      Access to <strong>{formatCount(impact.lessonCount)}</strong> lessons
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Minus
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
                      aria-hidden
                    />
                    <span>
                      <strong>{formatCount(impact.enrolmentCount)}</strong> enrolments become
                      inactive
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-success)]"
                      aria-hidden
                    />
                    <span>
                      <strong>{formatCount(impact.certificatesRemainValid)}</strong> certificates
                      remain valid
                    </span>
                  </li>
                </ul>
              </div>
              <div className="h-px w-full bg-[var(--admin-border)]" />
              <div>
                <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  You keep
                </h3>
                <ul className="space-y-2 text-sm text-[var(--admin-on-surface)]">
                  {["Progress records", "Assessment scores", "Payment and invoice records"].map(
                    (item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-success)]"
                          aria-hidden
                        />
                        <span>{item}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
              <div className="h-px w-full bg-[var(--admin-border)]" />
              <div>
                <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  You free
                </h3>
                <p className="font-mono text-[28px] font-medium text-[var(--admin-success)]">
                  {formatGb(impact.storageGbIfDeleted)} <span className="text-lg">GB</span>
                </p>
                <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)] italic">
                  only if assets are deleted during archival
                </p>
              </div>
              {!archived ? (
                <button
                  type="button"
                  className={`${dangerOutlineButtonClassName} w-full`}
                  disabled={busy}
                  onClick={() => {
                    setArchiveOpen(true);
                  }}
                >
                  <Archive className="h-4 w-4" aria-hidden />
                  Archive course
                </button>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      {archiveOpen ? (
        <SingleArchiveModal
          detail={data}
          busy={busy}
          onClose={() => {
            setArchiveOpen(false);
          }}
          onConfirm={(input) => {
            void handleArchiveConfirm(input);
          }}
        />
      ) : null}
    </div>
  );
}
