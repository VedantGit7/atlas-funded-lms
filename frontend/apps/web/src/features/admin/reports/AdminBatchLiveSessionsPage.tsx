"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Download,
  ExternalLink,
  Mail,
  MoreVertical,
  RefreshCw,
  Search,
  Video,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  exportBatchReport,
  fetchBatchLiveSessionAbsentees,
  fetchBatchLiveSessions,
  fetchBatchLiveSessionsMatrix,
  sendBatchMessage,
  type BatchLiveSessionItem,
  type BatchLiveSessionsListData,
  type BatchLiveSessionsMatrixCellKind,
  type BatchLiveSessionsMatrixData,
} from "./admin-batches-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

type ViewMode = "sessions" | "matrix";
type SortBy = "scheduled_at" | "title" | "attendance_rate";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;
const thClass =
  "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]";
const fieldClassName =
  "h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";
const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const SUB_TABS = [
  { key: "overview", label: "Overview", path: "" },
  { key: "learners", label: "Learners", path: "?tab=learners" },
  { key: "live_sessions", label: "Live sessions", path: "/live-sessions" },
  { key: "exams", label: "Exams", path: "/exams" },
  { key: "content", label: "Content", path: "/content" },
  { key: "messages", label: "Messages", path: "/messages" },
] as const;

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

function formatPct(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "-";
  return `${v.toFixed(v % 1 === 0 ? 0 : 1)}%`;
}

function formatDateTime(v: string | null | undefined) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutesPair(actual: number | null | undefined, planned: number | null | undefined) {
  if (actual == null && planned == null) return "-";
  if (actual != null && planned != null)
    return `${String(Math.round(actual))}m of ${String(Math.round(planned))}m`;
  if (actual != null) return `${String(Math.round(actual))}m`;
  return `of ${String(Math.round(defined(planned)))}m`;
}

function titleCase(v: string) {
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusKind(status: string) {
  const s = status.toLowerCase();
  if (s === "cancelled" || s === "canceled") return "cancelled" as const;
  if (s === "live" || s === "in_progress") return "live" as const;
  if (s === "ended" || s === "completed") return "completed" as const;
  if (s === "scheduled" || s === "upcoming") return "upcoming" as const;
  return "other" as const;
}

function isUpcoming(item: BatchLiveSessionItem) {
  const k = statusKind(item.status);
  if (k === "upcoming") return true;
  if (k === "cancelled" || k === "completed" || k === "live") return false;
  if (!item.scheduledAt || item.endedAt) return false;
  return new Date(item.scheduledAt).getTime() >= Date.now();
}

function statusPillClass(status: string) {
  const k = statusKind(status);
  if (k === "completed")
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]";
  if (k === "cancelled")
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";
  if (k === "live")
    return "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]";
  return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function statusLabel(status: string) {
  const k = statusKind(status);
  if (k === "completed") return "Completed";
  if (k === "cancelled") return "Cancelled";
  if (k === "live") return "Live";
  if (k === "upcoming") return "Upcoming";
  return titleCase(status);
}

function rateTone(rate: number | null | undefined) {
  if (rate == null) return "text-[var(--admin-on-surface-variant)]";
  if (rate < 40) return "text-[var(--admin-danger)]";
  if (rate < 50) return "text-[var(--admin-warning)]";
  return "text-[var(--admin-on-surface)]";
}

function barTone(v: number | null | undefined, pass = 50) {
  if (v == null) return "bg-[var(--admin-outline)]";
  if (v >= pass) return "bg-[var(--admin-success)]";
  if (v >= 40) return "bg-[var(--admin-warning)]";
  return "bg-[var(--admin-danger)]";
}

function railClass(item: BatchLiveSessionItem) {
  if (statusKind(item.status) === "cancelled") return "bg-[var(--admin-danger)]";
  if (item.attendanceRatePct == null) return "bg-transparent";
  if (item.attendanceRatePct < 40) return "bg-[var(--admin-danger)]";
  if (item.attendanceRatePct < 50) return "bg-[var(--admin-warning)]";
  return "bg-transparent";
}

function matrixCellClass(kind: BatchLiveSessionsMatrixCellKind) {
  if (kind === "attended") return "bg-[var(--admin-success)]";
  if (kind === "partial") return "bg-[var(--admin-warning)]";
  if (kind === "absent") return "bg-[var(--admin-danger)]";
  return "border border-[var(--admin-outline)] bg-transparent";
}

function matrixLabel(kind: BatchLiveSessionsMatrixCellKind) {
  const map: Record<BatchLiveSessionsMatrixCellKind, string> = {
    attended: "Attended",
    partial: "Partial",
    absent: "Absent",
    upcoming: "Upcoming",
    cancelled: "Cancelled",
    none: "None",
  };
  return map[kind];
}

function errMsg(e: unknown, fallback: string) {
  if (e instanceof ClientApiError || e instanceof Error) return e.message;
  return fallback;
}

function MiniBar({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  return (
    <div className="mt-1 h-[3px] w-full max-w-[72px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
      <div
        className={`h-full rounded-full ${barTone(value)}`}
        style={{ width: `${String(Math.max(0, Math.min(100, value)))}%` }}
      />
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center">
      <CloudOff
        className="mx-auto mb-4 h-10 w-10 text-[var(--admin-outline)]"
        aria-hidden="true"
        strokeWidth={1.5}
      />
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        {description}
      </p>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Shimmer className="h-3 w-72 max-w-full" />
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-40" />
          <Shimmer className="h-9 w-36" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="h-8 w-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-sm border border-[var(--admin-border)] md:grid-cols-6 md:gap-px md:bg-[var(--admin-border)]">
        <div className="space-y-3 bg-[var(--admin-surface)] p-5 md:col-span-2">
          <Shimmer className="h-3 w-32" />
          <Shimmer className="h-8 w-20" />
          <Shimmer className="h-[3px] w-full" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 bg-[var(--admin-surface)] p-5">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-b border-[var(--admin-border)] px-4 py-3 last:border-0">
            <Shimmer className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminBatchLiveSessionsPage({ batchId }: { batchId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchId = useId();
  const messageTitleId = useId();

  const view: ViewMode = searchParams.get("view") === "matrix" ? "matrix" : "sessions";
  const q = searchParams.get("q") ?? "";
  const pageRaw = Number(searchParams.get("page"));
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const sortByRaw = searchParams.get("sortBy");
  const sortBy: SortBy =
    sortByRaw === "title" || sortByRaw === "attendance_rate" ? sortByRaw : "scheduled_at";
  const sortDir: SortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

  const [draftQ, setDraftQ] = useState(q);
  const [listData, setListData] = useState<BatchLiveSessionsListData | null>(null);
  const [matrixData, setMatrixData] = useState<BatchLiveSessionsMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageIds, setMessageIds] = useState<string[]>([]);
  const [messageBusy, setMessageBusy] = useState(false);

  const replaceParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      router.replace(
        query
          ? `/admin/reports/batches/${batchId}/live-sessions?${query}`
          : `/admin/reports/batches/${batchId}/live-sessions`,
      );
    },
    [batchId, router, searchParams],
  );

  useEffect(() => {
    setDraftQ(q);
  }, [q]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = draftQ.trim();
      if (next === q) return;
      replaceParams({ q: next || null, page: "1" });
    }, 300);
    return () => {
      window.clearTimeout(t);
    };
  }, [draftQ, q, replaceParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (view === "matrix") {
        const [matrixRes, listRes] = await Promise.all([
          fetchBatchLiveSessionsMatrix(batchId, { q: q.trim() || undefined }),
          fetchBatchLiveSessions(batchId, { page: 1, limit: 1 }),
        ]);
        setMatrixData(matrixRes.data);
        setListData(listRes.data);
      } else {
        const response = await fetchBatchLiveSessions(batchId, {
          q: q.trim() || undefined,
          sortBy,
          sortDir,
          page,
          limit: PAGE_SIZE,
        });
        setListData(response.data);
      }
    } catch (e) {
      setError(errMsg(e, "Couldn't load live sessions."));
      if (view === "matrix") setMatrixData(null);
      else setListData(null);
    } finally {
      setLoading(false);
    }
  }, [batchId, page, q, sortBy, sortDir, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const batchName = listData?.batchName ?? matrixData?.batchName ?? "Batch";
  const summary = listData?.summary;
  const grouped = useMemo(() => {
    const past: BatchLiveSessionItem[] = [];
    const upcoming: BatchLiveSessionItem[] = [];
    for (const item of listData?.items ?? []) {
      (isUpcoming(item) ? upcoming : past).push(item);
    }
    return { past, upcoming };
  }, [listData?.items]);

  function toggleSort(next: SortBy) {
    if (sortBy === next) {
      replaceParams({ sortDir: sortDir === "asc" ? "desc" : "asc", page: "1" });
      return;
    }
    replaceParams({
      sortBy: next === "scheduled_at" ? null : next,
      sortDir: "desc",
      page: "1",
    });
  }

  async function handleExport() {
    setBusy(true);
    setActionError(null);
    try {
      const response = await exportBatchReport({ batchId, emailDownloadLink: true });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed")
        throw new Error(completed.errorMessage ?? "Export failed.");
      if (completed.status === "completed") await downloadReportExport(completed.id, "csv");
    } catch (e) {
      setActionError(errMsg(e, "Unable to export report."));
    } finally {
      setBusy(false);
    }
  }

  async function openMessageAbsentees() {
    setBusy(true);
    setActionError(null);
    try {
      const response = await fetchBatchLiveSessionAbsentees(batchId, 1);
      const ids = response.data.membershipIds;
      if (ids.length === 0) {
        setActionError("No absentees to message for this batch.");
        return;
      }
      setMessageIds(ids);
      setMessageSubject("You missed a live session");
      setMessageBody(
        "We noticed you missed one or more live sessions for this batch. Please catch up using the recording when available, and reach out if you need help.",
      );
      setMessageOpen(true);
    } catch (e) {
      setActionError(errMsg(e, "Couldn't load absentees."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage() {
    if (!messageSubject.trim() || !messageBody.trim() || messageIds.length === 0) return;
    setMessageBusy(true);
    setActionError(null);
    try {
      await sendBatchMessage({
        batchId,
        membershipIds: messageIds,
        subject: messageSubject.trim(),
        message: messageBody.trim(),
      });
      setMessageOpen(false);
      setMessageSubject("");
      setMessageBody("");
      setMessageIds([]);
    } catch (e) {
      setActionError(errMsg(e, "Couldn't send message."));
    } finally {
      setMessageBusy(false);
    }
  }

  const totalCount = listData?.pageInfo.totalCount ?? 0;
  const totalPages = listData?.pageInfo.totalPages ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  function SortBtn({ col, label }: { col: SortBy; label: string }) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
        onClick={() => {
          toggleSort(col);
        }}
      >
        {label}
        {sortBy === col ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden="true" />
          )
        ) : null}
      </button>
    );
  }

  function renderRows(items: BatchLiveSessionItem[], dimmed = false) {
    return items.map((item) => {
      const watchPct =
        item.avgWatchMinutes != null && item.plannedDurationMinutes
          ? Math.min(100, (item.avgWatchMinutes / item.plannedDurationMinutes) * 100)
          : null;
      const attendedPct =
        item.rosterCount > 0 ? (item.attendedCount / item.rosterCount) * 100 : null;
      return (
        <tr
          key={item.id}
          className={[
            "group relative border-b border-[var(--admin-border)] last:border-b-0 hover:bg-[var(--admin-surface-low)]",
            dimmed ? "opacity-60" : "",
          ].join(" ")}
        >
          <td className="sticky left-0 z-10 border-r border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 group-hover:bg-[var(--admin-surface-low)]">
            <span
              className={`absolute inset-y-0 left-0 w-1 ${railClass(item)}`}
              aria-hidden="true"
            />
            <p
              className={[
                "pl-2 text-sm font-medium",
                statusKind(item.status) === "cancelled"
                  ? "text-[var(--admin-on-surface-variant)] line-through"
                  : "text-[var(--admin-on-surface)]",
              ].join(" ")}
            >
              <Link
                href={`/admin/reports/batches/${batchId}/live-sessions/${item.id}`}
                className="hover:text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              >
                {item.title}
              </Link>
            </p>
            {item.kind ? (
              <p className="mt-0.5 pl-2 text-[11px] text-[var(--admin-on-surface-variant)]">
                {titleCase(item.kind)}
              </p>
            ) : null}
          </td>
          <td className="whitespace-nowrap px-4 py-3">
            <p
              className={[
                "font-mono text-xs",
                statusKind(item.status) === "cancelled"
                  ? "text-[var(--admin-on-surface-variant)] line-through"
                  : "text-[var(--admin-on-surface)]",
              ].join(" ")}
            >
              {formatDateTime(item.scheduledAt)}
            </p>
            {statusKind(item.status) === "cancelled" ? (
              <p className="mt-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">Cancelled</p>
            ) : item.actualDurationMinutes != null ? (
              <p className="mt-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                {item.actualDurationMinutes}m actual
              </p>
            ) : item.plannedDurationMinutes != null ? (
              <p className="mt-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                {item.plannedDurationMinutes}m scheduled
              </p>
            ) : null}
          </td>
          <td className="px-4 py-3">
            <span
              className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] ${statusPillClass(item.status)}`}
            >
              {statusLabel(item.status)}
            </span>
          </td>
          <td className="px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
            {item.hostLabel ?? "-"}
          </td>
          <td className="px-4 py-3">
            {item.attendanceRatePct == null &&
            (isUpcoming(item) || statusKind(item.status) === "cancelled") ? (
              <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">-</span>
            ) : (
              <>
                <p className="font-mono text-xs text-[var(--admin-on-surface)]">
                  {item.attendedCount}
                  <span className="text-[var(--admin-on-surface-variant)]">
                    {" "}
                    / {item.rosterCount}
                  </span>
                </p>
                <MiniBar value={attendedPct} />
              </>
            )}
          </td>
          <td className="px-4 py-3">
            <p className={`font-mono text-xs font-medium ${rateTone(item.attendanceRatePct)}`}>
              {formatPct(item.attendanceRatePct)}
            </p>
          </td>
          <td className="px-4 py-3">
            {item.avgWatchMinutes == null &&
            (isUpcoming(item) || statusKind(item.status) === "cancelled") ? (
              <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">-</span>
            ) : (
              <>
                <p className="font-mono text-xs text-[var(--admin-on-surface)]">
                  {formatMinutesPair(item.avgWatchMinutes, item.plannedDurationMinutes)}
                </p>
                <MiniBar value={watchPct} />
              </>
            )}
          </td>
          <td className="px-4 py-3 font-mono text-xs text-[var(--admin-on-surface)]">
            {isUpcoming(item) || statusKind(item.status) === "cancelled" ? (
              <span className="text-[var(--admin-on-surface-variant)]">-</span>
            ) : (
              item.lateCount
            )}
          </td>
          <td className="px-4 py-3">
            {item.hasRecording && item.recordingUrl ? (
              <a
                href={item.recordingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              >
                <Video className="h-3.5 w-3.5" aria-hidden="true" />
                Recording
              </a>
            ) : (
              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                {item.hasRecording ? "Recording" : "Not recorded"}
              </span>
            )}
          </td>
          <td className="relative px-3 py-3">
            <button
              type="button"
              className="rounded p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              aria-label={`Actions for ${item.title}`}
              aria-expanded={rowMenuId === item.id}
              onClick={() => {
                setRowMenuId((c) => (c === item.id ? null : item.id));
              }}
            >
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </button>
            {rowMenuId === item.id ? (
              <div className="absolute right-3 top-9 z-30 min-w-[200px] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                <Link
                  href={`/admin/reports/batches/${batchId}/live-sessions/${item.id}`}
                  className="block px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                  onClick={() => {
                    setRowMenuId(null);
                  }}
                >
                  Open attendance detail
                </Link>
                <Link
                  href="/admin/reports/live-class-attendance"
                  className="block px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                  onClick={() => {
                    setRowMenuId(null);
                  }}
                >
                  Tenant attendance report
                </Link>
              </div>
            ) : null}
          </td>
        </tr>
      );
    });
  }

  if (loading && !listData && !matrixData) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <PageSkeleton />
      </div>
    );
  }

  if (error && !listData && !matrixData) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <div
          className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-[var(--admin-danger)]">
                Couldn&apos;t load live sessions.
              </p>
              <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface))]">
                {error}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-[var(--admin-on-danger)] hover:opacity-90"
            onClick={() => void load()}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
        <div className="opacity-40">
          <PageSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      <nav
        className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link href="/admin" className="hover:text-[var(--admin-primary)]">
          Admin
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
          Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports/batches" className="hover:text-[var(--admin-primary)]">
          Batches
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href={`/admin/reports/batches/${batchId}`}
          className="hover:text-[var(--admin-primary)]"
        >
          {batchName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">Live sessions</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Live sessions
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Attendance for every session held for this batch.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
          <Link
            href={`/admin/reports/live-class-attendance?batchId=${encodeURIComponent(batchId)}`}
            className={secondaryButtonClassName}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open attendance report
          </Link>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy}
            onClick={() => void openMessageAbsentees()}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Message absentees
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--admin-border)]">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Batch report tabs">
          {SUB_TABS.map((tab) => {
            const active = tab.key === "live_sessions";
            const href = `/admin/reports/batches/${batchId}${tab.path}`;
            return (
              <Link
                key={tab.key}
                href={href}
                role="tab"
                aria-selected={active}
                className={[
                  "inline-flex h-10 shrink-0 items-center px-4 text-xs font-semibold uppercase tracking-[0.06em] transition-colors",
                  active
                    ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                    : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {actionError ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-danger)]">{actionError}</p>
          </div>
          <button
            type="button"
            className={ghostButtonClassName}
            onClick={() => {
              setActionError(null);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {summary ? (
        <div className="grid grid-cols-1 overflow-hidden rounded-sm border border-[var(--admin-border)] md:grid-cols-6 md:gap-px md:bg-[var(--admin-border)]">
          <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 md:col-span-2">
            <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
              Average attendance
            </p>
            <p className="font-mono text-[32px] font-medium leading-none text-[var(--admin-on-surface)]">
              {formatPct(summary.avgAttendancePct)}
            </p>
            <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
              <div
                className={`h-full rounded-full ${barTone(summary.avgAttendancePct)}`}
                style={{
                  width: `${String(Math.max(0, Math.min(100, summary.avgAttendancePct ?? 0)))}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
              across {summary.sessionsHeldCount} session
              {summary.sessionsHeldCount === 1 ? "" : "s"} held
            </p>
          </div>
          <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
            <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
              Sessions held
            </p>
            <p className="font-mono text-2xl font-medium leading-none text-[var(--admin-on-surface)]">
              {summary.sessionsHeldCount} of {summary.sessionsTotalCount}
            </p>
          </div>
          <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
            <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-success)]">
              Perfect attendance
            </p>
            <p className="inline-flex items-center gap-2 font-mono text-2xl font-medium leading-none text-[var(--admin-on-surface)]">
              <span className="h-2 w-2 rounded-full bg-[var(--admin-success)]" aria-hidden="true" />
              {summary.perfectAttendanceCount}
            </p>
            <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">learners</p>
          </div>
          <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
            <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-warning)]">
              Missed 3 or more
            </p>
            <p className="inline-flex items-center gap-2 font-mono text-2xl font-medium leading-none text-[var(--admin-warning)]">
              <span className="h-2 w-2 rounded-full bg-[var(--admin-warning)]" aria-hidden="true" />
              {summary.missedThreeOrMoreCount}
            </p>
          </div>
          <div className="hidden flex-col justify-between bg-[var(--admin-surface)] p-5 md:flex">
            <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
              Avg watch time
            </p>
            <p className="font-mono text-2xl font-medium leading-none text-[var(--admin-on-surface)]">
              {formatMinutesPair(summary.avgWatchMinutes, summary.plannedWatchMinutes)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-0.5"
          role="tablist"
          aria-label="Live sessions view"
        >
          {(
            [
              ["sessions", "Sessions"],
              ["matrix", "Attendance matrix"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              className={[
                "h-8 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30",
                view === key
                  ? "bg-[var(--admin-surface)] text-[var(--admin-on-surface)] shadow-sm"
                  : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
              ].join(" ")}
              onClick={() => {
                replaceParams({
                  view: key === "sessions" ? null : key,
                  page: key === "sessions" ? String(page) : null,
                });
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative block w-full max-w-sm" htmlFor={searchId}>
          <span className="sr-only">Filter by session title</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            id={searchId}
            className={`${fieldClassName} w-full pl-9`}
            placeholder="Filter by session title"
            value={draftQ}
            onChange={(e) => {
              setDraftQ(e.target.value);
            }}
          />
        </label>
      </div>

      {view === "sessions" ? (
        <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          {loading && !listData?.items.length ? (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="border-b border-[var(--admin-border)] px-4 py-3 last:border-0"
                >
                  <Shimmer className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : !listData?.items.length ? (
            <EmptyState
              title="No live sessions are linked to this batch yet"
              description="Sessions link through the batch's course."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                      <th
                        className={`sticky left-0 z-20 border-r border-[var(--admin-border)] bg-[var(--admin-surface-low)] ${thClass}`}
                      >
                        Session title
                      </th>
                      <th className="px-4 py-2.5">
                        <SortBtn col="scheduled_at" label="Scheduled" />
                      </th>
                      <th className={thClass}>Status</th>
                      <th className={thClass}>Host</th>
                      <th className={thClass}>Attended</th>
                      <th className="px-4 py-2.5">
                        <SortBtn col="attendance_rate" label="Rate" />
                      </th>
                      <th className={thClass}>Avg watch</th>
                      <th className={thClass}>Late</th>
                      <th className={thClass}>Recording</th>
                      <th className="w-10 px-3 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.upcoming.length > 0 ? (
                      <>
                        <tr className="bg-[var(--admin-surface-low)]">
                          <td
                            colSpan={10}
                            className="px-4 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
                          >
                            Upcoming
                          </td>
                        </tr>
                        {renderRows(grouped.upcoming, true)}
                      </>
                    ) : null}
                    {grouped.past.length > 0 ? (
                      <>
                        <tr className="bg-[var(--admin-surface-low)]">
                          <td
                            colSpan={10}
                            className="px-4 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
                          >
                            Past sessions
                          </td>
                        </tr>
                        {renderRows(grouped.past)}
                      </>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  Showing {rangeStart}-{rangeEnd} of {totalCount.toLocaleString()} sessions
                </p>
                {totalPages > 1 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      disabled={page <= 1 || loading}
                      onClick={() => {
                        replaceParams({ page: String(Math.max(1, page - 1)) });
                      }}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      disabled={page >= totalPages || loading}
                      onClick={() => {
                        replaceParams({ page: String(page + 1) });
                      }}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <p className="border-b border-[var(--admin-border)] px-4 py-2 text-xs text-[var(--admin-on-surface-variant)] md:hidden">
            Open on a larger screen to see the attendance matrix.
          </p>
          {loading && !matrixData ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Shimmer key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !matrixData?.sessions.length || !matrixData.learners.length ? (
            <EmptyState
              title="No live sessions are linked to this batch yet"
              description="Sessions link through the batch's course."
            />
          ) : (
            <>
              <div className="hidden overflow-auto md:block" style={{ maxHeight: 560 }}>
                <table className="border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 z-30 border-b border-r border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Learner
                      </th>
                      {matrixData.sessions.map((session) => (
                        <th
                          key={session.id}
                          className="sticky top-0 z-20 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-1 py-2 text-center"
                          title={session.title}
                        >
                          <div className="mx-auto flex h-16 w-7 items-end justify-center">
                            <span className="origin-bottom -rotate-45 whitespace-nowrap text-[10px] text-[var(--admin-on-surface)]">
                              {session.title.length > 14
                                ? `${session.title.slice(0, 14)}…`
                                : session.title}
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                            {session.scheduledAt
                              ? new Date(session.scheduledAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "-"}
                          </p>
                        </th>
                      ))}
                      <th className="sticky right-0 top-0 z-30 border-b border-l border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.learners.map((learner) => {
                      const denom = learner.attendedCount + learner.missedCount;
                      const total = denom > 0 ? (learner.attendedCount / denom) * 100 : null;
                      const name = learner.learnerName ?? learner.email ?? "Learner";
                      return (
                        <tr
                          key={learner.membershipId}
                          className="border-b border-[var(--admin-border)] last:border-b-0"
                        >
                          <td className="sticky left-0 z-10 border-r border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5">
                            <p className="max-w-[140px] truncate text-xs font-medium text-[var(--admin-on-surface)]">
                              {name}
                            </p>
                            {learner.email && learner.learnerName ? (
                              <p className="max-w-[140px] truncate font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                {learner.email}
                              </p>
                            ) : null}
                          </td>
                          {matrixData.sessions.map((session) => {
                            const kind =
                              learner.cells.find((c) => c.liveSessionId === session.id)?.kind ??
                              "none";
                            return (
                              <td key={session.id} className="px-1 py-1.5 text-center">
                                <span
                                  className={`inline-block h-7 w-7 rounded-sm ${matrixCellClass(kind)}`}
                                  title={`${name} · ${session.title} · ${matrixLabel(kind)}`}
                                  aria-label={`${name}, ${session.title}: ${matrixLabel(kind)}`}
                                />
                              </td>
                            );
                          })}
                          <td className="sticky right-0 z-10 border-l border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5">
                            <p className="font-mono text-xs text-[var(--admin-on-surface)]">
                              {formatPct(total)}
                            </p>
                            <MiniBar value={total} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-4 border-t border-[var(--admin-border)] px-4 py-3 text-[11px] text-[var(--admin-on-surface-variant)]">
                {(
                  [
                    ["attended", "Attended"],
                    ["partial", "Partial"],
                    ["absent", "Absent"],
                    ["upcoming", "Upcoming / none"],
                  ] as const
                ).map(([kind, label]) => (
                  <span key={kind} className="inline-flex items-center gap-1.5">
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-sm ${matrixCellClass(kind)}`}
                      aria-hidden="true"
                    />
                    {label}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {messageOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={messageTitleId}
        >
          <div className="w-full max-w-lg rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-4">
              <h2
                id={messageTitleId}
                className="text-base font-semibold text-[var(--admin-on-surface)]"
              >
                Message absentees
              </h2>
              <button
                type="button"
                className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                onClick={() => {
                  setMessageOpen(false);
                }}
                aria-label="Close message dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Sending to {messageIds.length} learner{messageIds.length === 1 ? "" : "s"} who
                missed at least one session.
              </p>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Subject
                <input
                  className={fieldClassName}
                  value={messageSubject}
                  onChange={(e) => {
                    setMessageSubject(e.target.value);
                  }}
                  maxLength={200}
                />
              </label>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Message
                <textarea
                  className={`${fieldClassName} h-auto min-h-[120px] py-2`}
                  rows={5}
                  value={messageBody}
                  onChange={(e) => {
                    setMessageBody(e.target.value);
                  }}
                  maxLength={10000}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
              <button
                type="button"
                className={ghostButtonClassName}
                onClick={() => {
                  setMessageOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={messageBusy || !messageSubject.trim() || !messageBody.trim()}
                onClick={() => void handleSendMessage()}
              >
                {messageBusy ? "Sending…" : `Send to ${String(messageIds.length)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
