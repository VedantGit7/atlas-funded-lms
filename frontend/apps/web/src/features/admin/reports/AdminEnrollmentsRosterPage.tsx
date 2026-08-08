"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Columns3,
  Download,
  Filter,
  Loader2,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";
import { Select, dropdownPanelEnterEndClassName } from "@atlas/design-system";
import {
  analyticsAlertErrorClassName,
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  dropdownItemClassName,
  inlineExpandClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { ClientApiError, createClientUuid } from "../../../lib/client-api";
import {
  createEnrollmentReportGroup,
  dateInputToEndIso,
  dateInputToStartIso,
  ENROLLMENT_ROSTER_COLUMN_OPTIONS,
  exportEnrollmentReport,
  fetchEnrollmentOverview,
  fetchEnrollmentRoster,
  sendEnrollmentReportMessage,
  type EnrollmentOverview,
  type EnrollmentRosterColumnKey,
  type EnrollmentRosterItem,
} from "./admin-enrollments-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

const ENROLLED_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
  { value: "complimentary", label: "Complimentary" },
  { value: "manual", label: "Manual" },
  { value: "offline", label: "Offline" },
  { value: "trial", label: "Trial" },
] as const;

const FILTER_FIELD_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "enrolledType", label: "Enrolled type" },
  { value: "status", label: "Status" },
] as const;

const selectTriggerClassName =
  "w-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const PAGE_SIZE = 20;

const TYPE_COLORS: Record<string, string> = {
  paid: "var(--admin-primary)",
  free: "var(--admin-success)",
  trial: "var(--admin-warning)",
  offline: "var(--admin-outline)",
};

type ExtraFilter = {
  id: string;
  field: "email" | "enrolledType" | "status";
  value: string;
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateInputLabel(from: string, to: string): string {
  if (!from && !to) return "Last 30 days";
  const fromLabel = from
    ? new Date(`${from}T00:00:00.000Z`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Start";
  const toLabel = to
    ? new Date(`${to}T00:00:00.000Z`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Today";
  return `${fromLabel} - ${toLabel}`;
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function learnerInitials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").split(/\s+/).filter(Boolean);
  if (source.length === 0) return "?";
  if (source.length === 1) return defined(source[0]).slice(0, 2).toUpperCase();
  return `${defined(source[0])[0] ?? ""}${defined(source[1])[0] ?? ""}`.toUpperCase();
}

function statusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "active") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (normalized === "expired" || normalized === "revoked" || normalized === "cancelled") {
    return "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  if (normalized.includes("expir")) {
    return "bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function EnrollmentTrendChart({
  points,
  label,
}: {
  points: EnrollmentOverview["trend"];
  label: string;
}) {
  const max = Math.max(1, ...points.map((point) => point.total));
  const width = 100;
  const height = 40;
  const coords = points.map((point, index) => {
    const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - (point.total / max) * (height - 4) - 2;
    return `${String(x)},${String(y)}`;
  });
  const linePath =
    coords.length === 0
      ? ""
      : `M${String(coords[0])}${coords
          .slice(1)
          .map((coord) => ` L${coord}`)
          .join("")}`;
  const areaPath =
    coords.length === 0
      ? ""
      : `${linePath} L${String(width)},${String(height)} L0,${String(height)} Z`;

  if (points.length === 0) {
    return (
      <div className="flex min-h-[140px] items-center justify-center rounded-lg bg-[var(--admin-surface-low)] text-sm text-[var(--admin-on-surface-variant)]">
        No enrollment activity in this window.
      </div>
    );
  }

  return (
    <div className="relative mt-auto flex min-h-[140px] items-end overflow-hidden rounded-lg">
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
      >
        <path d={areaPath} fill="color-mix(in srgb, var(--admin-primary) 14%, transparent)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--admin-primary)"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function TypeDonut({ items }: { items: EnrollmentOverview["byType"] }) {
  const radius = 15.915;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = items.filter((item) => item.count > 0);

  if (segments.length === 0) {
    return (
      <div className="flex h-36 w-36 items-center justify-center rounded-full border border-[var(--admin-border)] text-xs text-[var(--admin-on-surface-variant)]">
        No data
      </div>
    );
  }

  return (
    <div className="relative h-36 w-36">
      <svg
        className="h-full w-full -rotate-90"
        viewBox="0 0 36 36"
        role="img"
        aria-label="Enrollment type breakdown"
      >
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="transparent"
          stroke="var(--admin-surface-high)"
          strokeWidth="4"
        />
        {segments.map((item) => {
          const length = (item.percent / 100) * circumference;
          const dashArray = `${String(length)} ${String(circumference - length)}`;
          const dashOffset = -offset;
          offset += length;
          return (
            <circle
              key={item.type}
              cx="18"
              cy="18"
              r={radius}
              fill="transparent"
              stroke={TYPE_COLORS[item.type] ?? "var(--admin-outline)"}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeWidth="4"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--admin-on-surface)]">
        <span className="text-base font-black">100%</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
          Total
        </span>
      </div>
    </div>
  );
}

export function AdminEnrollmentsRosterPage() {
  const router = useRouter();
  const columnsMenuId = useId();
  const columnsRef = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<EnrollmentRosterItem[]>([]);
  const [overview, setOverview] = useState<EnrollmentOverview | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [enrolledFrom, setEnrolledFrom] = useState("");
  const [enrolledTo, setEnrolledTo] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<EnrollmentRosterColumnKey[]>(
    ENROLLMENT_ROSTER_COLUMN_OPTIONS.map((column) => column.key),
  );
  const [extraFilters, setExtraFilters] = useState<ExtraFilter[]>([]);
  const [sortBy, setSortBy] = useState<"enrolled_at" | "expires_at">("enrolled_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [messageOpen, setMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  const [groupOpen, setGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupDescription, setGroupDescription] = useState("");

  const activeEmail = useMemo(
    () => extraFilters.find((filter) => filter.field === "email")?.value.trim() || undefined,
    [extraFilters],
  );
  const activeEnrolledType = useMemo(
    () => extraFilters.find((filter) => filter.field === "enrolledType")?.value.trim() || undefined,
    [extraFilters],
  );
  const activeStatus = useMemo(
    () => extraFilters.find((filter) => filter.field === "status")?.value.trim() || undefined,
    [extraFilters],
  );

  const filterPayload = useMemo(
    () => ({
      enrolledFrom: dateInputToStartIso(enrolledFrom),
      enrolledTo: dateInputToEndIso(enrolledTo),
      ...(activeEmail ? { email: activeEmail } : {}),
      ...(activeEnrolledType ? { enrolledType: activeEnrolledType } : {}),
      ...(activeStatus ? { status: activeStatus } : {}),
    }),
    [activeEmail, activeEnrolledType, activeStatus, enrolledFrom, enrolledTo],
  );

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const response = await fetchEnrollmentOverview(filterPayload);
      setOverview(response.data);
    } catch (loadError) {
      setOverview(null);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load enrollment overview.",
      );
    } finally {
      setOverviewLoading(false);
    }
  }, [filterPayload]);

  const loadRoster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchEnrollmentRoster({
        ...filterPayload,
        sortBy,
        sortDir,
        columns: selectedColumns,
        page,
        limit: PAGE_SIZE,
      });
      setItems(response.data.items);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load enrollments.",
      );
      setItems([]);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [filterPayload, page, selectedColumns, sortBy, sortDir]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!columnsOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!columnsRef.current?.contains(event.target as Node)) {
        setColumnsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setColumnsOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [columnsOpen]);

  function toggleColumn(column: EnrollmentRosterColumnKey) {
    setSelectedColumns((current) => {
      if (current.includes(column)) {
        if (current.length === 1) return current;
        return current.filter((value) => value !== column);
      }
      return [...current, column];
    });
    setPage(1);
  }

  function addFilter() {
    setFiltersOpen(true);
    setExtraFilters((current) => [
      ...current,
      { id: createClientUuid(), field: "email", value: "" },
    ]);
  }

  function updateFilter(id: string, patch: Partial<ExtraFilter>) {
    setExtraFilters((current) =>
      current.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)),
    );
    setPage(1);
  }

  function removeFilter(id: string) {
    setExtraFilters((current) => current.filter((filter) => filter.id !== id));
    setPage(1);
  }

  function toggleSort(column: "enrolled_at" | "expires_at") {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(column === "enrolled_at" ? "desc" : "asc");
    }
    setPage(1);
  }

  async function handleExport() {
    setBusy(true);
    setExportProgress(8);
    setError(null);
    try {
      const response = await exportEnrollmentReport({
        ...filterPayload,
        sortBy,
        sortDir,
        emailDownloadLink: true,
      });
      setExportProgress(35);
      const completed = await pollReportRunUntilComplete(response.data.runId, {
        onPoll: (attempt) => {
          setExportProgress(Math.min(90, 35 + attempt * 8));
        },
      });
      if (completed.status === "failed") {
        throw new Error(completed.errorMessage ?? "Enrollment export failed.");
      }
      setExportProgress(96);
      await downloadReportExport(completed.id, "csv");
      setExportProgress(100);
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export enrollments.",
      );
    } finally {
      setBusy(false);
      window.setTimeout(() => {
        setExportProgress(null);
      }, 900);
    }
  }

  async function handleCreateGroup() {
    if (!groupTitle.trim()) {
      setError("Group title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createEnrollmentReportGroup({
        title: groupTitle.trim(),
        ...(groupDescription.trim() ? { description: groupDescription.trim() } : {}),
        ...filterPayload,
      });
      setGroupOpen(false);
      setGroupTitle("");
      setGroupDescription("");
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

  async function handleSendMessage() {
    if (!messageSubject.trim() || !messageBody.trim()) {
      setError("Subject and message are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendEnrollmentReportMessage({
        subject: messageSubject.trim(),
        message: messageBody.trim(),
        ...filterPayload,
      });
      setMessageOpen(false);
      setMessageSubject("");
      setMessageBody("");
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

  const visibleColumns = ENROLLMENT_ROSTER_COLUMN_OPTIONS.filter((column) =>
    selectedColumns.includes(column.key),
  );

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);
  const changePercent = overview?.summary.changePercent ?? null;
  const changePositive = changePercent !== null && changePercent >= 0;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            Reports
          </p>
          <h1 className="mt-1 text-[30px] font-bold tracking-tight text-[var(--admin-on-surface)]">
            Enrollment Manager
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            Analytical overview and operational roster for learner enrollments across products.
          </p>
        </div>
      </header>

      {error ? <div className={analyticsAlertErrorClassName}>{error}</div> : null}

      <section className="flex flex-col gap-6 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--admin-border)] pb-3">
          <h2 className="text-base font-bold text-[var(--admin-on-surface)]">Enrollment KPIs</h2>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
            <span className="rounded-md bg-[var(--admin-surface-low)] px-2 py-1">
              Active {overviewLoading ? "-" : (overview?.summary.activeCount ?? 0).toLocaleString()}
            </span>
            <span className="rounded-md bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] px-2 py-1 text-[var(--admin-warning)]">
              Expiring 7d{" "}
              {overviewLoading ? "-" : (overview?.summary.expiringSoonCount ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="col-span-1 flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm motion-safe:transition-shadow hover:shadow-md lg:col-span-2">
            <div className="mb-4 flex items-start justify-between gap-3">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Total enrollments ({overview?.summary.windowLabel ?? "30 Days"})
              </span>
              {changePercent !== null ? (
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[13px] font-bold ${
                    changePositive
                      ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
                      : "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]"
                  }`}
                >
                  {changePositive ? (
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {changePositive ? "+" : ""}
                  {changePercent}%
                </span>
              ) : null}
            </div>
            {overviewLoading ? (
              <div className="h-10 w-40 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
            ) : (
              <div className="mb-6 text-[40px] font-black leading-none text-[var(--admin-on-surface)]">
                {(overview?.summary.totalCount ?? 0).toLocaleString()}
              </div>
            )}
            {overviewLoading ? (
              <div className="min-h-[140px] animate-pulse rounded-lg bg-[var(--admin-surface-low)]" />
            ) : (
              <EnrollmentTrendChart
                points={overview?.trend ?? []}
                label={`Daily enrollments over ${overview?.summary.windowLabel ?? "selected window"}`}
              />
            )}
          </div>

          <div className="flex flex-col items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm motion-safe:transition-shadow hover:shadow-md">
            <span className="mb-4 self-start text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Type breakdown
            </span>
            {overviewLoading ? (
              <div className="mb-6 h-36 w-36 animate-pulse rounded-full bg-[var(--admin-surface-high)]" />
            ) : (
              <div className="mb-6">
                <TypeDonut items={overview?.byType ?? []} />
              </div>
            )}
            <div className="grid w-full grid-cols-2 gap-3 text-[13px] font-semibold text-[var(--admin-on-surface)]">
              {(
                overview?.byType ?? [
                  { type: "paid", label: "Paid", percent: 0, count: 0 },
                  { type: "free", label: "Free", percent: 0, count: 0 },
                  { type: "trial", label: "Trial", percent: 0, count: 0 },
                  { type: "offline", label: "Offline", percent: 0, count: 0 },
                ]
              ).map((item) => (
                <div key={item.type} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ background: TYPE_COLORS[item.type] ?? "var(--admin-outline)" }}
                    aria-hidden="true"
                  />
                  <span>
                    {item.label} ({item.percent}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-1.5">
              <CalendarDays
                className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <span className="text-[13px] font-semibold text-[var(--admin-on-surface)]">
                {formatDateInputLabel(enrolledFrom, enrolledTo)}
              </span>
              <label className="sr-only" htmlFor="enroll-from">
                Enrolled from
              </label>
              <input
                id="enroll-from"
                type="date"
                className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 text-xs text-[var(--admin-on-surface)]"
                value={enrolledFrom}
                onChange={(event) => {
                  setEnrolledFrom(event.target.value);
                  setPage(1);
                }}
              />
              <label className="sr-only" htmlFor="enroll-to">
                Enrolled to
              </label>
              <input
                id="enroll-to"
                type="date"
                className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 text-xs text-[var(--admin-on-surface)]"
                value={enrolledTo}
                onChange={(event) => {
                  setEnrolledTo(event.target.value);
                  setPage(1);
                }}
              />
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] px-3 py-1.5 text-[13px] font-bold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-surface))] motion-safe:active:scale-[0.98]"
              onClick={addFilter}
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              Add filter
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative" ref={columnsRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={columnsOpen}
                aria-controls={columnsMenuId}
                className="inline-flex items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] px-3 py-1.5 text-[13px] font-bold text-[var(--admin-success)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-success)_18%,var(--admin-surface))] motion-safe:active:scale-[0.98]"
                onClick={() => {
                  setColumnsOpen((open) => !open);
                }}
              >
                <Columns3 className="h-4 w-4" aria-hidden="true" />
                Columns
                <ChevronDown
                  className={[
                    "h-4 w-4 shrink-0 transition-transform duration-200",
                    columnsOpen ? "rotate-180" : "rotate-0",
                  ].join(" ")}
                  aria-hidden="true"
                />
              </button>
              {columnsOpen ? (
                <div
                  id={columnsMenuId}
                  role="menu"
                  aria-label="Visible columns"
                  className={[
                    "absolute right-0 top-[calc(100%+6px)] z-20 w-56 overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1.5 shadow-lg",
                    dropdownPanelEnterEndClassName,
                  ].join(" ")}
                >
                  {ENROLLMENT_ROSTER_COLUMN_OPTIONS.map((column) => {
                    const checked = selectedColumns.includes(column.key);
                    return (
                      <button
                        key={column.key}
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={checked}
                        className={[
                          dropdownItemClassName,
                          checked ? "bg-[var(--admin-surface-high)] font-semibold" : "",
                        ].join(" ")}
                        onClick={() => {
                          toggleColumn(column.key);
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate text-left">{column.label}</span>
                        {checked ? (
                          <Check
                            className="h-4 w-4 shrink-0 text-[var(--admin-primary)]"
                            aria-hidden="true"
                          />
                        ) : (
                          <span className="h-4 w-4 shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-1.5 text-[13px] font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] disabled:opacity-50"
              disabled={busy || totalCount === 0}
              onClick={() => {
                setMessageOpen(true);
              }}
            >
              Send message
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-1.5 text-[13px] font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] disabled:opacity-50"
              disabled={busy || totalCount === 0}
              onClick={() => {
                setGroupOpen(true);
              }}
            >
              Create group
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-[var(--admin-primary)] px-4 py-1.5 text-[13px] font-bold text-[var(--admin-on-primary)] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 motion-safe:active:scale-[0.98]"
              disabled={busy || loading}
              onClick={() => {
                void handleExport();
              }}
            >
              Export
              <Download className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {(filtersOpen || extraFilters.length > 0) && (
          <div
            className={[
              "space-y-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-4",
              inlineExpandClassName,
            ].join(" ")}
          >
            {extraFilters.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Add email, enrolled type, or status filters to refine the roster and KPIs.
              </p>
            ) : null}
            {extraFilters.map((filter) => (
              <div key={filter.id} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
                <Select
                  value={filter.field}
                  onValueChange={(value) => {
                    updateFilter(filter.id, {
                      field: value as ExtraFilter["field"],
                      value: "",
                    });
                  }}
                  options={[...FILTER_FIELD_OPTIONS]}
                  ariaLabel="Filter field"
                  className={selectTriggerClassName}
                />
                {filter.field === "enrolledType" ? (
                  <Select
                    value={filter.value}
                    onValueChange={(value) => {
                      updateFilter(filter.id, { value });
                    }}
                    options={[...ENROLLED_TYPE_OPTIONS]}
                    ariaLabel="Enrolled type"
                    className={selectTriggerClassName}
                  />
                ) : (
                  <input
                    className={fieldClassName}
                    placeholder={filter.field === "email" ? "learner@example.com" : "active"}
                    value={filter.value}
                    onChange={(event) => {
                      updateFilter(filter.id, { value: event.target.value });
                    }}
                  />
                )}
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => {
                    removeFilter(filter.id);
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Remove
                </button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={primaryButtonClassName}
                onClick={() => {
                  setPage(1);
                  void loadRoster();
                  void loadOverview();
                }}
              >
                Apply filters
              </button>
              {extraFilters.length > 0 ? (
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => {
                    setExtraFilters([]);
                    setFiltersOpen(false);
                    setPage(1);
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
                {visibleColumns.map((column) => {
                  const sortable = column.key === "enrolled_at" || column.key === "expires_at";
                  return (
                    <th
                      key={column.key}
                      className="px-4 py-3 text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]"
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 transition-colors hover:text-[var(--admin-primary)]"
                          onClick={() => {
                            toggleSort(column.key);
                          }}
                        >
                          {column.label}
                          <span aria-hidden="true">
                            {sortBy === column.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                          </span>
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[color-mix(in_srgb,var(--admin-border)_70%,transparent)] text-[13px]">
              {loading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`skeleton-${String(index)}`}>
                      <td colSpan={visibleColumns.length} className="px-4 py-3">
                        <div className="h-8 animate-pulse rounded-md bg-[var(--admin-surface-high)]" />
                      </td>
                    </tr>
                  ))
                : null}

              {!loading && items.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length}
                    className="px-4 py-16 text-center text-[var(--admin-on-surface-variant)]"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <UsersRound
                        className="h-8 w-8 text-[var(--admin-outline)]"
                        aria-hidden="true"
                      />
                      <p className="font-semibold text-[var(--admin-on-surface)]">
                        No enrollments match the current filters
                      </p>
                      <p className="text-sm">
                        Widen the date range or clear filters to see more learners.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading
                ? items.map((item) => (
                    <tr
                      key={item.id}
                      className="group cursor-pointer transition-colors hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        router.push(`/admin/members/${item.membershipId}`);
                      }}
                    >
                      {visibleColumns.map((column) => {
                        if (column.key === "learner_name") {
                          return (
                            <td key={`${item.id}-${column.key}`} className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-surface))] text-[10px] font-bold text-[var(--admin-primary)]">
                                  {learnerInitials(item.learnerName, item.email)}
                                </span>
                                <Link
                                  href={`/admin/members/${item.membershipId}`}
                                  className="font-semibold text-[var(--admin-primary)] group-hover:underline"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                  }}
                                >
                                  {item.learnerName ?? "-"}
                                </Link>
                              </div>
                            </td>
                          );
                        }
                        if (column.key === "email") {
                          return (
                            <td
                              key={`${item.id}-${column.key}`}
                              className="px-4 py-3 font-mono text-[13px] text-[var(--admin-on-surface-variant)]"
                            >
                              {item.email ?? "-"}
                            </td>
                          );
                        }
                        if (column.key === "product_title") {
                          return (
                            <td
                              key={`${item.id}-${column.key}`}
                              className="px-4 py-3 font-medium text-[var(--admin-on-surface)]"
                            >
                              {item.productTitle}
                            </td>
                          );
                        }
                        if (column.key === "enrolled_type") {
                          return (
                            <td key={`${item.id}-${column.key}`} className="px-4 py-3">
                              <span className="rounded-sm bg-[var(--admin-surface-high)] px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface)]">
                                {titleCase(item.enrolledType)}
                              </span>
                            </td>
                          );
                        }
                        if (column.key === "status") {
                          return (
                            <td key={`${item.id}-${column.key}`} className="px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusTone(item.status)}`}
                              >
                                {titleCase(item.status)}
                              </span>
                            </td>
                          );
                        }
                        if (column.key === "enrolled_at") {
                          return (
                            <td
                              key={`${item.id}-${column.key}`}
                              className="px-4 py-3 font-mono text-[13px] text-[var(--admin-on-surface-variant)]"
                            >
                              {formatDate(item.enrolledAt)}
                            </td>
                          );
                        }
                        return (
                          <td
                            key={`${item.id}-${column.key}`}
                            className="px-4 py-3 font-mono text-[13px] text-[var(--admin-on-surface-variant)]"
                          >
                            {formatDate(item.expiresAt)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <span className="text-[13px] font-semibold text-[var(--admin-on-surface-variant)]">
            {loading
              ? "Loading enrollments..."
              : `Showing ${String(rangeStart)} to ${String(rangeEnd)} of ${totalCount.toLocaleString()} entries`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1 text-[13px] font-bold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)] disabled:opacity-50"
              disabled={busy || page <= 1}
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
              }}
            >
              Previous
            </button>
            <span className="rounded bg-[var(--admin-surface-low)] px-2 py-1 text-[13px] font-bold text-[var(--admin-on-surface)]">
              Page {page}
              {totalPages > 0 ? ` of ${String(totalPages)}` : ""}
            </span>
            <button
              type="button"
              className="px-3 py-1 text-[13px] font-bold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)] disabled:opacity-50"
              disabled={busy || page >= totalPages || totalPages === 0}
              onClick={() => {
                setPage((current) => current + 1);
              }}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {exportProgress !== null ? (
        <div
          className="fixed bottom-6 right-6 z-50 flex max-w-[260px] items-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-lg"
          role="status"
          aria-live="polite"
        >
          {exportProgress < 100 ? (
            <Loader2
              className="h-4 w-4 animate-spin text-[var(--admin-primary)]"
              aria-hidden="true"
            />
          ) : (
            <Download className="h-4 w-4 text-[var(--admin-success)]" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold leading-tight text-[var(--admin-on-surface)]">
              {exportProgress < 100 ? "Preparing export..." : "Export ready"}
            </p>
            <p className="font-mono text-[10px] font-medium text-[var(--admin-primary)]">
              {exportProgress}% complete
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
              <div
                className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-300"
                style={{ width: `${String(exportProgress)}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {messageOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--admin-scrim)] p-4">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                  Send message
                </h2>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  Sends email to learners in the current filtered enrollment set ({totalCount}).
                </p>
              </div>
              <MessageSquare className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--admin-on-surface)]">Subject</span>
              <input
                className={fieldClassName}
                value={messageSubject}
                onChange={(event) => {
                  setMessageSubject(event.target.value);
                }}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--admin-on-surface)]">Message</span>
              <textarea
                className={`${fieldClassName} min-h-32`}
                value={messageBody}
                onChange={(event) => {
                  setMessageBody(event.target.value);
                }}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={busy}
                onClick={() => {
                  setMessageOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={busy}
                onClick={() => {
                  void handleSendMessage();
                }}
              >
                Send message
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {groupOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--admin-scrim)] p-4">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Create group</h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Saves the current filtered learners as a batch group for messaging and marketing.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--admin-on-surface)]">
                Group title
              </span>
              <input
                className={fieldClassName}
                value={groupTitle}
                onChange={(event) => {
                  setGroupTitle(event.target.value);
                }}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--admin-on-surface)]">
                Description
              </span>
              <textarea
                className={`${fieldClassName} min-h-24`}
                value={groupDescription}
                onChange={(event) => {
                  setGroupDescription(event.target.value);
                }}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={busy}
                onClick={() => {
                  setGroupOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={busy}
                onClick={() => {
                  void handleCreateGroup();
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
