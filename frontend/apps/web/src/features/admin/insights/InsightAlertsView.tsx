"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  Inbox,
  Info,
  KeyRound,
  Megaphone,
  MessageSquare,
  Minus,
  MoreVertical,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingDown,
  Users,
  VolumeX,
  X,
} from "lucide-react";
import { DropdownMenu } from "@atlas/design-system";
import { ADMIN_INSIGHTS_HREF, adminInsightHref } from "./admin-insights-catalog";
import type {
  InsightAlertBoardItem,
  InsightAlertRuleCard,
  InsightAlertsBoard,
  InsightAlertsMutation,
  InsightDashboardRange,
} from "./admin-insights-api";
import {
  csvEscape,
  formatDateTime,
  formatDurationHms,
  formatInsightNumber,
  formatMutedUntil,
  formatRelativeTime,
} from "./admin-insights-format";
import {
  INSIGHT_RANGE_OPTIONS,
  insightBreadcrumbClassName,
  insightGhostButtonClassName,
  insightKpiCardClassName,
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

export type InsightAlertsTab = "open" | "resolved" | "muted" | "rules";

type InsightAlertsViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightAlertsBoard | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  range: InsightDashboardRange;
  tab: InsightAlertsTab;
  onRangeChange: (range: InsightDashboardRange) => void;
  onTabChange: (tab: InsightAlertsTab) => void;
  onRefresh: () => void;
  onMutate: (body: InsightAlertsMutation) => Promise<void>;
};

const MUTE_OPTIONS = [
  { value: "1d", label: "24 hours", hint: "Until tomorrow" },
  { value: "7d", label: "7 days", hint: "Pause for a week" },
  { value: "forever", label: "Indefinitely", hint: "Requires manual unmute" },
] as const;

const TIMEFRAME_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
] as const;

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
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
    ["Alert", "Severity", "Source", "Status", "First seen", "Resolved", "Muted until"]
      .map((cell) => csvEscape(cell))
      .join(","),
  ];
  for (const item of items) {
    lines.push(
      [
        item.title,
        item.severity,
        item.source,
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

function ruleIcon(icon: InsightAlertRuleCard["icon"]): ReactNode {
  const className = "h-5 w-5";
  if (icon === "payments") return <CreditCard className={className} aria-hidden="true" />;
  if (icon === "inbox") return <Inbox className={className} aria-hidden="true" />;
  if (icon === "live") return <Radio className={className} aria-hidden="true" />;
  if (icon === "users") return <Users className={className} aria-hidden="true" />;
  if (icon === "trend") return <TrendingDown className={className} aria-hidden="true" />;
  if (icon === "moderation") return <ShieldAlert className={className} aria-hidden="true" />;
  if (icon === "course") return <BookOpen className={className} aria-hidden="true" />;
  if (icon === "campaign") return <Megaphone className={className} aria-hidden="true" />;
  if (icon === "message") return <MessageSquare className={className} aria-hidden="true" />;
  if (icon === "security") return <KeyRound className={className} aria-hidden="true" />;
  return <Activity className={className} aria-hidden="true" />;
}

function severityBadge(severity: InsightAlertBoardItem["severity"]): string {
  if (severity === "critical") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  if (severity === "warning") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
}

function accentBar(severity: InsightAlertBoardItem["severity"]): string {
  if (severity === "critical") return "bg-[var(--admin-danger)]";
  if (severity === "warning") return "bg-[var(--admin-warning)]";
  return "bg-[var(--admin-outline)]";
}

function menuPanelClassName(): string {
  return "admin-theme admin-dropdown-panel border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]";
}

function RangeControl({
  range,
  onRangeChange,
}: {
  range: InsightDashboardRange;
  onRangeChange: (range: InsightDashboardRange) => void;
}) {
  return (
    <div className={insightSegmentTrackClassName} role="radiogroup" aria-label="Date range">
      {INSIGHT_RANGE_OPTIONS.map((option) => {
        const active = option.value === range;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? insightSegmentButtonActiveClassName : insightSegmentButtonClassName}
            onClick={() => {
              onRangeChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function InsightAlertsView({
  slug,
  sectionTitle,
  board,
  loading,
  mutating,
  error,
  range,
  tab,
  onRangeChange,
  onTabChange,
  onRefresh,
  onMutate,
}: InsightAlertsViewProps) {
  const [resolvedQuery, setResolvedQuery] = useState("");
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d">("7d");
  const [muteTarget, setMuteTarget] = useState<InsightAlertBoardItem | null>(null);
  const [muteFor, setMuteFor] = useState<"1d" | "7d" | "forever">("1d");

  const openCount = board?.summary.open ?? 0;
  const resolvedCount = board?.alerts.filter((item) => item.status === "resolved").length ?? 0;
  const mutedCount = board?.summary.muted ?? 0;
  const mutedTitle = board?.alerts.find((item) => item.status === "muted")?.title ?? null;

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
      return `${item.title} ${item.message} ${item.source}`.toLowerCase().includes(needle);
    });
  }, [board?.alerts, resolvedQuery, timeframe]);

  const groupedOpen = useMemo(
    () => ({
      critical: openItems.filter((item) => item.severity === "critical"),
      warning: openItems.filter((item) => item.severity === "warning"),
      info: openItems.filter((item) => item.severity === "info"),
    }),
    [openItems],
  );

  const criticalShare =
    board && board.summary.open > 0 ? (board.summary.critical / board.summary.open) * 100 : 0;
  const warningShare =
    board && board.summary.open > 0 ? (board.summary.warning / board.summary.open) * 100 : 0;
  const infoShare =
    board && board.summary.open > 0 ? (board.summary.info / board.summary.open) * 100 : 0;

  const exportTab = () => {
    const items = tab === "muted" ? mutedItems : tab === "resolved" ? resolvedItems : openItems;
    downloadCsv(`insight-alerts-${slug}-${tab}.csv`, alertsToCsv(items));
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
          <h1 className={insightPageTitleClassName}>Alerts</h1>
          <p className={insightPageDescClassName}>
            What {sectionTitle} is flagging, and the thresholds behind it.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <RangeControl range={range} onRangeChange={onRangeChange} />
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
            <button
              type="button"
              className={insightGhostButtonClassName}
              onClick={() => {
                onTabChange("rules");
              }}
            >
              View rules
            </button>
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

      {loading && !board ? <InsightAlertsSkeleton /> : null}

      {board && !error ? (
        <>
          <section
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5"
            aria-label="Alert summary"
          >
            <div className={insightKpiCardClassName}>
              <div className={insightKpiLabelClassName}>Open alerts</div>
              <div className={insightKpiValueClassName}>
                {formatInsightNumber(board.summary.open)}
              </div>
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                {formatInsightNumber(board.summary.warning)} warning
                <span
                  className="mx-1.5 inline-block h-1 w-1 rounded-full bg-[var(--admin-outline)]"
                  aria-hidden="true"
                />
                {formatInsightNumber(board.summary.info)} info
                {board.summary.critical > 0 ? (
                  <>
                    <span
                      className="mx-1.5 inline-block h-1 w-1 rounded-full bg-[var(--admin-outline)]"
                      aria-hidden="true"
                    />
                    {formatInsightNumber(board.summary.critical)} critical
                  </>
                ) : null}
              </p>
              <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
                <div
                  className="h-full bg-[var(--admin-danger)]"
                  style={{ width: `${criticalShare}%` }}
                />
                <div
                  className="h-full bg-[var(--admin-warning)]"
                  style={{ width: `${warningShare}%` }}
                />
                <div
                  className="h-full bg-[var(--admin-outline)]"
                  style={{ width: `${infoShare}%` }}
                />
              </div>
            </div>
            <div className={insightKpiCardClassName}>
              <div className={insightKpiLabelClassName}>New since yesterday</div>
              <div className={insightKpiValueClassName}>
                {formatInsightNumber(board.summary.newSinceYesterday)}
              </div>
            </div>
            <div className={insightKpiCardClassName}>
              <div className={insightKpiLabelClassName}>Resolved this week</div>
              <div className={`${insightKpiValueClassName} text-[var(--admin-success)]`}>
                {formatInsightNumber(board.summary.resolvedThisWeek)}
              </div>
            </div>
            <button
              type="button"
              className={`${insightKpiCardClassName} text-left outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30`}
              onClick={() => {
                onTabChange("muted");
              }}
            >
              <div className={insightKpiLabelClassName}>Muted</div>
              <div className={`${insightKpiValueClassName} text-[var(--admin-outline)]`}>
                {formatInsightNumber(board.summary.muted)}
              </div>
              {mutedTitle ? (
                <p className="mt-1 truncate text-xs text-[var(--admin-on-surface-variant)]">
                  {mutedTitle}
                </p>
              ) : null}
            </button>
            <button
              type="button"
              className={`${insightKpiCardClassName} text-left outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30`}
              onClick={() => {
                onTabChange("rules");
              }}
            >
              <div className={insightKpiLabelClassName}>Rules</div>
              <div className={insightKpiValueClassName}>
                {formatInsightNumber(board.rules.length)}
              </div>
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                Thresholds are configurable
              </p>
            </button>
          </section>

          <div
            className="flex gap-8 border-b border-[var(--admin-border)]"
            role="tablist"
            aria-label="Alert views"
          >
            {(
              [
                ["open", `Open (${openCount})`],
                ["resolved", `Resolved (${resolvedCount})`],
                ["muted", `Muted (${mutedCount})`],
                ["rules", `Rules (${board.rules.length})`],
              ] as const
            ).map(([id, label]) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={
                    active
                      ? "-mb-px border-b-2 border-[var(--admin-primary)] pb-3 text-sm font-medium text-[var(--admin-primary)]"
                      : "pb-3 text-sm text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
                  }
                  onClick={() => {
                    onTabChange(id);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {tab === "open" ? (
            openCount === 0 ? (
              <EmptyOpenState
                sectionTitle={sectionTitle}
                onOpenRules={() => {
                  onTabChange("rules");
                }}
              />
            ) : (
              <div className="flex flex-col gap-6 pb-8">
                {(["critical", "warning", "info"] as const).map((severity) => {
                  const rows = groupedOpen[severity];
                  if (rows.length === 0) return null;
                  const tone =
                    severity === "critical"
                      ? "text-[var(--admin-danger)]"
                      : severity === "warning"
                        ? "text-[var(--admin-warning)]"
                        : "text-[var(--admin-on-surface-variant)]";
                  return (
                    <section key={severity} className="flex flex-col gap-3">
                      <h2
                        className={`flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] ${tone}`}
                      >
                        {severity === "critical" ? (
                          <AlertCircle className="h-4 w-4" aria-hidden="true" />
                        ) : severity === "warning" ? (
                          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Info className="h-4 w-4" aria-hidden="true" />
                        )}
                        {severity} ({rows.length})
                      </h2>
                      <div className={insightPanelClassName}>
                        {rows.map((item, index) => (
                          <OpenAlertRow
                            key={item.id}
                            item={item}
                            last={index === rows.length - 1}
                            disabled={mutating}
                            onMute={() => {
                              setMuteFor("1d");
                              setMuteTarget(item);
                            }}
                            onResolve={() => {
                              void onMutate({ action: "resolve", ruleId: item.ruleId });
                            }}
                            onMarkSeen={() => {
                              void onMutate({ action: "mark-seen", ruleId: item.ruleId });
                            }}
                          />
                        ))}
                      </div>
                    </section>
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
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
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
            <RulesList
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
            setMuteTarget(null);
            void onMutate({ action: "mute", ruleId, muteFor });
          }}
        />
      ) : null}
    </div>
  );
}

function OpenAlertRow({
  item,
  last,
  disabled,
  onMute,
  onResolve,
  onMarkSeen,
}: {
  item: InsightAlertBoardItem;
  last: boolean;
  disabled: boolean;
  onMute: () => void;
  onResolve: () => void;
  onMarkSeen: () => void;
}) {
  const body = (
    <div className="min-w-0 flex-1 pl-2">
      <div className="text-sm font-medium text-[var(--admin-on-surface)]">{item.title}</div>
      <div className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">{item.message}</div>
    </div>
  );

  return (
    <div
      className={`group relative flex min-h-14 items-center justify-between gap-4 p-4 ${
        last ? "" : "border-b border-[var(--admin-border)]"
      } hover:bg-[var(--admin-surface-high)]`}
    >
      <div
        className={`absolute inset-y-0 left-0 w-1.5 ${accentBar(item.severity)}`}
        aria-hidden="true"
      />
      {item.href ? (
        <Link
          href={item.href}
          prefetch={false}
          className="flex min-w-0 flex-1 items-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
        >
          {body}
        </Link>
      ) : (
        body
      )}
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
          {formatRelativeTime(item.lastSeenAt)}
        </span>
        <DropdownMenu
          label={`Actions for ${item.title}`}
          trigger={<MoreVertical className="h-5 w-5" aria-hidden="true" />}
          contentClassName={menuPanelClassName()}
          triggerClassName="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          items={[
            { key: "seen", label: "Mark as seen", disabled, onSelect: onMarkSeen },
            { key: "mute", label: "Mute rule", disabled, onSelect: onMute },
            { key: "resolve", label: "Resolve", disabled, onSelect: onResolve },
          ]}
        />
        {item.href ? (
          <ChevronRight
            className="h-5 w-5 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
        ) : null}
      </div>
    </div>
  );
}

function ResolvedTable({
  items,
  query,
  onQueryChange,
  timeframe,
  onTimeframeChange,
}: {
  items: InsightAlertBoardItem[];
  query: string;
  onQueryChange: (value: string) => void;
  timeframe: "7d" | "30d" | "90d";
  onTimeframeChange: (value: "7d" | "30d" | "90d") => void;
}) {
  return (
    <div className={`${insightPanelClassName} pb-0`}>
      <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Resolved alerts</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative h-9 w-full sm:w-64">
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
          <div
            className={insightSegmentTrackClassName}
            role="radiogroup"
            aria-label="Resolved timeframe"
          >
            {TIMEFRAME_OPTIONS.map((option) => {
              const active = option.value === timeframe;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={
                    active ? insightSegmentButtonActiveClassName : insightSegmentButtonClassName
                  }
                  onClick={() => {
                    onTimeframeChange(option.value);
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-[var(--admin-on-surface-variant)]">
          No resolved alerts in this timeframe.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={insightTableHeadClassName}>
                <th className="px-4 py-3">Alert</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">First seen</th>
                <th className="px-4 py-3 text-right">Resolved</th>
                <th className="px-4 py-3">Resolved by</th>
                <th className="px-4 py-3 text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={insightTableRowClassName}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-[var(--admin-on-surface)]">{item.title}</div>
                    <div className="text-xs text-[var(--admin-on-surface-variant)]">
                      {item.message}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] uppercase tracking-wider ${severityBadge(item.severity)}`}
                    >
                      {item.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-[var(--admin-on-surface-variant)]">
                    {item.source}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                    {formatDateTime(item.firstSeenAt)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="font-data text-sm text-[var(--admin-on-surface)]">
                      {item.resolvedAt ? formatRelativeTime(item.resolvedAt) : "n/a"}
                    </div>
                    {item.resolvedAt ? (
                      <div className="text-xs text-[var(--admin-on-surface-variant)]">
                        {formatDateTime(item.resolvedAt)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-sm text-[var(--admin-on-surface-variant)]">
                    {item.resolvedByLabel ?? "n/a"}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                    {formatDurationHms(item.durationSeconds) || "n/a"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
      <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Muted alerts</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={insightTableHeadClassName}>
              <th className="px-4 py-3">Alert</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Source</th>
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
                    className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] uppercase tracking-wider ${severityBadge(item.severity)}`}
                  >
                    {item.severity}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-[var(--admin-on-surface-variant)]">
                  {item.source}
                </td>
                <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-warning)]">
                  {formatMutedUntil(item.mutedUntil) || "n/a"}
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
          Muted alerts stay off the Open list and the dashboard until unmuted. Forever requires an
          operator to unmute.
        </p>
      </div>
    </div>
  );
}

function RulesList({
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
  return (
    <div className="flex flex-col gap-4 pb-8">
      <p className="text-sm text-[var(--admin-on-surface-variant)]">
        Rules fire from live insight metrics. Tune a threshold or disable a rule to keep it off the
        Open list.
      </p>
      {rules.map((rule) => (
        <article
          key={rule.id}
          className={`${insightPanelClassName} gap-4 p-6 ${rule.enabled ? "" : "opacity-70"}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
                <span className="text-[var(--admin-primary)]">{ruleIcon(rule.icon)}</span>
                {rule.title}
              </h3>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                {rule.description}
              </p>
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
          <div className="flex flex-wrap items-end gap-6 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            {rule.thresholdKind !== "none" ? (
              <label className="flex flex-col gap-2 text-xs text-[var(--admin-on-surface-variant)]">
                Threshold
                <span className="flex items-center gap-2">
                  <input
                    key={`${rule.id}-${rule.threshold}`}
                    type="number"
                    defaultValue={rule.threshold}
                    min={rule.min}
                    max={rule.max}
                    disabled={disabled || !rule.enabled}
                    aria-label={`${rule.title} threshold`}
                    className="h-9 w-20 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-right font-data text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:opacity-50"
                    onBlur={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isFinite(next) || next === rule.threshold) return;
                      onThreshold(rule.id, next);
                    }}
                  />
                  <span>{rule.thresholdKind === "percent" ? "%" : ""}</span>
                </span>
              </label>
            ) : null}
            <div className="flex flex-col gap-2">
              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                Severity it can produce
              </span>
              <div className="flex flex-wrap gap-2">
                {rule.severities.map((severity) => (
                  <span
                    key={severity}
                    className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] uppercase tracking-wider ${severityBadge(severity)}`}
                  >
                    {severity}
                  </span>
                ))}
              </div>
            </div>
            <div className="ml-auto text-right text-xs text-[var(--admin-on-surface-variant)]">
              {rule.health === "disabled" ? (
                <span className="inline-flex items-center gap-1.5">
                  <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
                  Rule disabled
                </span>
              ) : rule.health === "firing" ? (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full bg-[var(--admin-warning)]"
                    aria-hidden="true"
                  />
                  Live reading:{" "}
                  <span className="font-data text-[var(--admin-on-surface)]">
                    {formatInsightNumber(rule.currentValue)}
                    {rule.thresholdKind === "percent" ? "%" : ""}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2
                    className="h-3.5 w-3.5 text-[var(--admin-success)]"
                    aria-hidden="true"
                  />
                  Healthy
                  <span className="font-data text-[var(--admin-on-surface)]">
                    {formatInsightNumber(rule.currentValue)}
                    {rule.thresholdKind === "percent" ? "%" : ""}
                  </span>
                </span>
              )}
              {rule.lastFiredAt && rule.health !== "disabled" ? (
                <div className="mt-1 font-data">
                  Last fired {formatRelativeTime(rule.lastFiredAt)}
                </div>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function EmptyOpenState({
  sectionTitle,
  onOpenRules,
}: {
  sectionTitle: string;
  onOpenRules: () => void;
}) {
  return (
    <div
      className={`${insightPanelClassName} min-h-[360px] items-center justify-center px-6 py-16 text-center`}
    >
      <Minus className="mb-6 h-12 w-12 text-[var(--admin-outline)]" aria-hidden="true" />
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
        Nothing is flagged in {sectionTitle}
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Alerts appear here when one of the rules fires.
      </p>
      <button type="button" className={`${insightGhostButtonClassName} mt-6`} onClick={onOpenRules}>
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
  muteFor: "1d" | "7d" | "forever";
  onMuteForChange: (value: "1d" | "7d" | "forever") => void;
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mute-alert-title"
        className="admin-theme flex w-full max-w-[480px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]">
              <VolumeX className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="mute-alert-title"
                className="text-base font-semibold text-[var(--admin-on-surface)]"
              >
                Mute alert rule
              </h3>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">{title}</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label="Close"
            onClick={onCancel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-6 px-6 py-5">
          <p className="text-sm text-[var(--admin-on-surface)]">
            This stops new alerts from this rule. Existing alerts stay until resolved.
          </p>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Mute duration
            </legend>
            <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Mute duration">
              {MUTE_OPTIONS.map((option) => {
                const active = muteFor === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`flex items-center rounded-lg border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${
                      active
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                        : "border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)]"
                    }`}
                    onClick={() => {
                      onMuteForChange(option.value);
                    }}
                  >
                    <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                      {option.label}
                    </span>
                    <span className="ml-auto text-xs text-[var(--admin-on-surface-variant)]">
                      {option.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] px-6 py-4">
          <button type="button" className={insightGhostButtonClassName} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={insightPrimaryButtonClassName} onClick={onConfirm}>
            Confirm mute
          </button>
        </div>
      </div>
    </div>
  );
}

function InsightAlertsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading alerts">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className={`${insightKpiCardClassName} gap-3`}>
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-8 w-16" />
            <Shimmer className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="flex gap-6">
        <Shimmer className="h-8 w-20" />
        <Shimmer className="h-8 w-24" />
        <Shimmer className="h-8 w-20" />
        <Shimmer className="h-8 w-20" />
      </div>
      <div className={insightPanelClassName}>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex h-14 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-8 w-1.5" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-1/3" />
              <Shimmer className="h-3 w-2/3" />
            </div>
            <Shimmer className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
