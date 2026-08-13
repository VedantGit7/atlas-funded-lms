"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Minus,
  MoreVertical,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Shield,
  VolumeX,
  X,
} from "lucide-react";
import { DropdownMenu } from "@atlas/design-system";
import {
  ADMIN_INSIGHTS_HREF,
  adminInsightAlertsHref,
  adminInsightHref,
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

type LiveDashboardAlertsViewProps = {
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
type ResolvedTimeframe = "7d" | "30d" | "90d";

const MUTE_OPTIONS: Array<{ value: MuteFor; label: string }> = [
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "forever", label: "Forever" },
];

const ALL_INSIGHT_ALERTS_HREF = adminInsightAlertsHref("dashboard");
const RESOLVED_PAGE_SIZE = 8;

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

function severityBadge(severity: InsightAlertBoardItem["severity"]): string {
  if (severity === "critical") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  if (severity === "warning") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  return "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]";
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

function formatClockZ(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "-";
    return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")} Z`;
  } catch {
    return "-";
  }
}

function ruleDescription(rule: InsightAlertRuleCard): string {
  return rule.description.replaceAll("{threshold}", String(rule.threshold));
}

export function LiveDashboardAlertsView({
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
}: LiveDashboardAlertsViewProps) {
  const [resolvedQuery, setResolvedQuery] = useState("");
  const [timeframe, setTimeframe] = useState<ResolvedTimeframe>("7d");
  const [resolvedPage, setResolvedPage] = useState(1);
  const [muteTarget, setMuteTarget] = useState<InsightAlertBoardItem | null>(null);
  const [muteFor, setMuteFor] = useState<MuteFor>("forever");
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
    const days = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const needle = resolvedQuery.trim().toLowerCase();
    return items.filter((item) => {
      if ((item.resolvedAt ?? item.lastSeenAt) < cutoff) return false;
      if (!needle) return true;
      return `${item.title} ${item.message} ${item.ruleId}`.toLowerCase().includes(needle);
    });
  }, [board?.alerts, resolvedQuery, timeframe]);

  const resolvedPageCount = Math.max(1, Math.ceil(resolvedItems.length / RESOLVED_PAGE_SIZE));
  const resolvedPageSafe = Math.min(resolvedPage, resolvedPageCount);
  const resolvedSlice = resolvedItems.slice(
    (resolvedPageSafe - 1) * RESOLVED_PAGE_SIZE,
    resolvedPageSafe * RESOLVED_PAGE_SIZE,
  );

  const groupedOpen = useMemo(
    () => ({
      critical: openItems.filter((item) => item.severity === "critical"),
      warning: openItems.filter((item) => item.severity === "warning"),
      info: openItems.filter((item) => item.severity === "info"),
    }),
    [openItems],
  );

  const warningShare =
    board && board.summary.open > 0 ? (board.summary.warning / board.summary.open) * 100 : 0;
  const infoShare =
    board && board.summary.open > 0 ? (board.summary.info / board.summary.open) * 100 : 0;
  const criticalShare =
    board && board.summary.open > 0 ? (board.summary.critical / board.summary.open) * 100 : 0;

  const configurableRules =
    board?.rules.filter((rule) => rule.thresholdKind !== "none").length ?? 0;

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
    downloadCsv(`live-dashboard-alerts-${tab}.csv`, alertsToCsv(items));
  };

  const beginMute = (item: InsightAlertBoardItem, duration: MuteFor = "forever") => {
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

      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h1 className={insightPageTitleClassName}>
            {tab === "rules" ? "Alert Configuration & Rules" : "Alerts"}
          </h1>
          <p className={insightPageDescClassName}>
            {tab === "rules"
              ? "Manage live-session alert thresholds and informational notices. Changes apply immediately to the monitoring stream."
              : `What ${sectionTitle} is flagging, and the thresholds behind it.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {tab === "rules" ? (
            <button
              type="button"
              className={insightGhostButtonClassName}
              onClick={() => {
                onTabChange("resolved");
              }}
            >
              View History
            </button>
          ) : (
            <>
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
            </>
          )}
        </div>
      </header>

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

      {loading && !board ? <LiveAlertsSkeleton /> : null}

      {board && !error ? (
        <>
          <section
            className="grid grid-cols-1 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-6 md:gap-px"
            aria-label="Alert summary"
          >
            <button
              type="button"
              className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 text-left outline-none transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 md:col-span-2"
              onClick={() => {
                onTabChange("open");
              }}
            >
              <div className={insightKpiLabelClassName}>Open alerts</div>
              <div className={`${insightKpiValueClassName} text-[32px] leading-9`}>
                {formatInsightNumber(board.summary.open)}
              </div>
              <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
                <div
                  className="h-full bg-[var(--admin-danger)]"
                  style={{ width: `${criticalShare}%` }}
                />
                <div
                  className="h-full bg-[var(--admin-warning)]"
                  style={{ width: `${warningShare}%` }}
                />
                <div
                  className="h-full bg-[var(--admin-primary)]"
                  style={{ width: `${infoShare}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                {formatInsightNumber(board.summary.warning)} warning ·{" "}
                {formatInsightNumber(board.summary.info)} info
                {board.summary.critical > 0
                  ? ` · ${formatInsightNumber(board.summary.critical)} critical`
                  : ""}
              </p>
            </button>
            <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
              <div className={insightKpiLabelClassName}>New since yesterday</div>
              <div className={insightKpiValueClassName}>
                {formatInsightNumber(board.summary.newSinceYesterday)}
              </div>
            </div>
            <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
              <div className={insightKpiLabelClassName}>Resolved this week</div>
              <div className={`${insightKpiValueClassName} text-[var(--admin-success)]`}>
                {formatInsightNumber(board.summary.resolvedThisWeek)}
              </div>
            </div>
            <button
              type="button"
              className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 text-left outline-none transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              onClick={() => {
                onTabChange("muted");
              }}
            >
              <div className={insightKpiLabelClassName}>Muted</div>
              <div className={`${insightKpiValueClassName} text-[var(--admin-on-surface-variant)]`}>
                {formatInsightNumber(board.summary.muted)}
              </div>
            </button>
            <button
              type="button"
              className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 text-left outline-none transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              onClick={() => {
                onTabChange("rules");
              }}
            >
              <div className={insightKpiLabelClassName}>Rules</div>
              <div className={insightKpiValueClassName}>
                {formatInsightNumber(board.rules.length)}
              </div>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                {configurableRules === board.rules.length
                  ? "both thresholds configurable"
                  : `${formatInsightNumber(configurableRules)} threshold${configurableRules === 1 ? "" : "s"} configurable`}
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
                      ? "-mb-px border-b-2 border-[var(--admin-primary)] pb-3 text-base font-semibold text-[var(--admin-primary)]"
                      : "pb-3 text-base font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
                  }
                  onClick={() => {
                    onTabChange(id);
                    if (id === "resolved") setResolvedPage(1);
                  }}
                >
                  {label}
                  <span className="ml-1.5 font-data text-xs font-medium">({count})</span>
                </button>
              );
            })}
          </div>

          {tab === "open" ? (
            openCount === 0 ? (
              <EmptyOpenState
                sectionTitle={sectionTitle}
                ruleCount={board.rules.length}
                onOpenRules={() => {
                  onTabChange("rules");
                }}
              />
            ) : (
              <div className="flex flex-col gap-8 pb-8">
                {(["critical", "warning", "info"] as const).map((severity) => {
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
              items={resolvedSlice}
              total={resolvedItems.length}
              page={resolvedPageSafe}
              pageCount={resolvedPageCount}
              onPageChange={setResolvedPage}
              query={resolvedQuery}
              onQueryChange={(value) => {
                setResolvedQuery(value);
                setResolvedPage(1);
              }}
              timeframe={timeframe}
              onTimeframeChange={(value) => {
                setTimeframe(value);
                setResolvedPage(1);
              }}
              copiedId={copiedId}
              onCopy={copyId}
            />
          ) : null}

          {tab === "muted" ? (
            <MutedTable
              items={mutedItems}
              sectionTitle={sectionTitle}
              disabled={mutating}
              onUnmute={(ruleId) => {
                void onMutate({ action: "unmute", ruleId });
              }}
            />
          ) : null}

          {tab === "rules" ? (
            <RulesBoard
              rules={board.rules}
              generatedAt={board.generatedAt}
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
  severity: "critical" | "warning" | "info";
  rows: InsightAlertBoardItem[];
  disabled: boolean;
  copiedId: string | null;
  onMute: (item: InsightAlertBoardItem, duration?: MuteFor) => void;
  onResolve: (ruleId: string) => void;
  onCopy: (id: string) => void;
}) {
  const accent =
    severity === "critical"
      ? "border-[var(--admin-danger)]"
      : severity === "warning"
        ? "border-[var(--admin-warning)]"
        : "border-[var(--admin-primary)]";
  const iconTone =
    severity === "critical"
      ? "text-[var(--admin-danger)]"
      : severity === "warning"
        ? "text-[var(--admin-warning)]"
        : "text-[var(--admin-primary)]";

  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
        {severity} ({rows.length})
      </h2>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        {rows.map((item) => (
          <OpenAlertStrip
            key={item.id}
            item={item}
            accent={accent}
            iconTone={iconTone}
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
  accent,
  iconTone,
  disabled,
  copied,
  onMute,
  onResolve,
  onCopy,
}: {
  item: InsightAlertBoardItem;
  accent: string;
  iconTone: string;
  disabled: boolean;
  copied: boolean;
  onMute: (item: InsightAlertBoardItem, duration?: MuteFor) => void;
  onResolve: (ruleId: string) => void;
  onCopy: (id: string) => void;
}) {
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
      key: "mute",
      label: "Mute…",
      disabled,
      onSelect: () => {
        onMute(item);
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
      className={`group flex flex-col justify-between gap-4 border-b border-[var(--admin-border)] border-l-[3px] p-4 last:border-b-0 hover:bg-[var(--admin-surface-high)] md:flex-row md:items-center ${accent}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-6">
        <div className="flex w-full shrink-0 items-center gap-3 md:w-64">
          {item.severity === "critical" ? (
            <AlertCircle className={`h-5 w-5 shrink-0 ${iconTone}`} aria-hidden="true" />
          ) : item.severity === "warning" ? (
            <AlertTriangle className={`h-5 w-5 shrink-0 ${iconTone}`} aria-hidden="true" />
          ) : (
            <Info className={`h-5 w-5 shrink-0 ${iconTone}`} aria-hidden="true" />
          )}
          <span className="truncate font-semibold text-[var(--admin-on-surface)]">
            {item.title}
          </span>
        </div>
        <p className="min-w-0 flex-1 text-sm text-[var(--admin-on-surface-variant)]">
          {item.message}
        </p>
        <span className="shrink-0 font-data text-sm text-[var(--admin-on-surface-variant)] md:pr-4 md:text-right">
          {formatClockZ(item.lastSeenAt)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1 self-end text-[var(--admin-on-surface-variant)] opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        {item.href ? (
          <Link
            href={item.href}
            prefetch={false}
            className="rounded p-1 outline-none hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label={`Open ${item.title}`}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : null}
        <DropdownMenu
          label={`Actions for ${item.title}`}
          trigger={<MoreVertical className="h-5 w-5" aria-hidden="true" />}
          contentClassName={menuPanelClassName()}
          triggerClassName="rounded p-1 outline-none hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          items={items}
        />
      </div>
    </div>
  );
}

function ResolvedTable({
  items,
  total,
  page,
  pageCount,
  onPageChange,
  query,
  onQueryChange,
  timeframe,
  onTimeframeChange,
  copiedId,
  onCopy,
}: {
  items: InsightAlertBoardItem[];
  total: number;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  timeframe: ResolvedTimeframe;
  onTimeframeChange: (value: ResolvedTimeframe) => void;
  copiedId: string | null;
  onCopy: (id: string) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * RESOLVED_PAGE_SIZE + 1;
  const to = Math.min(page * RESOLVED_PAGE_SIZE, total);

  return (
    <div className={`${insightPanelClassName} overflow-hidden pb-0`}>
      <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
            Timeframe
          </span>
          <div
            className={insightSegmentTrackClassName}
            role="radiogroup"
            aria-label="Resolved timeframe"
          >
            {(
              [
                ["7d", "Last 7 days"],
                ["30d", "Last 30 days"],
                ["90d", "Last 90 days"],
              ] as const
            ).map(([value, label]) => {
              const active = value === timeframe;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={
                    active ? insightSegmentButtonActiveClassName : insightSegmentButtonClassName
                  }
                  onClick={() => {
                    onTimeframeChange(value);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
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
          No resolved alerts in this timeframe.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className={insightTableHeadClassName}>
                <th className="px-4 py-3">Alert</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Rule ID</th>
                <th className="px-4 py-3 text-right">First Seen</th>
                <th className="px-4 py-3 text-right">Resolved</th>
                <th className="px-4 py-3">Resolved By</th>
                <th className="px-4 py-3 text-right">Duration Open</th>
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
                    <span
                      className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] uppercase tracking-wide ${severityBadge(item.severity)}`}
                    >
                      {item.severity}
                    </span>
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
                        ? "text-[var(--admin-on-surface-variant)]"
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

      <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
        <span>
          Showing {from}-{to} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--admin-outline)] disabled:opacity-40"
            disabled={page <= 1}
            aria-label="Previous page"
            onClick={() => {
              onPageChange(page - 1);
            }}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="px-2 font-data text-sm text-[var(--admin-on-surface)]">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--admin-outline)] disabled:opacity-40"
            disabled={page >= pageCount}
            aria-label="Next page"
            onClick={() => {
              onPageChange(page + 1);
            }}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MutedTable({
  items,
  sectionTitle,
  disabled,
  onUnmute,
}: {
  items: InsightAlertBoardItem[];
  sectionTitle: string;
  disabled: boolean;
  onUnmute: (ruleId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p
        className={`${insightPanelClassName} px-6 py-16 text-center text-sm text-[var(--admin-on-surface-variant)]`}
      >
        No muted alerts. Muting hides a rule from Open without changing the underlying condition.
      </p>
    );
  }

  return (
    <div className={insightPanelClassName}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={insightTableHeadClassName}>
              <th className="px-4 py-3">Alert</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Rule</th>
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
                    className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] uppercase ${severityBadge(item.severity)}`}
                  >
                    {item.severity}
                  </span>
                </td>
                <td className="px-4 py-2 font-data text-[10px] text-[var(--admin-on-surface-variant)]">
                  {item.ruleId}
                </td>
                <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-warning)]">
                  {formatMutedUntil(item.mutedUntil) || "-"}
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
      <div className="flex items-start gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <p className="text-xs leading-5 text-[var(--admin-on-surface-variant)]">
          Muted alerts stay off the Open list and the {sectionTitle} board until unmuted. Forever
          requires an operator to unmute.
        </p>
      </div>
    </div>
  );
}

function RulesBoard({
  rules,
  generatedAt,
  disabled,
  onToggle,
  onThreshold,
}: {
  rules: InsightAlertRuleCard[];
  generatedAt: string;
  disabled: boolean;
  onToggle: (ruleId: string, enabled: boolean) => void;
  onThreshold: (ruleId: string, threshold: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 pb-8 lg:grid-cols-12">
      <div className="flex flex-col gap-6 lg:col-span-8">
        {rules.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            disabled={disabled}
            onToggle={onToggle}
            onThreshold={onThreshold}
          />
        ))}
      </div>
      <aside className="lg:col-span-4">
        <div className={`${insightPanelClassName} gap-3 p-5`}>
          <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
            <Radio className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
            Rule evaluation
          </h3>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Rules are evaluated against the live session stream. Informational rules do not
            escalate.
          </p>
          <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Last evaluated
              </span>
              <span className="font-data text-sm font-semibold text-[var(--admin-on-surface)]">
                {formatRelativeTime(generatedAt)}
              </span>
            </div>
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              {formatInsightNumber(rules.filter((rule) => rule.enabled).length)} of{" "}
              {formatInsightNumber(rules.length)} rules enabled
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function RuleCard({
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
  const severity = rule.severities[0] ?? "info";
  const canStep = rule.thresholdKind !== "none" && rule.enabled && !disabled;

  return (
    <article
      className={`${insightPanelClassName} gap-4 rounded-xl p-6 ${rule.enabled ? "" : "opacity-70"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{rule.title}</h3>
          <span
            className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] uppercase tracking-wider ${severityBadge(severity)}`}
          >
            {severity}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={rule.enabled}
          aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.title}`}
          disabled={disabled}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            rule.enabled ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-surface-high)]"
          }`}
          onClick={() => {
            onToggle(rule.id, !rule.enabled);
          }}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--admin-surface)] transition-transform ${
              rule.enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <p className="text-sm text-[var(--admin-on-surface-variant)]">{ruleDescription(rule)}</p>

      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
        {rule.thresholdKind !== "none" ? (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-base font-semibold text-[var(--admin-on-surface)]">
                Threshold (N):
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
        ) : null}

        <div
          className={
            rule.thresholdKind !== "none" ? "mt-4 border-t border-[var(--admin-border)] pt-4" : ""
          }
        >
          {rule.id === "low-attendance" ? (
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              Note: The 50% attendance floor is fixed and not configurable.
            </p>
          ) : rule.id === "upcoming-live" ? (
            <p className="flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              This rule is informational and clears itself once sessions end.
            </p>
          ) : (
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              Threshold changes apply to the next evaluation cycle.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--admin-on-surface-variant)]">
        <span>
          Last fired:{" "}
          <span className="font-data font-semibold text-[var(--admin-on-surface)]">
            {rule.lastFiredAt ? formatRelativeTime(rule.lastFiredAt) : "Never"}
          </span>
        </span>
      </div>
    </article>
  );
}

function EmptyOpenState({
  sectionTitle,
  ruleCount,
  onOpenRules,
}: {
  sectionTitle: string;
  ruleCount: number;
  onOpenRules: () => void;
}) {
  return (
    <div
      className={`${insightPanelClassName} min-h-[360px] items-center justify-center px-6 py-24 text-center`}
    >
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--admin-surface-low)]">
        <Shield className="h-10 w-10 text-[var(--admin-outline)]" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
        Nothing is flagged in {sectionTitle}
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Alerts appear here when one of the {formatInsightNumber(ruleCount)} rules fires.
      </p>
      <button type="button" className={`${insightGhostButtonClassName} mt-8`} onClick={onOpenRules}>
        View rules
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
        aria-labelledby="mute-live-alert-title"
        className="admin-theme flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-bg)_50%,var(--admin-surface))] px-6 py-5">
          <h2
            id="mute-live-alert-title"
            className="text-base font-semibold leading-tight text-[var(--admin-on-surface)]"
          >
            Mute &lsquo;{title}&rsquo;
          </h2>
          <button
            type="button"
            className="-mr-2 -mt-2 rounded-lg p-2 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label="Close"
            onClick={onCancel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 px-6 py-6">
          <p className="mb-6 text-sm text-[var(--admin-on-surface-variant)]">
            Muting hides the alert from the dashboard but does not change the underlying condition.
          </p>
          <fieldset>
            <legend className="mb-3 block text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface)]">
              Mute Duration
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
            Mute Rule
          </button>
        </div>
      </div>
    </div>
  );
}

function LiveAlertsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading alerts">
      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-[var(--admin-border)] md:grid-cols-6">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className={`flex flex-col gap-3 bg-[var(--admin-surface)] p-5 ${index === 0 ? "md:col-span-2" : ""}`}
          >
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-8 w-16" />
            <Shimmer className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="flex gap-6 border-b border-[var(--admin-border)] pb-3">
        <Shimmer className="h-6 w-16" />
        <Shimmer className="h-6 w-24" />
        <Shimmer className="h-6 w-16" />
        <Shimmer className="h-6 w-14" />
      </div>
      <div className={`${insightPanelClassName} gap-0 overflow-hidden p-0`}>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-5 w-5 rounded-full" />
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-4 flex-1" />
            <Shimmer className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
