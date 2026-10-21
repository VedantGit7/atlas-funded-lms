"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { AlertCircle, Check, Download, RefreshCw } from "lucide-react";
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
  InsightDashboardRange,
} from "./admin-insights-api";
import { formatInsightNumber } from "./admin-insights-format";
import {
  INSIGHT_RANGE_OPTIONS,
  insightBreadcrumbClassName,
  insightGhostButtonClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPageTitleClassName,
  insightPanelClassName,
  insightPrimaryButtonClassName,
} from "./admin-insights-shared";
import { copyText, downloadCsv } from "./insight-detail-kit";
import {
  ALERT_SEVERITIES,
  AlertGroup,
  AlertTabs,
  AlertsCallout,
  AlertsSkeleton,
  AlertsTable,
  CopyIdMenu,
  EmptyState,
  FilterField,
  MuteDialog,
  Pager,
  RESOLVED_TIMEFRAME_HOURS,
  RESOLVED_TIMEFRAME_LABELS,
  RuleCard,
  SearchField,
  SegmentedControl,
  SeverityBar,
  SeverityFilter,
  SummaryStrip,
  SummaryTile,
  alertColumn,
  alertsToCsv,
  emptyMutedIcon,
  emptyOpenIcon,
  firstSeenColumn,
  mutedUntilColumn,
  resolvedColumns,
  ruleColumn,
  ruleIcon,
  severityColumn,
  type AlertActions,
  type AlertSeverity,
  type AlertsTabId,
  type MuteFor,
  type ResolvedTimeframe,
} from "./insight-alerts-kit";

export type InsightAlertsTab = AlertsTabId;

export type AlertsTile = "open" | "critical" | "new" | "resolved" | "muted" | "rules";

/**
 * What one Insights section's alerts page shows beyond the shared frame. The
 * frame owns the layout, the tabs, the tables, the mute dialog and every
 * mutation; a section names its severities, its summary tiles and its copy,
 * and adds its own notes and panels.
 */
export type InsightAlertsArea = {
  /** The severities this section's rules can raise. One severity hides the severity column. */
  severities: readonly AlertSeverity[];
  /** The rule id, or the section an alert came from on the boards that span sections. */
  ruleColumn: "rule" | "source";
  /** Links to the board of every insight alert; off on the boards that are that board. */
  linkAllAlerts: boolean;
  rangePicker?: boolean | undefined;
  description?: string | undefined;
  rulesHeader?: { title: string; description: string } | undefined;
  /** Shown between the breadcrumb and the title. */
  localNav?: ((slug: string) => ReactNode) | undefined;
  /** Shown under the title. */
  notice?: ReactNode;
  tiles?: readonly AlertsTile[] | undefined;
  tileCaptions?: Partial<Record<AlertsTile, (board: InsightAlertsBoard) => ReactNode>> | undefined;
  groupOpenBy?: "severity" | "rule" | undefined;
  resolvedTimeframes?:
    | { options: readonly ResolvedTimeframe[]; initial: ResolvedTimeframe }
    | undefined;
  resolvedSeverityFilter?: boolean | undefined;
  mutedWarning?: ((items: InsightAlertBoardItem[]) => ReactNode) | undefined;
  emptyOpenBody?: ((board: InsightAlertsBoard) => string) | undefined;
  rulesIntro?: string | undefined;
  rulesAside?: ((board: InsightAlertsBoard) => ReactNode) | undefined;
  rulesFooter?: ReactNode;
  ruleText?: ((rule: InsightAlertRuleCard) => string) | undefined;
  ruleNote?: ((rule: InsightAlertRuleCard) => ReactNode) | undefined;
  thresholdLabel?: ((rule: InsightAlertRuleCard) => string) | undefined;
  muteWarning?: ((ruleId: string) => ReactNode) | undefined;
};

export type InsightAlertsViewProps = {
  slug: string;
  sectionTitle: string;
  area: InsightAlertsArea;
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

const DEFAULT_TILES: readonly AlertsTile[] = ["open", "new", "resolved", "muted", "rules"];
const RESOLVED_PAGE_SIZE = 10;

function defaultThresholdLabel(rule: InsightAlertRuleCard): string {
  return rule.thresholdKind === "percent" ? "Threshold (%)" : "Threshold (N)";
}

function rulesCaption(rules: InsightAlertRuleCard[]): string {
  const configurable = rules.filter((rule) => rule.thresholdKind !== "none").length;
  if (configurable === 0) return "No thresholds to set";
  if (configurable === rules.length) return "All thresholds configurable";
  return `${formatInsightNumber(configurable)} threshold${configurable === 1 ? "" : "s"} configurable`;
}

function groupBySeverity(items: InsightAlertBoardItem[]) {
  return ALERT_SEVERITIES.map((severity) => ({
    key: severity,
    title: severity,
    severity,
    rows: items.filter((item) => item.severity === severity),
  })).filter((group) => group.rows.length > 0);
}

function groupByRule(items: InsightAlertBoardItem[], rules: InsightAlertRuleCard[]) {
  const groups = rules
    .map((rule) => ({
      key: rule.id,
      title: rule.title,
      severity: undefined,
      rows: items.filter((item) => item.ruleId === rule.id),
    }))
    .filter((group) => group.rows.length > 0);
  const known = new Set(rules.map((rule) => rule.id));
  const others = items.filter((item) => !known.has(item.ruleId));
  if (others.length > 0)
    groups.push({ key: "other", title: "Other", severity: undefined, rows: others });
  return groups;
}

export function InsightAlertsView({
  slug,
  sectionTitle,
  area,
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
  const [timeframe, setTimeframe] = useState<ResolvedTimeframe | null>(
    area.resolvedTimeframes?.initial ?? null,
  );
  const [resolvedSeverity, setResolvedSeverity] = useState<AlertSeverity | "all">("all");
  const [resolvedPage, setResolvedPage] = useState(1);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [muteTarget, setMuteTarget] = useState<InsightAlertBoardItem | null>(null);
  const [muteFor, setMuteFor] = useState<MuteFor>("1d");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const alerts = useMemo(() => board?.alerts ?? [], [board?.alerts]);
  const openItems = useMemo(() => alerts.filter((item) => item.status === "open"), [alerts]);
  const mutedItems = useMemo(() => alerts.filter((item) => item.status === "muted"), [alerts]);
  const allResolved = useMemo(() => alerts.filter((item) => item.status === "resolved"), [alerts]);

  const resolvedItems = useMemo(() => {
    const cutoff = timeframe
      ? new Date(Date.now() - RESOLVED_TIMEFRAME_HOURS[timeframe] * 60 * 60 * 1000).toISOString()
      : null;
    const needle = resolvedQuery.trim().toLowerCase();
    return allResolved.filter((item) => {
      if (cutoff && (item.resolvedAt ?? item.lastSeenAt) < cutoff) return false;
      if (resolvedSeverity !== "all" && item.severity !== resolvedSeverity) return false;
      if (!needle) return true;
      return `${item.title} ${item.message} ${item.ruleId} ${item.source}`
        .toLowerCase()
        .includes(needle);
    });
  }, [allResolved, resolvedQuery, resolvedSeverity, timeframe]);

  const resolvedPageCount = Math.max(1, Math.ceil(resolvedItems.length / RESOLVED_PAGE_SIZE));
  const page = Math.min(resolvedPage, resolvedPageCount);
  const resolvedSlice = resolvedItems.slice(
    (page - 1) * RESOLVED_PAGE_SIZE,
    page * RESOLVED_PAGE_SIZE,
  );

  const visibleOpen = criticalOnly
    ? openItems.filter((item) => item.severity === "critical")
    : openItems;
  const openGroups =
    area.groupOpenBy === "rule"
      ? groupByRule(visibleOpen, board?.rules ?? [])
      : groupBySeverity(visibleOpen);

  const showSeverity = area.severities.length > 1;

  const selectTab = (next: InsightAlertsTab) => {
    if (next !== "open") setCriticalOnly(false);
    setResolvedPage(1);
    onTabChange(next);
  };

  const actions: AlertActions = {
    disabled: mutating,
    copiedId,
    onMute: (item, duration) => {
      setMuteFor(duration);
      setMuteTarget(item);
    },
    onResolve: (ruleId) => {
      void onMutate({ action: "resolve", ruleId });
    },
    onMarkSeen: (ruleId) => {
      void onMutate({ action: "mark-seen", ruleId });
    },
    onCopy: (id) => {
      void copyText(id).then((copied) => {
        if (!copied) return;
        setCopiedId(id);
        window.setTimeout(() => {
          setCopiedId((current) => (current === id ? null : current));
        }, 1600);
      });
    },
  };

  const exportTab = () => {
    const items = tab === "muted" ? mutedItems : tab === "resolved" ? resolvedItems : openItems;
    downloadCsv(`${slug}-alerts-${tab}.csv`, alertsToCsv(items, area.ruleColumn));
  };

  const heading =
    tab === "rules" && area.rulesHeader
      ? area.rulesHeader
      : {
          title: "Alerts",
          description:
            area.description ?? `What ${sectionTitle} is flagging, and the thresholds behind it.`,
        };

  const muteRule = muteTarget
    ? board?.rules.find((rule) => rule.id === muteTarget.ruleId)
    : undefined;

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

      {area.localNav?.(slug)}

      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h1 className={insightPageTitleClassName}>{heading.title}</h1>
          <p className={insightPageDescClassName}>{heading.description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          {area.rangePicker ? (
            <SegmentedControl
              label="Date range"
              value={range}
              options={INSIGHT_RANGE_OPTIONS}
              onChange={onRangeChange}
            />
          ) : null}
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
            {area.linkAllAlerts ? (
              <Link
                href={adminInsightAlertsHref("dashboard")}
                prefetch={false}
                className={insightGhostButtonClassName}
              >
                View all insight alerts
              </Link>
            ) : (
              <button
                type="button"
                className={insightGhostButtonClassName}
                onClick={() => {
                  selectTab("rules");
                }}
              >
                View rules
              </button>
            )}
            <button
              type="button"
              className={insightPrimaryButtonClassName}
              disabled={mutating || openItems.length === 0}
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

      {area.notice}

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

      {loading && !board ? <AlertsSkeleton /> : null}

      {board && !error ? (
        <>
          <SummaryStrip>
            {(area.tiles ?? DEFAULT_TILES).map((tile) => {
              const caption = area.tileCaptions?.[tile]?.(board);
              if (tile === "open") {
                const counts = area.severities.map((severity) => ({
                  severity,
                  count: board.summary[severity],
                }));
                return (
                  <SummaryTile
                    key={tile}
                    wide
                    label="Open alerts"
                    value={board.summary.open}
                    caption={
                      caption ??
                      (board.summary.open === 0 ? (
                        "No open alerts"
                      ) : (
                        <>
                          {counts
                            .filter(({ count }) => count > 0)
                            .map(
                              ({ severity, count }) => `${formatInsightNumber(count)} ${severity}`,
                            )
                            .join(" · ")}
                          {counts.length > 1 ? <SeverityBar counts={counts} /> : null}
                        </>
                      ))
                    }
                    onClick={() => {
                      setCriticalOnly(false);
                      selectTab("open");
                    }}
                  />
                );
              }
              if (tile === "critical") {
                return (
                  <SummaryTile
                    key={tile}
                    label="Critical"
                    labelTone="text-[var(--admin-danger)]"
                    value={board.summary.critical}
                    valueTone="text-[var(--admin-danger)]"
                    caption={caption}
                    onClick={() => {
                      selectTab("open");
                      setCriticalOnly(true);
                    }}
                  />
                );
              }
              if (tile === "new") {
                return (
                  <SummaryTile
                    key={tile}
                    label="New since yesterday"
                    value={board.summary.newSinceYesterday}
                    caption={caption}
                  />
                );
              }
              if (tile === "resolved") {
                return (
                  <SummaryTile
                    key={tile}
                    label="Resolved this week"
                    value={board.summary.resolvedThisWeek}
                    valueTone="text-[var(--admin-success)]"
                    caption={caption}
                  />
                );
              }
              if (tile === "muted") {
                return (
                  <SummaryTile
                    key={tile}
                    label="Muted"
                    value={board.summary.muted}
                    valueTone="text-[var(--admin-on-surface-variant)]"
                    caption={
                      caption ?? (
                        <span className="block truncate">{mutedItems[0]?.title ?? ""}</span>
                      )
                    }
                    onClick={() => {
                      selectTab("muted");
                    }}
                  />
                );
              }
              return (
                <SummaryTile
                  key={tile}
                  label="Rules"
                  value={board.rules.length}
                  caption={caption ?? rulesCaption(board.rules)}
                  onClick={() => {
                    selectTab("rules");
                  }}
                />
              );
            })}
          </SummaryStrip>

          <AlertTabs
            tab={tab}
            counts={{
              open: openItems.length,
              resolved: allResolved.length,
              muted: mutedItems.length,
              rules: board.rules.length,
            }}
            onSelect={selectTab}
          />

          {tab === "open" ? (
            openItems.length === 0 ? (
              <EmptyState
                icon={emptyOpenIcon}
                title={`Nothing is flagged in ${sectionTitle}`}
                body={
                  area.emptyOpenBody?.(board) ??
                  `Alerts appear here when one of the ${formatInsightNumber(board.rules.length)} rules fires.`
                }
              >
                <button
                  type="button"
                  className={insightGhostButtonClassName}
                  onClick={() => {
                    selectTab("rules");
                  }}
                >
                  View rules
                </button>
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-8 pb-8">
                {criticalOnly ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                    {visibleOpen.length === 0
                      ? "No critical alerts are open."
                      : "Showing critical alerts only."}
                    <button
                      type="button"
                      className="text-sm font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                      onClick={() => {
                        setCriticalOnly(false);
                      }}
                    >
                      Show all open alerts
                    </button>
                  </div>
                ) : null}
                {openGroups.map((group) => (
                  <AlertGroup
                    key={group.key}
                    title={group.title}
                    severity={group.severity}
                    rows={group.rows}
                    actions={actions}
                  />
                ))}
              </div>
            )
          ) : null}

          {tab === "resolved" ? (
            <div className={`${insightPanelClassName} pb-0`}>
              <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-wrap gap-4">
                  {area.resolvedTimeframes && timeframe ? (
                    <FilterField label="Timeframe">
                      <SegmentedControl
                        label="Resolved timeframe"
                        value={timeframe}
                        options={area.resolvedTimeframes.options.map((value) => ({
                          value,
                          label: RESOLVED_TIMEFRAME_LABELS[value],
                        }))}
                        onChange={(value) => {
                          setTimeframe(value);
                          setResolvedPage(1);
                        }}
                      />
                    </FilterField>
                  ) : null}
                  {area.resolvedSeverityFilter ? (
                    <FilterField label="Severity">
                      <SeverityFilter
                        value={resolvedSeverity}
                        severities={area.severities}
                        onChange={(value) => {
                          setResolvedSeverity(value);
                          setResolvedPage(1);
                        }}
                      />
                    </FilterField>
                  ) : null}
                </div>
                <SearchField
                  value={resolvedQuery}
                  placeholder="Search resolved alerts"
                  onChange={(value) => {
                    setResolvedQuery(value);
                    setResolvedPage(1);
                  }}
                />
              </div>
              {resolvedItems.length === 0 ? (
                <p className="px-6 py-16 text-center text-sm text-[var(--admin-on-surface-variant)]">
                  {allResolved.length === 0
                    ? "No resolved alerts yet. Resolved alerts appear here after you mark them resolved or the condition clears."
                    : resolvedQuery.trim()
                      ? "No resolved alerts match your search."
                      : "No resolved alerts in this timeframe."}
                </p>
              ) : (
                <>
                  <AlertsTable
                    items={resolvedSlice}
                    columns={[
                      alertColumn(),
                      ...(showSeverity ? [severityColumn()] : []),
                      ruleColumn(area.ruleColumn),
                      firstSeenColumn(),
                      ...resolvedColumns(),
                    ]}
                    action={{
                      header: "",
                      cell: (item) => (
                        <CopyIdMenu item={item} copiedId={copiedId} onCopy={actions.onCopy} />
                      ),
                    }}
                  />
                  <Pager
                    page={page}
                    pageCount={resolvedPageCount}
                    from={(page - 1) * RESOLVED_PAGE_SIZE + 1}
                    to={Math.min(page * RESOLVED_PAGE_SIZE, resolvedItems.length)}
                    total={resolvedItems.length}
                    onPageChange={setResolvedPage}
                  />
                </>
              )}
            </div>
          ) : null}

          {tab === "muted" ? (
            <div className="flex flex-col gap-4 pb-8">
              {area.mutedWarning?.(mutedItems)}
              {mutedItems.length === 0 ? (
                <EmptyState
                  icon={emptyMutedIcon}
                  title={`No muted rules in ${sectionTitle}`}
                  body="Muting a rule keeps its alerts off the Open list without changing the underlying condition."
                >
                  <button
                    type="button"
                    className={insightGhostButtonClassName}
                    onClick={() => {
                      selectTab("rules");
                    }}
                  >
                    View rules
                  </button>
                  <button
                    type="button"
                    className={insightGhostButtonClassName}
                    onClick={() => {
                      selectTab("open");
                    }}
                  >
                    Back to open
                  </button>
                </EmptyState>
              ) : (
                <div className={insightPanelClassName}>
                  <AlertsTable
                    items={mutedItems}
                    columns={[
                      alertColumn(),
                      ...(showSeverity ? [severityColumn()] : []),
                      ruleColumn(area.ruleColumn),
                      firstSeenColumn(),
                      mutedUntilColumn(),
                    ]}
                    action={{
                      header: "Actions",
                      cell: (item) => (
                        <button
                          type="button"
                          className="text-sm font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:opacity-50"
                          disabled={mutating}
                          onClick={() => {
                            void onMutate({ action: "unmute", ruleId: item.ruleId });
                          }}
                        >
                          Unmute
                        </button>
                      ),
                    }}
                  />
                  <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
                    <p className="text-xs leading-5 text-[var(--admin-on-surface-variant)]">
                      Muted alerts stay off the Open list until unmuted. Muting does not change the
                      underlying condition, and Forever needs an operator to unmute.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {tab === "rules" ? (
            <div
              className={`grid grid-cols-1 gap-6 pb-8 ${area.rulesAside ? "lg:grid-cols-12" : ""}`}
            >
              <div className={`flex flex-col gap-4 ${area.rulesAside ? "lg:col-span-8" : ""}`}>
                {area.rulesIntro ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    {area.rulesIntro}
                  </p>
                ) : null}
                {board.rules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    text={area.ruleText?.(rule) ?? rule.description}
                    thresholdLabel={(area.thresholdLabel ?? defaultThresholdLabel)(rule)}
                    note={
                      area.ruleNote?.(rule) ??
                      (rule.thresholdKind === "none" ? "This rule has no threshold to set." : null)
                    }
                    disabled={mutating}
                    onToggle={(ruleId, enabled) => {
                      void onMutate({ action: "toggle-rule", ruleId, enabled });
                    }}
                    onThreshold={(ruleId, threshold) => {
                      void onMutate({ action: "set-threshold", ruleId, threshold });
                    }}
                  />
                ))}
                {area.rulesFooter}
              </div>
              {area.rulesAside ? (
                <aside className="lg:col-span-4">{area.rulesAside(board)}</aside>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {muteTarget ? (
        <MuteDialog
          title={muteTarget.title}
          icon={ruleIcon(muteRule?.icon ?? "activity", "h-4 w-4 shrink-0")}
          warning={
            area.muteWarning?.(muteTarget.ruleId) ? (
              <AlertsCallout tone="warning">{area.muteWarning(muteTarget.ruleId)}</AlertsCallout>
            ) : null
          }
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

/** School Vitals and the Dashboard board, which spans every section. */
export const genericAlertsArea: InsightAlertsArea = {
  severities: ALERT_SEVERITIES,
  ruleColumn: "source",
  linkAllAlerts: false,
  rangePicker: true,
  resolvedTimeframes: { options: ["7d", "30d", "90d"], initial: "7d" },
  rulesIntro:
    "Rules fire from live insight metrics. Tune a threshold or disable a rule to keep it off the Open list.",
};
