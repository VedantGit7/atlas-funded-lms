"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BellOff,
  Check,
  ChevronRight,
  CreditCard,
  Download,
  Info,
  MoreVertical,
  RefreshCw,
  Search,
  TrendingDown,
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

type SalesInsightAlertsViewProps = {
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

type OpenSeverityFilter = "all" | "critical";
type ResolvedTimeframe = "24h" | "7d" | "30d";
type ResolvedSeverityFilter = "all" | "critical" | "warning" | "info";
type MuteFor = "1d" | "7d" | "forever";

const MUTE_OPTIONS: Array<{ value: MuteFor; label: string; hint: string }> = [
  { value: "1d", label: "1 day", hint: "Until tomorrow" },
  { value: "7d", label: "7 days", hint: "Pause for a week" },
  { value: "forever", label: "Forever", hint: "Requires an operator to unmute" },
];

const ALL_INSIGHT_ALERTS_HREF = adminInsightAlertsHref("dashboard");

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
  return "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-primary)]";
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

function thresholdFieldLabel(rule: InsightAlertRuleCard): string {
  if (rule.id === "low-conversion") return "Target (%)";
  if (rule.id === "pending-orders") return "Orders (N)";
  return "Threshold (N)";
}

function ruleIcon(rule: InsightAlertRuleCard): ReactNode {
  if (rule.icon === "trend") return <TrendingDown className="h-5 w-5" aria-hidden="true" />;
  return <CreditCard className="h-5 w-5" aria-hidden="true" />;
}

function isFailedPayments(ruleId: string): boolean {
  return ruleId === "failed-payments";
}

function escalatedThenCleared(item: InsightAlertBoardItem): boolean {
  return (
    item.status === "resolved" &&
    item.openedSeverity != null &&
    item.peakSeverity != null &&
    item.openedSeverity !== item.peakSeverity
  );
}

export function SalesInsightAlertsView({
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
}: SalesInsightAlertsViewProps) {
  const [resolvedQuery, setResolvedQuery] = useState("");
  const [timeframe, setTimeframe] = useState<ResolvedTimeframe>("7d");
  const [resolvedSeverity, setResolvedSeverity] = useState<ResolvedSeverityFilter>("all");
  const [openFilter, setOpenFilter] = useState<OpenSeverityFilter>("all");
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
    const hours = timeframe === "24h" ? 24 : timeframe === "7d" ? 7 * 24 : 30 * 24;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const needle = resolvedQuery.trim().toLowerCase();
    return items.filter((item) => {
      if ((item.resolvedAt ?? item.lastSeenAt) < cutoff) return false;
      if (resolvedSeverity !== "all" && item.severity !== resolvedSeverity) return false;
      if (!needle) return true;
      return `${item.title} ${item.message} ${item.ruleId}`.toLowerCase().includes(needle);
    });
  }, [board?.alerts, resolvedQuery, resolvedSeverity, timeframe]);

  const visibleOpen = useMemo(() => {
    if (openFilter === "critical") return openItems.filter((item) => item.severity === "critical");
    return openItems;
  }, [openFilter, openItems]);

  const groupedOpen = useMemo(
    () => ({
      critical: visibleOpen.filter((item) => item.severity === "critical"),
      warning: visibleOpen.filter((item) => item.severity === "warning"),
      info: visibleOpen.filter((item) => item.severity === "info"),
    }),
    [visibleOpen],
  );

  const criticalShare =
    board && board.summary.open > 0 ? (board.summary.critical / board.summary.open) * 100 : 0;
  const warningShare =
    board && board.summary.open > 0 ? (board.summary.warning / board.summary.open) * 100 : 0;
  const infoShare =
    board && board.summary.open > 0 ? (board.summary.info / board.summary.open) * 100 : 0;

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
    downloadCsv(`sales-insight-alerts-${tab}.csv`, alertsToCsv(items));
  };

  const beginMute = (item: InsightAlertBoardItem, duration: MuteFor) => {
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
          <h1 className={insightPageTitleClassName}>Alerts</h1>
          <p className={insightPageDescClassName}>
            What {sectionTitle} is flagging, and the thresholds behind it.
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

      {loading && !board ? <SalesAlertsSkeleton /> : null}

      {board && !error ? (
        <>
          <section
            className="grid grid-cols-1 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-5 md:gap-px"
            aria-label="Alert summary"
          >
            <button
              type="button"
              className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 text-left outline-none transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 md:col-span-2"
              onClick={() => {
                setOpenFilter("all");
                onTabChange("open");
              }}
            >
              <div className={insightKpiLabelClassName}>Open alerts</div>
              <div className={`${insightKpiValueClassName} text-[32px] leading-9`}>
                {formatInsightNumber(board.summary.open)}
              </div>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                {formatInsightNumber(board.summary.critical)} critical ·{" "}
                {formatInsightNumber(board.summary.warning)} warning ·{" "}
                {formatInsightNumber(board.summary.info)} info
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
                  className="h-full bg-[var(--admin-primary)]"
                  style={{ width: `${infoShare}%` }}
                />
              </div>
            </button>
            <button
              type="button"
              className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 text-left outline-none transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              onClick={() => {
                setOpenFilter("critical");
                onTabChange("open");
              }}
            >
              <div className={`${insightKpiLabelClassName} text-[var(--admin-danger)]`}>
                Critical
              </div>
              <div className={`${insightKpiValueClassName} mt-auto text-[var(--admin-danger)]`}>
                {formatInsightNumber(board.summary.critical)}
              </div>
            </button>
            <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
              <div className={insightKpiLabelClassName}>New since yesterday</div>
              <div className={`${insightKpiValueClassName} mt-auto`}>
                {formatInsightNumber(board.summary.newSinceYesterday)}
              </div>
            </div>
            <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
              <div className={`${insightKpiLabelClassName} text-[var(--admin-success)]`}>
                Resolved this week
              </div>
              <div className={`${insightKpiValueClassName} mt-auto text-[var(--admin-success)]`}>
                {formatInsightNumber(board.summary.resolvedThisWeek)}
              </div>
            </div>
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
              <p className="mt-auto text-xs text-[var(--admin-on-surface-variant)]">
                all thresholds configurable
              </p>
            </button>
          </section>

          <div
            className="flex gap-6 border-b border-[var(--admin-border)]"
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
                    if (id !== "open") setOpenFilter("all");
                    onTabChange(id);
                  }}
                >
                  {label}
                  <span className="ml-1.5 font-data text-xs font-medium">{count}</span>
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
            ) : visibleOpen.length === 0 ? (
              <p
                className={`${insightPanelClassName} px-6 py-16 text-center text-sm text-[var(--admin-on-surface-variant)]`}
              >
                No critical alerts are open.
              </p>
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
              items={resolvedItems}
              query={resolvedQuery}
              onQueryChange={setResolvedQuery}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              severity={resolvedSeverity}
              onSeverityChange={setResolvedSeverity}
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
          ruleId={muteTarget.ruleId}
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
  onMute: (item: InsightAlertBoardItem, duration: MuteFor) => void;
  onResolve: (ruleId: string) => void;
  onCopy: (id: string) => void;
}) {
  const tone =
    severity === "critical"
      ? "text-[var(--admin-danger)]"
      : severity === "warning"
        ? "text-[var(--admin-warning)]"
        : "text-[var(--admin-primary)]";
  const pill =
    severity === "critical"
      ? "border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]"
      : severity === "warning"
        ? "border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]"
        : "border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]";

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-[var(--admin-border)] pb-2">
        {severity === "critical" ? (
          <AlertCircle className={`h-[18px] w-[18px] ${tone}`} aria-hidden="true" />
        ) : severity === "warning" ? (
          <AlertTriangle className={`h-[18px] w-[18px] ${tone}`} aria-hidden="true" />
        ) : (
          <Info className={`h-[18px] w-[18px] ${tone}`} aria-hidden="true" />
        )}
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface)]">
          {severity}
        </h2>
        <span
          className={`ml-2 rounded border px-1.5 py-0.5 font-data text-[11px] font-medium ${pill}`}
        >
          {rows.length}
        </span>
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
  onMute: (item: InsightAlertBoardItem, duration: MuteFor) => void;
  onResolve: (ruleId: string) => void;
  onCopy: (id: string) => void;
}) {
  const surface =
    item.severity === "critical"
      ? "border-l-2 border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))]"
      : item.severity === "warning"
        ? "border-l-2 border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))]"
        : "border border-transparent bg-[var(--admin-surface-low)] hover:border-[var(--admin-outline)] hover:bg-[var(--admin-surface-high)]";
  const iconTone =
    item.severity === "critical"
      ? "text-[var(--admin-danger)]"
      : item.severity === "warning"
        ? "text-[var(--admin-warning)]"
        : "text-[var(--admin-on-surface-variant)]";

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
      className={`flex flex-col justify-between gap-4 rounded-r p-4 md:flex-row md:items-center ${surface}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        {item.severity === "critical" ? (
          <AlertCircle className={`mt-0.5 h-5 w-5 shrink-0 ${iconTone}`} aria-hidden="true" />
        ) : item.severity === "warning" ? (
          <TrendingDown className={`mt-0.5 h-5 w-5 shrink-0 ${iconTone}`} aria-hidden="true" />
        ) : (
          <CreditCard className={`mt-0.5 h-5 w-5 shrink-0 ${iconTone}`} aria-hidden="true" />
        )}
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-[var(--admin-on-surface)]">
            {item.title}
          </div>
          <div className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{item.message}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 self-end md:self-auto">
        <span className="font-data text-[10px] text-[var(--admin-on-surface-variant)]">
          {formatRelativeTime(item.lastSeenAt)}
        </span>
        {item.href ? (
          <Link
            href={item.href}
            prefetch={false}
            className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label={`Open ${item.title}`}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : null}
        <DropdownMenu
          label={`Actions for ${item.title}`}
          trigger={<MoreVertical className="h-5 w-5" aria-hidden="true" />}
          contentClassName={menuPanelClassName()}
          triggerClassName="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
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
  timeframe,
  onTimeframeChange,
  severity,
  onSeverityChange,
  copiedId,
  onCopy,
}: {
  items: InsightAlertBoardItem[];
  query: string;
  onQueryChange: (value: string) => void;
  timeframe: ResolvedTimeframe;
  onTimeframeChange: (value: ResolvedTimeframe) => void;
  severity: ResolvedSeverityFilter;
  onSeverityChange: (value: ResolvedSeverityFilter) => void;
  copiedId: string | null;
  onCopy: (id: string) => void;
}) {
  const severityLabel =
    severity === "all"
      ? "All severities"
      : severity === "critical"
        ? "Critical"
        : severity === "warning"
          ? "Warning"
          : "Info";

  return (
    <div className={`${insightPanelClassName} pb-0`}>
      <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-4">
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
                  ["24h", "Last 24 hours"],
                  ["7d", "Last 7 days"],
                  ["30d", "Last 30 days"],
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
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Severity
            </span>
            <DropdownMenu
              label="Filter by severity"
              trigger={<span className="text-sm">{severityLabel}</span>}
              align="start"
              contentClassName={menuPanelClassName()}
              triggerClassName="inline-flex h-10 min-w-[11.5rem] items-center justify-between rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[var(--admin-on-surface)] outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              items={[
                {
                  key: "all",
                  label: "All severities",
                  onSelect: () => {
                    onSeverityChange("all");
                  },
                },
                {
                  key: "critical",
                  label: "Critical",
                  onSelect: () => {
                    onSeverityChange("critical");
                  },
                },
                {
                  key: "warning",
                  label: "Warning",
                  onSelect: () => {
                    onSeverityChange("warning");
                  },
                },
                {
                  key: "info",
                  label: "Info",
                  onSelect: () => {
                    onSeverityChange("info");
                  },
                },
              ]}
            />
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
                <th className="px-4 py-2">Alert / Message</th>
                <th className="px-4 py-2">Severity</th>
                <th className="px-4 py-2">Rule</th>
                <th className="px-4 py-2 text-right">First seen</th>
                <th className="px-4 py-2 text-right">Resolved</th>
                <th className="px-4 py-2">Resolved by</th>
                <th className="px-4 py-2 text-right">Duration open</th>
                <th className="w-10 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={`${insightTableRowClassName} group h-auto`}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-[var(--admin-on-surface)]">{item.title}</div>
                    <div className="mt-0.5 max-w-sm truncate text-xs text-[var(--admin-on-surface-variant)]">
                      {item.message}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-data text-[11px] ${severityBadge(item.severity)}`}
                      >
                        {item.severity === "critical" ? (
                          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : item.severity === "warning" ? (
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Info className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {item.severity}
                      </span>
                      {escalatedThenCleared(item) ? (
                        <div className="text-[10px] leading-tight text-[var(--admin-on-surface-variant)]">
                          <div>escalated</div>
                          <div>then cleared</div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-data text-[10px] text-[var(--admin-on-surface-variant)]">
                    {item.ruleId}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-on-surface)]">
                    {formatDateTime(item.firstSeenAt)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="font-data text-sm text-[var(--admin-on-surface)]">
                      {item.resolvedAt ? formatDateTime(item.resolvedAt) : "-"}
                    </div>
                    {item.resolvedAt ? (
                      <div className="text-xs text-[var(--admin-on-surface-variant)]">
                        {formatRelativeTime(item.resolvedAt)}
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
                  <td className="px-4 py-2">
                    <DropdownMenu
                      label={`Actions for ${item.title}`}
                      trigger={<MoreVertical className="h-[18px] w-[18px]" aria-hidden="true" />}
                      contentClassName={menuPanelClassName()}
                      triggerClassName="rounded-full p-1 text-[var(--admin-on-surface-variant)] opacity-0 outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 group-hover:opacity-100"
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
      <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
        Showing {items.length} resolved alert{items.length === 1 ? "" : "s"}
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
  const failedMuted = items.some((item) => isFailedPayments(item.ruleId));

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
    <div className="flex flex-col gap-4 pb-8">
      {failedMuted ? (
        <div className="flex items-start gap-3 rounded border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-4">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--admin-on-surface)]">
            Failed payments is muted. Revenue recovery will stay off the Open list until you unmute
            it.
          </p>
        </div>
      ) : null}
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
                      className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] ${severityBadge(item.severity)}`}
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
            Muted alerts stay off the Open list and the Sales Insight dashboard until unmuted.
            Forever requires an operator to unmute.
          </p>
        </div>
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
      {rules.map((rule) => {
        const captionTone =
          rule.currentCaption?.includes("critical") === true
            ? "text-[var(--admin-danger)]"
            : "text-[var(--admin-on-surface-variant)]";
        return (
          <article
            key={rule.id}
            className={`${insightPanelClassName} gap-4 p-5 transition-colors hover:bg-[var(--admin-surface-high)] ${
              rule.enabled ? "" : "opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
                    <span className="text-[var(--admin-primary)]">{ruleIcon(rule)}</span>
                    {rule.title}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {rule.severities.map((severity) => (
                      <span
                        key={severity}
                        className={`inline-flex rounded-md border px-2 py-0.5 font-data text-[11px] ${severityBadge(severity)}`}
                      >
                        {severity}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-[var(--admin-on-surface-variant)]">{rule.description}</p>
                <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                  {rule.thresholdKind !== "none" ? (
                    <label className="flex items-center gap-3 text-sm font-medium text-[var(--admin-on-surface)]">
                      {thresholdFieldLabel(rule)}
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
                    </label>
                  ) : null}
                  {rule.currentCaption ? (
                    <span className={`ml-auto flex items-center gap-1 text-xs ${captionTone}`}>
                      <Info className="h-4 w-4" aria-hidden="true" />
                      {rule.currentCaption}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  Last fired: {rule.lastFiredAt ? formatRelativeTime(rule.lastFiredAt) : "Never"}
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
          </article>
        );
      })}
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
      <BellOff className="mb-6 h-12 w-12 text-[var(--admin-outline)]" aria-hidden="true" />
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
        Nothing is flagged in {sectionTitle}
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Alerts appear here when one of the three rules fires. You are currently operating within the
        configured thresholds.
      </p>
      <button type="button" className={`${insightGhostButtonClassName} mt-6`} onClick={onOpenRules}>
        View rules
      </button>
    </div>
  );
}

function MuteModal({
  title,
  ruleId,
  muteFor,
  onMuteForChange,
  onCancel,
  onConfirm,
}: {
  title: string;
  ruleId: string;
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

  const failed = isFailedPayments(ruleId);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mute-sales-alert-title"
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
                id="mute-sales-alert-title"
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
          {failed ? (
            <div className="flex items-start gap-3 rounded border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-3">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
                aria-hidden="true"
              />
              <p className="text-sm text-[var(--admin-on-surface)]">
                Muting failed payments hides a revenue-affecting signal. Consider raising the
                threshold instead.
              </p>
            </div>
          ) : null}
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

function SalesAlertsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading alerts">
      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-[var(--admin-border)] md:grid-cols-5">
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
      <div className="flex gap-6">
        <Shimmer className="h-8 w-16" />
        <Shimmer className="h-8 w-24" />
        <Shimmer className="h-8 w-20" />
        <Shimmer className="h-8 w-16" />
      </div>
      <div className="flex flex-col gap-3">
        <Shimmer className="h-4 w-24" />
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="flex min-h-16 items-center gap-4 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4"
          >
            <Shimmer className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-1/3" />
              <Shimmer className="h-3 w-2/3" />
            </div>
            <Shimmer className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
