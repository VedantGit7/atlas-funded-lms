"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Download,
  FilterX,
  HardDrive,
  Inbox,
  Mail,
  MoreVertical,
  Pause,
  Play,
  Search,
  Trash2,
  AlertTriangle,
  Webhook,
  X,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import { DropdownField } from "../../studio/courses/admin-form-dropdown-shared";
import {
  bulkMutateSchedules,
  deleteReportSchedule,
  EXPORTS_REPORT_DEFINITIONS,
  fetchSchedulesRoster,
  runScheduleNow,
  updateReportSchedule,
  type ScheduleCadenceFilter,
  type ScheduleDestinationFilter,
  type ScheduleSort,
  type ScheduleStatusFilter,
  type SchedulesRosterItem,
  type SchedulesRosterSummary,
} from "./admin-export-schedules-api";

const primaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 text-[13px] font-semibold text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const ghostButtonClassName =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:opacity-50";

const fieldClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const EMPTY_SUMMARY: SchedulesRosterSummary = {
  totalCount: 0,
  enabledCount: 0,
  pausedCount: 0,
  runsThisMonth: 0,
  runsSucceededThisMonth: 0,
  runsFailedThisMonth: 0,
  nextRunAt: null,
  nextScheduleName: null,
  failingCount: 0,
  maxConsecutiveFailures: 0,
  externalDeliveryCount: 0,
};

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatAbsolute(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function formatRelative(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) {
    const ahead = Math.abs(diffMs);
    if (ahead < 60_000) return "in under a minute";
    const mins = Math.floor(ahead / 60_000);
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 48) return `in ${hours}h`;
    return `in ${Math.floor(hours / 24)}d`;
  }
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusPill(status: string | null) {
  if (!status) return null;
  const tone =
    status === "SUCCEEDED"
      ? "border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]"
      : status === "FAILED"
        ? "border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]"
        : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
  return (
    <span
      className={`inline-flex rounded border px-1.5 py-px font-mono text-[11px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {status === "SUCCEEDED" ? "Success" : status === "FAILED" ? "Failed" : status}
    </span>
  );
}

function DestinationIcon({ kind }: { kind: string }) {
  if (kind === "email") return <Mail className="h-3 w-3" aria-hidden="true" />;
  if (kind === "webhook") return <Webhook className="h-3 w-3" aria-hidden="true" />;
  if (kind === "storage") return <HardDrive className="h-3 w-3" aria-hidden="true" />;
  return <Download className="h-3 w-3" aria-hidden="true" />;
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--admin-surface-low)] ${className ?? "h-4 w-24"}`}
    />
  );
}

function SchedulesLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading schedules">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"
          >
            <SkeletonBar className="mb-3 h-3 w-24" />
            <SkeletonBar className="mb-2 h-8 w-16" />
            <SkeletonBar className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
        <div className="flex flex-wrap gap-3">
          <SkeletonBar className="h-9 w-48" />
          <SkeletonBar className="h-9 w-32" />
          <SkeletonBar className="h-9 w-32" />
          <SkeletonBar className="h-9 w-32" />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--admin-border)] px-4 py-4 last:border-b-0"
          >
            <SkeletonBar className="h-4 w-4" />
            <SkeletonBar className="h-4 w-40" />
            <SkeletonBar className="h-4 w-28" />
            <SkeletonBar className="h-4 w-20" />
            <SkeletonBar className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DeleteScheduleModal({
  item,
  busy,
  onCancel,
  onConfirm,
}: {
  item: SchedulesRosterItem;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const destinationLabel = item.destinations.map((d) => d.label).join(", ") || "Download";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-schedule-title"
    >
      <div className="admin-theme flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-6 py-5">
          <div className="flex items-start gap-3 text-[var(--admin-danger)]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <h2
              id="delete-schedule-title"
              className="text-base font-semibold text-[var(--admin-on-surface)]"
            >
              Delete schedule: {item.name}?
            </h2>
          </div>
          <button
            type="button"
            className={ghostButtonClassName}
            onClick={onCancel}
            aria-label="Close"
            disabled={busy}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col gap-5 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Cadence</p>
              <p className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                <Calendar
                  className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                {item.cadenceLabel}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Destination</p>
              <p className="text-sm text-[var(--admin-on-surface)]">{destinationLabel}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Past runs</p>
              <p className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                {formatCount(item.pastRunCount)} runs
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 border-l-2 border-[var(--admin-on-surface-variant)] bg-[var(--admin-surface-low)] p-3 text-xs text-[var(--admin-on-surface-variant)]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <p>
              Past runs and their files are kept for audit while the schedule is removed
              permanently.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-danger)] px-4 text-[13px] font-semibold text-[var(--admin-on-danger)] transition-all hover:opacity-90 active:translate-y-px disabled:opacity-50"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminExportSchedulesPage() {
  const statusLabelId = useId();
  const cadenceLabelId = useId();
  const destinationLabelId = useId();
  const sortLabelId = useId();
  const reportLabelId = useId();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SchedulesRosterItem[]>([]);
  const [summary, setSummary] = useState<SchedulesRosterSummary>(EMPTY_SUMMARY);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<ScheduleStatusFilter>("all");
  const [cadence, setCadence] = useState<ScheduleCadenceFilter>("any");
  const [destination, setDestination] = useState<ScheduleDestinationFilter>("any");
  const [definitionKey, setDefinitionKey] = useState("");
  const [sort, setSort] = useState<ScheduleSort>("next_run_asc");

  const [statusOpen, setStatusOpen] = useState(false);
  const [cadenceOpen, setCadenceOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<SchedulesRosterItem | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQ(q.trim());
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSchedulesRoster({
        q: debouncedQ || undefined,
        status,
        cadence,
        destination,
        definitionKey: definitionKey || undefined,
        sort,
        page,
        limit: 50,
      });
      setItems(response.data.items);
      setSummary(response.data.summary);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to load schedules.",
      );
      setItems([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, status, cadence, destination, definitionKey, sort, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedQ, status, cadence, destination, definitionKey, sort]);

  const hasFilters =
    Boolean(debouncedQ) ||
    status !== "all" ||
    cadence !== "any" ||
    destination !== "any" ||
    Boolean(definitionKey);

  const chips = useMemo(() => {
    const list: Array<{ key: string; label: string; clear: () => void }> = [];
    if (debouncedQ) {
      list.push({
        key: "q",
        label: `Search: ${debouncedQ}`,
        clear: () => {
          setQ("");
        },
      });
    }
    if (status !== "all") {
      list.push({
        key: "status",
        label: `Status: ${status}`,
        clear: () => {
          setStatus("all");
        },
      });
    }
    if (cadence !== "any") {
      list.push({
        key: "cadence",
        label: `Cadence: ${cadence}`,
        clear: () => {
          setCadence("any");
        },
      });
    }
    if (destination !== "any") {
      list.push({
        key: "destination",
        label: `Destination: ${destination}`,
        clear: () => {
          setDestination("any");
        },
      });
    }
    if (definitionKey) {
      const report = EXPORTS_REPORT_DEFINITIONS.find((d) => d.key === definitionKey);
      list.push({
        key: "report",
        label: `Report: ${report?.title ?? definitionKey}`,
        clear: () => {
          setDefinitionKey("");
        },
      });
    }
    return list;
  }, [debouncedQ, status, cadence, destination, definitionKey]);

  function clearFilters() {
    setQ("");
    setStatus("all");
    setCadence("any");
    setDestination("any");
    setDefinitionKey("");
    setSort("next_run_asc");
  }

  function toggleRow(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    if (items.length === 0) return;
    const allSelected = items.every((item) => selectedIds.has(item.id));
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const item of items) {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  }

  async function handleToggle(item: SchedulesRosterItem) {
    const nextActive = !item.isActive;
    if (!nextActive) {
      const confirmed = window.confirm(`Pause schedule "${item.name}"?`);
      if (!confirmed) return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateReportSchedule(item.id, { isActive: nextActive });
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to update schedule.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRunNow(id: string) {
    setBusy(true);
    setError(null);
    setMenuOpenId(null);
    try {
      await runScheduleNow(id);
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to run schedule.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    try {
      await deleteReportSchedule(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(deleteTarget.id);
        return next;
      });
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to delete schedule.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleBulk(action: "pause" | "enable" | "delete" | "run_now") {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (action === "delete") {
      const confirmed = window.confirm(`Delete ${ids.length} selected schedule(s)?`);
      if (!confirmed) return;
    }
    setBusy(true);
    setError(null);
    try {
      await bulkMutateSchedules({ action, ids });
      setSelectedIds(new Set());
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Bulk action failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const moduleTabs: Array<{ key: string; label: string; href?: string; active?: boolean }> = [
    { key: "history", label: "History", href: "/admin/reports/exports" },
    { key: "new", label: "New export", href: "/admin/reports/exports/new" },
    {
      key: "schedules",
      label: "Schedules",
      href: "/admin/reports/exports/schedules",
      active: true,
    },
    { key: "destinations", label: "Destinations", href: "/admin/reports/exports/destinations" },
    { key: "settings", label: "Settings", href: "/admin/reports/exports/settings" },
  ];

  const statusLabel =
    status === "all"
      ? "All statuses"
      : status === "enabled"
        ? "Enabled"
        : status === "paused"
          ? "Paused"
          : "Failing";
  const cadenceLabel =
    cadence === "any" ? "Any cadence" : cadence.charAt(0).toUpperCase() + cadence.slice(1);
  const destinationLabel =
    destination === "any"
      ? "All destinations"
      : destination.charAt(0).toUpperCase() + destination.slice(1);
  const sortLabel =
    sort === "next_run_asc"
      ? "Next run (earliest)"
      : sort === "last_run_desc"
        ? "Last run (latest)"
        : sort === "name_asc"
          ? "Name (A-Z)"
          : "Failures (most)";

  const showEmptyTrue =
    !loading && !error && items.length === 0 && !hasFilters && summary.totalCount === 0;
  const showEmptyFiltered = !loading && !error && items.length === 0 && hasFilters;

  return (
    <div className="relative flex flex-col gap-6 pb-28">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-medium tracking-wide text-[var(--admin-on-surface-variant)]">
            Admin / Reports / Exports
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Schedules
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Exports that run on a cadence and deliver themselves.
          </p>
          <nav
            className="mt-4 flex items-end gap-5 border-b border-[var(--admin-border)]"
            aria-label="Exports module"
          >
            {moduleTabs.map((tab) => {
              const className = `-mb-px border-b-2 pb-2 text-sm transition-colors ${
                tab.active
                  ? "border-[var(--admin-primary)] font-medium text-[var(--admin-primary)]"
                  : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
              }`;
              if (tab.href) {
                return (
                  <Link key={tab.key} href={tab.href} className={className}>
                    {tab.label}
                  </Link>
                );
              }
              return (
                <button
                  key={tab.key}
                  type="button"
                  disabled
                  title="Coming soon"
                  className={`${className} cursor-not-allowed opacity-50`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={secondaryButtonClassName} disabled title="Coming soon">
            <Download className="h-4 w-4" aria-hidden="true" />
            Export this list
          </button>
          <Link href="/admin/reports/exports/new" className={primaryButtonClassName}>
            New schedule
          </Link>
        </div>
      </div>

      {error ? (
        <div
          className="flex flex-wrap items-center gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4"
          role="alert"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] text-[var(--admin-danger)]">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[var(--admin-danger)]">
              Couldn&apos;t load schedules.
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-[var(--admin-danger)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--admin-danger)]"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <SchedulesLoadingSkeleton />
      ) : showEmptyTrue ? (
        <section className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-12 text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
            <Clock className="h-12 w-12" strokeWidth={1.25} aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
            No scheduled exports
          </h2>
          <p className="mb-8 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            Turn any export into a recurring one from the export builder to automate your reporting
            workflows.
          </p>
          <Link href="/admin/reports/exports/new" className={primaryButtonClassName}>
            New schedule
          </Link>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <p className="mb-2 font-mono text-[10px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                Total schedules
              </p>
              <p className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-on-surface)]">
                {formatCount(summary.totalCount)}
              </p>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                {formatCount(summary.enabledCount)} enabled · {formatCount(summary.pausedCount)}{" "}
                paused
              </p>
            </div>
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <p className="mb-2 font-mono text-[10px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                Runs this month
              </p>
              <p className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-on-surface)]">
                {formatCount(summary.runsThisMonth)}
              </p>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                <span className="text-[var(--admin-success)]">
                  {formatCount(summary.runsSucceededThisMonth)} succeeded
                </span>{" "}
                ·{" "}
                <span className="text-[var(--admin-danger)]">
                  {formatCount(summary.runsFailedThisMonth)} failed
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <p className="mb-2 font-mono text-[10px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                Upcoming execution
              </p>
              <p className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-on-surface)]">
                {summary.nextRunAt ? formatRelative(summary.nextRunAt) : "-"}
              </p>
              <p className="mt-2 truncate text-xs text-[var(--admin-primary)]">
                {summary.nextScheduleName ?? "No upcoming runs"}
              </p>
            </div>
            <button
              type="button"
              className="relative overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[var(--admin-surface)] p-5 text-left transition-colors hover:bg-[var(--admin-surface-low)]"
              onClick={() => {
                setStatus("failing");
              }}
            >
              <div className="absolute top-0 bottom-0 left-0 w-1 bg-[var(--admin-danger)]" />
              <p className="mb-2 flex items-center gap-1 font-mono text-[10px] font-medium tracking-wider text-[var(--admin-danger)] uppercase">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Failing schedules
              </p>
              <p className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-danger)]">
                {formatCount(summary.failingCount)}
              </p>
              <p className="mt-2 text-xs text-[color-mix(in_srgb,var(--admin-danger)_80%,transparent)]">
                {summary.maxConsecutiveFailures > 0
                  ? `${formatCount(summary.maxConsecutiveFailures)} consecutive failures`
                  : "No active failure streaks"}
              </p>
            </button>
            <button
              type="button"
              className="relative overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[var(--admin-surface)] p-5 text-left transition-colors hover:bg-[var(--admin-surface-low)]"
              onClick={() => {
                setDestination("email");
              }}
            >
              <div className="absolute top-0 bottom-0 left-0 w-1 bg-[var(--admin-warning)]" />
              <p className="mb-2 flex items-center gap-1 font-mono text-[10px] font-medium tracking-wider text-[var(--admin-warning)] uppercase">
                <Webhook className="h-3.5 w-3.5" aria-hidden="true" />
                External delivery
              </p>
              <p className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-warning)]">
                {formatCount(summary.externalDeliveryCount)}
              </p>
              <p className="mt-2 text-xs text-[color-mix(in_srgb,var(--admin-warning)_80%,transparent)]">
                to email, webhook, or storage
              </p>
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <div className="flex min-w-[200px] flex-1 flex-col gap-1">
              <label className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                Search schedules
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <input
                  className={`${fieldClassName} pl-9`}
                  placeholder="By name or key…"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                  }}
                />
              </div>
            </div>

            <div className="min-w-[140px]">
              <DropdownField
                label={
                  <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                    Status
                  </span>
                }
                labelId={statusLabelId}
                open={statusOpen}
                onToggle={() => {
                  setStatusOpen((o) => !o);
                }}
                triggerContent={
                  <span className="flex w-full items-center gap-2 text-[13px]">
                    <span className="flex-1 text-left">{statusLabel}</span>
                  </span>
                }
                panelAriaLabel="Status options"
              >
                <div className={"p-1.5"} role="listbox">
                  {(
                    [
                      ["all", "All statuses"],
                      ["enabled", "Enabled"],
                      ["paused", "Paused"],
                      ["failing", "Failing"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={status === value}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        setStatus(value);
                        setStatusOpen(false);
                      }}
                    >
                      {status === value ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              </DropdownField>
            </div>

            <div className="min-w-[140px]">
              <DropdownField
                label={
                  <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                    Cadence
                  </span>
                }
                labelId={cadenceLabelId}
                open={cadenceOpen}
                onToggle={() => {
                  setCadenceOpen((o) => !o);
                }}
                triggerContent={
                  <span className="flex w-full items-center gap-2 text-[13px]">
                    <span className="flex-1 text-left">{cadenceLabel}</span>
                  </span>
                }
                panelAriaLabel="Cadence options"
              >
                <div className={"p-1.5"} role="listbox">
                  {(
                    [
                      ["any", "Any cadence"],
                      ["hourly", "Hourly"],
                      ["daily", "Daily"],
                      ["weekly", "Weekly"],
                      ["monthly", "Monthly"],
                      ["custom", "Custom"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={cadence === value}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        setCadence(value);
                        setCadenceOpen(false);
                      }}
                    >
                      {cadence === value ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              </DropdownField>
            </div>

            <div className="min-w-[150px]">
              <DropdownField
                label={
                  <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                    Destination
                  </span>
                }
                labelId={destinationLabelId}
                open={destinationOpen}
                onToggle={() => {
                  setDestinationOpen((o) => !o);
                }}
                triggerContent={
                  <span className="flex w-full items-center gap-2 text-[13px]">
                    <span className="flex-1 text-left">{destinationLabel}</span>
                  </span>
                }
                panelAriaLabel="Destination options"
              >
                <div className={"p-1.5"} role="listbox">
                  {(
                    [
                      ["any", "All destinations"],
                      ["download", "Download"],
                      ["email", "Email"],
                      ["webhook", "Webhook"],
                      ["storage", "Storage"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={destination === value}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        setDestination(value);
                        setDestinationOpen(false);
                      }}
                    >
                      {destination === value ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              </DropdownField>
            </div>

            <div className="min-w-[160px]">
              <DropdownField
                label={
                  <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                    Report
                  </span>
                }
                labelId={reportLabelId}
                open={reportOpen}
                onToggle={() => {
                  setReportOpen((o) => !o);
                }}
                triggerContent={
                  <span className="flex w-full items-center gap-2 text-[13px]">
                    <span className="flex-1 truncate text-left">
                      {definitionKey
                        ? (EXPORTS_REPORT_DEFINITIONS.find((d) => d.key === definitionKey)?.title ??
                          definitionKey)
                        : "All reports"}
                    </span>
                  </span>
                }
                panelAriaLabel="Report options"
              >
                <div className={"max-h-64 overflow-y-auto p-1.5"} role="listbox">
                  <button
                    type="button"
                    role="option"
                    aria-selected={!definitionKey}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                    onClick={() => {
                      setDefinitionKey("");
                      setReportOpen(false);
                    }}
                  >
                    {!definitionKey ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <span className="w-3.5" />
                    )}
                    All reports
                  </button>
                  {EXPORTS_REPORT_DEFINITIONS.map((def) => (
                    <button
                      key={def.key}
                      type="button"
                      role="option"
                      aria-selected={definitionKey === def.key}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        setDefinitionKey(def.key);
                        setReportOpen(false);
                      }}
                    >
                      {definitionKey === def.key ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                      {def.title}
                    </button>
                  ))}
                </div>
              </DropdownField>
            </div>

            <div className="min-w-[170px]">
              <DropdownField
                label={
                  <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                    Sort by
                  </span>
                }
                labelId={sortLabelId}
                open={sortOpen}
                onToggle={() => {
                  setSortOpen((o) => !o);
                }}
                triggerContent={
                  <span className="flex w-full items-center gap-2 text-[13px]">
                    <span className="flex-1 text-left">{sortLabel}</span>
                  </span>
                }
                panelAriaLabel="Sort options"
              >
                <div className={"p-1.5"} role="listbox">
                  {(
                    [
                      ["next_run_asc", "Next run (earliest)"],
                      ["last_run_desc", "Last run (latest)"],
                      ["name_asc", "Name (A-Z)"],
                      ["failures_desc", "Failures (most)"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={sort === value}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        setSort(value);
                        setSortOpen(false);
                      }}
                    >
                      {sort === value ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              </DropdownField>
            </div>

            <button
              type="button"
              className={ghostButtonClassName}
              title="Clear filters"
              onClick={clearFilters}
              disabled={!hasFilters}
            >
              <FilterX className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {chips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 py-1 text-xs text-[var(--admin-on-surface)]"
                  onClick={chip.clear}
                >
                  {chip.label}
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
                onClick={clearFilters}
              >
                Clear all
              </button>
            </div>
          ) : null}

          {showEmptyFiltered ? (
            <section className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
              <Inbox
                className="mb-4 h-10 w-10 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                No schedules match these filters
              </h2>
              <p className="mb-6 text-sm text-[var(--admin-on-surface-variant)]">
                Try clearing filters or creating a new schedule.
              </p>
              <button type="button" className={secondaryButtonClassName} onClick={clearFilters}>
                Clear filters
              </button>
            </section>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] md:block">
                <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="h-11 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                      <th className="w-12 px-4">
                        <input
                          type="checkbox"
                          checked={items.length > 0 && items.every((i) => selectedIds.has(i.id))}
                          onChange={toggleAllVisible}
                          aria-label="Select all visible"
                          className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                        />
                      </th>
                      <th className="px-4 font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase text-[12px]">
                        Schedule &amp; report
                      </th>
                      <th className="px-4 font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase text-[12px]">
                        Cadence
                      </th>
                      <th className="px-4 font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase text-[12px]">
                        Destination
                      </th>
                      <th className="px-4 font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase text-[12px]">
                        Format
                      </th>
                      <th className="px-4 text-right font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase text-[12px]">
                        Last run
                      </th>
                      <th className="px-4 text-right font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase text-[12px]">
                        Next run
                      </th>
                      <th className="px-4 font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase text-[12px]">
                        Owner
                      </th>
                      <th className="w-20 px-4 text-center font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase text-[12px]">
                        State
                      </th>
                      <th className="w-12 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const selected = selectedIds.has(item.id);
                      return (
                        <tr
                          key={item.id}
                          className={`h-16 border-b border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-low)] ${
                            selected
                              ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                              : ""
                          } ${!item.isActive ? "opacity-70" : ""} ${
                            item.isFailing
                              ? "shadow-[inset_2px_0_0_0_var(--admin-danger)]"
                              : selected
                                ? "shadow-[inset_2px_0_0_0_var(--admin-primary)]"
                                : ""
                          }`}
                        >
                          <td className="px-4">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {
                                toggleRow(item.id);
                              }}
                              aria-label={`Select ${item.name}`}
                              className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                            />
                          </td>
                          <td className="px-4">
                            <Link
                              href={`/admin/reports/exports/schedules/${item.id}`}
                              className="font-semibold text-[var(--admin-primary)] hover:underline"
                            >
                              {item.name}
                            </Link>
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                              {item.isFailing ? (
                                <AlertCircle
                                  className="h-3 w-3 text-[var(--admin-danger)]"
                                  aria-hidden="true"
                                />
                              ) : null}
                              <span>{item.definitionTitle}</span>
                              <span className="font-mono text-[10px]">{item.definitionKey}</span>
                            </div>
                          </td>
                          <td className="px-4">
                            <div
                              className={`font-mono text-[13px] ${!item.isActive ? "line-through text-[var(--admin-on-surface-variant)]" : "text-[var(--admin-on-surface)]"}`}
                            >
                              {item.cadenceLabel}
                            </div>
                            {item.isActive && item.nextRunAt ? (
                              <div className="text-xs text-[var(--admin-on-surface-variant)]">
                                {formatRelative(item.nextRunAt)}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.destinations.map((dest) => (
                                <span
                                  key={`${item.id}-${dest.kind}`}
                                  className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 text-xs"
                                >
                                  <DestinationIcon kind={dest.kind} />
                                  {dest.label}
                                </span>
                              ))}
                              {item.isExternal ? (
                                <span className="rounded border border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--admin-warning)]">
                                  EXT
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4">
                            <span className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-mono text-[10px] uppercase">
                              {item.primaryFormat}
                            </span>
                          </td>
                          <td className="px-4 text-right">
                            <div className="mb-0.5 flex items-center justify-end gap-2">
                              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                                {formatRelative(item.lastRunAt)}
                              </span>
                              {statusPill(item.lastRunStatus)}
                            </div>
                            {item.isFailing ? (
                              <div className="font-mono text-[13px] text-[var(--admin-danger)]">
                                {item.lastRunErrorMessage ||
                                  `${item.consecutiveFailures} consecutive failures`}
                              </div>
                            ) : item.lastRunRowCount != null ? (
                              <div className="font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                                {formatCount(item.lastRunRowCount)} rows
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 text-right">
                            {!item.isActive ? (
                              <span className="font-mono text-[13px] text-[var(--admin-on-surface-variant)] italic">
                                Paused
                              </span>
                            ) : (
                              <span className="font-mono text-[13px]">
                                {formatAbsolute(item.nextRunAt)}
                              </span>
                            )}
                          </td>
                          <td className="px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--admin-surface-low)] font-mono text-[10px] text-[var(--admin-on-surface)]">
                                {item.ownerInitials}
                              </div>
                              <span className="truncate text-sm">
                                {item.ownerName ?? "Unknown"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 text-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={item.isActive}
                              aria-label={`${item.isActive ? "Pause" : "Enable"} ${item.name}`}
                              disabled={busy}
                              onClick={() => void handleToggle(item)}
                              className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                                item.isActive
                                  ? "bg-[var(--admin-primary)]"
                                  : "border border-[var(--admin-outline)] bg-[var(--admin-surface-variant)]"
                              }`}
                            >
                              <span
                                className={`absolute h-3 w-3 rounded-full bg-[var(--admin-surface)] shadow-sm transition-all ${
                                  item.isActive ? "right-0.5" : "left-0.5"
                                }`}
                              />
                            </button>
                          </td>
                          <td className="px-4 text-right">
                            <div className="relative inline-block">
                              <button
                                type="button"
                                className={ghostButtonClassName}
                                aria-label={`Actions for ${item.name}`}
                                onClick={() => {
                                  setMenuOpenId((current) =>
                                    current === item.id ? null : item.id,
                                  );
                                }}
                              >
                                <MoreVertical className="h-4 w-4" aria-hidden="true" />
                              </button>
                              {menuOpenId === item.id ? (
                                <div
                                  className={
                                    "absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1.5 shadow-lg motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]"
                                  }
                                  role="menu"
                                >
                                  <Link
                                    href={`/admin/reports/exports/schedules/${item.id}`}
                                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                                    role="menuitem"
                                    onClick={() => {
                                      setMenuOpenId(null);
                                    }}
                                  >
                                    Open
                                  </Link>
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                                    onClick={() => void handleRunNow(item.id)}
                                  >
                                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                                    Run now
                                  </button>
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                                    onClick={() => {
                                      setMenuOpenId(null);
                                      void handleToggle(item);
                                    }}
                                  >
                                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                                    {item.isActive ? "Pause" : "Enable"}
                                  </button>
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-[var(--admin-danger)] hover:bg-[var(--admin-surface-low)]"
                                    onClick={() => {
                                      setMenuOpenId(null);
                                      setDeleteTarget(item);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    Delete
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 md:hidden">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 ${
                      item.isFailing ? "border-l-2 border-l-[var(--admin-danger)]" : ""
                    } ${!item.isActive ? "opacity-70" : ""}`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/admin/reports/exports/schedules/${item.id}`}
                          className="font-semibold text-[var(--admin-primary)] hover:underline"
                        >
                          {item.name}
                        </Link>
                        <p className="text-xs text-[var(--admin-on-surface-variant)]">
                          {item.definitionTitle}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => {
                          toggleRow(item.id);
                        }}
                        aria-label={`Select ${item.name}`}
                      />
                    </div>
                    <p className="mb-2 font-mono text-[13px]">{item.cadenceLabel}</p>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {item.destinations.map((dest) => (
                        <span
                          key={`${item.id}-m-${dest.kind}`}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 text-xs"
                        >
                          <DestinationIcon kind={dest.kind} />
                          {dest.label}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {statusPill(item.lastRunStatus)}
                        <span className="text-xs text-[var(--admin-on-surface-variant)]">
                          {item.isActive ? formatRelative(item.nextRunAt) : "Paused"}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={secondaryButtonClassName}
                        onClick={() => void handleRunNow(item.id)}
                        disabled={busy}
                      >
                        Run now
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="flex items-center justify-between text-sm text-[var(--admin-on-surface-variant)]">
                  <span>
                    {formatCount(totalCount)} schedule{totalCount === 1 ? "" : "s"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      disabled={page <= 1 || busy}
                      onClick={() => {
                        setPage((p) => Math.max(1, p - 1));
                      }}
                    >
                      Previous
                    </button>
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      disabled={page >= totalPages || busy}
                      onClick={() => {
                        setPage((p) => p + 1);
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      {selectedIds.size > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-[var(--admin-outline)] bg-[var(--admin-on-surface)] px-5 py-3 text-[var(--admin-surface)] shadow-lg">
          <span className="text-sm font-semibold">
            {selectedIds.size} schedule{selectedIds.size === 1 ? "" : "s"} selected
          </span>
          <div className="h-6 w-px bg-[var(--admin-outline)]" />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm hover:bg-[color-mix(in_srgb,var(--admin-surface)_12%,transparent)]"
            onClick={() => void handleBulk("run_now")}
            disabled={busy}
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            Run now
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm hover:bg-[color-mix(in_srgb,var(--admin-surface)_12%,transparent)]"
            onClick={() => void handleBulk("pause")}
            disabled={busy}
          >
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
            Pause
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_20%,transparent)]"
            onClick={() => void handleBulk("delete")}
            disabled={busy}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </button>
          <button
            type="button"
            className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--admin-surface)_12%,transparent)]"
            aria-label="Clear selection"
            onClick={() => {
              setSelectedIds(new Set());
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {deleteTarget ? (
        <DeleteScheduleModal
          item={deleteTarget}
          busy={busy}
          onCancel={() => {
            setDeleteTarget(null);
          }}
          onConfirm={() => void handleDeleteConfirm()}
        />
      ) : null}

      <p className="text-xs text-[var(--admin-on-surface-variant)]">
        Audit record: All export actions are logged with PII masking.
      </p>
    </div>
  );
}
