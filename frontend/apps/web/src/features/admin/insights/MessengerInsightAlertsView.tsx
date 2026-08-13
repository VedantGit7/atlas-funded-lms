"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  EyeOff,
  Info,
  MessageSquare,
  Minus,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  TriangleAlert,
  VolumeX,
  X,
} from "lucide-react";
import { DropdownMenu } from "@atlas/design-system";
import {
  ADMIN_INSIGHTS_HREF,
  adminInsightAlertsHref,
  adminInsightChannelsHref,
  adminInsightHref,
  adminInsightInboxHref,
  adminInsightWhatsappHref,
} from "./admin-insights-catalog";
import type {
  InsightAlertBoardItem,
  InsightAlertRuleCard,
  InsightAlertsBoard,
  InsightAlertsMutation,
} from "./admin-insights-api";
import {
  csvEscape,
  formatDateTime,
  formatInsightNumber,
  formatMutedUntil,
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
import type { InsightAlertsTab } from "./InsightAlertsView";

type MessengerInsightAlertsViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightAlertsBoard | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  tab: InsightAlertsTab;
  onTabChange: (tab: InsightAlertsTab) => void;
  onRefresh: () => void;
  onMutate: (body: InsightAlertsMutation) => Promise<void>;
};

type MuteFor = "1d" | "7d" | "forever";
type MessengerSeverity = "warning" | "info";

const MUTE_OPTIONS: Array<{ value: MuteFor; label: string }> = [
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "forever", label: "Forever" },
];

const ALL_INSIGHT_ALERTS_HREF = adminInsightAlertsHref("dashboard");

const INFO_BADGE =
  "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]";
const WARNING_BADGE =
  "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]";

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

function menuPanelClassName(): string {
  return "admin-theme admin-dropdown-panel border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]";
}

function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function alertsToCsv(items: InsightAlertBoardItem[]): string {
  const lines = [
    ["Alert", "Severity", "Rule", "Status", "First seen", "Resolved", "Muted until"]
      .map((cell) => csvEscape(cell))
      .join(","),
  ];
  for (const item of items) {
    lines.push(
      [
        item.title,
        item.severity,
        item.ruleId,
        item.status,
        item.firstSeenAt,
        item.resolvedAt ?? "",
        item.mutedUntil ?? "",
      ]
        .map((cell) => csvEscape(cell))
        .join(","),
    );
  }
  return lines.join("\n");
}

function formatDurationCompact(totalSeconds: number | null): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "-";
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(rest).padStart(2, "0")}s`;
  return `${rest}s`;
}

function severityBadge(severity: InsightAlertBoardItem["severity"]): string {
  if (severity === "warning" || severity === "critical") return WARNING_BADGE;
  return INFO_BADGE;
}

function severityLabel(severity: InsightAlertBoardItem["severity"]): string {
  if (severity === "warning") return "Warning";
  if (severity === "critical") return "Critical";
  return "Info";
}

function openCompositionCaption(warning: number, info: number): string {
  return `${formatInsightNumber(warning)} warning · ${formatInsightNumber(info)} info`;
}

function isEscalatedFailures(item: InsightAlertBoardItem): boolean {
  return (
    item.ruleId === "whatsapp-failures" &&
    item.openedSeverity != null &&
    item.peakSeverity != null &&
    item.openedSeverity !== item.peakSeverity
  );
}

function ruleConditionText(rule: InsightAlertRuleCard): string {
  if (rule.id === "whatsapp-failures") {
    return `Notify on any failed send; raise it to a warning at ${rule.threshold} or more.`;
  }
  return rule.description;
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
        className={insightSegmentButtonClassName}
      >
        Inbox
      </Link>
      <Link
        href={adminInsightAlertsHref(slug)}
        prefetch={false}
        className={insightSegmentButtonActiveClassName}
        aria-current="page"
      >
        Alerts
      </Link>
    </div>
  );
}

function CoverageStrip() {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]"
    >
      <Info
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
        aria-hidden="true"
      />
      <div>
        <p>Both rules in this section watch WhatsApp.</p>
        <p className="mt-1">
          Email, push, announcements, and the inbox have no alert rules - no alert will fire for
          them however they perform.
        </p>
      </div>
    </div>
  );
}

export function MessengerInsightAlertsView({
  slug,
  sectionTitle,
  board,
  loading,
  mutating,
  error,
  tab,
  onTabChange,
  onRefresh,
  onMutate,
}: MessengerInsightAlertsViewProps) {
  const [resolvedQuery, setResolvedQuery] = useState("");
  const [muteTarget, setMuteTarget] = useState<InsightAlertBoardItem | null>(null);
  const [muteFor, setMuteFor] = useState<MuteFor>("1d");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const openCount = board?.summary.open ?? 0;
  const resolvedCount = board?.alerts.filter((item) => item.status === "resolved").length ?? 0;
  const mutedCount = board?.summary.muted ?? 0;

  const openItems = useMemo(
    () => board?.alerts.filter((item) => item.status === "open") ?? [],
    [board?.alerts],
  );

  const mutedItems = useMemo(
    () => board?.alerts.filter((item) => item.status === "muted") ?? [],
    [board?.alerts],
  );

  const resolvedItems = useMemo(() => {
    const items = board?.alerts.filter((item) => item.status === "resolved") ?? [];
    const needle = resolvedQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (!needle) return true;
      return `${item.title} ${item.message} ${item.ruleId}`.toLowerCase().includes(needle);
    });
  }, [board?.alerts, resolvedQuery]);

  const groupedOpen = useMemo(
    () => ({
      // Messenger rules only declare warning + info; fold critical into warning if it ever appears.
      warning: openItems.filter(
        (item) => item.severity === "warning" || item.severity === "critical",
      ),
      info: openItems.filter((item) => item.severity === "info"),
    }),
    [openItems],
  );

  const compositionTotal = board != null ? board.summary.warning + board.summary.info : 0;
  const warningShare =
    compositionTotal > 0 && board ? (board.summary.warning / compositionTotal) * 100 : 0;
  const infoShare =
    compositionTotal > 0 && board ? (board.summary.info / compositionTotal) * 100 : 0;

  const copyId = (id: string) => {
    void navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1600);
    });
  };

  const exportTab = () => {
    const items = tab === "muted" ? mutedItems : tab === "resolved" ? resolvedItems : openItems;
    downloadCsv(`messenger-insight-alerts-${tab}.csv`, alertsToCsv(items));
  };

  const beginMute = (item: InsightAlertBoardItem, duration: MuteFor = "1d") => {
    setMuteFor(duration);
    setMuteTarget(item);
  };

  return (
    <div className={insightPageClassName}>
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
        <span className="font-medium text-[var(--admin-on-surface)]">Alerts</span>
      </nav>

      <LocalTabs slug={slug} />

      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h1 className={insightPageTitleClassName}>Alerts</h1>
          <p className={insightPageDescClassName}>
            What Messenger Insight is flagging, and what it does not watch.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!board}
            onClick={exportTab}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
          <Link
            href={ALL_INSIGHT_ALERTS_HREF}
            prefetch={false}
            className={insightGhostButtonClassName}
          >
            View all insight alerts
          </Link>
          <button
            type="button"
            className={insightPrimaryButtonClassName}
            disabled={mutating || openCount === 0}
            onClick={() => {
              void onMutate({ action: "mark-all-seen" });
            }}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Mark all as seen
          </button>
        </div>
      </header>

      <CoverageStrip />

      {error ? (
        <div className="flex items-start gap-4 rounded border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-5">
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--admin-danger)]">
              Unable to load alerts
            </h3>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
            <button
              type="button"
              className={`${insightGhostButtonClassName} mt-4`}
              onClick={onRefresh}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {loading && !board ? <MessengerAlertsSkeleton /> : null}

      {board && !error ? (
        <>
          <section
            className="grid grid-cols-1 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-12 md:gap-px"
            aria-label="Alert summary"
          >
            <button
              type="button"
              className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 text-left outline-none transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 md:col-span-4"
              onClick={() => {
                onTabChange("open");
              }}
            >
              <div className={insightKpiLabelClassName}>Open alerts</div>
              <div className={`${insightKpiValueClassName} text-[32px] leading-9`}>
                {formatInsightNumber(board.summary.open)}
              </div>
              {board.summary.open > 0 ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-[var(--admin-warning)]">
                      <span
                        className="inline-block h-2 w-2 rounded-full bg-[var(--admin-warning)]"
                        aria-hidden="true"
                      />
                      {formatInsightNumber(board.summary.warning)} warning
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[var(--admin-primary)]">
                      <span
                        className="inline-block h-2 w-2 rounded-full bg-[var(--admin-primary)]"
                        aria-hidden="true"
                      />
                      {formatInsightNumber(board.summary.info)} info
                    </span>
                  </div>
                  <div
                    className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-low)]"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full bg-[var(--admin-warning)]"
                      style={{ width: `${warningShare}%` }}
                    />
                    <div
                      className="h-full bg-[var(--admin-primary)]"
                      style={{ width: `${infoShare}%` }}
                    />
                  </div>
                </>
              ) : (
                <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                  {openCompositionCaption(0, 0)}
                </p>
              )}
            </button>
            <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 md:col-span-2">
              <div className={insightKpiLabelClassName}>New since yesterday</div>
              <div className={insightKpiValueClassName}>
                {formatInsightNumber(board.summary.newSinceYesterday)}
              </div>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                Across all severities
              </p>
            </div>
            <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 md:col-span-2">
              <div className={insightKpiLabelClassName}>Resolved this week</div>
              <div className={`${insightKpiValueClassName} text-[var(--admin-success)]`}>
                {formatInsightNumber(board.summary.resolvedThisWeek)}
              </div>
              {board.summary.resolvedThisWeek > 0 || board.summary.open === 0 ? (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--admin-success)]">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  System stable
                </p>
              ) : (
                <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                  Cleared this week
                </p>
              )}
            </div>
            <button
              type="button"
              className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 text-left outline-none transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 md:col-span-2"
              onClick={() => {
                onTabChange("muted");
              }}
            >
              <div className={insightKpiLabelClassName}>Muted</div>
              <div className={`${insightKpiValueClassName} text-[var(--admin-on-surface-variant)]`}>
                {formatInsightNumber(board.summary.muted)}
              </div>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                {board.summary.muted === 0
                  ? "No active suppressions"
                  : `${formatInsightNumber(board.summary.muted)} active`}
              </p>
            </button>
            <button
              type="button"
              className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 text-left outline-none transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 md:col-span-2"
              onClick={() => {
                onTabChange("rules");
              }}
            >
              <div className={insightKpiLabelClassName}>Rules</div>
              <div className={insightKpiValueClassName}>
                {formatInsightNumber(board.rules.length)}
              </div>
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                both WhatsApp
              </p>
            </button>
          </section>

          <div
            className="flex flex-wrap gap-6 border-b border-[var(--admin-border)]"
            role="tablist"
            aria-label="Alert views"
          >
            {(
              [
                ["open", "Open"],
                ["resolved", "Resolved"],
                ["muted", "Muted"],
                ["rules", "Rules"],
              ] as const
            ).map(([id, label]) => {
              const active = tab === id;
              const count =
                id === "open"
                  ? openCount
                  : id === "resolved"
                    ? resolvedCount
                    : id === "muted"
                      ? mutedCount
                      : board.rules.length;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={
                    active
                      ? "-mb-px inline-flex items-center gap-2 border-b-2 border-[var(--admin-primary)] pb-3 text-sm font-semibold text-[var(--admin-primary)]"
                      : "inline-flex items-center gap-2 pb-3 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
                  }
                  onClick={() => {
                    onTabChange(id);
                  }}
                >
                  {label}
                  <span
                    className={`rounded px-1.5 py-0.5 font-data text-[11px] font-medium ${
                      active && id === "open"
                        ? "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]"
                        : "text-[var(--admin-on-surface-variant)]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {tab === "open" ? (
            openCount === 0 ? (
              <EmptyOpenState
                onOpenRules={() => {
                  onTabChange("rules");
                }}
              />
            ) : (
              <div className="flex flex-col gap-8 pb-8">
                {(["warning", "info"] as const).map((severity) => {
                  const rows = groupedOpen[severity];
                  if (rows.length === 0) return null;
                  return (
                    <OpenSeverityGroup
                      key={severity}
                      severity={severity}
                      rows={rows}
                      disabled={mutating}
                      copiedId={copiedId}
                      onMute={beginMute}
                      onResolve={(ruleId) => {
                        void onMutate({ action: "resolve", ruleId });
                      }}
                      onCopy={copyId}
                    />
                  );
                })}
              </div>
            )
          ) : null}

          {tab === "resolved" ? (
            <ResolvedTable
              items={resolvedItems}
              query={resolvedQuery}
              onQueryChange={setResolvedQuery}
              copiedId={copiedId}
              onCopy={copyId}
            />
          ) : null}

          {tab === "muted" ? (
            <MutedTable
              items={mutedItems}
              disabled={mutating}
              onUnmute={(ruleId) => {
                void onMutate({ action: "unmute", ruleId });
              }}
            />
          ) : null}

          {tab === "rules" ? (
            <RulesBoard
              rules={board.rules}
              disabled={mutating}
              onToggle={(ruleId, enabled) => {
                void onMutate({ action: "toggle-rule", ruleId, enabled });
              }}
              onThreshold={(ruleId, threshold) => {
                void onMutate({ action: "set-threshold", ruleId, threshold });
              }}
            />
          ) : null}
        </>
      ) : null}

      {muteTarget ? (
        <MuteModal
          title={muteTarget.title}
          muteFor={muteFor}
          onMuteForChange={setMuteFor}
          onCancel={() => {
            setMuteTarget(null);
          }}
          onConfirm={() => {
            const ruleId = muteTarget.ruleId;
            const duration = muteFor;
            setMuteTarget(null);
            void onMutate({ action: "mute", ruleId, muteFor: duration });
          }}
        />
      ) : null}
    </div>
  );
}

function OpenSeverityGroup({
  severity,
  rows,
  disabled,
  copiedId,
  onMute,
  onResolve,
  onCopy,
}: {
  severity: MessengerSeverity;
  rows: InsightAlertBoardItem[];
  disabled: boolean;
  copiedId: string | null;
  onMute: (item: InsightAlertBoardItem, duration?: MuteFor) => void;
  onResolve: (ruleId: string) => void;
  onCopy: (id: string) => void;
}) {
  const tone =
    severity === "warning" ? "text-[var(--admin-warning)]" : "text-[var(--admin-primary)]";

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-[var(--admin-border)] pb-2">
        {severity === "warning" ? (
          <TriangleAlert className={`h-[18px] w-[18px] ${tone}`} aria-hidden="true" />
        ) : (
          <Info className={`h-[18px] w-[18px] ${tone}`} aria-hidden="true" />
        )}
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
          {severity === "warning" ? "Warning" : "Info"}{" "}
          <span className="font-normal text-[var(--admin-on-surface-variant)]">
            ({rows.length})
          </span>
        </h2>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((item) => (
          <OpenAlertStrip
            key={item.id}
            item={item}
            disabled={disabled}
            copied={copiedId === item.id}
            onMute={onMute}
            onResolve={onResolve}
            onCopy={onCopy}
          />
        ))}
      </div>
    </section>
  );
}

function OpenAlertStrip({
  item,
  disabled,
  copied,
  onMute,
  onResolve,
  onCopy,
}: {
  item: InsightAlertBoardItem;
  disabled: boolean;
  copied: boolean;
  onMute: (item: InsightAlertBoardItem, duration?: MuteFor) => void;
  onResolve: (ruleId: string) => void;
  onCopy: (id: string) => void;
}) {
  const isWarning = item.severity === "warning" || item.severity === "critical";
  const surface = isWarning
    ? "border border-[color-mix(in_srgb,var(--admin-warning)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))]"
    : "border border-[color-mix(in_srgb,var(--admin-primary)_22%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))]";
  const iconTone = isWarning ? "text-[var(--admin-warning)]" : "text-[var(--admin-primary)]";

  const items = [
    ...(item.href
      ? [
          {
            key: "open",
            label: "Open linked page",
            disabled,
            onSelect: () => {
              window.location.assign(item.href ?? "/admin");
            },
          },
        ]
      : []),
    {
      key: "mute-1d",
      label: "Mute for 1 day",
      disabled,
      onSelect: () => {
        onMute(item, "1d");
      },
    },
    {
      key: "mute-7d",
      label: "Mute for 7 days",
      disabled,
      onSelect: () => {
        onMute(item, "7d");
      },
    },
    {
      key: "mute-forever",
      label: "Mute forever",
      disabled,
      onSelect: () => {
        onMute(item, "forever");
      },
    },
    {
      key: "resolve",
      label: "Mark as resolved",
      disabled,
      onSelect: () => {
        onResolve(item.ruleId);
      },
    },
    {
      key: "copy",
      label: copied ? "Copied" : "Copy alert id",
      disabled,
      onSelect: () => {
        onCopy(item.id);
      },
    },
  ];

  return (
    <div
      className={`group relative flex flex-col gap-3 rounded p-4 pl-5 transition-colors md:flex-row md:items-center md:gap-4 ${surface}`}
    >
      <span
        className={`absolute bottom-0 left-0 top-0 w-1.5 rounded-l ${
          isWarning ? "bg-[var(--admin-warning)]" : "bg-[var(--admin-primary)]"
        }`}
        aria-hidden="true"
      />
      {isWarning ? (
        <TriangleAlert className={`h-6 w-6 shrink-0 ${iconTone}`} aria-hidden="true" />
      ) : (
        <Info className={`h-6 w-6 shrink-0 ${iconTone}`} aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <h4 className="truncate pr-4 text-[15px] font-semibold text-[var(--admin-on-surface)]">
          {item.title}
        </h4>
        <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{item.message}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end md:self-auto">
        <div className="text-right">
          <div className="font-data text-sm text-[var(--admin-on-surface-variant)]">
            {formatRelativeTime(item.firstSeenAt)}
          </div>
          <div className="font-data text-[10px] text-[var(--admin-on-surface-variant)]">
            {formatDateTime(item.firstSeenAt)}
          </div>
        </div>
        {item.href ? (
          <Link
            href={item.href}
            prefetch={false}
            className="rounded p-1.5 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[color-mix(in_srgb,var(--admin-on-surface)_6%,transparent)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label={`Open ${item.title}`}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : null}
        <DropdownMenu
          label={`Actions for ${item.title}`}
          trigger={<MoreVertical className="h-5 w-5" aria-hidden="true" />}
          contentClassName={menuPanelClassName()}
          triggerClassName="rounded p-1.5 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[color-mix(in_srgb,var(--admin-on-surface)_6%,transparent)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          items={items}
        />
      </div>
    </div>
  );
}

function ResolvedTable({
  items,
  query,
  onQueryChange,
  copiedId,
  onCopy,
}: {
  items: InsightAlertBoardItem[];
  query: string;
  onQueryChange: (value: string) => void;
  copiedId: string | null;
  onCopy: (id: string) => void;
}) {
  return (
    <div className={`${insightPanelClassName} overflow-hidden pb-0`}>
      <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 lg:flex-row lg:items-center lg:justify-end">
        <label className="relative h-10 w-full lg:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
            }}
            placeholder="Search resolved alerts"
            className="h-full w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </label>
      </div>

      {items.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-[var(--admin-on-surface-variant)]">
          No resolved alerts yet. Resolved alerts appear here after you mark them resolved or the
          condition clears.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left">
            <thead>
              <tr className={insightTableHeadClassName}>
                <th className="px-4 py-3">Alert</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Rule id</th>
                <th className="px-4 py-3 text-right">First seen</th>
                <th className="px-4 py-3 text-right">Resolved</th>
                <th className="px-4 py-3">Resolved by</th>
                <th className="px-4 py-3 text-right">Duration</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={`${insightTableRowClassName} group h-11`}>
                  <td className="px-4 py-2">
                    <div className="font-semibold text-[var(--admin-on-surface)]">{item.title}</div>
                    <div className="mt-0.5 max-w-[220px] truncate text-xs text-[var(--admin-on-surface-variant)]">
                      {item.message}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {isEscalatedFailures(item) && item.openedSeverity && item.peakSeverity ? (
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded border px-2 py-0.5 font-data text-[11px] ${severityBadge(item.openedSeverity)}`}
                          >
                            {severityLabel(item.openedSeverity)}
                          </span>
                          <ArrowRight
                            className="h-3.5 w-3.5 text-[var(--admin-on-surface-variant)]"
                            aria-hidden="true"
                          />
                          <span
                            className={`inline-flex items-center rounded border px-2 py-0.5 font-data text-[11px] ${severityBadge(item.peakSeverity)}`}
                          >
                            {severityLabel(item.peakSeverity)}
                          </span>
                        </div>
                        <p className="text-[10px] leading-tight text-[var(--admin-on-surface-variant)]">
                          escalated as failures passed the threshold
                        </p>
                      </div>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-data text-[11px] ${severityBadge(item.severity)}`}
                      >
                        {item.severity === "warning" ? (
                          <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Info className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {severityLabel(item.severity)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-data text-[10px] text-[var(--admin-on-surface-variant)]">
                    {item.ruleId}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                    {formatDateTime(item.firstSeenAt)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="font-data text-sm text-[var(--admin-on-surface)]">
                      {item.resolvedAt ? formatRelativeTime(item.resolvedAt) : "-"}
                    </div>
                    {item.resolvedAt ? (
                      <div className="text-[10px] text-[var(--admin-on-surface-variant)]">
                        ({formatDateTime(item.resolvedAt)})
                      </div>
                    ) : null}
                  </td>
                  <td
                    className={`px-4 py-2 text-sm ${
                      item.resolvedByLabel === "Automatically"
                        ? "italic text-[var(--admin-on-surface-variant)]"
                        : "text-[var(--admin-on-surface)]"
                    }`}
                  >
                    {item.resolvedByLabel ?? "-"}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-on-surface)]">
                    {formatDurationCompact(item.durationSeconds)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <DropdownMenu
                      label={`Actions for ${item.title}`}
                      trigger={<MoreVertical className="h-5 w-5" aria-hidden="true" />}
                      contentClassName={menuPanelClassName()}
                      triggerClassName="rounded p-1 text-[var(--admin-on-surface-variant)] opacity-0 outline-none hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 group-hover:opacity-100"
                      items={[
                        {
                          key: "copy",
                          label: copiedId === item.id ? "Copied" : "Copy alert id",
                          onSelect: () => {
                            onCopy(item.id);
                          },
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
        Showing {formatInsightNumber(items.length)} resolved alert
        {items.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function MutedTable({
  items,
  disabled,
  onUnmute,
}: {
  items: InsightAlertBoardItem[];
  disabled: boolean;
  onUnmute: (ruleId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-start gap-3 rounded border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-4">
        <TriangleAlert
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--admin-on-surface)]">
          Muting WhatsApp failures hides the only delivery signal this section watches.
        </p>
      </div>

      {items.length === 0 ? (
        <div
          className={`${insightPanelClassName} flex min-h-[280px] flex-col items-center justify-center px-6 py-16 text-center`}
        >
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
            <VolumeX className="h-8 w-8 opacity-70" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
            No muted WhatsApp rules
          </h3>
          <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            Muting hides the alert but does not change the condition.
          </p>
        </div>
      ) : (
        <div className={insightPanelClassName}>
          <p className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
            Muting hides the alert but does not change the condition.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead>
                <tr className={insightTableHeadClassName}>
                  <th className="px-4 py-3">Alert</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Rule id</th>
                  <th className="px-4 py-3 text-right">First seen</th>
                  <th className="px-4 py-3 text-right">Muted until</th>
                  <th className="w-28 px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={insightTableRowClassName}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-[var(--admin-on-surface)]">{item.title}</div>
                      <div className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                        {item.message}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] ${severityBadge(item.severity)}`}
                      >
                        {severityLabel(item.severity)}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-data text-[10px] text-[var(--admin-on-surface-variant)]">
                      {item.ruleId}
                    </td>
                    <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                      {formatDateTime(item.firstSeenAt)}
                    </td>
                    <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-warning)]">
                      {formatMutedUntil(item.mutedUntil) || "Forever"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        className="text-sm font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:opacity-50"
                        disabled={disabled}
                        onClick={() => {
                          onUnmute(item.ruleId);
                        }}
                      >
                        Unmute
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RulesBoard({
  rules,
  disabled,
  onToggle,
  onThreshold,
}: {
  rules: InsightAlertRuleCard[];
  disabled: boolean;
  onToggle: (ruleId: string, enabled: boolean) => void;
  onThreshold: (ruleId: string, threshold: number) => void;
}) {
  const failures = rules.find((rule) => rule.id === "whatsapp-failures") ?? null;
  const disconnected = rules.find((rule) => rule.id === "whatsapp-disconnected") ?? null;
  const others = rules.filter(
    (rule) => rule.id !== "whatsapp-failures" && rule.id !== "whatsapp-disconnected",
  );

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {failures ? (
          <div className="lg:col-span-3">
            <FailuresRuleCard
              rule={failures}
              disabled={disabled}
              onToggle={onToggle}
              onThreshold={onThreshold}
            />
          </div>
        ) : null}
        {disconnected ? (
          <div className="lg:col-span-2">
            <DisconnectedRuleCard rule={disconnected} disabled={disabled} onToggle={onToggle} />
          </div>
        ) : null}
      </div>

      {others.map((rule) => (
        <FailuresRuleCard
          key={rule.id}
          rule={rule}
          disabled={disabled}
          onToggle={onToggle}
          onThreshold={onThreshold}
        />
      ))}

      <div className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_6%,var(--admin-surface))] px-4 py-5">
        <div className="flex items-start gap-3">
          <EyeOff
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <div>
            <h4 className="text-base font-semibold text-[var(--admin-on-surface)]">Coverage gap</h4>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              No rules watch email, push, announcements, or the inbox.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FailuresRuleCard({
  rule,
  disabled,
  onToggle,
  onThreshold,
}: {
  rule: InsightAlertRuleCard;
  disabled: boolean;
  onToggle: (ruleId: string, enabled: boolean) => void;
  onThreshold: (ruleId: string, threshold: number) => void;
}) {
  const canStep = rule.thresholdKind !== "none" && rule.enabled && !disabled;
  const chips = (["info", "warning"] as const).filter((severity) =>
    rule.severities.includes(severity),
  );

  return (
    <article
      className={`${insightPanelClassName} h-full gap-4 rounded-xl p-6 ${rule.enabled ? "" : "opacity-70"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <MessageSquare
            className="h-5 w-5 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{rule.title}</h3>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Severity it can produce
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {chips.map((severity) => (
                <span
                  key={severity}
                  className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] uppercase tracking-wider ${
                    severity === "warning" ? WARNING_BADGE : INFO_BADGE
                  }`}
                >
                  {severityLabel(severity)}
                </span>
              ))}
            </div>
          </div>
        </div>
        <EnabledToggle
          title={rule.title}
          enabled={rule.enabled}
          disabled={disabled}
          onToggle={() => {
            onToggle(rule.id, !rule.enabled);
          }}
        />
      </div>

      <p className="text-sm text-[var(--admin-on-surface-variant)]">{ruleConditionText(rule)}</p>

      {rule.thresholdKind !== "none" ? (
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-base font-semibold text-[var(--admin-on-surface)]">
                Threshold (N)
              </span>
              <div className="inline-flex overflow-hidden rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)]">
                <button
                  type="button"
                  className="border-r border-[var(--admin-outline)] px-3 py-2 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
                  disabled={!canStep || rule.threshold <= rule.min}
                  aria-label={`Decrease ${rule.title} threshold`}
                  onClick={() => {
                    onThreshold(rule.id, Math.max(rule.min, rule.threshold - 1));
                  }}
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="min-w-16 px-3 py-2 text-center font-data text-sm font-semibold text-[var(--admin-on-surface)]">
                  {rule.threshold}
                </span>
                <button
                  type="button"
                  className="border-l border-[var(--admin-outline)] px-3 py-2 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
                  disabled={!canStep || rule.threshold >= rule.max}
                  aria-label={`Increase ${rule.title} threshold`}
                  onClick={() => {
                    onThreshold(rule.id, Math.min(rule.max, rule.threshold + 1));
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            {rule.currentCaption ? (
              <span className="flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                {rule.currentCaption}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="text-xs text-[var(--admin-on-surface-variant)]">
        Last fired:{" "}
        <span className="font-data font-semibold text-[var(--admin-on-surface)]">
          {rule.lastFiredAt ? formatRelativeTime(rule.lastFiredAt) : "Never"}
        </span>
      </div>
    </article>
  );
}

function DisconnectedRuleCard({
  rule,
  disabled,
  onToggle,
}: {
  rule: InsightAlertRuleCard;
  disabled: boolean;
  onToggle: (ruleId: string, enabled: boolean) => void;
}) {
  return (
    <article
      className={`${insightPanelClassName} h-full gap-4 rounded-xl p-6 ${rule.enabled ? "" : "opacity-70"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <ShieldAlert
            className="h-5 w-5 shrink-0 text-[var(--admin-primary)]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{rule.title}</h3>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Severity it can produce
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] uppercase tracking-wider ${INFO_BADGE}`}
              >
                Info
              </span>
            </div>
          </div>
        </div>
        <EnabledToggle
          title={rule.title}
          enabled={rule.enabled}
          disabled={disabled}
          onToggle={() => {
            onToggle(rule.id, !rule.enabled);
          }}
        />
      </div>

      <p className="text-sm text-[var(--admin-on-surface-variant)]">
        {rule.description || "Fires whenever the integration is disconnected."}
      </p>

      <div className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
        <p className="text-xs italic text-[var(--admin-on-surface-variant)]">
          This rule has no threshold. It fires whenever the integration is disconnected.
        </p>
      </div>

      <div className="mt-auto text-xs text-[var(--admin-on-surface-variant)]">
        Last fired:{" "}
        <span className="font-data font-semibold text-[var(--admin-on-surface)]">
          {rule.lastFiredAt ? formatRelativeTime(rule.lastFiredAt) : "Never"}
        </span>
      </div>
    </article>
  );
}

function EnabledToggle({
  title,
  enabled,
  disabled,
  onToggle,
}: {
  title: string;
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${enabled ? "Disable" : "Enable"} ${title}`}
      disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        enabled ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-surface-high)]"
      }`}
      onClick={onToggle}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--admin-surface)] transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function EmptyOpenState({ onOpenRules }: { onOpenRules: () => void }) {
  return (
    <div
      className={`${insightPanelClassName} flex min-h-[400px] flex-col items-center justify-center px-6 py-24 text-center`}
    >
      <div className="relative mb-6 flex h-28 w-28 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full border border-[color-mix(in_srgb,var(--admin-outline)_40%,transparent)] motion-safe:animate-[spin_60s_linear_infinite]"
          aria-hidden="true"
        />
        <span
          className="absolute inset-2 rounded-full border border-dashed border-[color-mix(in_srgb,var(--admin-outline)_30%,transparent)] motion-safe:animate-[spin_40s_linear_infinite_reverse]"
          aria-hidden="true"
        />
        <CheckCircle2
          className="relative h-14 w-14 text-[var(--admin-outline)]"
          strokeWidth={1.25}
          aria-hidden="true"
        />
      </div>
      <h3 className="text-xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
        Nothing is flagged in Messenger Insight
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Both rules watch WhatsApp, and neither is firing.
      </p>
      <button type="button" className={`${insightGhostButtonClassName} mt-8`} onClick={onOpenRules}>
        Review rules
      </button>
    </div>
  );
}

function MuteModal({
  title,
  muteFor,
  onMuteForChange,
  onCancel,
  onConfirm,
}: {
  title: string;
  muteFor: MuteFor;
  onMuteForChange: (value: MuteFor) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-[1px]"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mute-messenger-alert-title"
        className="admin-theme flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <div className="flex items-center gap-3 text-[var(--admin-warning)]">
            <VolumeX className="h-5 w-5 shrink-0" aria-hidden="true" />
            <h2
              id="mute-messenger-alert-title"
              className="text-base font-semibold leading-tight text-[var(--admin-on-surface)]"
            >
              Mute alert rule
            </h2>
          </div>
          <button
            type="button"
            className="-mr-2 rounded-lg p-2 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label="Close"
            onClick={onCancel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 px-6 py-6">
          <p className="mb-4 text-sm text-[var(--admin-on-surface)]">
            You are about to mute notifications for the rule:
          </p>
          <div className="mb-6 flex items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
            <MessageSquare
              className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <span className="font-data text-sm font-medium text-[var(--admin-on-surface)]">
              {title}
            </span>
          </div>
          <p className="mb-4 text-sm text-[var(--admin-on-surface-variant)]">
            Muting hides the alert from the dashboard but does not change the underlying condition.
          </p>
          <fieldset>
            <legend className="mb-3 block text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Mute duration
            </legend>
            <div className="space-y-2" role="radiogroup" aria-label="Mute duration">
              {MUTE_OPTIONS.map((option) => {
                const active = muteFor === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`relative flex w-full items-center rounded-lg border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${
                      active
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                        : "border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)]"
                    }`}
                    onClick={() => {
                      onMuteForChange(option.value);
                    }}
                  >
                    {active ? (
                      <span
                        className="absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--admin-primary)]"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span
                      className={`mr-3 inline-flex h-4 w-4 shrink-0 rounded-full border-2 ${
                        active
                          ? "border-[var(--admin-primary)] bg-[var(--admin-surface)] shadow-[inset_0_0_0_3px_var(--admin-primary)]"
                          : "border-[var(--admin-outline)] bg-[var(--admin-surface)]"
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={`text-sm font-medium ${
                        active ? "text-[var(--admin-primary)]" : "text-[var(--admin-on-surface)]"
                      }`}
                    >
                      {option.label}
                    </span>
                    {option.value === "forever" ? (
                      <span className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--admin-warning)]">
                        <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                        Requires manual unmute
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <button type="button" className={insightGhostButtonClassName} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={insightPrimaryButtonClassName} onClick={onConfirm}>
            <VolumeX className="h-4 w-4" aria-hidden="true" />
            Confirm mute
          </button>
        </div>
      </div>
    </div>
  );
}

function MessengerAlertsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading alerts">
      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-[var(--admin-border)] md:grid-cols-12">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className={`flex flex-col gap-3 bg-[var(--admin-surface)] p-5 ${index === 0 ? "md:col-span-4" : "md:col-span-2"}`}
          >
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-8 w-16" />
            {index === 0 || index === 4 ? <Shimmer className="h-3 w-32" /> : null}
          </div>
        ))}
      </div>
      <div className="flex gap-6 border-b border-[var(--admin-border)] pb-3">
        <Shimmer className="h-6 w-16" />
        <Shimmer className="h-6 w-24" />
        <Shimmer className="h-6 w-16" />
        <Shimmer className="h-6 w-14" />
      </div>
      <div className="flex flex-col gap-3">
        <Shimmer className="h-4 w-40" />
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="flex min-h-16 items-center gap-4 rounded border-l-[3px] border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 py-4"
          >
            <Shimmer className="h-5 w-5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-1/3" />
              <Shimmer className="h-3 w-2/3" />
            </div>
            <Shimmer className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
