"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Info,
  Megaphone,
  Minus,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
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
  insightShimmerClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";
import type { InsightAlertsTab } from "./InsightAlertsView";

type MarketingInsightAlertsViewProps = {
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

const MUTE_OPTIONS: Array<{ value: MuteFor; label: string }> = [
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "forever", label: "Forever" },
];

const ALL_INSIGHT_ALERTS_HREF = adminInsightAlertsHref("dashboard");
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
    ["Alert", "Rule", "Status", "First seen", "Resolved", "Muted until"]
      .map((cell) => csvEscape(cell))
      .join(","),
  ];
  for (const item of items) {
    lines.push(
      [
        item.title,
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

function ruleDescription(rule: InsightAlertRuleCard): string {
  return rule.description.replaceAll("{threshold}", String(rule.threshold));
}

function thresholdFieldLabel(rule: InsightAlertRuleCard): string {
  if (rule.id === "no-form-submissions-30d") return "Minimum live forms";
  if (rule.thresholdKind === "percent") return "Warning threshold (%)";
  if (rule.thresholdKind === "count") return "Threshold (N)";
  return "Threshold";
}

function openAlertsCaption(openCount: number): string {
  if (openCount === 0) return "no open warnings";
  if (openCount === 2) return "both warnings";
  return `${formatInsightNumber(openCount)} warning${openCount === 1 ? "" : "s"}`;
}

function rulesKpiCaption(rules: InsightAlertRuleCard[]): string {
  const configurable = rules.filter((rule) => rule.thresholdKind !== "none").length;
  if (rules.length === 2 && configurable === 2) {
    return "both warnings, both thresholds configurable";
  }
  return `${formatInsightNumber(configurable)} threshold${configurable === 1 ? "" : "s"} configurable`;
}

function ruleNote(ruleId: string): string | null {
  if (ruleId === "no-form-submissions-30d") {
    return "This rule only considers live forms.";
  }
  if (ruleId === "low-cta-click-rate") {
    return "Needs a minimum view count before it can fire so a brand-new CTA does not trip it.";
  }
  return null;
}

export function MarketingInsightAlertsView({
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
}: MarketingInsightAlertsViewProps) {
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

  const groupedByRule = useMemo(() => {
    const rules = board?.rules ?? [];
    const groups: Array<{ rule: InsightAlertRuleCard; items: InsightAlertBoardItem[] }> = [];
    for (const rule of rules) {
      const items = openItems.filter((item) => item.ruleId === rule.id);
      if (items.length > 0) groups.push({ rule, items });
    }
    const known = new Set(rules.map((rule) => rule.id));
    const orphans = openItems.filter((item) => !known.has(item.ruleId));
    if (orphans.length > 0) {
      groups.push({
        rule: {
          id: "unknown",
          title: "Other",
          description: "",
          icon: "campaign",
          source: "",
          enabled: true,
          threshold: 0,
          thresholdKind: "none",
          min: 0,
          max: 0,
          lastFiredAt: null,
          health: "firing",
          severities: ["warning"],
          currentValue: 0,
          currentCaption: null,
        },
        items: orphans,
      });
    }
    return groups;
  }, [board?.rules, openItems]);

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
    downloadCsv(`marketing-insight-alerts-${tab}.csv`, alertsToCsv(items));
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

      {loading && !board ? <MarketingAlertsSkeleton /> : null}

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
              <p
                className={`mt-2 flex items-center gap-1 text-xs ${
                  board.summary.open > 0
                    ? "text-[var(--admin-warning)]"
                    : "text-[var(--admin-on-surface-variant)]"
                }`}
              >
                {board.summary.open > 0 ? (
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : null}
                {openAlertsCaption(board.summary.open)}
              </p>
            </button>
            <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 md:col-span-2">
              <div className={insightKpiLabelClassName}>New since yesterday</div>
              <div className={insightKpiValueClassName}>
                {formatInsightNumber(board.summary.newSinceYesterday)}
              </div>
            </div>
            <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 md:col-span-2">
              <div className={insightKpiLabelClassName}>Resolved this week</div>
              <div className={`${insightKpiValueClassName} text-[var(--admin-success)]`}>
                {formatInsightNumber(board.summary.resolvedThisWeek)}
              </div>
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
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                {rulesKpiCaption(board.rules)}
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
                sectionTitle={sectionTitle}
                onOpenRules={() => {
                  onTabChange("rules");
                }}
              />
            ) : (
              <div className={`${insightPanelClassName} gap-8 p-4`}>
                {groupedByRule.map(({ rule, items }) => (
                  <OpenRuleGroup
                    key={rule.id}
                    ruleTitle={rule.title}
                    rows={items}
                    disabled={mutating}
                    copiedId={copiedId}
                    onMute={beginMute}
                    onResolve={(ruleId) => {
                      void onMutate({ action: "resolve", ruleId });
                    }}
                    onCopy={copyId}
                  />
                ))}
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
              sectionTitle={sectionTitle}
              disabled={mutating}
              onOpenTab={() => {
                onTabChange("open");
              }}
              onOpenRules={() => {
                onTabChange("rules");
              }}
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

function OpenRuleGroup({
  ruleTitle,
  rows,
  disabled,
  copiedId,
  onMute,
  onResolve,
  onCopy,
}: {
  ruleTitle: string;
  rows: InsightAlertBoardItem[];
  disabled: boolean;
  copiedId: string | null;
  onMute: (item: InsightAlertBoardItem, duration?: MuteFor) => void;
  onResolve: (ruleId: string) => void;
  onCopy: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-[var(--admin-border)] pb-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
          {ruleTitle}
        </h2>
        <span className="font-data text-[11px] text-[var(--admin-on-surface-variant)]">
          ({rows.length})
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
    <div className="group relative flex flex-col gap-3 rounded border border-[color-mix(in_srgb,var(--admin-warning)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-4 pl-5 transition-colors hover:bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] md:flex-row md:items-center md:gap-4">
      <span
        className="absolute bottom-0 left-0 top-0 w-1.5 rounded-l bg-[var(--admin-warning)]"
        aria-hidden="true"
      />
      <TriangleAlert className="h-6 w-6 shrink-0 text-[var(--admin-warning)]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h4 className="truncate pr-4 text-[15px] font-semibold text-[var(--admin-on-surface)]">
            {item.title}
          </h4>
          <span className="shrink-0 font-data text-sm text-[var(--admin-on-surface-variant)]">
            {formatDateTime(item.firstSeenAt)}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-[var(--admin-on-surface-variant)]">
          {item.message}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 self-end opacity-100 transition-opacity md:self-auto md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
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
      <p className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
        All resolved alerts in this section are warnings.
      </p>
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
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className={insightTableHeadClassName}>
                <th className="px-4 py-3">Alert</th>
                <th className="px-4 py-3">Rule id</th>
                <th className="px-4 py-3 text-right">First seen</th>
                <th className="px-4 py-3 text-right">Resolved</th>
                <th className="px-4 py-3">Resolved by</th>
                <th className="px-4 py-3 text-right">Duration open</th>
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
  sectionTitle,
  disabled,
  onOpenTab,
  onOpenRules,
  onUnmute,
}: {
  items: InsightAlertBoardItem[];
  sectionTitle: string;
  disabled: boolean;
  onOpenTab: () => void;
  onOpenRules: () => void;
  onUnmute: (ruleId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div
        className={`${insightPanelClassName} flex min-h-[360px] flex-col items-center justify-center px-6 py-16 text-center`}
      >
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
          <VolumeX className="h-8 w-8 opacity-70" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
          No muted rules in {sectionTitle}
        </h3>
        <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
          Muting a rule suppresses its notifications but does not change its underlying conditions
          or trigger history. You currently have no muted alert rules.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <button type="button" className={insightGhostButtonClassName} onClick={onOpenRules}>
            View active rules
          </button>
          <button type="button" className={insightGhostButtonClassName} onClick={onOpenTab}>
            Back to open
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={insightPanelClassName}>
      <p className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
        Muting hides the alert but does not change the condition.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={insightTableHeadClassName}>
              <th className="px-4 py-3">Alert</th>
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
  return (
    <div className="flex flex-col gap-6 pb-8">
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
  const canStep = rule.thresholdKind !== "none" && rule.enabled && !disabled;
  const note = ruleNote(rule.id);

  return (
    <article
      className={`${insightPanelClassName} gap-4 rounded-xl p-6 ${rule.enabled ? "" : "opacity-70"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Megaphone className="h-5 w-5 shrink-0 text-[var(--admin-warning)]" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{rule.title}</h3>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Severity it can produce
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] uppercase tracking-wider ${WARNING_BADGE}`}
              >
                Warning
              </span>
            </div>
          </div>
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
                {thresholdFieldLabel(rule)}
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
                  {rule.thresholdKind === "percent" ? "%" : ""}
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

        {note ? (
          <p
            className={`text-xs text-[var(--admin-on-surface-variant)] ${rule.thresholdKind !== "none" ? "mt-4 border-t border-[var(--admin-border)] pt-4" : ""}`}
          >
            {note}
          </p>
        ) : null}
      </div>

      <div className="text-xs text-[var(--admin-on-surface-variant)]">
        Last fired:{" "}
        <span className="font-data font-semibold text-[var(--admin-on-surface)]">
          {rule.lastFiredAt ? formatRelativeTime(rule.lastFiredAt) : "Never"}
        </span>
      </div>
    </article>
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
      className={`${insightPanelClassName} flex min-h-[400px] flex-col items-center justify-center px-6 py-24 text-center`}
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
        <CheckCircle2
          className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
        Nothing is flagged in {sectionTitle}
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Alerts appear here when one of the two active monitoring rules fires.
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
        aria-labelledby="mute-marketing-alert-title"
        className="admin-theme flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <div className="flex items-center gap-3 text-[var(--admin-warning)]">
            <VolumeX className="h-5 w-5 shrink-0" aria-hidden="true" />
            <h2
              id="mute-marketing-alert-title"
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
            <Megaphone
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

function MarketingAlertsSkeleton() {
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
