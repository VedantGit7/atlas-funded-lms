"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Download,
  Info,
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
  InsightMessengerChannelsBoard,
  InsightMessengerChannelsComparisonRow,
  InsightMessengerChannelsVolumePoint,
} from "./admin-insights-api";
import {
  csvEscape,
  formatInsightNumber,
  formatPeriodLabel,
  formatRelativeTime,
} from "./admin-insights-format";
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

type MessengerInsightChannelsViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightMessengerChannelsBoard | null;
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

function compactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return formatInsightNumber(value);
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

function channelsCsv(board: InsightMessengerChannelsBoard): string {
  const lines = [
    [
      "Channel",
      "Direction",
      "Sends",
      "Recipients",
      "Recipients per send",
      "Share of outbound reach %",
      "Last send",
      "Messages",
      "Open conversations",
    ]
      .map(csvEscape)
      .join(","),
  ];
  for (const row of board.table.outbound) {
    lines.push(
      [
        row.label,
        "Outbound",
        row.sends,
        row.recipients,
        row.recipientsPerSend ?? "-",
        row.reachSharePct,
        row.lastSentAt ?? "-",
        "-",
        "-",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  for (const row of board.table.inbound) {
    lines.push(
      [row.label, "Inbound", "-", "-", "-", "-", "-", row.messageCount, row.openConversations]
        .map(csvEscape)
        .join(","),
    );
  }
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

function ChannelsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading messenger channels">
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className={`${insightPanelClassName} p-5 lg:col-span-1`}>
          <Shimmer className="mb-4 h-5 w-40" />
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={String(index)} className="mb-5 space-y-2">
              <Shimmer className="h-4 w-24" />
              <Shimmer className="h-2 w-full" widthPct={70} />
              <Shimmer className="h-2 w-full" widthPct={55} />
            </div>
          ))}
        </section>
        <section className={`${insightPanelClassName} p-5 lg:col-span-2`}>
          <Shimmer className="mb-4 h-5 w-48" />
          <Shimmer className="mb-4 h-[240px] w-full" />
          <Shimmer className="h-3 w-full max-w-xl" />
        </section>
      </div>
      <section className={insightPanelClassName}>
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
          <Shimmer className="h-5 w-36" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={String(index)}
            className="flex h-12 items-center gap-4 border-b border-[var(--admin-border)] px-5 last:border-b-0"
          >
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-4 w-20" />
            <Shimmer className="ml-auto h-4 w-16" />
            <Shimmer className="h-4 w-16" />
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
          Unable to load messenger channels
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
        className={insightSegmentButtonActiveClassName}
        aria-current="page"
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

function ShareBar({ pct, tone }: { pct: number; tone: "muted" | "primary" }) {
  const width = Math.min(Math.max(pct, 0), 100);
  return (
    <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
      <div
        className={`h-full rounded-full ${
          tone === "primary"
            ? "bg-[var(--admin-primary)]"
            : "bg-[color-mix(in_srgb,var(--admin-outline)_70%,var(--admin-surface))]"
        }`}
        style={{ width: `${String(width)}%` }}
      />
    </div>
  );
}

function ComparisonPanel({ board }: { board: InsightMessengerChannelsBoard }) {
  const rows = board.comparison.rows;
  const maxSends = Math.max(...rows.map((row) => row.sends), 1);
  const maxRecipients = Math.max(...rows.map((row) => row.recipients), 1);

  return (
    <section
      className={`${insightPanelClassName} flex flex-col p-5`}
      aria-label="Channel efficiency"
    >
      <h3 className="mb-1 text-base font-semibold text-[var(--admin-on-surface)]">
        Channel efficiency
      </h3>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px] text-[var(--admin-on-surface-variant)]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-3 rounded-sm bg-[color-mix(in_srgb,var(--admin-outline)_65%,var(--admin-surface))]"
            aria-hidden="true"
          />
          Sends
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-[var(--admin-primary)]" aria-hidden="true" />
          Recipients
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-10 text-center">
          <p className="text-sm font-medium text-[var(--admin-on-surface)]">
            No outbound activity yet
          </p>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            Email, push, WhatsApp, and announcement sends will appear here once campaigns go out.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-5">
          {rows.map((row) => (
            <ComparisonRow
              key={row.id}
              row={row}
              sendWidth={(row.sends / maxSends) * 100}
              reachWidth={(row.recipients / maxRecipients) * 100}
            />
          ))}
          {board.unusedCaption ? (
            <p className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-xs text-[var(--admin-on-surface-variant)]">
              {board.unusedCaption}{" "}
              <Link
                href={board.manageCampaignsHref}
                prefetch={false}
                className="font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              >
                Configure campaigns
              </Link>
            </p>
          ) : null}
          {board.comparison.caption ? (
            <p className="mt-auto border-t border-[var(--admin-border)] pt-3 text-xs text-[var(--admin-on-surface-variant)]">
              {board.comparison.caption} Top bar: sends. Bottom bar: recipients.
            </p>
          ) : (
            <p className="mt-auto border-t border-[var(--admin-border)] pt-3 text-xs text-[var(--admin-on-surface-variant)]">
              Sends and recipients use separate scales within each row. Top bar: sends. Bottom bar:
              recipients.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function ComparisonRow({
  row,
  sendWidth,
  reachWidth,
}: {
  row: InsightMessengerChannelsComparisonRow;
  sendWidth: number;
  reachWidth: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <Link
          href={row.href}
          prefetch={false}
          className="text-sm font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
        >
          {row.label}
        </Link>
        <span className="font-data text-[11px] text-[var(--admin-on-surface-variant)]">
          {row.recipientsPerSend == null
            ? "No sends yet"
            : `${formatInsightNumber(row.recipientsPerSend, 1)} recipients / send`}
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
            <div
              className="h-full rounded-full bg-[color-mix(in_srgb,var(--admin-outline)_65%,var(--admin-surface))]"
              style={{ width: `${String(Math.max(sendWidth, row.sends > 0 ? 4 : 0))}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right font-data text-xs text-[var(--admin-on-surface-variant)]">
            {formatInsightNumber(row.sends)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
            <div
              className="h-full rounded-full bg-[var(--admin-primary)]"
              style={{ width: `${String(Math.max(reachWidth, row.recipients > 0 ? 4 : 0))}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right font-data text-xs text-[var(--admin-on-surface)]">
            {formatInsightNumber(row.recipients)}
          </span>
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
        <span>Sends</span>
        <span>Recipients</span>
      </div>
    </div>
  );
}

function DualAxisChannelsVolume({
  points,
  averageOutbound,
  caption,
  outboundOnly,
}: {
  points: InsightMessengerChannelsVolumePoint[];
  averageOutbound: number | null;
  caption: string;
  outboundOnly: boolean;
}) {
  if (points.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-12 text-center">
        <p className="text-sm font-medium text-[var(--admin-on-surface)]">
          Awaiting messaging activity
        </p>
        <p className="mt-1 max-w-sm text-xs text-[var(--admin-on-surface-variant)]">
          Outbound reach and inbound replies will plot here as campaigns and inbox traffic start.
        </p>
      </div>
    );
  }

  const width = 720;
  const height = 260;
  const padL = 44;
  const padR = outboundOnly ? 16 : 44;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const outboundMax = Math.max(
    ...points.flatMap((row) => [row.email, row.push, row.whatsapp, row.outboundTotal]),
    averageOutbound ?? 0,
    1,
  );
  const inboundMax = Math.max(...points.map((row) => row.inbox), 1);

  const toX = (index: number) =>
    padL + (points.length <= 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const toYLeft = (value: number) => padT + plotH - (value / outboundMax) * plotH;
  const toYRight = (value: number) => padT + plotH - (value / inboundMax) * plotH;

  const buildPath = (key: "email" | "push" | "whatsapp") =>
    points
      .map((row, index) => {
        const x = toX(index);
        const y = toYLeft(row[key]);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  const inboxPath = points
    .map((row, index) => {
      const x = toX(index);
      const y = toYRight(row.inbox);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const leftTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: padT + plotH - ratio * plotH,
    label: compactNumber(Math.round(outboundMax * ratio)),
  }));
  const rightTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: padT + plotH - ratio * plotH,
    label: compactNumber(Math.round(inboundMax * ratio)),
  }));

  const meanY = averageOutbound != null && averageOutbound > 0 ? toYLeft(averageOutbound) : null;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--admin-on-surface-variant)]">
        <span className="font-semibold text-[var(--admin-on-surface)]">Outbound reach</span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-3 bg-[var(--admin-primary)]" />
          Email
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-3 bg-[color-mix(in_srgb,var(--admin-primary)_60%,var(--admin-surface))]" />
          Push
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-3 bg-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-outline))]" />
          WhatsApp
        </span>
        {meanY != null ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-0 w-3 border-t border-dashed border-[var(--admin-primary)]" />
            Mean outbound
          </span>
        ) : null}
        {!outboundOnly ? (
          <>
            <span
              className="mx-1 hidden h-3 w-px bg-[var(--admin-border)] sm:inline-block"
              aria-hidden="true"
            />
            <span className="font-semibold text-[var(--admin-on-surface)]">Inbound</span>
            <span className="inline-flex items-center gap-2">
              <span className="h-0 w-3 border-t border-dashed border-[var(--admin-on-surface-variant)]" />
              Inbox messages
            </span>
          </>
        ) : null}
      </div>
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className="h-[240px] w-full sm:h-[260px]"
        role="img"
        aria-label={
          outboundOnly
            ? "Daily outbound messaging volume"
            : "Daily messaging volume: outbound reach on left axis, inbox messages on right axis"
        }
      >
        {leftTicks.map((tick) => (
          <g key={`grid-${tick.label}-${tick.y}`}>
            <line
              x1={padL}
              y1={tick.y}
              x2={width - padR}
              y2={tick.y}
              stroke="color-mix(in srgb, var(--admin-border) 70%, transparent)"
              strokeWidth={1}
            />
            <text
              x={padL - 8}
              y={tick.y + 3}
              textAnchor="end"
              fill="var(--admin-on-surface-variant)"
              fontSize={10}
              fontFamily="var(--font-data, ui-monospace)"
            >
              {tick.label}
            </text>
          </g>
        ))}
        {!outboundOnly
          ? rightTicks.map((tick) => (
              <text
                key={`right-${tick.label}-${tick.y}`}
                x={width - padR + 8}
                y={tick.y + 3}
                textAnchor="start"
                fill="var(--admin-on-surface-variant)"
                fontSize={10}
                fontFamily="var(--font-data, ui-monospace)"
              >
                {tick.label}
              </text>
            ))
          : null}
        <line
          x1={padL}
          y1={padT + plotH}
          x2={width - padR}
          y2={padT + plotH}
          stroke="var(--admin-border)"
          strokeWidth={1}
        />
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + plotH}
          stroke="var(--admin-border)"
          strokeWidth={1}
        />
        {!outboundOnly ? (
          <line
            x1={width - padR}
            y1={padT}
            x2={width - padR}
            y2={padT + plotH}
            stroke="var(--admin-border)"
            strokeWidth={1}
          />
        ) : null}
        {meanY != null ? (
          <line
            x1={padL}
            y1={meanY}
            x2={width - padR}
            y2={meanY}
            stroke="var(--admin-primary)"
            strokeWidth={1.25}
            strokeDasharray="4 4"
            opacity={0.55}
          />
        ) : null}
        <path
          d={buildPath("email")}
          fill="none"
          stroke="var(--admin-primary)"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={buildPath("push")}
          fill="none"
          stroke="color-mix(in srgb, var(--admin-primary) 60%, var(--admin-surface))"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
        <path
          d={buildPath("whatsapp")}
          fill="none"
          stroke="color-mix(in srgb, var(--admin-primary) 35%, var(--admin-outline))"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
        {!outboundOnly ? (
          <path
            d={inboxPath}
            fill="none"
            stroke="var(--admin-on-surface-variant)"
            strokeWidth={1.75}
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {points.map((row, index) =>
          index === 0 ||
          index === points.length - 1 ||
          index % Math.max(1, Math.floor(points.length / 4)) === 0 ? (
            <text
              key={`${row.period}-${String(index)}`}
              x={toX(index)}
              y={height - 6}
              textAnchor="middle"
              fill="var(--admin-on-surface-variant)"
              fontSize={10}
              fontFamily="var(--font-data, ui-monospace)"
            >
              {formatPeriodLabel(row.period, "30d")}
            </text>
          ) : null,
        )}
      </svg>
      <p className="text-center text-xs text-[var(--admin-on-surface-variant)]">{caption}</p>
      {!outboundOnly ? (
        <p className="text-center text-[11px] text-[var(--admin-warning)]">
          Left and right axes use different units and must not be added together.
        </p>
      ) : null}
    </div>
  );
}

function VolumePanel({
  board,
  outboundOnly,
  onToggleOutboundOnly,
}: {
  board: InsightMessengerChannelsBoard;
  outboundOnly: boolean;
  onToggleOutboundOnly: () => void;
}) {
  return (
    <section className={`${insightPanelClassName} flex flex-col p-5`} aria-label="Daily volume">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
          Daily volume (30d)
        </h3>
        <button
          type="button"
          className={insightGhostButtonClassName}
          onClick={onToggleOutboundOnly}
          aria-pressed={outboundOnly}
        >
          {outboundOnly ? "Show inbox axis" : "Show outbound only"}
        </button>
      </div>
      <DualAxisChannelsVolume
        points={board.volume.points}
        averageOutbound={board.volume.averageOutbound}
        caption={board.volumeCaption}
        outboundOnly={outboundOnly}
      />
    </section>
  );
}

function ChannelTable({ board }: { board: InsightMessengerChannelsBoard }) {
  const hasOutbound = board.table.outbound.length > 0;
  const hasInbound = board.table.inbound.length > 0;

  if (!hasOutbound && !hasInbound) {
    return (
      <section className={`${insightPanelClassName} p-8 text-center`} aria-label="Channel table">
        <p className="text-sm font-medium text-[var(--admin-on-surface)]">
          No channel activity yet
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs text-[var(--admin-on-surface-variant)]">
          Outbound campaigns and inbox messages will list here once messaging starts.
        </p>
      </section>
    );
  }

  return (
    <section className={insightPanelClassName} aria-label="Channel table">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
        <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Channels</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr>
              <th className={`${insightTableHeadClassName} px-5 py-3`}>Channel</th>
              <th className={`${insightTableHeadClassName} px-5 py-3`}>Direction</th>
              <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Sends</th>
              <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Recipients</th>
              <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>
                Recipients / send
              </th>
              <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>
                Share of reach
              </th>
              <th className={`${insightTableHeadClassName} px-5 py-3 text-right`}>Last send</th>
              <th className={`${insightTableHeadClassName} px-5 py-3`}>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {board.table.outbound.map((row) => (
              <tr key={row.id} className={insightTableRowClassName}>
                <td className="px-5 py-3">
                  <Link
                    href={row.href}
                    prefetch={false}
                    className="text-sm font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                  >
                    {row.label}
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-data text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Outbound
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="font-data text-sm text-[var(--admin-on-surface)]">
                    {formatInsightNumber(row.sends)}
                  </span>
                  <ShareBar pct={row.sendSharePct} tone="muted" />
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="font-data text-sm text-[var(--admin-on-surface)]">
                    {formatInsightNumber(row.recipients)}
                  </span>
                  <ShareBar pct={row.reachSharePct} tone="primary" />
                </td>
                <td className="px-5 py-3 text-right font-data text-sm text-[var(--admin-on-surface)]">
                  {row.recipientsPerSend == null
                    ? "-"
                    : formatInsightNumber(row.recipientsPerSend, 1)}
                </td>
                <td className="px-5 py-3 text-right font-data text-sm text-[var(--admin-on-surface)]">
                  {formatInsightNumber(row.reachSharePct, 1)}%
                </td>
                <td className="px-5 py-3 text-right">
                  {row.lastSentAt ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-data text-sm text-[var(--admin-on-surface)]">
                        {formatRelativeTime(row.lastSentAt)}
                      </span>
                      <span className="font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                        {formatAbsoluteDate(row.lastSentAt)}
                      </span>
                    </div>
                  ) : (
                    <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
                      -
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={row.href}
                    prefetch={false}
                    className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                    aria-label={`Open ${row.label}`}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
            {hasOutbound && hasInbound ? (
              <tr aria-hidden="true">
                <td colSpan={8} className="px-5 py-0">
                  <div className="border-t border-[var(--admin-border)]" />
                </td>
              </tr>
            ) : null}
            {board.table.inbound.map((row) => (
              <tr key={row.id} className={insightTableRowClassName}>
                <td className="px-5 py-3">
                  <Link
                    href={row.href}
                    prefetch={false}
                    className="text-sm font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                  >
                    {row.label}
                  </Link>
                  <p className="mt-0.5 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                    {formatInsightNumber(row.messageCount)} messages ·{" "}
                    {formatInsightNumber(row.openConversations)} open
                  </p>
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex rounded border border-[color-mix(in_srgb,var(--admin-primary)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,transparent)] px-2 py-0.5 font-data text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-primary)]">
                    Inbound
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
                    -
                  </span>
                  <p className="mt-0.5 text-[10px] text-[var(--admin-on-surface-variant)]">
                    Not applicable to inbound
                  </p>
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
                    -
                  </span>
                  <p className="mt-0.5 text-[10px] text-[var(--admin-on-surface-variant)]">
                    Not applicable to inbound
                  </p>
                </td>
                <td className="px-5 py-3 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                  -
                </td>
                <td className="px-5 py-3 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                  -
                </td>
                <td className="px-5 py-3 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                  -
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={row.href}
                    prefetch={false}
                    className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                    aria-label="Open inbox"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function MessengerInsightChannelsView({
  slug,
  sectionTitle,
  board,
  loading,
  error,
  onRefresh,
}: MessengerInsightChannelsViewProps) {
  const [copied, setCopied] = useState(false);
  const [outboundOnly, setOutboundOnly] = useState(false);
  const csv = useMemo(() => (board ? channelsCsv(board) : ""), [board]);

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
        <span className="font-medium text-[var(--admin-on-surface)]">Channels</span>
      </nav>

      <LocalTabs slug={slug} />

      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Link
              href={adminInsightHref(slug)}
              prefetch={false}
              className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              aria-label={`Back to ${sectionTitle}`}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className={insightPageTitleClassName}>{board?.title ?? "Channels"}</h1>
          </div>
          <p className={insightPageDescClassName}>
            {board?.subtitle ?? "What each channel sends, who it reaches, and how that has moved."}
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
              downloadCsv("messenger-channels.csv", csv);
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>
          <Link
            href={board?.manageCampaignsHref ?? "/admin/marketing/messenger/email"}
            prefetch={false}
            className={insightPrimaryButtonClassName}
          >
            Manage campaigns
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}
      {loading && !board ? <ChannelsSkeleton /> : null}

      {board ? (
        <>
          <div
            role="note"
            className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-sm text-[var(--admin-on-surface-variant)]"
          >
            <Info
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <p>{board.caveat}</p>
          </div>

          <section
            className="grid grid-cols-1 overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] md:grid-cols-12"
            aria-label="Channels headline"
          >
            <div className="flex flex-col justify-between p-5 md:col-span-4 md:p-6">
              <div>
                <p className={insightKpiLabelClassName}>Outbound reach</p>
                <p className={`${insightKpiValueClassName} text-[2rem] leading-none`}>
                  {formatInsightNumber(board.headline.outboundReach)}
                </p>
              </div>
              <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
                across {formatInsightNumber(board.headline.campaignsSent)} campaigns
              </p>
            </div>
            <div className="border-t border-[var(--admin-border)] p-5 md:col-span-2 md:border-l md:border-t-0 md:p-6">
              <p className={insightKpiLabelClassName}>Campaigns sent</p>
              <p className={insightKpiValueClassName}>
                {formatInsightNumber(board.headline.campaignsSent)}
              </p>
            </div>
            <div className="border-t border-[var(--admin-border)] p-5 md:col-span-2 md:border-l md:border-t-0 md:p-6">
              <p className={insightKpiLabelClassName}>Avg reach / campaign</p>
              <p className={insightKpiValueClassName}>
                {board.headline.avgReachPerCampaign == null
                  ? "-"
                  : formatInsightNumber(board.headline.avgReachPerCampaign, 1)}
              </p>
            </div>
            <div className="border-t border-[var(--admin-border)] p-5 md:col-span-2 md:border-l md:border-t-0 md:p-6">
              <p className={insightKpiLabelClassName}>Channels used</p>
              <p className={insightKpiValueClassName}>
                {formatInsightNumber(board.headline.channelsUsed)}
              </p>
            </div>
            <div className="border-t border-[var(--admin-border)] p-5 md:col-span-2 md:border-l md:border-t-0 md:p-6">
              <p className={insightKpiLabelClassName}>Scheduled</p>
              <p className={insightKpiValueClassName}>
                {formatInsightNumber(board.headline.scheduledTotal)}
              </p>
              <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
                {board.headline.scheduledCaption}
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <ComparisonPanel board={board} />
            </div>
            <div className="lg:col-span-2">
              <VolumePanel
                board={board}
                outboundOnly={outboundOnly}
                onToggleOutboundOnly={() => {
                  setOutboundOnly((value) => !value);
                }}
              />
            </div>
          </div>

          <ChannelTable board={board} />

          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Refreshed {formatRelativeTime(board.generatedAt)}.
          </p>
        </>
      ) : null}
    </div>
  );
}
