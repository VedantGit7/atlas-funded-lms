"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreVertical,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { DropdownMenu, Select } from "@atlas/design-system";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  connectZoomAccount,
  dateInputToEndIso,
  dateInputToStartIso,
  exportZoomInsightsReport,
  fetchZoomPeopleRoster,
  fetchZoomPersonMeetings,
  type ZoomConnectionMeta,
  type ZoomMatchState,
  type ZoomPeopleSummary,
  type ZoomPersonListItem,
  type ZoomPersonMeetingsDetail,
} from "./admin-zoom-insights-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type ModuleTab = "meetings" | "participants" | "unmatched" | "connection" | "exports";
type DatePreset = "7d" | "30d" | "90d" | "custom";
type SortBy =
  | "display_name"
  | "meetings_attended"
  | "total_time"
  | "avg_duration"
  | "avg_coverage"
  | "first_seen"
  | "last_seen";

const PAGE_SIZE = 25;

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const selectTriggerClassName =
  "h-9 min-w-[9.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[13px] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

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

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${String(hours)}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${String(minutes)}m`;
  return `${String(total % 60)}s`;
}

function formatDateShort(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTimeShort(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(value: string | null): string {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "never";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${String(mins)} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${String(hours)} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${String(days)} day${days === 1 ? "" : "s"} ago`;
  if (days >= 30) return `>${String(Math.floor(days / 30) * 30)}d ago`;
  return formatDateShort(value);
}

function isStale(value: string | null): boolean {
  if (!value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  return Date.now() - date.getTime() > 30 * 24 * 60 * 60 * 1000;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function initials(name: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function presetToRange(preset: DatePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === "7d") from.setDate(from.getDate() - 7);
  else if (preset === "30d") from.setDate(from.getDate() - 30);
  else if (preset === "90d") from.setDate(from.getDate() - 90);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "muted";
  children: ReactNode;
}) {
  const tones = {
    success:
      "border-[color-mix(in_srgb,var(--admin-success)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]",
    warning:
      "border-[color-mix(in_srgb,var(--admin-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]",
    danger:
      "border-[color-mix(in_srgb,var(--admin-danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]",
    muted:
      "border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function CoverageMeter({
  percent,
  tone,
}: {
  percent: number | null;
  tone?: "success" | "warning" | "danger" | "muted";
}) {
  if (percent == null)
    return <span className="font-mono text-[13px] text-[var(--admin-on-surface-variant)]">—</span>;
  const width = Math.max(0, Math.min(100, percent));
  const resolved = tone ?? (percent >= 80 ? "success" : percent >= 40 ? "warning" : "danger");
  const bar =
    resolved === "success"
      ? "bg-[var(--admin-success)]"
      : resolved === "warning"
        ? "bg-[var(--admin-warning)]"
        : resolved === "danger"
          ? "bg-[var(--admin-danger)]"
          : "bg-[var(--admin-outline)]";
  const text =
    resolved === "danger" ? "text-[var(--admin-danger)]" : "text-[var(--admin-on-surface)]";
  return (
    <div className="flex flex-col items-end gap-1">
      <span className={`inline-flex items-center gap-1 font-mono text-[13px] ${text}`}>
        {resolved === "danger" ? (
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        ) : null}
        {percent.toFixed(1)}%
      </span>
      <div className="h-[3px] w-full max-w-[96px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${String(width)}%` }} />
      </div>
    </div>
  );
}

function ModuleTabs({ active }: { active: ModuleTab }) {
  const router = useRouter();
  const tabs: Array<[ModuleTab, string, string]> = [
    ["meetings", "Meetings", "/admin/reports/zoom-insights"],
    ["participants", "Participants", "/admin/reports/zoom-insights/participants"],
    ["unmatched", "Unmatched", "/admin/reports/zoom-insights/unmatched"],
    ["connection", "Connection", "/admin/reports/zoom-insights/connection"],
    ["exports", "Exports", "/admin/reports/zoom-insights/exports"],
  ];
  return (
    <div className="flex gap-6 border-b border-[var(--admin-border)]" role="tablist">
      {tabs.map(([value, label, href]) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={[
              "px-1 pb-2 text-base font-semibold transition-colors",
              selected
                ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
            ].join(" ")}
            onClick={() => {
              router.push(href);
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ConnectionBanner({
  connection,
  onSync,
  onReconnect,
  syncing,
}: {
  connection: ZoomConnectionMeta;
  onSync: () => void;
  onReconnect: () => void;
  syncing: boolean;
}) {
  if (connection.status === "connected") {
    return (
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--admin-on-surface)]">
          <span className="inline-flex h-2 w-2 rounded-full bg-[var(--admin-success)]" />
          <span className="font-semibold">Zoom connected</span>
          <span className="text-[var(--admin-on-surface-variant)]">·</span>
          <span className="text-[var(--admin-on-surface-variant)]">
            last synced {formatRelative(connection.lastSyncedAt)}
          </span>
          <span className="text-[var(--admin-on-surface-variant)]">·</span>
          <span className="text-[var(--admin-on-surface-variant)]">
            {formatCount(connection.meetingsImportedToday)} meeting
            {connection.meetingsImportedToday === 1 ? "" : "s"} imported today
          </span>
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-[var(--admin-primary)] hover:underline disabled:opacity-50"
          disabled={syncing}
          onClick={onSync}
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>
    );
  }

  if (connection.status === "disconnected") {
    return (
      <div className="relative overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4">
        <div className="absolute inset-y-0 left-0 w-1 bg-[var(--admin-danger)]" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" />
            <div>
              <p className="font-semibold text-[var(--admin-danger)]">Zoom is not connected.</p>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Participant data will not update until Zoom is reconnected.
              </p>
            </div>
          </div>
          <button
            type="button"
            className={`${primaryButtonClassName} h-9 shrink-0`}
            disabled={syncing}
            onClick={onReconnect}
          >
            Reconnect Zoom
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] px-4 py-3">
      <p className="text-sm text-[var(--admin-on-surface)]">
        Could not verify the Zoom connection. Data may be incomplete.
      </p>
      <button
        type="button"
        className={secondaryButtonClassName}
        disabled={syncing}
        onClick={onSync}
      >
        Check connection
      </button>
    </div>
  );
}

function PeopleLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading participants">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <div className="col-span-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <Shimmer className="mb-3 h-4 w-20" />
          <Shimmer className="mb-4 h-9 w-24" />
          <Shimmer className="h-1.5 w-full" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"
          >
            <Shimmer className="mb-4 h-4 w-28" />
            <Shimmer className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex h-14 items-center gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-8 w-28" />
          <Shimmer className="h-8 w-32" />
          <div className="flex-1" />
          <Shimmer className="h-8 w-36" />
        </div>
        <div className="divide-y divide-[var(--admin-border)]">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={index}
              className="flex h-[60px] items-center gap-4 px-4"
              style={{ opacity: Math.max(0.2, 1 - index * 0.08) }}
            >
              <Shimmer className="h-4 w-4" />
              <Shimmer className="h-8 w-8 rounded-full" />
              <Shimmer className="h-4 w-40" />
              <Shimmer className="ml-8 h-5 w-20" />
              <Shimmer className="ml-auto h-4 w-12" />
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MeetingsAttendedDrawer({
  open,
  onClose,
  detail,
  loading,
  error,
  onRetry,
  attendedFrom,
  attendedTo,
}: {
  open: boolean;
  onClose: () => void;
  detail: ZoomPersonMeetingsDetail | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  attendedFrom: string;
  attendedTo: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer overlay"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl motion-safe:animate-[admin-dropdown-in_0.22s_cubic-bezier(0.16,1,0.3,1)] motion-safe:origin-right"
        role="dialog"
        aria-modal="true"
        aria-label="Meetings attended"
      >
        <header className="sticky top-0 z-10 flex flex-col gap-5 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="flex items-start justify-between">
            <button
              type="button"
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading && !detail ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <Shimmer className="h-16 w-16 rounded-full" />
                <div className="flex-1">
                  <Shimmer className="mb-2 h-7 w-48" />
                  <Shimmer className="h-4 w-40" />
                </div>
              </div>
              <Shimmer className="h-20 w-full rounded-lg" />
            </div>
          ) : error && !detail ? (
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4">
              <p className="font-semibold text-[var(--admin-danger)]">{error}</p>
              <button
                type="button"
                className={`${secondaryButtonClassName} mt-3`}
                onClick={onRetry}
              >
                Retry
              </button>
            </div>
          ) : detail ? (
            <>
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-sm font-semibold text-[var(--admin-on-surface-variant)]">
                  {initials(detail.displayName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
                      {detail.displayName ?? "Unknown participant"}
                    </h2>
                    <StatusPill
                      tone={
                        detail.matchState === "matched"
                          ? "success"
                          : detail.matchState === "unmatched"
                            ? "warning"
                            : "muted"
                      }
                    >
                      {detail.matchState}
                    </StatusPill>
                  </div>
                  {detail.email ? (
                    <p className="mt-1 truncate font-mono text-xs text-[var(--admin-on-surface-variant)]">
                      {detail.email}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Total meetings
                  </p>
                  <p className="mt-1 text-base font-semibold text-[var(--admin-on-surface)]">
                    {formatCount(detail.totalMeetings)}
                  </p>
                </div>
                <div className="border-l border-[var(--admin-border)] pl-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Total time
                  </p>
                  <p className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface)]">
                    {formatDuration(detail.totalDurationSeconds)}
                  </p>
                </div>
                <div className="border-l border-[var(--admin-border)] pl-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Avg coverage
                  </p>
                  <p
                    className={[
                      "mt-1 font-mono text-[13px]",
                      (detail.avgCoveragePercent ?? 0) >= 80
                        ? "text-[var(--admin-success)]"
                        : "text-[var(--admin-on-surface)]",
                    ].join(" ")}
                  >
                    {detail.avgCoveragePercent != null
                      ? `${detail.avgCoveragePercent.toFixed(0)}%`
                      : "—"}
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Attendance pulse
                  </p>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    {formatDateShort(dateInputToStartIso(attendedFrom) ?? null)} –{" "}
                    {formatDateShort(dateInputToEndIso(attendedTo) ?? null)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {detail.attendancePulse.map((cell) => {
                    const tone =
                      cell.state === "high"
                        ? "bg-[var(--admin-success)]"
                        : cell.state === "partial"
                          ? "bg-[var(--admin-warning)]"
                          : cell.state === "missed"
                            ? "border border-[var(--admin-border)] bg-[var(--admin-surface-low)]"
                            : "border border-[var(--admin-border)] bg-transparent opacity-40";
                    return (
                      <div
                        key={cell.date}
                        title={`${cell.date}: ${cell.state}${
                          cell.coveragePercent != null
                            ? ` · ${cell.coveragePercent.toFixed(0)}%`
                            : ""
                        }`}
                        className={`h-2 w-2 rounded-[1px] transition-transform hover:scale-150 ${tone}`}
                      />
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--admin-on-surface-variant)]">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-[1px] bg-[var(--admin-success)]" /> High
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-[1px] bg-[var(--admin-warning)]" /> Partial
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-[1px] border border-[var(--admin-border)] bg-[var(--admin-surface-low)]" />{" "}
                    None
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </header>

        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <h3 className="mb-3 text-base font-semibold text-[var(--admin-on-surface)]">
            Meeting history
          </h3>
          {detail && detail.meetings.length === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              No meetings in this range.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--admin-border)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <tr>
                    <th className="px-3 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Topic / ID
                    </th>
                    <th className="px-3 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Date
                    </th>
                    <th className="px-3 py-2.5 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Duration
                    </th>
                    <th className="px-3 py-2.5 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Rejoins
                    </th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]">
                  {(detail?.meetings ?? []).map((meeting) => (
                    <tr
                      key={meeting.meetingId}
                      className="group h-11 transition-colors hover:bg-[var(--admin-surface-high)]"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/admin/reports/zoom-insights/${meeting.meetingId}`}
                          className="block max-w-[140px] truncate font-medium text-[var(--admin-primary)] hover:underline"
                          title={meeting.topic ?? meeting.externalMeetingId}
                        >
                          {meeting.topic ?? "Untitled meeting"}
                        </Link>
                        <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                          {meeting.externalMeetingId}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[13px] text-[var(--admin-on-surface)]">
                        {formatDateTimeShort(meeting.startedAt)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-mono text-[13px]">
                            {formatDuration(meeting.durationSeconds)}
                          </span>
                          <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
                            <div
                              className={[
                                "h-full rounded-full",
                                (meeting.coveragePercent ?? 0) >= 80
                                  ? "bg-[var(--admin-success)]"
                                  : (meeting.coveragePercent ?? 0) >= 40
                                    ? "bg-[var(--admin-warning)]"
                                    : "bg-[var(--admin-danger)]",
                              ].join(" ")}
                              style={{
                                width: `${String(Math.max(0, Math.min(100, meeting.coveragePercent ?? 0)))}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={[
                            "inline-flex min-w-[24px] items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[12px]",
                            meeting.rejoinCount > 0
                              ? "border-[color-mix(in_srgb,var(--admin-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]"
                              : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]",
                          ].join(" ")}
                        >
                          {meeting.rejoinCount}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/admin/reports/zoom-insights/${meeting.meetingId}/participants/${meeting.participantId}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--admin-primary)] opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          View <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-[var(--admin-border)] p-4">
          {detail?.representativeMeetingId && detail.representativeParticipantId ? (
            <Link
              href={`/admin/reports/zoom-insights/${detail.representativeMeetingId}/participants/${detail.representativeParticipantId}`}
              className={secondaryButtonClassName}
            >
              Open participant detail
            </Link>
          ) : null}
          <button type="button" className={secondaryButtonClassName} onClick={onClose}>
            Close
          </button>
        </footer>
      </aside>
    </div>
  );
}

export function AdminZoomInsightsParticipantsPage() {
  const router = useRouter();
  const searchId = useId();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [people, setPeople] = useState<ZoomPersonListItem[]>([]);
  const [connection, setConnection] = useState<ZoomConnectionMeta | null>(null);
  const [summary, setSummary] = useState<ZoomPeopleSummary | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const initialRange = useMemo(() => presetToRange("30d"), []);
  const [attendedFrom, setAttendedFrom] = useState(initialRange.from);
  const [attendedTo, setAttendedTo] = useState(initialRange.to);
  const [draftSearch, setDraftSearch] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [matchState, setMatchState] = useState<"all" | ZoomMatchState>(() => {
    if (typeof window === "undefined") return "all";
    const param = new URLSearchParams(window.location.search).get("matchState");
    return param === "matched" || param === "unmatched" || param === "guest" ? param : "all";
  });
  const [meetingsFilter, setMeetingsFilter] = useState<"any" | "once" | "multi">("any");
  const [coverageFilter, setCoverageFilter] = useState<"any" | "low" | "mid" | "high">("any");
  const [sortBy, setSortBy] = useState<SortBy>("meetings_attended");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerKey, setDrawerKey] = useState<string | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<ZoomPersonMeetingsDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const meetingsMin = meetingsFilter === "once" ? 1 : meetingsFilter === "multi" ? 2 : undefined;
  const meetingsMax = meetingsFilter === "once" ? 1 : undefined;
  const coverageMin =
    coverageFilter === "low"
      ? undefined
      : coverageFilter === "mid"
        ? 40
        : coverageFilter === "high"
          ? 80
          : undefined;
  const coverageMax =
    coverageFilter === "low" ? 39.999 : coverageFilter === "mid" ? 79.999 : undefined;

  const loadPeople = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchZoomPeopleRoster({
        q: searchQ || undefined,
        attendedFrom: dateInputToStartIso(attendedFrom),
        attendedTo: dateInputToEndIso(attendedTo),
        matchState,
        meetingsMin,
        meetingsMax,
        coverageMin,
        coverageMax,
        sortBy,
        sortDir,
        page,
        limit: pageSize,
      });
      setPeople(response.data.items);
      setConnection(response.data.connection);
      setSummary(response.data.summary);
      setTotalPages(response.data.pageInfo.totalPages);
      setTotalCount(response.data.pageInfo.totalCount);
      setSelectedKeys([]);
    } catch (err) {
      const message =
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't load participant data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    attendedFrom,
    attendedTo,
    coverageMax,
    coverageMin,
    matchState,
    meetingsMax,
    meetingsMin,
    page,
    pageSize,
    searchQ,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  const loadDrawer = useCallback(
    async (identityKey: string) => {
      setDrawerLoading(true);
      setDrawerError(null);
      try {
        const response = await fetchZoomPersonMeetings({
          identityKey,
          attendedFrom: dateInputToStartIso(attendedFrom),
          attendedTo: dateInputToEndIso(attendedTo),
        });
        setDrawerDetail(response.data);
      } catch (err) {
        setDrawerDetail(null);
        setDrawerError(
          err instanceof ClientApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Couldn't load meeting history.",
        );
      } finally {
        setDrawerLoading(false);
      }
    },
    [attendedFrom, attendedTo],
  );

  const openDrawer = (identityKey: string) => {
    setDrawerKey(identityKey);
    setDrawerOpen(true);
    setDrawerDetail(null);
    void loadDrawer(identityKey);
  };

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "custom") return;
    const range = presetToRange(preset);
    setAttendedFrom(range.from);
    setAttendedTo(range.to);
    setPage(1);
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      const queued = await exportZoomInsightsReport({
        joinedFrom: dateInputToStartIso(attendedFrom),
        joinedTo: dateInputToEndIso(attendedTo),
        emailDownloadLink: false,
      });
      const run = await pollReportRunUntilComplete(queued.data.runId);
      if (run.status === "failed") {
        throw new Error(run.errorMessage ?? "Export failed.");
      }
      if (run.status === "completed") {
        await downloadReportExport(run.id, "csv");
      }
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Export failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReconnect = async () => {
    setBusy(true);
    try {
      await connectZoomAccount();
      await loadPeople();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Reconnect failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const allSelected = people.length > 0 && selectedKeys.length === people.length;
  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (matchState !== "all") {
    activeChips.push({
      key: "match",
      label: `Match state: ${matchState}`,
      clear: () => {
        setMatchState("all");
        setPage(1);
      },
    });
  }
  if (meetingsFilter !== "any") {
    activeChips.push({
      key: "meetings",
      label: meetingsFilter === "once" ? "Attended once only" : "Attended 2+ meetings",
      clear: () => {
        setMeetingsFilter("any");
        setPage(1);
      },
    });
  }
  if (coverageFilter !== "any") {
    activeChips.push({
      key: "coverage",
      label:
        coverageFilter === "low"
          ? "Coverage under 40%"
          : coverageFilter === "mid"
            ? "Coverage 40–80%"
            : "Coverage 80%+",
      clear: () => {
        setCoverageFilter("any");
        setPage(1);
      },
    });
  }
  if (searchQ) {
    activeChips.push({
      key: "q",
      label: `Search: ${searchQ}`,
      clear: () => {
        setDraftSearch("");
        setSearchQ("");
        setPage(1);
      },
    });
  }

  const emptyFiltered =
    !loading &&
    !error &&
    people.length === 0 &&
    (searchQ || matchState !== "all" || meetingsFilter !== "any" || coverageFilter !== "any");
  const emptyRange = !loading && !error && people.length === 0 && !emptyFiltered;

  const matchedRatio =
    summary && summary.peopleCount > 0 ? (summary.matchedCount / summary.peopleCount) * 100 : 0;
  const unmatchedRatio =
    summary && summary.peopleCount > 0
      ? ((summary.unmatchedCount + summary.guestCount) / summary.peopleCount) * 100
      : 0;
  const onceRatio =
    summary && summary.peopleCount > 0
      ? (summary.attendedOnceOnlyCount / summary.peopleCount) * 100
      : 0;

  const selectedPeople = people.filter((person) => selectedKeys.includes(person.identityKey));
  const firstUnmatched = selectedPeople.find((person) => person.matchState === "unmatched");

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-24">
      <div className="flex flex-col gap-1 text-xs text-[var(--admin-on-surface-variant)]">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin" className="hover:underline">
            Admin
          </Link>
          <span className="text-[var(--admin-on-surface-variant)]">/</span>
          <Link href="/admin/reports" className="hover:underline">
            Reports
          </Link>
          <span className="text-[var(--admin-on-surface-variant)]">/</span>
          <Link href="/admin/reports/zoom-insights" className="hover:underline">
            Zoom Insights
          </Link>
          <span className="text-[var(--admin-on-surface-variant)]">/</span>
          <span className="text-[var(--admin-on-surface)]">Participants</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="mb-1 text-sm font-semibold text-[var(--admin-on-surface)]">Zoom Insights</p>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Participants
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            Every person who has attended a Zoom meeting, across all meetings in range.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={datePreset}
            ariaLabel="Date range"
            onValueChange={(value) => {
              applyDatePreset(value as DatePreset);
            }}
            options={[
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "90d", label: "Last 90 days" },
              { value: "custom", label: "Custom" },
            ]}
            className={selectTriggerClassName}
          />
          {datePreset === "custom" ? (
            <>
              <input
                type="date"
                className={fieldClassName}
                value={attendedFrom}
                onChange={(event) => {
                  setAttendedFrom(event.target.value);
                  setPage(1);
                }}
              />
              <input
                type="date"
                className={fieldClassName}
                value={attendedTo}
                onChange={(event) => {
                  setAttendedTo(event.target.value);
                  setPage(1);
                }}
              />
            </>
          ) : null}
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy || loading}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            className={`${primaryButtonClassName} h-9`}
            onClick={() => {
              router.push("/admin/reports/zoom-insights/unmatched");
            }}
          >
            Reconcile unmatched
          </button>
        </div>
      </div>

      <ModuleTabs active="participants" />

      {connection && !loading ? (
        <ConnectionBanner
          connection={connection}
          syncing={busy || loading}
          onSync={() => void loadPeople()}
          onReconnect={() => void handleReconnect()}
        />
      ) : null}

      {error ? (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" />
              <div>
                <p className="font-semibold text-[var(--admin-danger)]">
                  Couldn&apos;t load participant data.
                </p>
                <p className="mt-1 text-sm text-[color-mix(in_srgb,var(--admin-danger)_75%,var(--admin-on-surface))]">
                  {error}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg bg-[var(--admin-danger)] px-4 py-1.5 text-sm font-semibold text-[var(--admin-on-danger)]"
              onClick={() => void loadPeople()}
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {loading && !summary ? (
        <PeopleLoadingSkeleton />
      ) : (
        <>
          {summary ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                <div className="flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-2">
                  <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">
                    People
                  </p>
                  <p className="my-3 font-mono text-[32px] leading-none text-[var(--admin-on-surface)]">
                    {formatCount(summary.peopleCount)}
                  </p>
                  <div>
                    <div className="mb-1.5 flex justify-between text-xs text-[var(--admin-on-surface-variant)]">
                      <span>{formatCount(summary.matchedCount)} matched</span>
                      <span>
                        {formatCount(summary.unmatchedCount + summary.guestCount)} unmatched
                      </span>
                    </div>
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                      <div
                        className="h-full bg-[var(--admin-primary)]"
                        style={{ width: `${String(matchedRatio)}%` }}
                      />
                      <div
                        className="h-full bg-[var(--admin-warning)]"
                        style={{ width: `${String(unmatchedRatio)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                  <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">
                    Meetings attended, average
                  </p>
                  <p className="mt-auto pt-4 font-mono text-2xl text-[var(--admin-on-surface)]">
                    {summary.avgMeetingsAttended != null
                      ? summary.avgMeetingsAttended.toFixed(1)
                      : "—"}
                  </p>
                </div>
                <div className="flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                  <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">
                    Total time
                  </p>
                  <p className="mt-auto pt-4 font-mono text-2xl text-[var(--admin-on-surface)]">
                    {formatDuration(summary.totalDurationSeconds)}
                  </p>
                </div>
                <div className="flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                  <p className="mb-2 text-sm font-medium text-[var(--admin-on-surface-variant)]">
                    Average coverage
                  </p>
                  <p className="mt-auto mb-2 font-mono text-2xl text-[var(--admin-on-surface)]">
                    {summary.avgCoveragePercent != null
                      ? `${summary.avgCoveragePercent.toFixed(1)}%`
                      : "—"}
                  </p>
                  <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                    <div
                      className="h-full bg-[var(--admin-success)]"
                      style={{
                        width: `${String(Math.max(0, Math.min(100, summary.avgCoveragePercent ?? 0)))}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                  <p className="mb-2 text-sm font-medium text-[var(--admin-on-surface-variant)]">
                    Attended once only
                  </p>
                  <p className="mt-auto mb-1 font-mono text-2xl text-[var(--admin-on-surface)]">
                    {formatCount(summary.attendedOnceOnlyCount)}
                  </p>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    {onceRatio.toFixed(1)}% of people
                  </p>
                </div>
              </div>
              <p className="-mt-2 text-right text-xs text-[var(--admin-on-surface-variant)]">
                Data reflects activity from{" "}
                {formatDateShort(dateInputToStartIso(attendedFrom) ?? null)} to{" "}
                {formatDateShort(dateInputToEndIso(attendedTo) ?? null)}.
              </p>
            </>
          ) : null}

          <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] max-w-xs flex-1">
                  <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
                  <input
                    id={searchId}
                    className={`${fieldClassName} w-full pl-9`}
                    placeholder="Search name or email…"
                    value={draftSearch}
                    onChange={(event) => {
                      setDraftSearch(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        setSearchQ(draftSearch.trim());
                        setPage(1);
                      }
                    }}
                  />
                </div>
                <Select
                  value={matchState}
                  ariaLabel="Match state"
                  onValueChange={(value) => {
                    setMatchState(value as "all" | ZoomMatchState);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: "Match state" },
                    { value: "matched", label: "Matched" },
                    { value: "unmatched", label: "Unmatched" },
                    { value: "guest", label: "Guest" },
                  ]}
                  className={selectTriggerClassName}
                />
                <Select
                  value={meetingsFilter}
                  ariaLabel="Meetings attended"
                  onValueChange={(value) => {
                    setMeetingsFilter(value as "any" | "once" | "multi");
                    setPage(1);
                  }}
                  options={[
                    { value: "any", label: "Meetings attended" },
                    { value: "once", label: "Once only" },
                    { value: "multi", label: "2 or more" },
                  ]}
                  className={selectTriggerClassName}
                />
                <Select
                  value={coverageFilter}
                  ariaLabel="Average coverage"
                  onValueChange={(value) => {
                    setCoverageFilter(value as "any" | "low" | "mid" | "high");
                    setPage(1);
                  }}
                  options={[
                    { value: "any", label: "Average coverage" },
                    { value: "low", label: "Under 40%" },
                    { value: "mid", label: "40–80%" },
                    { value: "high", label: "80%+" },
                  ]}
                  className={selectTriggerClassName}
                />
                <div className="ml-auto min-w-[12rem]">
                  <Select
                    value={`${sortBy}:${sortDir}`}
                    ariaLabel="Sort"
                    onValueChange={(value) => {
                      const [nextSort, nextDir] = value.split(":") as [SortBy, "asc" | "desc"];
                      setSortBy(nextSort);
                      setSortDir(nextDir);
                      setPage(1);
                    }}
                    options={[
                      { value: "meetings_attended:desc", label: "Sort: Meetings desc" },
                      { value: "meetings_attended:asc", label: "Sort: Meetings asc" },
                      { value: "display_name:asc", label: "Sort: Name A–Z" },
                      { value: "display_name:desc", label: "Sort: Name Z–A" },
                      { value: "avg_coverage:asc", label: "Sort: Coverage asc" },
                      { value: "avg_coverage:desc", label: "Sort: Coverage desc" },
                      { value: "total_time:desc", label: "Sort: Total time desc" },
                      { value: "last_seen:desc", label: "Sort: Last seen" },
                    ]}
                    className={`${selectTriggerClassName} w-full min-w-[12rem]`}
                  />
                </div>
              </div>
              {activeChips.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {activeChips.map((chip) => (
                    <div
                      key={chip.key}
                      className="inline-flex h-6 items-center rounded bg-[var(--admin-surface-high)] px-2 text-xs font-medium text-[var(--admin-on-surface)]"
                    >
                      {chip.label}
                      <button
                        type="button"
                        className="ml-1 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                        aria-label={`Clear ${chip.label}`}
                        onClick={chip.clear}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="h-6 px-2 text-xs font-medium text-[var(--admin-primary)] hover:underline"
                    onClick={() => {
                      setMatchState("all");
                      setMeetingsFilter("any");
                      setCoverageFilter("any");
                      setDraftSearch("");
                      setSearchQ("");
                      setPage(1);
                    }}
                  >
                    Clear all
                  </button>
                </div>
              ) : null}
            </div>

            {emptyRange || emptyFiltered ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center p-12 text-center">
                <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--admin-surface-low)]">
                  <Users className="h-12 w-12 text-[var(--admin-outline)]" />
                </div>
                <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                  {emptyFiltered
                    ? "No participants match these filters"
                    : "No participants in this range"}
                </h2>
                <p className="mb-8 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                  Try adjusting your filters or date range to see more people.
                </p>
                {emptyFiltered ? (
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    onClick={() => {
                      setMatchState("all");
                      setMeetingsFilter("any");
                      setCoverageFilter("any");
                      setDraftSearch("");
                      setSearchQ("");
                      setPage(1);
                    }}
                  >
                    Clear all filters
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                        <th className="sticky left-0 z-10 w-12 border-r border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                            checked={allSelected}
                            aria-label="Select all on page"
                            onChange={(event) => {
                              setSelectedKeys(
                                event.target.checked
                                  ? people.map((person) => person.identityKey)
                                  : [],
                              );
                            }}
                          />
                        </th>
                        <th className="sticky left-12 z-10 min-w-[280px] border-r border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Person
                        </th>
                        <th className="w-32 px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          State
                        </th>
                        <th className="w-32 px-4 py-3 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Meetings
                        </th>
                        <th className="w-24 px-4 py-3 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Total time
                        </th>
                        <th className="w-24 px-4 py-3 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Avg dur.
                        </th>
                        <th className="w-36 px-4 py-3 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Coverage
                        </th>
                        <th className="w-32 px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          First seen
                        </th>
                        <th className="w-32 px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Last seen
                        </th>
                        <th className="w-12 px-2 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--admin-border)]">
                      {people.map((person) => {
                        const selected = selectedKeys.includes(person.identityKey);
                        const unmatched = person.matchState === "unmatched";
                        const meetingShare =
                          person.meetingsInRange > 0
                            ? (person.meetingsAttended / person.meetingsInRange) * 100
                            : 0;
                        return (
                          <tr
                            key={person.identityKey}
                            className={[
                              "group h-[60px] transition-colors",
                              unmatched
                                ? "bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))]"
                                : "hover:bg-[var(--admin-surface-high)]",
                            ].join(" ")}
                          >
                            <td
                              className={[
                                "sticky left-0 z-10 border-r border-[var(--admin-border)] px-4 py-2 text-center",
                                unmatched
                                  ? "bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] group-hover:bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))]"
                                  : "bg-[var(--admin-surface)] group-hover:bg-[var(--admin-surface-high)]",
                              ].join(" ")}
                            >
                              <input
                                type="checkbox"
                                className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                                checked={selected}
                                aria-label={`Select ${person.displayName ?? "participant"}`}
                                onChange={(event) => {
                                  setSelectedKeys((current) =>
                                    event.target.checked
                                      ? [...current, person.identityKey]
                                      : current.filter((key) => key !== person.identityKey),
                                  );
                                }}
                              />
                            </td>
                            <td
                              className={[
                                "sticky left-12 z-10 border-r border-[var(--admin-border)] px-4 py-2",
                                unmatched
                                  ? "bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] group-hover:bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))]"
                                  : "bg-[var(--admin-surface)] group-hover:bg-[var(--admin-surface-high)]",
                              ].join(" ")}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
                                    {initials(person.displayName)}
                                  </div>
                                  <div className="min-w-0">
                                    <button
                                      type="button"
                                      className="truncate font-medium text-[var(--admin-primary)] hover:underline"
                                      onClick={() => {
                                        openDrawer(person.identityKey);
                                      }}
                                    >
                                      {person.displayName ?? "Unknown"}
                                    </button>
                                    {person.email ? (
                                      <p className="truncate font-mono text-xs text-[var(--admin-on-surface-variant)]">
                                        {person.email}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                                {unmatched ? (
                                  <Link
                                    href={`/admin/reports/zoom-insights/${person.representativeMeetingId}/participants/${person.representativeParticipantId}`}
                                    className="shrink-0 whitespace-nowrap rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-2 py-1 text-xs font-medium text-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)]"
                                  >
                                    Match to learner
                                  </Link>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <StatusPill
                                tone={
                                  person.matchState === "matched"
                                    ? "success"
                                    : person.matchState === "unmatched"
                                      ? "warning"
                                      : "muted"
                                }
                              >
                                {person.matchState}
                              </StatusPill>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                                {formatCount(person.meetingsAttended)}
                              </div>
                              <div className="text-[11px] text-[var(--admin-on-surface-variant)]">
                                of {formatCount(person.meetingsInRange)} in range
                              </div>
                              <div className="mt-1 ml-auto h-[3px] w-full max-w-[96px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                                <div
                                  className="ml-auto h-full bg-[var(--admin-outline)]"
                                  style={{ width: `${String(Math.min(100, meetingShare))}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                              {formatDuration(person.totalDurationSeconds)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                              {formatDuration(person.avgDurationSeconds)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <CoverageMeter percent={person.avgCoveragePercent} />
                            </td>
                            <td className="px-4 py-2 text-xs text-[var(--admin-on-surface-variant)]">
                              {formatDateShort(person.firstSeenAt)}
                            </td>
                            <td
                              className={[
                                "px-4 py-2 text-xs",
                                isStale(person.lastSeenAt)
                                  ? "text-[var(--admin-danger)]"
                                  : "text-[var(--admin-on-surface)]",
                              ].join(" ")}
                            >
                              <span className="inline-flex items-center gap-1">
                                {isStale(person.lastSeenAt) ? (
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                ) : null}
                                {formatRelative(person.lastSeenAt)}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <div className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                <DropdownMenu
                                  label={`Actions for ${person.displayName ?? "participant"}`}
                                  align="end"
                                  trigger={<MoreVertical className="h-5 w-5" aria-hidden="true" />}
                                  triggerClassName="h-8 w-8 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                                  contentClassName="admin-theme admin-dropdown-panel border-[var(--admin-border)] bg-[var(--admin-surface)]"
                                  itemClassName="text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                  items={[
                                    {
                                      key: "meetings",
                                      label: "View meetings",
                                      onSelect: () => {
                                        openDrawer(person.identityKey);
                                      },
                                    },
                                    {
                                      key: "detail",
                                      label: "Open detail",
                                      onSelect: () => {
                                        router.push(
                                          `/admin/reports/zoom-insights/${person.representativeMeetingId}/participants/${person.representativeParticipantId}`,
                                        );
                                      },
                                    },
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 text-sm text-[var(--admin-on-surface-variant)]">
                  <div>
                    Showing {totalCount === 0 ? 0 : formatCount((page - 1) * pageSize + 1)} to{" "}
                    {formatCount(Math.min(page * pageSize, totalCount))} of{" "}
                    {formatCount(totalCount)}
                    {matchState === "unmatched" ? " unmatched" : ""} participants
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      Rows per page:
                      <Select
                        value={String(pageSize)}
                        ariaLabel="Rows per page"
                        onValueChange={(value) => {
                          setPageSize(Number(value));
                          setPage(1);
                        }}
                        options={[
                          { value: "12", label: "12" },
                          { value: "25", label: "25" },
                          { value: "50", label: "50" },
                        ]}
                        className="h-8 min-w-[4.5rem] border border-[var(--admin-outline)] bg-[var(--admin-surface)] text-sm text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                      />
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                        disabled={page <= 1}
                        aria-label="Previous page"
                        onClick={() => {
                          setPage((current) => Math.max(1, current - 1));
                        }}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                        disabled={page >= totalPages}
                        aria-label="Next page"
                        onClick={() => {
                          setPage((current) => current + 1);
                        }}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {selectedKeys.length > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-lg bg-[var(--admin-surface-low)] px-6 py-3 text-[var(--admin-on-surface)] shadow-lg ring-1 ring-[var(--admin-border)] motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="font-medium">{formatCount(selectedKeys.length)} people selected</div>
          <div className="h-6 w-px bg-[var(--admin-outline)]" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] disabled:opacity-40"
              disabled={!firstUnmatched}
              onClick={() => {
                if (!firstUnmatched) return;
                router.push(
                  `/admin/reports/zoom-insights/${firstUnmatched.representativeMeetingId}/participants/${firstUnmatched.representativeParticipantId}`,
                );
              }}
            >
              Match selected
            </button>
            <button
              type="button"
              className="rounded px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)]"
              onClick={() => {
                const first = selectedPeople[0];
                if (first) openDrawer(first.identityKey);
              }}
            >
              View meetings
            </button>
          </div>
          <button
            type="button"
            className="ml-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
            aria-label="Clear selection"
            onClick={() => {
              setSelectedKeys([]);
            }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : null}

      <MeetingsAttendedDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerKey(null);
        }}
        detail={drawerDetail}
        loading={drawerLoading}
        error={drawerError}
        onRetry={() => {
          if (drawerKey) void loadDrawer(drawerKey);
        }}
        attendedFrom={attendedFrom}
        attendedTo={attendedTo}
      />

      {busy ? (
        <div className="fixed bottom-4 right-4 inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-xs text-[var(--admin-on-surface-variant)] shadow-lg">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Working…
        </div>
      ) : null}
    </div>
  );
}
