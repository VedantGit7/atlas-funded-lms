"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Inbox,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  ADMIN_INSIGHTS_HREF,
  adminInsightAlertsHref,
  adminInsightChannelsHref,
  adminInsightHref,
  adminInsightInboxHref,
  adminInsightWhatsappHref,
} from "./admin-insights-catalog";
import type {
  InsightMessengerInboxBoard,
  InsightMessengerInboxConversationRow,
  InsightMessengerInboxVolumePoint,
} from "./admin-insights-api";
import { csvEscape, formatInsightNumber, formatRelativeTime } from "./admin-insights-format";
import {
  insightBreadcrumbClassName,
  insightGhostButtonClassName,
  insightKpiLabelClassName,
  insightKpiValueClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPageTitleClassName,
  insightPanelClassName,
  insightPrimaryButtonClassName,
  insightSegmentButtonActiveClassName,
  insightSegmentButtonClassName,
  insightSegmentTrackClassName,
  insightShimmerClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";

type MessengerInsightInboxViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightMessengerInboxBoard | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function formatAbsoluteDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPeriodShort(period: string | undefined): string {
  if (!period) return "";
  const date = new Date(`${period}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Human duration: `1h 14m`, `8d 4h`, `45m`, `12s`. */
function formatHumanDuration(totalSeconds: number | null): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "-";
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return hours > 0 ? `${String(days)}d ${String(hours)}h` : `${String(days)}d`;
  if (hours > 0) {
    return minutes > 0 ? `${String(hours)}h ${String(minutes)}m` : `${String(hours)}h`;
  }
  if (minutes > 0) return `${String(minutes)}m`;
  return `${String(seconds)}s`;
}

function inboxCsv(board: InsightMessengerInboxBoard): string {
  const lines = [
    ["Metric", "Value"].map(csvEscape).join(","),
    ["Inbox messages", board.headline.inboxMessages].map(csvEscape).join(","),
    ["Inbox messages (30d)", board.headline.inboxMessages30d].map(csvEscape).join(","),
    ["Open conversations", board.headline.openConversations].map(csvEscape).join(","),
    ["Average per day", board.headline.averagePerDay == null ? "-" : board.headline.averagePerDay]
      .map(csvEscape)
      .join(","),
    [
      "Busiest day",
      board.headline.busiestDay
        ? `${board.headline.busiestDay.period} (${String(board.headline.busiestDay.count)})`
        : "-",
    ]
      .map(csvEscape)
      .join(","),
    [
      "Median first reply (s)",
      board.responseTime.medianFirstReplySeconds == null
        ? "-"
        : board.responseTime.medianFirstReplySeconds,
    ]
      .map(csvEscape)
      .join(","),
    [
      "Longest first reply (s)",
      board.responseTime.longestFirstReplySeconds == null
        ? "-"
        : board.responseTime.longestFirstReplySeconds,
    ]
      .map(csvEscape)
      .join(","),
    [
      "Longest waiting (s)",
      board.responseTime.longestWaitingSeconds == null
        ? "-"
        : board.responseTime.longestWaitingSeconds,
    ]
      .map(csvEscape)
      .join(","),
    "",
    ["Learner", "Messages", "Last message", "Waiting on", "Past 48h"].map(csvEscape).join(","),
    ...board.conversations.rows.map((row) =>
      [
        row.learnerName,
        row.messageCount,
        row.lastMessageAt,
        row.waitingOn === "us" ? "Us" : "Learner",
        row.waitingPast48h ? "yes" : "no",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  return lines.join("\n");
}

function Shimmer({ className, widthPct }: { className: string; widthPct?: number }) {
  return (
    <div
      className={`${insightShimmerClassName} ${className}`}
      style={widthPct != null ? { width: `${String(widthPct)}%` } : undefined}
    />
  );
}

function InboxSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading inbox insight">
      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
        <Shimmer className="h-4 w-80" />
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] md:grid-cols-12 md:divide-x md:divide-y-0">
          {Array.from({ length: 5 }).map((_, index) => (
            <section
              key={String(index)}
              className={`flex min-w-0 flex-col gap-2 p-5 md:p-6 ${
                index === 0 ? "md:col-span-4" : "md:col-span-2"
              }`}
            >
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-8 w-20" />
              <Shimmer className="h-3 w-28" />
            </section>
          ))}
        </div>
      </div>
      <section className={`${insightPanelClassName} p-5`}>
        <Shimmer className="mb-4 h-5 w-40" />
        <Shimmer className="mb-3 h-32 w-full" />
        <Shimmer className="h-3 w-72" />
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className={`${insightPanelClassName} p-5 lg:col-span-7`}>
          <Shimmer className="mb-4 h-5 w-44" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={String(index)}
              className="mb-3 flex items-center gap-4 border-b border-[var(--admin-border)] pb-3 last:mb-0 last:border-b-0"
            >
              <Shimmer className="h-4 w-36" />
              <Shimmer className="h-4 w-12" />
              <Shimmer className="ml-auto h-4 w-20" />
            </div>
          ))}
        </section>
        <div className="flex flex-col gap-6 lg:col-span-5">
          <section className={`${insightPanelClassName} p-5`}>
            <Shimmer className="mb-4 h-5 w-32" />
            <Shimmer className="mb-3 h-8 w-24" />
            <Shimmer className="h-24 w-full" />
          </section>
          <section className={`${insightPanelClassName} p-5`}>
            <Shimmer className="h-4 w-full" />
          </section>
        </div>
      </div>
    </div>
  );
}

function ErrorStrip({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-4 rounded border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]">
        <AlertCircle className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-[var(--admin-danger)]">
          Unable to load inbox insight
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">{message}</p>
        <button
          type="button"
          className={`${insightGhostButtonClassName} mt-4 border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-outline))] text-[var(--admin-danger)]`}
          onClick={onRetry}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry connection
        </button>
      </div>
    </div>
  );
}

function LocalTabs({ slug }: { slug: string }) {
  return (
    <div
      className={`${insightSegmentTrackClassName} w-fit`}
      role="tablist"
      aria-label="Messenger modules"
    >
      <Link
        href={adminInsightHref(slug)}
        prefetch={false}
        className={insightSegmentButtonClassName}
      >
        Overview
      </Link>
      <Link
        href={adminInsightChannelsHref(slug)}
        prefetch={false}
        className={insightSegmentButtonClassName}
      >
        Channels
      </Link>
      <Link
        href={adminInsightWhatsappHref(slug)}
        prefetch={false}
        className={insightSegmentButtonClassName}
      >
        WhatsApp
      </Link>
      <Link
        href={adminInsightInboxHref(slug)}
        prefetch={false}
        className={insightSegmentButtonActiveClassName}
        aria-current="page"
      >
        Inbox
      </Link>
      <Link
        href={adminInsightAlertsHref(slug)}
        prefetch={false}
        className={insightSegmentButtonClassName}
      >
        Alerts
      </Link>
    </div>
  );
}

function DirectionNote({ note }: { note: string }) {
  return (
    <div
      role="note"
      className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]"
    >
      {note}
    </div>
  );
}

function EmptyCanvas() {
  return (
    <section
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center"
      aria-label="Empty inbox"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
        <Inbox
          className="h-7 w-7 text-[var(--admin-outline)]"
          aria-hidden="true"
          strokeWidth={1.25}
        />
      </div>
      <p className="text-base font-medium text-[var(--admin-on-surface)]">
        No inbound messages in this window
      </p>
      <p className="mt-1 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Learner replies and open conversations will appear here once messaging starts.
      </p>
    </section>
  );
}

function HeadlineBand({ board }: { board: InsightMessengerInboxBoard }) {
  const openTone =
    board.headline.openConversations > 0
      ? "text-[var(--admin-warning)]"
      : board.allClear
        ? "text-[var(--admin-success)]"
        : "text-[var(--admin-on-surface)]";

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] md:grid-cols-12 md:divide-x md:divide-y-0">
        <section className="flex min-w-0 flex-col gap-1 p-5 md:col-span-4 md:p-6">
          <p className={insightKpiLabelClassName}>Inbox messages</p>
          <p className={`${insightKpiValueClassName} font-data text-[32px] leading-9`}>
            {formatInsightNumber(board.headline.inboxMessages)}
          </p>
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            {board.headline.inboxMessagesCaption}
          </p>
        </section>
        <section className="flex min-w-0 flex-col gap-1 p-5 md:col-span-2 md:p-6">
          <p className={insightKpiLabelClassName}>Open conversations</p>
          <p className={`${insightKpiValueClassName} font-data ${openTone}`}>
            {formatInsightNumber(board.headline.openConversations)}
          </p>
        </section>
        <section className="flex min-w-0 flex-col gap-1 p-5 md:col-span-2 md:p-6">
          <p className={insightKpiLabelClassName}>Messages (30d)</p>
          <p className={`${insightKpiValueClassName} font-data`}>
            {formatInsightNumber(board.headline.messages30d)}
          </p>
        </section>
        <section className="flex min-w-0 flex-col gap-1 p-5 md:col-span-2 md:p-6">
          <p className={insightKpiLabelClassName}>Average per day</p>
          <p className={`${insightKpiValueClassName} font-data`}>
            {board.headline.averagePerDay == null
              ? "-"
              : formatInsightNumber(board.headline.averagePerDay, 1)}
          </p>
        </section>
        <section className="flex min-w-0 flex-col gap-1 p-5 md:col-span-2 md:p-6">
          <p className={insightKpiLabelClassName}>Busiest day</p>
          {board.headline.busiestDay ? (
            <>
              <p className={`${insightKpiValueClassName} font-data text-lg`}>
                {formatPeriodShort(board.headline.busiestDay.period)}
              </p>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                {formatInsightNumber(board.headline.busiestDay.count)} messages
              </p>
            </>
          ) : (
            <p className={`${insightKpiValueClassName} font-data`}>-</p>
          )}
        </section>
      </div>
    </div>
  );
}

function VolumeBars({
  points,
  mean,
  caption,
}: {
  points: InsightMessengerInboxVolumePoint[];
  mean: number | null;
  caption: string | null;
}) {
  const max = Math.max(...points.map((point) => point.count), 1);
  const meanPct = mean != null && max > 0 ? Math.min((mean / max) * 100, 100) : null;

  return (
    <section className={`${insightPanelClassName} p-5`} aria-label="Inbound volume">
      <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
        Daily inbound volume (30d)
      </h3>
      <div className="relative flex h-40 items-end gap-px sm:gap-0.5">
        {meanPct != null && mean != null ? (
          <>
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-[var(--admin-outline)]"
              style={{ bottom: `${String(meanPct)}%` }}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute right-0 z-20 rounded bg-[var(--admin-surface)] px-1 font-data text-[10px] text-[var(--admin-on-surface-variant)]"
              style={{ bottom: `calc(${String(meanPct)}% + 2px)` }}
            >
              Mean {formatInsightNumber(mean, 1)}
            </span>
          </>
        ) : null}
        {points.map((point) => {
          const heightPct = point.count <= 0 ? 0 : Math.max((point.count / max) * 100, 4);
          return (
            <div
              key={point.period}
              className={`relative flex h-full min-w-0 flex-1 flex-col justify-end ${
                point.isWeekend ? "bg-[var(--admin-surface-low)]" : ""
              }`}
              title={`${formatPeriodShort(point.period)}: ${formatInsightNumber(point.count)}`}
            >
              {point.count <= 0 ? (
                <div
                  className="mx-auto mb-0 h-1.5 w-1.5 rounded-full border border-[var(--admin-outline)] bg-transparent"
                  aria-hidden="true"
                />
              ) : (
                <div
                  className="mx-auto w-[70%] max-w-3 rounded-t-sm bg-[var(--admin-primary)]"
                  style={{ height: `${String(heightPct)}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
      {caption ? (
        <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">{caption}</p>
      ) : null}
    </section>
  );
}

function WaitingChip({
  waitingOn,
  waitingPast48h,
}: {
  waitingOn: "us" | "learner";
  waitingPast48h?: boolean;
}) {
  if (waitingOn === "us") {
    const stale = Boolean(waitingPast48h);
    return (
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 font-data text-[11px] uppercase tracking-wide ${
          stale
            ? "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]"
            : "border-[color-mix(in_srgb,var(--admin-primary)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] text-[var(--admin-primary)]"
        }`}
      >
        Us
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-data text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
      Learner
    </span>
  );
}

function ConversationRow({ row }: { row: InsightMessengerInboxConversationRow }) {
  const railClass = row.waitingPast48h
    ? "border-l-4 border-l-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_6%,transparent)]"
    : "";
  const timeClass = row.waitingPast48h
    ? "text-[var(--admin-warning)]"
    : "text-[var(--admin-on-surface)]";

  return (
    <tr className={`${insightTableRowClassName} ${railClass}`}>
      <td className="px-5 py-3">
        <Link
          href={row.href}
          prefetch={false}
          className="font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
        >
          {row.learnerName}
        </Link>
        {row.lastMessagePreview ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--admin-on-surface-variant)]">
            {row.lastMessagePreview}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <span className="font-data text-[var(--admin-on-surface)]">
          {formatInsightNumber(row.messageCount)}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className={`font-data text-sm ${timeClass}`}>
          {formatRelativeTime(row.lastMessageAt)}
        </div>
        <div className="font-data text-[11px] text-[var(--admin-on-surface-variant)]">
          {formatAbsoluteDate(row.lastMessageAt)}
        </div>
      </td>
      <td className="px-3 py-3">
        <WaitingChip waitingOn={row.waitingOn} waitingPast48h={row.waitingPast48h} />
      </td>
      <td className="px-3 py-3">
        <Link
          href={row.href}
          prefetch={false}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          aria-label={`Open conversation with ${row.learnerName}`}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}

function ConversationCard({ row }: { row: InsightMessengerInboxConversationRow }) {
  const railClass = row.waitingPast48h
    ? "border-l-4 border-l-[var(--admin-warning)]"
    : "border-l-4 border-l-transparent";
  const timeClass = row.waitingPast48h
    ? "text-[var(--admin-warning)]"
    : "text-[var(--admin-on-surface-variant)]";

  return (
    <Link
      href={row.href}
      prefetch={false}
      className={`block border-b border-[var(--admin-border)] px-4 py-3 outline-none last:border-b-0 hover:bg-[var(--admin-surface-low)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-primary)]/30 ${railClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-[var(--admin-primary)]">{row.learnerName}</p>
          {row.lastMessagePreview ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--admin-on-surface-variant)]">
              {row.lastMessagePreview}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <WaitingChip waitingOn={row.waitingOn} waitingPast48h={row.waitingPast48h} />
            <span className="font-data text-[11px] text-[var(--admin-on-surface-variant)]">
              {formatInsightNumber(row.messageCount)} msgs
            </span>
            <span className={`font-data text-[11px] ${timeClass}`}>
              {formatRelativeTime(row.lastMessageAt)}
            </span>
          </div>
        </div>
        <ChevronRight
          className="mt-1 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

function ConversationsPanel({
  board,
  filter,
  onFilterChange,
}: {
  board: InsightMessengerInboxBoard;
  filter: string;
  onFilterChange: (value: string) => void;
}) {
  const query = filter.trim().toLowerCase();
  const rows =
    query.length === 0
      ? board.conversations.rows
      : board.conversations.rows.filter(
          (row) =>
            row.learnerName.toLowerCase().includes(query) ||
            row.lastMessagePreview.toLowerCase().includes(query),
        );

  if (board.allClear) {
    return (
      <section
        className={`${insightPanelClassName} flex flex-col justify-center p-6`}
        aria-label="Open conversations"
      >
        <h3 className="mb-3 text-base font-semibold text-[var(--admin-on-surface)]">
          Open conversations
        </h3>
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-success)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] px-4 py-3"
        >
          <CheckCircle2
            className="h-5 w-5 shrink-0 text-[var(--admin-success)]"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-[var(--admin-success)]">No open conversations</p>
        </div>
      </section>
    );
  }

  return (
    <section className={insightPanelClassName} aria-label="Open conversations">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Open conversations
          </h3>
          <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
            {formatInsightNumber(board.conversations.totalOpen)} open - oldest waiting first
          </p>
        </div>
        <label className="relative block w-full max-w-xs">
          <span className="sr-only">Filter conversations</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-outline)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filter}
            onChange={(event) => {
              onFilterChange(event.target.value);
            }}
            placeholder="Filter by learner or message"
            className="w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 pl-8 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          />
        </label>
      </header>

      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className={insightTableHeadClassName}>
              <tr>
                <th className="px-5 py-3 font-medium">Conversation</th>
                <th className="px-3 py-3 font-medium">Messages</th>
                <th className="px-3 py-3 font-medium">Last message</th>
                <th className="px-3 py-3 font-medium">Waiting on</th>
                <th className="w-10 px-3 py-3" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-[var(--admin-on-surface-variant)]"
                  >
                    {query
                      ? "No conversations match this filter."
                      : "No open conversations in this list."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => <ConversationRow key={row.id} row={row} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
            {query ? "No conversations match this filter." : "No open conversations in this list."}
          </p>
        ) : (
          rows.map((row) => <ConversationCard key={row.id} row={row} />)
        )}
      </div>
    </section>
  );
}

function ResponseTimePanel({ board }: { board: InsightMessengerInboxBoard }) {
  const { responseTime } = board;
  const maxBucket = Math.max(...responseTime.buckets.map((bucket) => bucket.count), 1);

  return (
    <section className={`${insightPanelClassName} p-5`} aria-label="Response time">
      <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Response time</h3>
      {!responseTime.available ? (
        <p className="text-sm text-[var(--admin-on-surface-variant)]">No first-reply samples yet</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={insightKpiLabelClassName}>Median first reply</p>
              <p className="mt-1 font-data text-2xl text-[var(--admin-on-surface)]">
                {formatHumanDuration(responseTime.medianFirstReplySeconds)}
              </p>
            </div>
            <div>
              <p className={insightKpiLabelClassName}>Longest first reply</p>
              <p className="mt-1 font-data text-2xl text-[var(--admin-on-surface)]">
                {formatHumanDuration(responseTime.longestFirstReplySeconds)}
              </p>
            </div>
          </div>
          {responseTime.longestWaitingSeconds != null ? (
            <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
              Longest open wait (waiting on us):{" "}
              <span className="font-data text-[var(--admin-warning)]">
                {formatHumanDuration(responseTime.longestWaitingSeconds)}
              </span>
            </p>
          ) : null}
          <div className="mt-5 space-y-2">
            {responseTime.buckets.map((bucket) => {
              const width = Math.round((bucket.count / maxBucket) * 100);
              const barTone =
                bucket.id === "24h+"
                  ? "bg-[var(--admin-warning)]"
                  : bucket.id === "0-1h"
                    ? "bg-[var(--admin-success)]"
                    : "bg-[var(--admin-primary)]";
              return (
                <div key={bucket.id} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-right font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                    {bucket.label}
                  </span>
                  <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-[var(--admin-surface-low)]">
                    <div
                      className={`h-full rounded-sm ${barTone}`}
                      style={{ width: `${String(Math.max(width, bucket.count > 0 ? 4 : 0))}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-data text-[11px] text-[var(--admin-on-surface)]">
                    {bucket.sharePct == null
                      ? formatInsightNumber(bucket.count)
                      : `${formatInsightNumber(bucket.sharePct, 1)}%`}
                  </span>
                </div>
              );
            })}
          </div>
          {responseTime.caption ? (
            <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
              {responseTime.caption}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function NoAlertingPanel({ board }: { board: InsightMessengerInboxBoard }) {
  return (
    <Link
      href={board.noAlerting.href}
      prefetch={false}
      className="flex items-start justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-4 outline-none hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_60%,var(--admin-surface-low))] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--admin-on-surface)]">No alerting here</p>
        <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
          {board.noAlerting.caption}
        </p>
      </div>
      <ChevronRight
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
        aria-hidden="true"
      />
    </Link>
  );
}

export function MessengerInsightInboxView({
  slug,
  sectionTitle,
  board,
  loading,
  error,
  onRefresh,
}: MessengerInsightInboxViewProps) {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState("");
  const csv = useMemo(() => (board ? inboxCsv(board) : ""), [board]);

  const onCopy = () => {
    if (!csv) return;
    void copyText(csv).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    });
  };

  return (
    <div className={insightPageClassName} aria-busy={loading}>
      <nav className={insightBreadcrumbClassName} aria-label="Breadcrumb">
        <Link href="/admin" prefetch={false} className="hover:text-[var(--admin-on-surface)]">
          Admin
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <Link
          href={ADMIN_INSIGHTS_HREF}
          prefetch={false}
          className="hover:text-[var(--admin-on-surface)]"
        >
          Insights
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <Link
          href={adminInsightHref(slug)}
          prefetch={false}
          className="hover:text-[var(--admin-on-surface)]"
        >
          {sectionTitle}
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <span className="font-medium text-[var(--admin-on-surface)]">Inbox</span>
      </nav>

      <LocalTabs slug={slug} />

      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Link
              href={adminInsightHref(slug)}
              prefetch={false}
              className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              aria-label={`Back to ${sectionTitle}`}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className={insightPageTitleClassName}>{board?.title ?? "Inbox"}</h1>
            {board?.allClear ? (
              <span className="inline-flex items-center gap-1 rounded border border-[color-mix(in_srgb,var(--admin-success)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] px-2 py-0.5 font-data text-[11px] uppercase tracking-wide text-[var(--admin-success)]">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                All clear
              </span>
            ) : null}
          </div>
          <p className={insightPageDescClassName}>
            {board?.subtitle ?? "What learners are sending in, and what is still waiting."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!board}
            onClick={onCopy}
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy as CSV"}
          </button>
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!board}
            onClick={() => {
              if (!csv) return;
              downloadCsv("messenger-inbox.csv", csv);
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>
          <Link
            href={board?.inboxHref ?? "/admin/messenger"}
            prefetch={false}
            className={insightPrimaryButtonClassName}
          >
            Open the inbox
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}
      {loading && !board ? <InboxSkeleton /> : null}

      {board ? (
        <>
          <DirectionNote note={board.directionNote} />

          {board.allClear ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-success)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] px-4 py-3"
            >
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-success)]"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-[var(--admin-success)]">
                  Open conversations 0
                </p>
                <p className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">
                  Inbox is clear. Historical volume and response times remain below for context.
                </p>
              </div>
            </div>
          ) : null}

          {board.empty ? (
            <>
              <HeadlineBand board={board} />
              <EmptyCanvas />
              <NoAlertingPanel board={board} />
            </>
          ) : (
            <>
              <HeadlineBand board={board} />
              <VolumeBars
                points={board.volume.points}
                mean={board.volume.mean}
                caption={board.volume.caption}
              />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <ConversationsPanel board={board} filter={filter} onFilterChange={setFilter} />
                </div>
                <div className="flex flex-col gap-6 lg:col-span-5">
                  <ResponseTimePanel board={board} />
                  <NoAlertingPanel board={board} />
                </div>
              </div>
            </>
          )}
        </>
      ) : null}

      {!loading && !board && !error ? (
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
          No inbox data available.
        </div>
      ) : null}
    </div>
  );
}
