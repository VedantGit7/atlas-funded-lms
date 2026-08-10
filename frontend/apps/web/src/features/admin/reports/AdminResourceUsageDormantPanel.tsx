"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Moon,
  MoreHorizontal,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  dropdownItemClassName,
  dropdownPanelSurfaceClassName,
  RoleToggle,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  archiveResourceUsageDormant,
  exportResourceUsageReport,
  fetchResourceUsageDormant,
  type ResourceUsageDormantEnrolmentFilter,
  type ResourceUsageDormantItem,
  type ResourceUsageDormantResponse,
  type ResourceUsageDormantSort,
  type ResourceUsageDormantStatusFilter,
  type ResourceUsageDormantSummary,
  type ResourceUsageDormantView,
} from "./admin-resource-usage-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

const SETTINGS_KEY = "atlas.resource-usage.dormancy-settings";

type DormancySettings = {
  dormantDays: number;
  minLessons: number;
  includeUnpublished: boolean;
  includeArchived: boolean;
};

type ArchiveReason = "outdated" | "consolidated" | "low_engagement" | "other";

const DEFAULT_SETTINGS: DormancySettings = {
  dormantDays: 30,
  minLessons: 1,
  includeUnpublished: true,
  includeArchived: false,
};

const selectClassName =
  "h-9 min-w-[130px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";
const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 text-sm font-medium text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-danger)] bg-[var(--admin-danger)] px-4 text-sm font-medium text-[var(--admin-on-primary)] transition-all hover:opacity-90 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50";
const fieldClassName =
  "h-10 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

const STATUS_OPTIONS: Array<{ value: ResourceUsageDormantStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "published", label: "Published" },
  { value: "unpublished", label: "Unpublished" },
  { value: "archived", label: "Archived" },
];
const DORMANT_FOR_OPTIONS = [
  { value: "", label: "Any dormant for" },
  { value: "30", label: "30+ days" },
  { value: "60", label: "60+ days" },
  { value: "90", label: "90+ days" },
];
const STORAGE_OPTIONS = [
  { value: "", label: "Any storage" },
  { value: "1", label: "Over 1 GB" },
  { value: "5", label: "Over 5 GB" },
];
const ENROLMENT_OPTIONS: Array<{ value: ResourceUsageDormantEnrolmentFilter; label: string }> = [
  { value: "any", label: "Any enrolments" },
  { value: "zero_active", label: "0 active" },
  { value: "has_active", label: "Has active" },
];
const SORT_OPTIONS: Array<{ value: ResourceUsageDormantSort; label: string }> = [
  { value: "storage_desc", label: "Storage ↓" },
  { value: "dormant_desc", label: "Dormant longest ↓" },
  { value: "lessons_desc", label: "Lessons ↓" },
  { value: "title_asc", label: "Title A-Z" },
  { value: "activity_asc", label: "Least recent activity" },
];
const REASON_OPTIONS = [
  { value: "", label: "Select a reason" },
  { value: "outdated", label: "Outdated content" },
  { value: "consolidated", label: "Consolidated into another course" },
  { value: "low_engagement", label: "Low engagement" },
  { value: "other", label: "Other" },
];
const VIEW_TABS: Array<{
  key: ResourceUsageDormantView;
  label: string;
  countKey: keyof ResourceUsageDormantSummary["viewCounts"];
}> = [
  { key: "all", label: "All dormant", countKey: "all" },
  { key: "unpublished", label: "Unpublished and dormant", countKey: "unpublished" },
  { key: "large", label: "Large and dormant", countKey: "large" },
  { key: "never_opened", label: "Never opened", countKey: "neverOpened" },
];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:-translate-x-full",
        "motion-safe:after:animate-[shimmer_1.8s_infinite] motion-safe:after:bg-gradient-to-r",
        "motion-safe:after:from-transparent motion-safe:after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] motion-safe:after:to-transparent",
        className,
      )}
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
  if (!iso) return "Never opened";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 30) return `${String(days)} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatMonthYear(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function readSettings(): DormancySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SETTINGS_KEY) ?? "null",
    ) as Partial<DormancySettings> | null;
    if (!parsed) return DEFAULT_SETTINGS;
    return {
      dormantDays:
        typeof parsed.dormantDays === "number" && parsed.dormantDays > 0
          ? Math.round(parsed.dormantDays)
          : DEFAULT_SETTINGS.dormantDays,
      minLessons:
        typeof parsed.minLessons === "number" && parsed.minLessons >= 0
          ? Math.round(parsed.minLessons)
          : DEFAULT_SETTINGS.minLessons,
      includeUnpublished:
        typeof parsed.includeUnpublished === "boolean"
          ? parsed.includeUnpublished
          : DEFAULT_SETTINGS.includeUnpublished,
      includeArchived:
        typeof parsed.includeArchived === "boolean"
          ? parsed.includeArchived
          : DEFAULT_SETTINGS.includeArchived,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(settings: DormancySettings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function statusTone(status: string): "success" | "warning" | "muted" | "primary" {
  const value = status.toUpperCase();
  if (value === "PUBLISHED") return "success";
  if (value === "ARCHIVED") return "muted";
  if (value === "DRAFT" || value === "REVIEW") return "warning";
  return "primary";
}

function StatusPill({
  tone,
  children,
}: {
  tone: ReturnType<typeof statusTone>;
  children: ReactNode;
}) {
  const tones = {
    success:
      "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]",
    warning:
      "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]",
    muted:
      "border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
    primary:
      "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ClientApiError || error instanceof Error) return error.message;
  return fallback;
}

function DormantLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dormant content">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-2">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-4 w-80 max-w-full" />
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
            <Shimmer className="h-3 w-24" />
            <div className="space-y-2">
              <Shimmer className="h-7 w-20" />
              <Shimmer className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-wrap gap-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
          <Shimmer className="h-9 w-48" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-32" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-3 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-4" />
            <Shimmer className="h-4 w-1/3" />
            <Shimmer className="ml-auto h-4 w-16" />
            <Shimmer className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyDormant({
  dormantDays,
  onOpenSettings,
}: {
  dormantDays: number;
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
        <BookOpen className="h-12 w-12 text-[var(--admin-outline)]" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-[var(--admin-on-surface)]">
        No dormant content
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Every course has had learner activity in the last {dormantDays} days.
      </p>
      <button
        type="button"
        className={cx(secondaryButtonClassName, "mt-6")}
        onClick={onOpenSettings}
      >
        <Settings2 className="h-4 w-4" aria-hidden />
        Dormancy settings
      </button>
    </div>
  );
}

function DormantErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
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

function RowMoreMenu({
  item,
  onArchive,
  onCopied,
}: {
  item: ResourceUsageDormantItem;
  onArchive: (item: ResourceUsageDormantItem) => void;
  onCopied: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 200;
    setStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      width,
      zIndex: 80,
    });
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
        aria-label={`More actions for ${item.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open && mounted
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              aria-label={`Actions for ${item.title}`}
              style={style}
              className={`admin-theme admin-dropdown-panel ${dropdownPanelSurfaceClassName} p-1.5 shadow-lg`}
            >
              <Link
                href={`/admin/reports/resource-usage/dormant/${item.courseId}`}
                prefetch={false}
                role="menuitem"
                className={dropdownItemClassName}
                onClick={() => {
                  setOpen(false);
                }}
              >
                <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
                View resource detail
              </Link>
              <Link
                href={`/studio/courses/${item.courseId}`}
                prefetch={false}
                role="menuitem"
                className={dropdownItemClassName}
                onClick={() => {
                  setOpen(false);
                }}
              >
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                Open in studio
              </Link>
              <button
                type="button"
                role="menuitem"
                className={dropdownItemClassName}
                onClick={() => {
                  void copyToClipboard(item.courseId).then((ok) => {
                    if (ok) onCopied("Course ID copied");
                    setOpen(false);
                  });
                }}
              >
                <Copy className="h-4 w-4 shrink-0" aria-hidden />
                Copy ID
              </button>
              {item.selectable ? (
                <button
                  type="button"
                  role="menuitem"
                  className={dropdownItemClassName}
                  onClick={() => {
                    setOpen(false);
                    onArchive(item);
                  }}
                >
                  <Archive className="h-4 w-4 shrink-0" aria-hidden />
                  Archive
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function ArchiveModal({
  items,
  busy,
  onClose,
  onConfirm,
}: {
  items: ResourceUsageDormantItem[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (input: { reason: ArchiveReason; deleteAssets: boolean }) => void;
}) {
  const [reason, setReason] = useState("");
  const [deleteAssets, setDeleteAssets] = useState(false);
  const titleId = useId();
  const totals = useMemo(
    () => ({
      storageGb: items.reduce((sum, row) => sum + row.storageGb, 0),
      lessons: items.reduce((sum, row) => sum + row.lessonCount, 0),
      enrolments: items.reduce((sum, row) => sum + row.totalEnrolmentCount, 0),
    }),
    [items],
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] p-4 backdrop-blur-[1px]">
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
        className="admin-theme relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_12px_40px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-[var(--admin-on-surface)]">
              Archive {formatCount(items.length)} course{items.length === 1 ? "" : "s"}
            </h2>
            <p className="mt-1 font-mono text-xs text-[var(--admin-on-surface-variant)]">
              {formatCount(items.length)} courses · {formatGb(totals.storageGb)} GB ·{" "}
              {formatCount(totals.lessons)} lessons · {formatCount(totals.enrolments)} enrolments
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 font-mono text-xs text-[var(--admin-on-surface)]">
            {items.map((item) => (
              <li key={item.courseId} className="flex justify-between gap-3">
                <span className="truncate">{item.title}</span>
                <span className="shrink-0 text-[var(--admin-on-surface-variant)]">
                  {formatGb(item.storageGb)} GB
                </span>
              </li>
            ))}
          </ul>
          <ul className="space-y-2 text-sm text-[var(--admin-on-surface)]">
            <li>Learners lose access to the course.</li>
            <li>Enrolment and progress records are kept.</li>
            <li>Stored assets are retained unless you choose to delete them below.</li>
          </ul>
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
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--admin-danger)]"
              checked={deleteAssets}
              onChange={(event) => {
                setDeleteAssets(event.target.checked);
              }}
            />
            <span>
              <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                Also delete stored assets
              </span>
              <span
                className={cx(
                  "mt-1 block text-xs",
                  deleteAssets
                    ? "text-[var(--admin-danger)]"
                    : "text-[var(--admin-on-surface-variant)]",
                )}
              >
                {deleteAssets
                  ? `This frees ${formatGb(totals.storageGb)} GB and cannot be undone.`
                  : "Assets stay in storage after archive."}
              </span>
            </span>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
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
              )
                return;
              onConfirm({ reason, deleteAssets });
            }}
          >
            <Archive className="h-4 w-4" aria-hidden />
            {deleteAssets
              ? `Archive and delete ${formatGb(totals.storageGb)} GB`
              : `Archive ${formatCount(items.length)} course${items.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SettingsDrawer({
  open,
  draft,
  liveCount,
  busy,
  onChange,
  onClose,
  onReset,
  onSave,
}: {
  open: boolean;
  draft: DormancySettings;
  liveCount: number | null;
  busy: boolean;
  onChange: (next: DormancySettings) => void;
  onClose: () => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const titleId = useId();
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex justify-end bg-[color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] backdrop-blur-[1px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dormancy settings overlay"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="admin-theme relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[-8px_0_24px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] motion-safe:animate-[admin-drawer-in_240ms_ease-out]"
      >
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-[var(--admin-on-surface)]">
            Dormancy settings
          </h2>
          <button
            type="button"
            className="rounded-md p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-[var(--admin-on-surface)]">
              Consider a course dormant after N days without learner activity
            </span>
            <input
              type="number"
              min={1}
              max={365}
              className={fieldClassName}
              value={draft.dormantDays}
              onChange={(event) => {
                const next = Number(event.target.value);
                onChange({
                  ...draft,
                  dormantDays: Number.isFinite(next)
                    ? Math.max(1, Math.round(next))
                    : draft.dormantDays,
                });
              }}
            />
            <p className="text-xs italic text-[var(--admin-on-surface-variant)]">
              {liveCount == null
                ? "Save to refresh the dormant course count for this threshold."
                : `This threshold identifies ${formatCount(liveCount)} courses.`}
            </p>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-[var(--admin-on-surface)]">
              Ignore courses with fewer than N lessons
            </span>
            <input
              type="number"
              min={0}
              max={500}
              className={fieldClassName}
              value={draft.minLessons}
              onChange={(event) => {
                const next = Number(event.target.value);
                onChange({
                  ...draft,
                  minLessons: Number.isFinite(next)
                    ? Math.max(0, Math.round(next))
                    : draft.minLessons,
                });
              }}
            />
          </label>
          <div className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <RoleToggle
              label="Include unpublished courses"
              checked={draft.includeUnpublished}
              onChange={(checked) => {
                onChange({ ...draft, includeUnpublished: checked });
              }}
            />
            <RoleToggle
              label="Include archived courses"
              checked={draft.includeArchived}
              onChange={(checked) => {
                onChange({ ...draft, includeArchived: checked });
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy}
            onClick={onReset}
          >
            Reset defaults
          </button>
          <button type="button" className={primaryButtonClassName} disabled={busy} onClick={onSave}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function HeadlineCard({
  label,
  value,
  unit,
  caption,
  tone = "default",
  barPct,
  icon,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  caption?: ReactNode;
  tone?: "default" | "warning" | "success";
  barPct?: number;
  icon?: ReactNode;
}) {
  const shell =
    tone === "warning"
      ? "border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_6%,var(--admin-surface))]"
      : tone === "success"
        ? "border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_6%,var(--admin-surface))]"
        : "border-[var(--admin-border)] bg-[var(--admin-surface)]";
  const labelTone =
    tone === "warning"
      ? "text-[var(--admin-warning)]"
      : tone === "success"
        ? "text-[var(--admin-success)]"
        : "text-[var(--admin-on-surface-variant)]";
  const valueTone =
    tone === "warning"
      ? "text-[var(--admin-warning)]"
      : tone === "success"
        ? "text-[var(--admin-success)]"
        : "text-[var(--admin-on-surface)]";
  const barTone = tone === "warning" ? "bg-[var(--admin-warning)]" : "bg-[var(--admin-primary)]";

  return (
    <div
      className={cx(
        "relative flex h-32 flex-col justify-between overflow-hidden rounded-lg border p-4",
        shell,
      )}
    >
      <p className={cx("flex items-center gap-1 text-xs", labelTone)}>
        {icon}
        {label}
      </p>
      <div>
        <p className={cx("flex items-end gap-2 font-mono text-[28px] leading-none", valueTone)}>
          {value}
          {unit ? (
            <span className="mb-0.5 text-sm font-normal text-[var(--admin-on-surface-variant)]">
              {unit}
            </span>
          ) : null}
        </p>
        {caption ? (
          <div className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">{caption}</div>
        ) : null}
      </div>
      {barPct != null ? (
        <div className="absolute right-0 bottom-0 left-0 h-[3px] bg-[var(--admin-surface-high)]">
          <div
            className={cx("h-full", barTone)}
            style={{ width: `${String(Math.min(100, Math.max(0, barPct)))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function AdminResourceUsageDormantPanel() {
  const [settings, setSettings] = useState<DormancySettings>(DEFAULT_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<DormancySettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [data, setData] = useState<ResourceUsageDormantResponse | null>(null);
  const dataRef = useRef<ResourceUsageDormantResponse | null>(null);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [view, setView] = useState<ResourceUsageDormantView>("all");
  const [status, setStatus] = useState<ResourceUsageDormantStatusFilter>("all");
  const [dormantForMin, setDormantForMin] = useState("");
  const [storageMinGb, setStorageMinGb] = useState("");
  const [enrolmentFilter, setEnrolmentFilter] =
    useState<ResourceUsageDormantEnrolmentFilter>("any");
  const [sort, setSort] = useState<ResourceUsageDormantSort>("storage_desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [archiveTargets, setArchiveTargets] = useState<ResourceUsageDormantItem[] | null>(null);

  useEffect(() => {
    const loaded = readSettings();
    setSettings(loaded);
    setSettingsDraft(loaded);
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQDebounced(q.trim());
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [q]);

  useEffect(() => {
    if (!copyHint) return;
    const timer = window.setTimeout(() => {
      setCopyHint(null);
    }, 1800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [copyHint]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchResourceUsageDormant({
        page,
        view,
        status,
        sort,
        dormantDays: settings.dormantDays,
        minLessons: settings.minLessons,
        includeUnpublished: settings.includeUnpublished,
        includeArchived: settings.includeArchived,
        enrolmentFilter,
        ...(qDebounced ? { q: qDebounced } : {}),
        ...(dormantForMin ? { dormantForMin: Number(dormantForMin) } : {}),
        ...(storageMinGb ? { storageMinGb: Number(storageMinGb) } : {}),
      });
      setData(response.data);
      setSelectedIds((current) =>
        current.filter((id) =>
          response.data.items.some((item) => item.courseId === id && item.selectable),
        ),
      );
    } catch (loadError) {
      setError(errorMessage(loadError, "Unable to load dormant content."));
      if (!dataRef.current) setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    dormantForMin,
    enrolmentFilter,
    page,
    qDebounced,
    settings.dormantDays,
    settings.includeArchived,
    settings.includeUnpublished,
    settings.minLessons,
    sort,
    status,
    storageMinGb,
    view,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary ?? null;
  const items = data?.items ?? [];
  const pageInfo = data?.pageInfo;
  const maxStorage = useMemo(
    () => Math.max(0.01, ...items.map((item) => item.storageGb), 0.01),
    [items],
  );
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.courseId)),
    [items, selectedIds],
  );
  const selectionTotals = useMemo(
    () => ({
      storageGb: selectedItems.reduce((sum, row) => sum + row.storageGb, 0),
      lessons: selectedItems.reduce((sum, row) => sum + row.lessonCount, 0),
    }),
    [selectedItems],
  );
  const selectableOnPage = items.filter((item) => item.selectable);
  const allPageSelected =
    selectableOnPage.length > 0 &&
    selectableOnPage.every((item) => selectedIds.includes(item.courseId));
  const hasActiveFilters =
    Boolean(qDebounced) ||
    status !== "all" ||
    Boolean(dormantForMin) ||
    Boolean(storageMinGb) ||
    enrolmentFilter !== "any" ||
    sort !== "storage_desc" ||
    view !== "all";

  function openSettings() {
    setSettingsDraft(settings);
    setSettingsOpen(true);
  }

  function clearFilters() {
    setQ("");
    setQDebounced("");
    setStatus("all");
    setDormantForMin("");
    setStorageMinGb("");
    setEnrolmentFilter("any");
    setSort("storage_desc");
    setView("all");
    setPage(1);
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportResourceUsageReport({
        reportTab: "dormant",
        ...(qDebounced ? { q: qDebounced } : {}),
        emailDownloadLink: true,
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed")
        throw new Error(completed.errorMessage ?? "Export failed.");
      if (completed.status === "completed") await downloadReportExport(completed.id, "csv");
    } catch (exportError) {
      setError(errorMessage(exportError, "Unable to export dormant content."));
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveConfirm(input: { reason: ArchiveReason; deleteAssets: boolean }) {
    if (!archiveTargets?.length) return;
    setBusy(true);
    setError(null);
    try {
      await archiveResourceUsageDormant({
        courseIds: archiveTargets.map((item) => item.courseId),
        action: "archive",
        reason: input.reason,
        deleteAssets: input.deleteAssets,
      });
      setArchiveTargets(null);
      setSelectedIds([]);
      await load();
    } catch (archiveError) {
      setError(errorMessage(archiveError, "Unable to archive courses."));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnpublish(targets: ResourceUsageDormantItem[]) {
    if (!targets.length) return;
    setBusy(true);
    setError(null);
    try {
      await archiveResourceUsageDormant({
        courseIds: targets.map((item) => item.courseId),
        action: "unpublish",
        reason: "other",
      });
      setSelectedIds([]);
      await load();
    } catch (unpublishError) {
      setError(errorMessage(unpublishError, "Unable to unpublish courses."));
    } finally {
      setBusy(false);
    }
  }

  function saveSettings() {
    writeSettings(settingsDraft);
    setSettings(settingsDraft);
    setSettingsOpen(false);
    setPage(1);
  }

  if (loading && !data) return <DormantLoadingSkeleton />;

  if (!data && error) {
    return (
      <div className="space-y-4">
        <DormantErrorBanner
          message={error}
          onRetry={() => {
            void load();
          }}
        />
      </div>
    );
  }

  if (data?.isEmpty) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--admin-on-surface)]">
              Dormant content
            </h1>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              Courses with no learner activity in the last {settings.dormantDays} days, and the
              storage they hold.
            </p>
          </div>
          <button type="button" className={secondaryButtonClassName} onClick={openSettings}>
            <Settings2 className="h-4 w-4" aria-hidden />
            Dormancy settings
          </button>
        </div>
        <EmptyDormant dormantDays={settings.dormantDays} onOpenSettings={openSettings} />
        <SettingsDrawer
          open={settingsOpen}
          draft={settingsDraft}
          liveCount={null}
          busy={busy}
          onChange={setSettingsDraft}
          onClose={() => {
            setSettingsOpen(false);
          }}
          onReset={() => {
            setSettingsDraft(DEFAULT_SETTINGS);
          }}
          onSave={saveSettings}
        />
      </div>
    );
  }

  if (!data || !summary) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Dormant content
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Courses with no learner activity in the last {settings.dormantDays} days, and the
            storage they hold.
          </p>
          {copyHint ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--admin-success)]">
              <Check className="h-3.5 w-3.5" aria-hidden />
              {copyHint}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
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
          <button type="button" className={secondaryButtonClassName} onClick={openSettings}>
            <Settings2 className="h-4 w-4" aria-hidden />
            Dormancy settings
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={selectedItems.length === 0 || busy}
            onClick={() => {
              setArchiveTargets(selectedItems);
            }}
          >
            <Archive className="h-4 w-4" aria-hidden />
            {selectedItems.length > 0
              ? `Archive selected (${formatCount(selectedItems.length)} · ${formatGb(selectionTotals.storageGb)} GB)`
              : "Archive selected"}
          </button>
        </div>
      </div>

      {error ? (
        <DormantErrorBanner
          message={error}
          onRetry={() => {
            void load();
          }}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <HeadlineCard
          label="Dormant courses"
          tone="warning"
          icon={<Moon className="h-3.5 w-3.5" aria-hidden />}
          value={formatCount(summary.dormantCourseCount)}
          caption={`of ${formatCount(summary.totalCourseCount)} courses · ${summary.dormantCoursePct.toFixed(1)}%`}
          barPct={summary.dormantCoursePct}
        />
        <HeadlineCard
          label="Storage held"
          value={formatGb(summary.storageHeldGb)}
          unit="GB"
          caption={`${summary.storageHeldPct.toFixed(1)}% of total storage`}
          barPct={summary.storageHeldPct}
        />
        <HeadlineCard
          label="Dormant and unpublished"
          tone="success"
          value={formatCount(summary.unpublishedDormantCount)}
          caption={
            <span className="font-medium tracking-wide text-[var(--admin-success)] uppercase">
              safest to archive
            </span>
          }
        />
        <HeadlineCard
          label="Longest dormant"
          value={
            summary.longestDormantDays != null ? (
              <>
                {formatCount(summary.longestDormantDays)}
                <span className="mb-0.5 ml-1 text-sm font-normal text-[var(--admin-on-surface-variant)]">
                  days
                </span>
              </>
            ) : (
              "-"
            )
          }
          caption={
            summary.longestDormantCourseId ? (
              <Link
                href={`/admin/reports/resource-usage/dormant/${summary.longestDormantCourseId}`}
                prefetch={false}
                className="truncate font-mono text-[var(--admin-primary)] hover:underline"
              >
                {summary.longestDormantShortCode ?? summary.longestDormantTitle ?? "View course"}
              </Link>
            ) : (
              <span className="truncate font-mono">
                {summary.longestDormantShortCode ?? summary.longestDormantTitle ?? "-"}
              </span>
            )
          }
        />
        <HeadlineCard label="Lessons affected" value={formatCount(summary.lessonsAffected)} />
      </div>

      <p className="text-xs italic text-[var(--admin-on-surface-variant)]">
        Dormant means no learner has opened a lesson in this course for {settings.dormantDays} days.
        Change the window in dormancy settings.
      </p>

      <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="space-y-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              placeholder="Search course title"
              aria-label="Search course title"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              className="h-9 min-w-[180px] flex-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
            />
            <Select
              ariaLabel="Status filter"
              className={selectClassName}
              value={status}
              onValueChange={(value) => {
                setStatus(value as ResourceUsageDormantStatusFilter);
                setPage(1);
              }}
              options={STATUS_OPTIONS}
            />
            <Select
              ariaLabel="Dormant for filter"
              className={selectClassName}
              value={dormantForMin}
              onValueChange={(value) => {
                setDormantForMin(value);
                setPage(1);
              }}
              options={DORMANT_FOR_OPTIONS}
            />
            <Select
              ariaLabel="Storage filter"
              className={selectClassName}
              value={storageMinGb}
              onValueChange={(value) => {
                setStorageMinGb(value);
                setPage(1);
              }}
              options={STORAGE_OPTIONS}
            />
            <Select
              ariaLabel="Enrolment filter"
              className={selectClassName}
              value={enrolmentFilter}
              onValueChange={(value) => {
                setEnrolmentFilter(value as ResourceUsageDormantEnrolmentFilter);
                setPage(1);
              }}
              options={ENROLMENT_OPTIONS}
            />
            <Select
              ariaLabel="Sort dormant courses"
              className={selectClassName}
              value={sort}
              onValueChange={(value) => {
                setSort(value as ResourceUsageDormantSort);
                setPage(1);
              }}
              options={SORT_OPTIONS}
            />
            {hasActiveFilters ? (
              <button
                type="button"
                className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
                onClick={clearFilters}
              >
                Clear all
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1 border-t border-[var(--admin-border)] pt-3">
            {VIEW_TABS.map((tab) => {
              const active = view === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={cx(
                    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                      : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]",
                  )}
                  onClick={() => {
                    setView(tab.key);
                    setPage(1);
                  }}
                >
                  {tab.label}
                  <span className="font-mono text-[10px] opacity-80">
                    {formatCount(summary.viewCounts[tab.countKey])}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedItems.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
            <p className="text-sm text-[var(--admin-on-surface)]">
              <span className="font-mono font-medium">{formatCount(selectedItems.length)}</span>{" "}
              selected ·{" "}
              <span className="font-mono font-medium">{formatGb(selectionTotals.storageGb)}</span>{" "}
              GB ·{" "}
              <span className="font-mono font-medium">{formatCount(selectionTotals.lessons)}</span>{" "}
              lessons
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={busy}
                onClick={() => {
                  void handleUnpublish(selectedItems);
                }}
              >
                Unpublish
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={busy}
                onClick={() => {
                  void handleExport();
                }}
              >
                Export
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={busy}
                onClick={() => {
                  setArchiveTargets(selectedItems);
                }}
              >
                Archive
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  setSelectedIds([]);
                }}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-[var(--admin-surface)] text-[11px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
              <tr>
                <th className="w-11 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--admin-primary)]"
                    checked={allPageSelected}
                    onChange={() => {
                      if (allPageSelected) {
                        setSelectedIds((current) =>
                          current.filter(
                            (id) => !selectableOnPage.some((row) => row.courseId === id),
                          ),
                        );
                      } else {
                        setSelectedIds((current) => [
                          ...new Set([...current, ...selectableOnPage.map((row) => row.courseId)]),
                        ]);
                      }
                    }}
                    aria-label="Select all selectable courses on this page"
                  />
                </th>
                <th className="px-4 py-2.5 font-semibold">Course</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Lessons</th>
                <th className="px-4 py-2.5 font-semibold">Storage</th>
                <th className="px-4 py-2.5 font-semibold">Enrolments</th>
                <th className="px-4 py-2.5 font-semibold">Last activity</th>
                <th className="px-4 py-2.5 font-semibold">Dormant for</th>
                <th className="px-4 py-2.5 font-semibold">Created</th>
                <th className="w-12 px-2 py-2.5 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6">
                    <div className="space-y-2" aria-busy="true">
                      <Shimmer className="h-8 w-full" />
                      <Shimmer className="h-8 w-full" />
                      <Shimmer className="h-8 w-full" />
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-[var(--admin-on-surface-variant)]"
                  >
                    No courses match these filters.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const selected = selectedIds.includes(row.courseId);
                  const archived = row.status.toUpperCase() === "ARCHIVED" || !row.selectable;
                  const neverOpened = !row.lastLearnerActivityAt;
                  const storagePct = Math.min(100, (row.storageGb / maxStorage) * 100);
                  return (
                    <tr
                      key={row.courseId}
                      className={cx(
                        "border-t border-[var(--admin-border)]",
                        selected
                          ? "border-l-2 border-l-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                          : "hover:bg-[var(--admin-surface-low)]",
                        archived && "opacity-70",
                      )}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          disabled={!row.selectable}
                          checked={selected}
                          onChange={() => {
                            if (!row.selectable) return;
                            setSelectedIds((current) =>
                              current.includes(row.courseId)
                                ? current.filter((id) => id !== row.courseId)
                                : [...current, row.courseId],
                            );
                          }}
                          aria-label={`Select ${row.title}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/reports/resource-usage/dormant/${row.courseId}`}
                          prefetch={false}
                          className={cx(
                            "font-medium text-[var(--admin-primary)] hover:underline",
                            archived && "line-through",
                          )}
                        >
                          {row.title}
                        </Link>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                            {row.shortCode || row.courseId.slice(0, 8)}
                          </span>
                          <button
                            type="button"
                            className="rounded p-0.5 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                            aria-label="Copy short code"
                            onClick={() => {
                              void copyToClipboard(row.shortCode || row.courseId).then((ok) => {
                                if (ok) setCopyHint("Copied");
                              });
                            }}
                          >
                            <Copy className="h-3 w-3" aria-hidden />
                          </button>
                          {archived ? (
                            <span className="text-[10px] text-[var(--admin-on-surface-variant)]">
                              Archived · assets retained
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill>
                      </td>
                      <td className="px-4 py-3 font-mono text-[var(--admin-on-surface)]">
                        {formatCount(row.lessonCount)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-[var(--admin-on-surface)]">
                          {formatGb(row.storageGb)} GB
                        </p>
                        <div className="mt-1 h-[3px] w-24 rounded-sm bg-[var(--admin-surface-high)]">
                          <div
                            className="h-full rounded-sm bg-[var(--admin-primary)]"
                            style={{ width: `${String(Math.max(4, storagePct))}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-[var(--admin-on-surface)]">
                          {formatCount(row.totalEnrolmentCount)}
                        </p>
                        <p
                          className={cx(
                            "mt-0.5 text-[10px]",
                            row.activeEnrolmentCount === 0
                              ? "font-medium text-[var(--admin-warning)]"
                              : "text-[var(--admin-on-surface-variant)]",
                          )}
                        >
                          {row.activeEnrolmentCount === 0
                            ? "0 active"
                            : `${formatCount(row.activeEnrolmentCount)} active`}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p
                          className={
                            neverOpened
                              ? "text-sm font-medium text-[var(--admin-warning)]"
                              : "text-sm text-[var(--admin-on-surface)]"
                          }
                        >
                          {formatRelative(row.lastLearnerActivityAt)}
                        </p>
                        {row.lastLearnerActivityAt ? (
                          <p className="mt-0.5 text-[10px] text-[var(--admin-on-surface-variant)]">
                            {new Date(row.lastLearnerActivityAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        ) : null}
                      </td>
                      <td
                        className={cx(
                          "px-4 py-3 font-mono",
                          row.dormantDays >= 90
                            ? "text-[var(--admin-warning)]"
                            : "text-[var(--admin-on-surface)]",
                        )}
                      >
                        {formatCount(row.dormantDays)} days
                      </td>
                      <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                        {formatMonthYear(row.createdAt)}
                      </td>
                      <td className="px-2 py-3">
                        <RowMoreMenu
                          item={row}
                          onArchive={(target) => {
                            setArchiveTargets([target]);
                          }}
                          onCopied={setCopyHint}
                        />
                      </td>
                    </tr>
                  );
                })
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

      {archiveTargets ? (
        <ArchiveModal
          items={archiveTargets}
          busy={busy}
          onClose={() => {
            setArchiveTargets(null);
          }}
          onConfirm={(input) => {
            void handleArchiveConfirm(input);
          }}
        />
      ) : null}

      <SettingsDrawer
        open={settingsOpen}
        draft={settingsDraft}
        liveCount={summary.dormantCourseCount}
        busy={busy}
        onChange={setSettingsDraft}
        onClose={() => {
          setSettingsOpen(false);
        }}
        onReset={() => {
          setSettingsDraft(DEFAULT_SETTINGS);
        }}
        onSave={saveSettings}
      />
    </div>
  );
}
