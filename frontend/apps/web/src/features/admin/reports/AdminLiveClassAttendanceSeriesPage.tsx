"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState, Fragment } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Layers,
  Mail,
  RefreshCw,
  Send,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  fetchLiveClassAttendanceSeries,
  fetchLiveClassAttendanceSeriesDetail,
  sendLiveClassAttendanceMessage,
  type LiveSeriesDetail,
  type LiveSeriesDropOff,
  type LiveSeriesGroupBy,
  type LiveSeriesListItem,
  type LiveSeriesListSummary,
  type LiveSeriesSortBy,
} from "./admin-live-class-attendance-roster-api";

type ModuleTab = "sessions" | "learners" | "series" | "exports";
type DatePreset = "7d" | "30d" | "90d" | "custom";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-transparent px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const EMPTY_SUMMARY: LiveSeriesListSummary = {
  seriesCount: 0,
  runningCount: 0,
  finishedCount: 0,
  sessionsCount: 0,
  registrationsCount: 0,
  avgTurnoutPct: null,
  bestSeries: null,
  weakestSeries: null,
  turnoutTrendPts: null,
};

const EMPTY_DROP_OFF: LiveSeriesDropOff = { stages: [], biggestDrop: null };

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

function presetToRange(preset: DatePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === "7d") from.setDate(from.getDate() - 7);
  else if (preset === "30d") from.setDate(from.getDate() - 30);
  else if (preset === "90d") from.setDate(from.getDate() - 90);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatDateShort(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDelta(pts: number | null): string {
  if (pts == null || Number.isNaN(pts)) return "—";
  if (Math.abs(pts) < 0.05) return "flat";
  const abs = Math.abs(pts).toFixed(1);
  return pts > 0 ? `+${abs} pts` : `−${abs} pts`;
}

function MetricBar({
  pct,
  tone = "primary",
}: {
  pct: number | null;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const width = Math.max(0, Math.min(100, pct ?? 0));
  const fill =
    tone === "success"
      ? "bg-[var(--admin-success)]"
      : tone === "warning"
        ? "bg-[var(--admin-warning)]"
        : tone === "danger"
          ? "bg-[var(--admin-danger)]"
          : "bg-[var(--admin-primary-strong)]";
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-variant)]">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${String(width)}%` }} />
    </div>
  );
}

function Sparkline({
  values,
  tone = "neutral",
}: {
  values: Array<number | null>;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const points = values.filter((v): v is number => v != null);
  if (points.length === 0) {
    return <span className="text-[11px] text-[var(--admin-on-surface-variant)]">—</span>;
  }
  const max = Math.max(100, ...points);
  const min = 0;
  const coords = values
    .map((value, index) => {
      if (value == null) return null;
      const x = values.length === 1 ? 24 : (index / (values.length - 1)) * 48;
      const y = 14 - ((value - min) / (max - min || 1)) * 12;
      return `${String(x)},${String(y)}`;
    })
    .filter((v): v is string => v != null)
    .join(" ");
  const stroke =
    tone === "success"
      ? "var(--admin-success)"
      : tone === "warning"
        ? "var(--admin-warning)"
        : tone === "danger"
          ? "var(--admin-danger)"
          : "var(--admin-on-surface-variant)";
  return (
    <svg
      className="h-4 w-12"
      viewBox="0 0 48 16"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={coords}
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ModuleTabs({ active }: { active: ModuleTab }) {
  const tabs: Array<{ key: ModuleTab; label: string; href?: string }> = [
    { key: "sessions", label: "Sessions", href: "/admin/reports/live-class-attendance" },
    { key: "learners", label: "Learners", href: "/admin/reports/live-class-attendance/learners" },
    { key: "series", label: "Series", href: "/admin/reports/live-class-attendance/series" },
    { key: "exports", label: "Exports", href: "/admin/reports/live-class-attendance/exports" },
  ];

  return (
    <div className="flex gap-8 border-b border-[var(--admin-border)]">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const className = [
          "pb-3 text-sm transition-colors",
          isActive
            ? "border-b-2 border-[var(--admin-primary-strong)] font-semibold text-[var(--admin-primary-strong)]"
            : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
        ].join(" ");
        if (tab.href) {
          return (
            <Link key={tab.key} href={tab.href} className={className}>
              {tab.label}
            </Link>
          );
        }
        return (
          <span key={tab.key} className={className} aria-current={isActive ? "page" : undefined}>
            {tab.label}
          </span>
        );
      })}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading series">
      <div className="grid gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-8 w-16" />
            <Shimmer className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
          <Shimmer className="h-4 w-32" />
          <Shimmer className="ml-auto h-4 w-40" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RemindModal({
  open,
  title,
  subject,
  body,
  busy,
  error,
  onSubjectChange,
  onBodyChange,
  onClose,
  onSend,
}: {
  open: boolean;
  title: string;
  subject: string;
  body: string;
  busy: boolean;
  error: string | null;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-[var(--admin-scrim)] p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close reminder dialog overlay"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        className="admin-theme relative z-10 flex w-full max-w-lg flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              Send reminder
            </h2>
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">{title}</p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {error ? (
            <div
              className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-danger)]"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
              Subject
            </span>
            <input
              className={fieldClassName}
              value={subject}
              onChange={(e) => {
                onSubjectChange(e.target.value);
              }}
              maxLength={200}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
              Message
            </span>
            <textarea
              className={`${fieldClassName} h-32 resize-y py-2`}
              value={body}
              onChange={(e) => {
                onBodyChange(e.target.value);
              }}
              maxLength={10000}
            />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
          <button type="button" className={ghostButtonClassName} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy || !subject.trim() || !body.trim()}
            onClick={onSend}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ExpandedPanel({
  detail,
  loading,
  error,
  onRetry,
}: {
  detail: LiveSeriesDetail | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading && !detail) {
    return (
      <div className="space-y-4 border-t border-[var(--admin-border)] bg-[var(--admin-bg)] px-6 py-5">
        <Shimmer className="h-5 w-40" />
        <Shimmer className="h-40 w-full" />
        <Shimmer className="h-24 w-full" />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="border-t border-[var(--admin-border)] bg-[var(--admin-bg)] px-6 py-5">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-danger)]">
          <span>{error}</span>
          <button type="button" className={ghostButtonClassName} onClick={onRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const avg = detail.avgTurnoutPct ?? 0;

  return (
    <div className="flex flex-col gap-6 border-t border-[var(--admin-border)] bg-[var(--admin-bg)] px-6 py-5 motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Session turnout
          </h3>
          {detail.steepestDrop ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--admin-danger)]" />
              {detail.steepestDrop.message}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              Per-session turnout across this series.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--admin-on-surface-variant)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 bg-[var(--admin-primary-strong)]" /> Actual
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 border border-[var(--admin-outline)]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, transparent, transparent 3px, color-mix(in srgb, var(--admin-outline) 55%, transparent) 3px, color-mix(in srgb, var(--admin-outline) 55%, transparent) 6px)",
              }}
            />{" "}
            Cancelled
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-6 border-t-2 border-dashed border-[var(--admin-outline)]" />{" "}
            Series avg ({formatPct(detail.avgTurnoutPct)})
          </span>
        </div>
      </div>

      <div className="relative flex h-48 items-end justify-around gap-2 border-b border-[var(--admin-border)] px-2 pt-6">
        <div
          className="pointer-events-none absolute left-0 right-0 z-[1] border-t-2 border-dashed border-[var(--admin-outline)]"
          style={{ bottom: `${String(Math.max(0, Math.min(100, avg)))}%` }}
          aria-hidden="true"
        />
        {detail.sessions.map((session) => {
          const height = session.cancelled
            ? 100
            : Math.max(4, Math.min(100, session.turnoutPct ?? 0));
          const isDrop =
            detail.steepestDrop != null && session.ordinal === detail.steepestDrop.toOrdinal;
          return (
            <div
              key={session.sessionId}
              className="relative z-[2] flex w-10 flex-col items-center sm:w-12"
              title={`${session.title}: ${session.cancelled ? "Cancelled" : formatPct(session.turnoutPct)}`}
            >
              {isDrop && !session.cancelled ? (
                <span className="absolute -top-5 rounded bg-[var(--admin-danger)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-on-danger)]">
                  {formatPct(session.turnoutPct)}
                </span>
              ) : null}
              <div
                className={[
                  "w-full rounded-t-sm transition-all",
                  session.cancelled
                    ? "border border-b-0 border-[var(--admin-outline)]"
                    : "bg-[var(--admin-primary-strong)]",
                  isDrop && !session.cancelled
                    ? "ring-2 ring-[var(--admin-danger)] ring-offset-1 ring-offset-[var(--admin-bg)]"
                    : "",
                ].join(" ")}
                style={
                  session.cancelled
                    ? {
                        height: `${String(height)}%`,
                        backgroundImage:
                          "repeating-linear-gradient(45deg, transparent, transparent 4px, color-mix(in srgb, var(--admin-outline) 40%, transparent) 4px, color-mix(in srgb, var(--admin-outline) 40%, transparent) 8px)",
                      }
                    : { height: `${String(height)}%` }
                }
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-around gap-2 px-2 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
        {detail.sessions.map((session) => (
          <div
            key={session.sessionId}
            className={[
              "w-10 text-center sm:w-12",
              detail.steepestDrop?.toOrdinal === session.ordinal
                ? "text-[var(--admin-danger)]"
                : "",
            ].join(" ")}
          >
            <div>S{session.ordinal}</div>
            <div className="text-[var(--admin-on-surface-variant)]">
              {formatDateShort(session.scheduledAt)}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <tr>
                {["#", "Session", "Date", "Registered", "Attended", "Coverage", ""].map((h) => (
                  <th
                    key={h || "actions"}
                    className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.sessions.map((session) => (
                <tr
                  key={session.sessionId}
                  className={[
                    "border-b border-[var(--admin-border)] last:border-b-0",
                    session.cancelled ? "opacity-60" : "",
                    detail.steepestDrop?.toOrdinal === session.ordinal && !session.cancelled
                      ? "bg-[color-mix(in_srgb,var(--admin-warning)_6%,transparent)]"
                      : "",
                  ].join(" ")}
                >
                  <td className="px-4 py-2 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                    {String(session.ordinal).padStart(2, "0")}
                  </td>
                  <td
                    className={[
                      "px-4 py-2 text-[var(--admin-on-surface)]",
                      session.cancelled ? "line-through" : "",
                    ].join(" ")}
                  >
                    {session.title}
                  </td>
                  <td className="px-4 py-2 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                    {formatDateShort(session.scheduledAt)}
                  </td>
                  <td className="px-4 py-2 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                    {session.cancelled ? "—" : formatCount(session.registeredCount)}
                  </td>
                  <td className="px-4 py-2">
                    {session.cancelled ? (
                      <span className="inline-flex rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-variant)] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-[var(--admin-on-surface-variant)]">
                        Cancelled
                      </span>
                    ) : (
                      <div className="flex min-w-[140px] items-center gap-2">
                        <span
                          className={[
                            "font-mono text-[13px]",
                            detail.steepestDrop?.toOrdinal === session.ordinal
                              ? "font-semibold text-[var(--admin-danger)]"
                              : "text-[var(--admin-on-surface)]",
                          ].join(" ")}
                        >
                          {formatCount(session.attendedCount)} of{" "}
                          {formatCount(session.registeredCount)} · {formatPct(session.turnoutPct)}
                        </span>
                        <div className="h-[3px] w-16">
                          <MetricBar
                            pct={session.turnoutPct}
                            tone={
                              detail.steepestDrop?.toOrdinal === session.ordinal
                                ? "danger"
                                : "primary"
                            }
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-[13px] text-[var(--admin-on-surface)]">
                    {session.cancelled ? "—" : formatPct(session.avgCoveragePct)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {!session.cancelled ? (
                      <Link
                        href={`/admin/reports/live-class-attendance/${session.sessionId}`}
                        className="text-xs font-semibold text-[var(--admin-primary-strong)] hover:underline"
                      >
                        View
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function exportSeriesCsv(items: LiveSeriesListItem[]) {
  const headers = [
    "Series",
    "Subtitle",
    "SessionsHeld",
    "SessionsTotal",
    "Cancelled",
    "Registrations",
    "AvgTurnoutPct",
    "AvgCoveragePct",
    "NeverAttending",
    "TrendDeltaPts",
    "Status",
    "NextSessionAt",
  ];
  const rows = items.map((item) => [
    item.title,
    item.subtitle ?? "",
    String(item.sessionsHeld),
    String(item.sessionsTotal),
    String(item.cancelledCount),
    String(item.registrations),
    item.avgTurnoutPct == null ? "" : String(item.avgTurnoutPct),
    item.avgCoveragePct == null ? "" : String(item.avgCoveragePct),
    String(item.neverAttendingCount),
    item.trendDeltaPts == null ? "" : String(item.trendDeltaPts),
    item.status,
    item.nextSessionAt ?? "",
  ]);
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "live-class-attendance-series.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminLiveClassAttendanceSeriesPage() {
  const datePresetLabelId = useId();
  const sortLabelId = useId();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LiveSeriesListItem[]>([]);
  const [summary, setSummary] = useState<LiveSeriesListSummary>(EMPTY_SUMMARY);
  const [dropOff, setDropOff] = useState<LiveSeriesDropOff>(EMPTY_DROP_OFF);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const initialRange = presetToRange("90d");
  const [datePreset, setDatePreset] = useState<DatePreset>("90d");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [scheduledFrom, setScheduledFrom] = useState(initialRange.from);
  const [scheduledTo, setScheduledTo] = useState(initialRange.to);
  const [groupBy, setGroupBy] = useState<LiveSeriesGroupBy>("course");
  const [searchQ, setSearchQ] = useState("");
  const [sortBy, setSortBy] = useState<LiveSeriesSortBy>("avg_turnout");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [sortOpen, setSortOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<LiveSeriesDetail | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [remindOpen, setRemindOpen] = useState(false);
  const [remindSubject, setRemindSubject] = useState(
    "We noticed you've missed recent live sessions",
  );
  const [remindBody, setRemindBody] = useState(
    "Hi {{learner_name}},\n\nWe noticed your attendance on recent live sessions has been lower than expected. Please join the next scheduled session or reach out if you need support.",
  );
  const [remindBusy, setRemindBusy] = useState(false);
  const [remindError, setRemindError] = useState<string | null>(null);

  const datePresetLabel =
    datePreset === "7d"
      ? "Last 7 days"
      : datePreset === "30d"
        ? "Last 30 days"
        : datePreset === "custom"
          ? "Custom range"
          : "This quarter";

  const filterPayload = useMemo(() => {
    const payload: Parameters<typeof fetchLiveClassAttendanceSeries>[0] = {
      groupBy,
      sortBy,
      sortDir,
      page,
      limit: 25,
    };
    const trimmed = searchQ.trim();
    if (trimmed) payload.q = trimmed;
    const fromIso = dateInputToStartIso(scheduledFrom);
    if (fromIso) payload.scheduledFrom = fromIso;
    const toIso = dateInputToEndIso(scheduledTo);
    if (toIso) payload.scheduledTo = toIso;
    return payload;
  }, [groupBy, page, scheduledFrom, scheduledTo, searchQ, sortBy, sortDir]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLiveClassAttendanceSeries(filterPayload);
      setItems(response.data.items);
      setSummary(response.data.summary);
      setDropOff(response.data.dropOff);
      setTotalPages(response.data.pageInfo.totalPages);
      setTotalCount(response.data.pageInfo.totalCount);
    } catch (loadError) {
      setItems([]);
      setSummary(EMPTY_SUMMARY);
      setDropOff(EMPTY_DROP_OFF);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load series rollup.",
      );
    } finally {
      setLoading(false);
    }
  }, [filterPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadExpand = useCallback(
    async (seriesId: string) => {
      setExpandLoading(true);
      setExpandError(null);
      try {
        const response = await fetchLiveClassAttendanceSeriesDetail(seriesId, {
          groupBy,
          scheduledFrom: dateInputToStartIso(scheduledFrom),
          scheduledTo: dateInputToEndIso(scheduledTo),
        });
        setExpandedDetail(response.data);
      } catch (loadError) {
        setExpandedDetail(null);
        setExpandError(
          loadError instanceof ClientApiError
            ? loadError.message
            : loadError instanceof Error
              ? loadError.message
              : "Couldn't load series detail.",
        );
      } finally {
        setExpandLoading(false);
      }
    },
    [groupBy, scheduledFrom, scheduledTo],
  );

  function applyDatePreset(preset: DatePreset) {
    setDatePreset(preset);
    if (preset !== "custom") {
      const range = presetToRange(preset);
      setScheduledFrom(range.from);
      setScheduledTo(range.to);
    }
    setPage(1);
    setDateMenuOpen(false);
  }

  function toggleExpand(seriesId: string) {
    if (expandedId === seriesId) {
      setExpandedId(null);
      setExpandedDetail(null);
      setExpandError(null);
      return;
    }
    setExpandedId(seriesId);
    setExpandedDetail(null);
    void loadExpand(seriesId);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      const ids = items.map((item) => item.seriesId);
      const allSelected = ids.length > 0 && ids.every((id) => current.has(id));
      if (allSelected) {
        const next = new Set(current);
        for (const id of ids) next.delete(id);
        return next;
      }
      const next = new Set(current);
      for (const id of ids) next.add(id);
      return next;
    });
  }

  function handleSort(next: LiveSeriesSortBy) {
    if (sortBy === next) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(next);
      setSortDir(next === "avg_turnout" || next === "title" ? "asc" : "desc");
    }
    setPage(1);
  }

  async function handleSendMessage() {
    if (!remindSubject.trim() || !remindBody.trim()) return;
    setRemindBusy(true);
    setRemindError(null);
    try {
      await sendLiveClassAttendanceMessage({
        audience: "low_attendance",
        subject: remindSubject.trim(),
        message: remindBody.trim(),
        channels: ["email", "in_app"],
      });
      setRemindOpen(false);
    } catch (sendError) {
      setRemindError(
        sendError instanceof ClientApiError
          ? sendError.message
          : sendError instanceof Error
            ? sendError.message
            : "Couldn't send reminder.",
      );
    } finally {
      setRemindBusy(false);
    }
  }

  const scopeCaption = `${formatCount(summary.seriesCount)} ${
    groupBy === "course" ? "courses" : "batches"
  } · ${formatCount(summary.sessionsCount)} sessions · ${formatCount(summary.registrationsCount)} registrations`;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-6">
      <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Series
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Attendance trends across a whole course or batch, session by session.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[160px]">
            <DropdownField
              label={<span className="sr-only">Date range</span>}
              labelId={datePresetLabelId}
              open={dateMenuOpen}
              onToggle={() => {
                setDateMenuOpen((open) => !open);
              }}
              triggerContent={
                <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                  <Calendar
                    className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-left">{datePresetLabel}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${dateMenuOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </span>
              }
              panelAriaLabel="Date range presets"
            >
              <div className="p-1.5" role="listbox">
                {(
                  [
                    ["7d", "Last 7 days"],
                    ["30d", "Last 30 days"],
                    ["90d", "This quarter"],
                    ["custom", "Custom"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="option"
                    aria-selected={datePreset === value}
                    className={dropdownItemClassName}
                    onClick={() => {
                      applyDatePreset(value);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </DropdownField>
          </div>
          {datePreset === "custom" ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className={fieldClassName}
                value={scheduledFrom}
                onChange={(e) => {
                  setScheduledFrom(e.target.value);
                  setPage(1);
                }}
                aria-label="From date"
              />
              <input
                type="date"
                className={fieldClassName}
                value={scheduledTo}
                onChange={(e) => {
                  setScheduledTo(e.target.value);
                  setPage(1);
                }}
                aria-label="To date"
              />
            </div>
          ) : null}
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={loading || items.length === 0}
            onClick={() => {
              exportSeriesCsv(items);
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => {
              setRemindError(null);
              setRemindOpen(true);
            }}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Message low-attendance learners
          </button>
        </div>
      </div>

      <ModuleTabs active="series" />

      {error ? (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button type="button" className={ghostButtonClassName} onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {loading && items.length === 0 && !error ? (
        <LoadingSkeleton />
      ) : !loading && items.length === 0 && !error ? (
        <section className="flex flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
            <Filter className="h-7 w-7 text-[var(--admin-outline)]" aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
            No series with sessions in this range
          </h2>
          <p className="mb-6 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            Try adjusting your filters or date selection to see attendance data.
          </p>
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              applyDatePreset("90d");
              setSearchQ("");
              setGroupBy("course");
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reset filters
          </button>
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-6">
                {(
                  [
                    ["course", "By course"],
                    ["batch", "By batch"],
                  ] as const
                ).map(([value, label]) => {
                  const active = groupBy === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      className={[
                        "relative pb-3 text-base font-semibold transition-colors",
                        active
                          ? "text-[var(--admin-on-surface)]"
                          : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                      ].join(" ")}
                      onClick={() => {
                        setGroupBy(value);
                        setPage(1);
                        setExpandedId(null);
                        setSelectedIds(new Set());
                      }}
                    >
                      {label}
                      {active ? (
                        <span className="absolute bottom-0 left-0 h-0.5 w-full translate-y-px bg-[var(--admin-primary-strong)]" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">{scopeCaption}</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-5 xl:divide-x xl:divide-[var(--admin-border)]">
              <div className="flex flex-col gap-1 xl:pr-4">
                <span className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Series count
                </span>
                <span className="font-mono text-[28px] font-medium leading-tight text-[var(--admin-on-surface)]">
                  {formatCount(summary.seriesCount)}
                </span>
                <span className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  {formatCount(summary.runningCount)} running · {formatCount(summary.finishedCount)}{" "}
                  finished
                </span>
              </div>
              <div className="flex flex-col gap-1 xl:px-4">
                <span className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Avg turnout
                </span>
                <span className="font-mono text-2xl text-[var(--admin-on-surface)]">
                  {formatPct(summary.avgTurnoutPct)}
                </span>
                <div className="mt-2">
                  <MetricBar pct={summary.avgTurnoutPct} />
                </div>
              </div>
              <div className="flex flex-col justify-center gap-1 xl:px-4">
                <span className="mb-1 text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Top performing
                </span>
                {summary.bestSeries ? (
                  <>
                    <button
                      type="button"
                      className="truncate text-left text-[13px] text-[var(--admin-on-surface)] hover:underline"
                      title={summary.bestSeries.title}
                      onClick={() => {
                        const best = summary.bestSeries;
                        if (!best) return;
                        setHighlightId(best.seriesId);
                        setExpandedId(best.seriesId);
                        void loadExpand(best.seriesId);
                      }}
                    >
                      {summary.bestSeries.title}
                    </button>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-success)]" />
                      <span className="font-mono text-[13px] text-[var(--admin-success)]">
                        {formatPct(summary.bestSeries.avgTurnoutPct)}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-[var(--admin-on-surface-variant)]">—</span>
                )}
              </div>
              <div className="flex flex-col justify-center gap-1 xl:px-4">
                <span className="mb-1 text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Requires attention
                </span>
                {summary.weakestSeries ? (
                  <>
                    <button
                      type="button"
                      className="truncate text-left text-[13px] text-[var(--admin-on-surface)] hover:underline"
                      title={summary.weakestSeries.title}
                      onClick={() => {
                        const weakest = summary.weakestSeries;
                        if (!weakest) return;
                        setHighlightId(weakest.seriesId);
                        setExpandedId(weakest.seriesId);
                        void loadExpand(weakest.seriesId);
                      }}
                    >
                      {summary.weakestSeries.title}
                    </button>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-warning)]" />
                      <span className="font-mono text-[13px] text-[var(--admin-warning)]">
                        {formatPct(summary.weakestSeries.avgTurnoutPct)}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-[var(--admin-on-surface-variant)]">—</span>
                )}
              </div>
              <div className="flex flex-col justify-center gap-1 xl:pl-4">
                <span className="mb-1 text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Overall trend
                </span>
                <div className="flex items-center gap-2">
                  {(summary.turnoutTrendPts ?? 0) < 0 ? (
                    <TrendingDown
                      className="h-5 w-5 text-[var(--admin-warning)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <TrendingUp
                      className="h-5 w-5 text-[var(--admin-success)]"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={[
                      "font-mono text-[13px]",
                      (summary.turnoutTrendPts ?? 0) < 0
                        ? "text-[var(--admin-warning)]"
                        : "text-[var(--admin-success)]",
                    ].join(" ")}
                  >
                    {formatDelta(summary.turnoutTrendPts)}
                  </span>
                </div>
                <span className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  first to last session avg
                </span>
              </div>
            </div>
          </section>

          <section className="relative flex flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2">
              <div className="flex items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
                <span>Sorted by:</span>
                <div className="min-w-[140px]">
                  <DropdownField
                    label={<span className="sr-only">Sort series</span>}
                    labelId={sortLabelId}
                    open={sortOpen}
                    onToggle={() => {
                      setSortOpen((open) => !open);
                    }}
                    triggerContent={
                      <span className="flex w-full items-center gap-1 text-[12px] font-medium text-[var(--admin-on-surface)]">
                        {sortBy === "avg_turnout"
                          ? "Avg turnout"
                          : sortBy === "sessions_held"
                            ? "Sessions held"
                            : sortBy === "registrations"
                              ? "Registrations"
                              : sortBy === "never_attending"
                                ? "Never attending"
                                : "Title"}
                        {sortDir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </span>
                    }
                    panelAriaLabel="Sort series"
                  >
                    <div className="p-1.5" role="listbox">
                      {(
                        [
                          ["avg_turnout", "Avg turnout"],
                          ["sessions_held", "Sessions held"],
                          ["registrations", "Registrations"],
                          ["never_attending", "Never attending"],
                          ["title", "Title"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="option"
                          aria-selected={sortBy === value}
                          className={dropdownItemClassName}
                          onClick={() => {
                            handleSort(value);
                            setSortOpen(false);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                </div>
              </div>
              <div className="relative">
                <Filter
                  className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <input
                  className={`${fieldClassName} h-7 w-48 pl-7 text-[12px]`}
                  placeholder="Filter series…"
                  value={searchQ}
                  onChange={(e) => {
                    setSearchQ(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter series"
                />
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[960px] border-collapse text-left whitespace-nowrap">
                <thead className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <tr>
                    <th className="w-10 px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 cursor-pointer rounded-sm border-[var(--admin-outline)] text-[var(--admin-primary-strong)] focus:ring-[var(--admin-primary)]"
                        aria-label="Select all visible series"
                        checked={
                          items.length > 0 && items.every((item) => selectedIds.has(item.seriesId))
                        }
                        onChange={toggleSelectAllVisible}
                      />
                    </th>
                    {(
                      [
                        ["title", "Series"],
                        ["sessions_held", "Sessions held"],
                        ["registrations", "Registrations"],
                        ["avg_turnout", "Avg turnout"],
                        [null, "Trend"],
                        [null, "Avg coverage"],
                        ["never_attending", "Never attending"],
                        [null, "Next session"],
                        [null, ""],
                      ] as const
                    ).map(([key, label], index) => (
                      <th
                        key={`${label}-${String(index)}`}
                        className={[
                          "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]",
                          key === "sessions_held" ||
                          key === "registrations" ||
                          key === "never_attending"
                            ? "text-right"
                            : "",
                        ].join(" ")}
                      >
                        {key ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 hover:text-[var(--admin-on-surface)]"
                            onClick={() => {
                              handleSort(key);
                            }}
                          >
                            {label}
                            {sortBy === key ? (
                              sortDir === "asc" ? (
                                <ArrowUp className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <ArrowDown className="h-3 w-3" aria-hidden="true" />
                              )
                            ) : null}
                          </button>
                        ) : (
                          label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const selected = selectedIds.has(item.seriesId);
                    const expanded = expandedId === item.seriesId;
                    const low = item.avgTurnoutPct != null && item.avgTurnoutPct < 40;
                    const trendTone =
                      (item.trendDeltaPts ?? 0) < -5
                        ? "warning"
                        : (item.trendDeltaPts ?? 0) > 5
                          ? "success"
                          : "neutral";
                    return (
                      <Fragment key={item.seriesId}>
                        <tr
                          id={`series-row-${item.seriesId}`}
                          className={[
                            "group h-11 border-b border-[var(--admin-border)] transition-colors",
                            selected || highlightId === item.seriesId || expanded
                              ? "bg-[var(--admin-primary-container)]"
                              : "hover:bg-[var(--admin-surface-high)]",
                          ].join(" ")}
                        >
                          <td className="relative px-4 text-center align-middle">
                            {(selected || expanded) && (
                              <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--admin-primary-strong)]" />
                            )}
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 cursor-pointer rounded-sm border-[var(--admin-outline)] text-[var(--admin-primary-strong)] focus:ring-[var(--admin-primary)]"
                              checked={selected}
                              onChange={() => {
                                toggleSelected(item.seriesId);
                              }}
                              aria-label={`Select ${item.title}`}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              className="flex flex-col text-left"
                              onClick={() => {
                                toggleExpand(item.seriesId);
                              }}
                            >
                              <span className="text-[13px] font-medium text-[var(--admin-primary-strong)] hover:underline">
                                {item.title}
                              </span>
                              {item.subtitle ? (
                                <span className="mt-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                                  {item.subtitle}
                                </span>
                              ) : null}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                                {item.sessionsHeld} of {item.sessionsTotal}
                              </span>
                              {item.cancelledCount > 0 ? (
                                <span className="mt-0.5 text-[11px] text-[var(--admin-danger)]">
                                  {item.cancelledCount} cancelled
                                </span>
                              ) : item.status === "finished" ? (
                                <span className="mt-0.5 text-[11px] text-[var(--admin-success)]">
                                  Completed
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {formatCount(item.registrations)}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-3">
                              <span
                                className={[
                                  "w-10 text-right font-mono text-[13px]",
                                  low
                                    ? "text-[var(--admin-warning)]"
                                    : "text-[var(--admin-on-surface)]",
                                ].join(" ")}
                              >
                                {formatPct(item.avgTurnoutPct)}
                              </span>
                              <div className="w-16">
                                <MetricBar
                                  pct={item.avgTurnoutPct}
                                  tone={low ? "warning" : "primary"}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <Sparkline values={item.sparkline} tone={trendTone} />
                              <span
                                className={[
                                  "text-[11px]",
                                  trendTone === "warning"
                                    ? "text-[var(--admin-warning)]"
                                    : trendTone === "success"
                                      ? "text-[var(--admin-success)]"
                                      : "text-[var(--admin-on-surface-variant)]",
                                ].join(" ")}
                              >
                                {item.trendDeltaPts == null
                                  ? "—"
                                  : `${formatDelta(item.trendDeltaPts)} since s1`}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {item.avgCoveragePct != null && item.avgCoveragePct < 50 ? (
                              <span className="inline-flex rounded-sm border border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--admin-warning)]">
                                {formatPct(item.avgCoveragePct)}
                              </span>
                            ) : (
                              <span className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                                {formatPct(item.avgCoveragePct)}
                              </span>
                            )}
                          </td>
                          <td
                            className={[
                              "px-4 py-2 text-right font-mono text-[13px]",
                              item.neverAttendingCount > 0
                                ? "text-[var(--admin-danger)]"
                                : "text-[var(--admin-on-surface)]",
                            ].join(" ")}
                          >
                            {formatCount(item.neverAttendingCount)}
                          </td>
                          <td className="px-4 py-2">
                            {item.nextSessionId ? (
                              <Link
                                href={`/admin/reports/live-class-attendance/${item.nextSessionId}`}
                                className="text-[12px] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)] hover:underline"
                              >
                                {formatDateShort(item.nextSessionAt)}
                                {item.nextSessionTitle ? ` · ${item.nextSessionTitle}` : ""}
                              </Link>
                            ) : (
                              <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                                {item.status === "finished" ? "Finished" : "None scheduled"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              type="button"
                              className="text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--admin-on-surface)]"
                              aria-label={expanded ? "Collapse series" : "Expand series"}
                              onClick={() => {
                                toggleExpand(item.seriesId);
                              }}
                            >
                              <ChevronRight
                                className={`h-5 w-5 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
                                aria-hidden="true"
                              />
                            </button>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr>
                            <td colSpan={10} className="p-0">
                              <ExpandedPanel
                                detail={expandedDetail}
                                loading={expandLoading}
                                error={expandError}
                                onRetry={() => void loadExpand(item.seriesId)}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col divide-y divide-[var(--admin-border)] lg:hidden">
              {items.map((item) => {
                const expanded = expandedId === item.seriesId;
                const low = item.avgTurnoutPct != null && item.avgTurnoutPct < 40;
                return (
                  <div key={item.seriesId} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <button
                          type="button"
                          className="text-left text-sm font-semibold text-[var(--admin-primary-strong)]"
                          onClick={() => {
                            toggleExpand(item.seriesId);
                          }}
                        >
                          {item.title}
                        </button>
                        {item.subtitle ? (
                          <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                            {item.subtitle}
                          </p>
                        ) : null}
                      </div>
                      <ChevronRight
                        className={`h-5 w-5 shrink-0 text-[var(--admin-outline)] transition-transform ${expanded ? "rotate-90" : ""}`}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span
                        className={[
                          "font-mono text-sm",
                          low ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface)]",
                        ].join(" ")}
                      >
                        {formatPct(item.avgTurnoutPct)}
                      </span>
                      <Sparkline values={item.sparkline} tone={low ? "warning" : "neutral"} />
                    </div>
                    <div className="mt-2">
                      <MetricBar pct={item.avgTurnoutPct} tone={low ? "warning" : "primary"} />
                    </div>
                    <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                      {item.sessionsHeld}/{item.sessionsTotal} sessions ·{" "}
                      {formatCount(item.registrations)} regs ·{" "}
                      {formatCount(item.neverAttendingCount)} never attending
                    </p>
                    {expanded ? (
                      <div className="mt-4 -mx-4">
                        <ExpandedPanel
                          detail={expandedDetail}
                          loading={expandLoading}
                          error={expandError}
                          onRetry={() => void loadExpand(item.seriesId)}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 py-2.5 text-xs text-[var(--admin-on-surface-variant)]">
              <div>
                Showing{" "}
                {totalCount === 0
                  ? "0"
                  : `${String((page - 1) * 25 + 1)}-${String((page - 1) * 25 + items.length)}`}{" "}
                of <span className="font-mono">{formatCount(totalCount)}</span> series
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded border border-[var(--admin-border)] disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                  }}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded border border-[var(--admin-border)] disabled:opacity-50"
                  disabled={page >= totalPages || totalPages === 0}
                  onClick={() => {
                    setPage((p) => p + 1);
                  }}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>

          <section className="mb-8 flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Where learners stop coming
                </h2>
                <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Aggregate cohort retention across series in this range.
                </p>
              </div>
              {dropOff.biggestDrop ? (
                <div className="inline-flex items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-[13px] text-[var(--admin-on-surface)]">
                  <Layers className="h-4 w-4 text-[var(--admin-warning)]" aria-hidden="true" />
                  Biggest drop:{" "}
                  <strong className="font-semibold">{dropOff.biggestDrop.label}</strong>
                </div>
              ) : null}
            </div>
            {dropOff.stages.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Not enough session history to chart retention yet.
              </p>
            ) : (
              <div className="flex h-32 w-full items-end gap-1">
                {dropOff.stages.map((stage) => {
                  const height = Math.max(8, stage.retentionPct ?? 0);
                  return (
                    <div key={stage.ordinal} className="relative flex flex-1 flex-col">
                      <div
                        className="relative w-full rounded-t bg-[var(--admin-primary-strong)] transition-all"
                        style={{ height: `${String(height)}%` }}
                      >
                        <span className="absolute left-1/2 top-2 -translate-x-1/2 font-mono text-[10px] text-[var(--admin-on-primary)]">
                          {formatPct(stage.retentionPct)}
                        </span>
                      </div>
                      <div className="mt-1 border-t border-[var(--admin-border)] pt-2 text-center font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                        {stage.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {selectedIds.size > 0 ? (
        <div className="sticky bottom-4 z-20 mx-auto flex w-full max-w-xl items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-lg">
          <span className="text-sm text-[var(--admin-on-surface)]">
            {selectedIds.size} series selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={ghostButtonClassName}
              onClick={() => {
                setSelectedIds(new Set());
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={() => {
                setRemindError(null);
                setRemindOpen(true);
              }}
            >
              Message low-attendance
            </button>
          </div>
        </div>
      ) : null}

      <RemindModal
        open={remindOpen}
        title="Low-attendance learners"
        subject={remindSubject}
        body={remindBody}
        busy={remindBusy}
        error={remindError}
        onSubjectChange={setRemindSubject}
        onBodyChange={setRemindBody}
        onClose={() => {
          if (!remindBusy) setRemindOpen(false);
        }}
        onSend={() => void handleSendMessage()}
      />
    </div>
  );
}
