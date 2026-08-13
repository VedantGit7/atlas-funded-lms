"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type RefObject } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  MessageCircle,
  RefreshCw,
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
  InsightMessengerWhatsappBoard,
  InsightMessengerWhatsappCampaignRow,
  InsightMessengerWhatsappFailurePoint,
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
import { messengerStatusTone, type MessengerStatusTone } from "./messenger-insight-meta";

type MessengerInsightWhatsappViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightMessengerWhatsappBoard | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

type CampaignFilter = "all" | "failures";

function statusPillClass(tone: MessengerStatusTone): string {
  if (tone === "success") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (tone === "danger") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  if (tone === "warning") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
}

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

function sharePct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function whatsappCsv(board: InsightMessengerWhatsappBoard): string {
  const lines = [
    ["Metric", "Value"].map(csvEscape).join(","),
    [
      "Delivery rate %",
      board.headline.deliveryRatePct == null ? "-" : board.headline.deliveryRatePct,
    ]
      .map(csvEscape)
      .join(","),
    ["Campaigns sent", board.headline.campaignsSent].map(csvEscape).join(","),
    ["Delivered", board.headline.delivered].map(csvEscape).join(","),
    ["Failed", board.headline.failed].map(csvEscape).join(","),
    ["Scheduled", board.headline.scheduled].map(csvEscape).join(","),
    ["Connected", board.connected ? "yes" : "no"].map(csvEscape).join(","),
    ["Last send", board.lastSentAt ?? "-"].map(csvEscape).join(","),
    "",
    [
      "Campaign",
      "Status",
      "Recipients",
      "Delivered",
      "Failed",
      "Delivery rate %",
      "Below average",
      "Fully failed",
      "Sent",
    ]
      .map(csvEscape)
      .join(","),
    ...board.campaigns.rows.map((row) =>
      [
        row.title,
        row.status,
        row.recipients,
        row.delivered,
        row.failed,
        row.deliveryRatePct == null ? "-" : row.deliveryRatePct,
        row.belowAverage ? "yes" : "no",
        row.fullyFailed ? "yes" : "no",
        row.sentAt ?? "-",
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

function WhatsappSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading WhatsApp insight">
      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
        <Shimmer className="h-4 w-64" />
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
        <Shimmer className="mb-3 h-4 w-full" />
        <Shimmer className="h-3 w-72" />
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className={`${insightPanelClassName} p-5 lg:col-span-7`}>
          <Shimmer className="mb-4 h-5 w-40" />
          <Shimmer className="mb-4 h-40 w-full" />
          <Shimmer className="h-3 w-56" />
        </section>
        <section className={`${insightPanelClassName} p-5 lg:col-span-5`}>
          <Shimmer className="mb-4 h-5 w-32" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={String(index)} className="mb-4 space-y-2">
              <Shimmer className="h-4 w-40" />
              <Shimmer className="h-3 w-full" />
            </div>
          ))}
        </section>
      </div>
      <section className={insightPanelClassName}>
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
          <Shimmer className="h-5 w-44" />
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={String(index)}
            className="flex h-12 items-center gap-4 border-b border-[var(--admin-border)] px-5 last:border-b-0"
          >
            <Shimmer className="h-4 w-36" />
            <Shimmer className="h-4 w-16" />
            <Shimmer className="ml-auto h-4 w-14" />
            <Shimmer className="h-4 w-14" />
          </div>
        ))}
      </section>
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
          Unable to load WhatsApp insight
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
        className={insightSegmentButtonActiveClassName}
        aria-current="page"
      >
        WhatsApp
      </Link>
      <Link
        href={adminInsightInboxHref(slug)}
        prefetch={false}
        className={insightSegmentButtonClassName}
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

function ShareBar({
  pct,
  tone = "primary",
}: {
  pct: number | null;
  tone?: "primary" | "success" | "warning" | "danger" | "muted";
}) {
  if (pct == null) return null;
  const width = Math.min(Math.max(pct, 0), 100);
  const toneClass =
    tone === "success"
      ? "bg-[var(--admin-success)]"
      : tone === "warning"
        ? "bg-[var(--admin-warning)]"
        : tone === "danger"
          ? "bg-[var(--admin-danger)]"
          : tone === "muted"
            ? "bg-[color-mix(in_srgb,var(--admin-outline)_70%,var(--admin-surface))]"
            : "bg-[var(--admin-primary)]";
  return (
    <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
      <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${String(width)}%` }} />
    </div>
  );
}

function ConnectionBanner({ board }: { board: InsightMessengerWhatsappBoard }) {
  if (board.connected) {
    return (
      <div
        role="status"
        className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface-variant)]"
      >
        <span>
          WhatsApp connected
          {board.lastSentAt ? ` · last send ${formatRelativeTime(board.lastSentAt)}` : ""}
        </span>
        <span className="text-[11px] uppercase tracking-wide text-[var(--admin-outline)]">
          Fixed reporting window
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] border-l-4 border-l-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--admin-on-surface)]">
            WhatsApp is not connected.
          </p>
          <p className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">
            {board.historical
              ? "The figures below are historical and will not update until a connection is restored."
              : "Connect WhatsApp to start reporting delivery outcomes."}
          </p>
        </div>
      </div>
      <Link
        href={board.settingsHref}
        prefetch={false}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--admin-warning)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--admin-warning)]/40 active:translate-y-px"
      >
        Reconnect WhatsApp
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

function EmptyState({ settingsHref, connected }: { settingsHref: string; connected: boolean }) {
  return (
    <section
      className={`${insightPanelClassName} flex flex-col items-center justify-center px-6 py-16 text-center`}
      aria-label="No WhatsApp campaigns"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
        <MessageCircle
          className="h-7 w-7 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
      </div>
      <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
        No WhatsApp campaigns sent
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--admin-on-surface-variant)]">
        {connected
          ? "Your WhatsApp channel is connected but has not been used yet. Send a campaign to populate delivery outcomes on this screen."
          : "WhatsApp is the only outbound channel that reports per-send delivery and failure counts. Connect the integration and send a campaign to populate this screen."}
      </p>
      <Link
        href={settingsHref}
        prefetch={false}
        className={`${insightPrimaryButtonClassName} mt-6`}
      >
        WhatsApp settings
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

function HeadlineBand({
  board,
  onFailedClick,
}: {
  board: InsightMessengerWhatsappBoard;
  onFailedClick: () => void;
}) {
  const rate = board.headline.deliveryRatePct;
  return (
    <section
      className="grid grid-cols-1 overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] md:grid-cols-12"
      aria-label="WhatsApp headline"
    >
      <div className="flex flex-col justify-between p-5 md:col-span-4 md:p-6">
        <div>
          <p className={insightKpiLabelClassName}>Delivery rate</p>
          <p className={`${insightKpiValueClassName} text-[2rem] leading-none`}>
            {rate == null ? "-" : `${formatInsightNumber(rate, 1)}%`}
          </p>
          <ShareBar pct={rate} tone="success" />
        </div>
        <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
          {board.headline.deliveryRateCaption ?? "No recipients recorded"}
        </p>
      </div>
      <div className="border-t border-[var(--admin-border)] p-5 md:col-span-2 md:border-l md:border-t-0 md:p-6">
        <p className={insightKpiLabelClassName}>Campaigns sent</p>
        <p className={insightKpiValueClassName}>
          {formatInsightNumber(board.headline.campaignsSent)}
        </p>
      </div>
      <div className="border-t border-[var(--admin-border)] p-5 md:col-span-2 md:border-l md:border-t-0 md:p-6">
        <p className={insightKpiLabelClassName}>Delivered</p>
        <p className={`${insightKpiValueClassName} text-[var(--admin-success)]`}>
          {formatInsightNumber(board.headline.delivered)}
        </p>
      </div>
      <div className="border-t border-[var(--admin-border)] p-5 md:col-span-2 md:border-l md:border-t-0 md:p-6">
        <p className={insightKpiLabelClassName}>Failed</p>
        <button
          type="button"
          className="group w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          onClick={onFailedClick}
        >
          <p
            className={`${insightKpiValueClassName} text-[var(--admin-danger)] group-hover:underline`}
          >
            {formatInsightNumber(board.headline.failed)}
          </p>
          {board.headline.failedSharePct != null ? (
            <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
              {formatInsightNumber(board.headline.failedSharePct, 1)}% of recipients
            </p>
          ) : null}
        </button>
      </div>
      <div className="border-t border-[var(--admin-border)] p-5 md:col-span-2 md:border-l md:border-t-0 md:p-6">
        <p className={insightKpiLabelClassName}>Scheduled</p>
        <p className={insightKpiValueClassName}>{formatInsightNumber(board.headline.scheduled)}</p>
      </div>
    </section>
  );
}

function CompositionPanel({ board }: { board: InsightMessengerWhatsappBoard }) {
  const { delivered, failed, pending, recipients } = board.composition;
  const deliveredPct = sharePct(delivered, recipients);
  const failedPct = sharePct(failed, recipients);
  const pendingPct = sharePct(pending, recipients);
  const perfect = board.perfectDelivery;

  return (
    <section className={`${insightPanelClassName} p-5 md:p-6`} aria-label="Delivery composition">
      <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
        Delivery composition
      </h2>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
        {perfect ? (
          <div className="h-full w-full bg-[var(--admin-success)]" aria-hidden="true" />
        ) : (
          <>
            {delivered > 0 ? (
              <div
                className="h-full bg-[var(--admin-success)]"
                style={{ width: `${String(deliveredPct)}%` }}
                aria-hidden="true"
              />
            ) : null}
            {failed > 0 ? (
              <div
                className="h-full bg-[var(--admin-danger)]"
                style={{ width: `${String(failedPct)}%` }}
                aria-hidden="true"
              />
            ) : null}
            {pending > 0 ? (
              <div
                className="h-full border border-[var(--admin-outline)] bg-transparent"
                style={{ width: `${String(pendingPct)}%` }}
                aria-hidden="true"
              />
            ) : null}
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--admin-on-surface-variant)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--admin-success)]" aria-hidden="true" />
          Delivered {formatInsightNumber(delivered)}
          {recipients > 0 ? ` · ${formatInsightNumber(deliveredPct, 1)}%` : ""}
        </span>
        {failed > 0 || !perfect ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[var(--admin-danger)]" aria-hidden="true" />
            Failed {formatInsightNumber(failed)}
            {recipients > 0 ? ` · ${formatInsightNumber(failedPct, 1)}%` : ""}
          </span>
        ) : null}
        {pending > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm border border-[var(--admin-outline)]"
              aria-hidden="true"
            />
            Pending {formatInsightNumber(pending)}
            {recipients > 0 ? ` · ${formatInsightNumber(pendingPct, 1)}%` : ""}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--admin-on-surface-variant)]">
        {board.composition.caption}
      </p>
    </section>
  );
}

function FailuresChart({ points }: { points: InsightMessengerWhatsappFailurePoint[] }) {
  const maxTotal = Math.max(...points.map((day) => day.delivered + day.failed), 1);

  return (
    <div className="flex h-40 w-full items-end gap-1 border-b border-[var(--admin-border)] pb-1">
      {points.map((day) => {
        const total = day.delivered + day.failed;
        if (total <= 0) {
          return (
            <div
              key={day.period}
              className="flex flex-1 flex-col items-center justify-end"
              title={`${day.period}: no sends`}
            >
              <div
                className="h-3 w-2 rounded-sm border border-dashed border-[var(--admin-outline)] bg-transparent"
                aria-hidden="true"
              />
            </div>
          );
        }

        const totalHeightPct = Math.max(8, (total / maxTotal) * 100);
        const failedHeightPct = day.failed > 0 ? (day.failed / total) * 100 : 0;
        const deliveredHeightPct = 100 - failedHeightPct;

        return (
          <div
            key={day.period}
            className="group flex flex-1 flex-col items-center justify-end"
            title={`${day.period}: ${String(day.delivered)} delivered, ${String(day.failed)} failed`}
          >
            <div
              className="flex w-full max-w-[18px] flex-col justify-end overflow-hidden rounded-t-sm"
              style={{ height: `${String(totalHeightPct)}%` }}
            >
              {day.failed > 0 ? (
                <div
                  className="w-full bg-[var(--admin-warning)]"
                  style={{ height: `${String(failedHeightPct)}%` }}
                  aria-hidden="true"
                />
              ) : null}
              <div
                className="w-full bg-[var(--admin-primary)]"
                style={{ height: `${String(deliveredHeightPct)}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FailurePanel({ board }: { board: InsightMessengerWhatsappBoard }) {
  if (board.perfectDelivery) {
    return (
      <section
        className={`${insightPanelClassName} flex items-center gap-3 p-5 md:p-6`}
        aria-label="Failures over time"
      >
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--admin-success)]" aria-hidden="true" />
        <p className="text-sm font-medium text-[var(--admin-success)]">
          No delivery failures recorded in this window
        </p>
      </section>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <section
        className={`${insightPanelClassName} p-5 md:p-6 lg:col-span-7`}
        aria-label="Failures over time"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              Failures over time
            </h2>
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              Delivered and failed recipients by day over the last 30 days.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--admin-on-surface-variant)]">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm bg-[var(--admin-primary)]"
                aria-hidden="true"
              />
              Delivered
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm bg-[var(--admin-warning)]"
                aria-hidden="true"
              />
              Failed
            </span>
          </div>
        </div>
        <FailuresChart points={board.failures.points} />
        {board.failures.points.length > 0 ? (
          <div className="mt-2 flex justify-between px-0.5 text-[10px] text-[var(--admin-on-surface-variant)]">
            <span>{formatPeriodShort(board.failures.points[0]?.period)}</span>
            <span>
              {formatPeriodShort(
                board.failures.points[Math.floor(board.failures.points.length / 2)]?.period,
              )}
            </span>
            <span>
              {formatPeriodShort(board.failures.points[board.failures.points.length - 1]?.period)}
            </span>
          </div>
        ) : null}
        {board.failures.caption ? (
          <p className="mt-3 text-xs leading-5 text-[var(--admin-on-surface-variant)]">
            {board.failures.caption}
          </p>
        ) : null}
      </section>

      <section
        className={`${insightPanelClassName} flex flex-col p-5 md:p-6 lg:col-span-5`}
        aria-label="What to check"
      >
        <h2 className="mb-1 text-base font-semibold text-[var(--admin-on-surface)]">
          What to check
        </h2>
        <p className="mb-4 text-xs leading-5 text-[var(--admin-on-surface-variant)]">
          {board.guidance.caption}
        </p>
        <ul className="flex flex-col gap-1">
          {board.guidance.items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                prefetch={false}
                className="group flex items-start justify-between gap-3 rounded-lg px-2 py-2.5 outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--admin-on-surface)]">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-[var(--admin-on-surface-variant)]">
                    {item.description}
                  </p>
                </div>
                <ChevronRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] group-hover:text-[var(--admin-on-surface)]"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CampaignTable({
  board,
  filter,
  tableRef,
  onClearFilter,
}: {
  board: InsightMessengerWhatsappBoard;
  filter: CampaignFilter;
  tableRef: RefObject<HTMLElement | null>;
  onClearFilter: () => void;
}) {
  const rows =
    filter === "failures"
      ? board.campaigns.rows.filter((row) => row.failed > 0 || row.fullyFailed)
      : board.campaigns.rows;

  return (
    <section
      ref={tableRef}
      className={insightPanelClassName}
      aria-label="Recent WhatsApp campaigns"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Recent campaigns
          </h2>
          {board.campaigns.averageDeliveryRatePct != null ? (
            <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
              Tenant average delivery rate{" "}
              {formatInsightNumber(board.campaigns.averageDeliveryRatePct, 1)}%
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filter === "failures" ? (
            <>
              <span className="rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] px-2 py-1 text-[11px] font-medium text-[var(--admin-danger)]">
                Showing campaigns with failures
              </span>
              <button type="button" className={insightGhostButtonClassName} onClick={onClearFilter}>
                Clear filter
              </button>
            </>
          ) : null}
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead className={insightTableHeadClassName}>
            <tr>
              <th className="px-5 py-3 font-medium">Campaign</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Recipients</th>
              <th className="px-3 py-3 font-medium">Delivered</th>
              <th className="px-3 py-3 font-medium">Failed</th>
              <th className="px-3 py-3 font-medium">Delivery rate</th>
              <th className="px-3 py-3 font-medium">Sent</th>
              <th className="w-10 px-3 py-3" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-8 text-center text-[var(--admin-on-surface-variant)]"
                >
                  {filter === "failures"
                    ? "No campaigns with failures in this list."
                    : "No recent WhatsApp campaigns."}
                </td>
              </tr>
            ) : (
              rows.map((row) => <CampaignRow key={row.id} row={row} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CampaignRow({ row }: { row: InsightMessengerWhatsappCampaignRow }) {
  const tone = messengerStatusTone(row.status);
  const railClass = row.fullyFailed
    ? "border-l-4 border-l-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_6%,transparent)]"
    : row.belowAverage
      ? "border-l-4 border-l-[var(--admin-warning)]"
      : "";

  return (
    <tr className={`${insightTableRowClassName} ${railClass}`}>
      <td className="px-5 py-3">
        <Link
          href={row.href}
          prefetch={false}
          className={`font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${
            row.fullyFailed ? "text-[var(--admin-danger)]" : "text-[var(--admin-primary)]"
          }`}
        >
          {row.title}
        </Link>
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 font-data text-[11px] uppercase tracking-wide ${statusPillClass(tone)}`}
        >
          {row.status}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="font-data text-[var(--admin-on-surface)]">
          {formatInsightNumber(row.recipients)}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="font-data text-[var(--admin-on-surface)]">
          {formatInsightNumber(row.delivered)}
        </span>
        <ShareBar
          pct={row.recipients > 0 ? sharePct(row.delivered, row.recipients) : null}
          tone="success"
        />
      </td>
      <td className="px-3 py-3">
        <span
          className={`font-data ${
            row.failed > 0 ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface)]"
          }`}
        >
          {formatInsightNumber(row.failed)}
        </span>
      </td>
      <td className="px-3 py-3">
        {row.deliveryRatePct == null ? (
          <div>
            <span className="font-data text-[var(--admin-on-surface-variant)]">-</span>
            <p className="mt-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
              No recipients recorded
            </p>
          </div>
        ) : (
          <div>
            <span
              className={`font-data ${
                row.belowAverage ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface)]"
              }`}
            >
              {formatInsightNumber(row.deliveryRatePct, 1)}%
            </span>
            <ShareBar pct={row.deliveryRatePct} tone={row.belowAverage ? "warning" : "success"} />
          </div>
        )}
      </td>
      <td className="px-3 py-3">
        {row.sentAt ? (
          <div>
            <div className="font-data text-sm text-[var(--admin-on-surface)]">
              {formatRelativeTime(row.sentAt)}
            </div>
            <div className="font-data text-[11px] text-[var(--admin-on-surface-variant)]">
              {formatAbsoluteDate(row.sentAt)}
            </div>
          </div>
        ) : (
          <span className="font-data text-[var(--admin-on-surface-variant)]">-</span>
        )}
      </td>
      <td className="px-3 py-3">
        <Link
          href={row.href}
          prefetch={false}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          aria-label={`Open ${row.title}`}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}

export function MessengerInsightWhatsappView({
  slug,
  sectionTitle,
  board,
  loading,
  error,
  onRefresh,
}: MessengerInsightWhatsappViewProps) {
  const [copied, setCopied] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>("all");
  const tableRef = useRef<HTMLElement | null>(null);
  const csv = useMemo(() => (board ? whatsappCsv(board) : ""), [board]);

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

  const scrollToFailures = () => {
    setCampaignFilter("failures");
    window.requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        <span className="font-medium text-[var(--admin-on-surface)]">WhatsApp</span>
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
            <h1 className={insightPageTitleClassName}>{board?.title ?? "WhatsApp"}</h1>
            {board?.historical ? (
              <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-data text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Historical
              </span>
            ) : null}
            {board?.perfectDelivery && !board.empty ? (
              <span className="inline-flex items-center gap-1 rounded border border-[color-mix(in_srgb,var(--admin-success)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] px-2 py-0.5 font-data text-[11px] uppercase tracking-wide text-[var(--admin-success)]">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Optimal
              </span>
            ) : null}
          </div>
          <p className={insightPageDescClassName}>
            {board?.subtitle ?? "The only channel that reports per-send delivery outcomes."}
          </p>
          <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
            WhatsApp figures use fixed windows from campaign history.
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
              downloadCsv("messenger-whatsapp.csv", csv);
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>
          <Link
            href={board?.settingsHref ?? "/admin/marketing/messenger/whatsapp"}
            prefetch={false}
            className={insightPrimaryButtonClassName}
          >
            WhatsApp settings
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}
      {loading && !board ? <WhatsappSkeleton /> : null}

      {board ? (
        <>
          <ConnectionBanner board={board} />

          {board.empty ? (
            <EmptyState settingsHref={board.settingsHref} connected={board.connected} />
          ) : (
            <>
              <HeadlineBand board={board} onFailedClick={scrollToFailures} />
              <CompositionPanel board={board} />
              <FailurePanel board={board} />
              <CampaignTable
                board={board}
                filter={campaignFilter}
                tableRef={tableRef}
                onClearFilter={() => {
                  setCampaignFilter("all");
                }}
              />
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
