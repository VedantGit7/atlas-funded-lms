"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Inbox,
  Info,
  KeyRound,
  Megaphone,
  MessageSquare,
  Minus,
  MoreVertical,
  Plus,
  Radio,
  Search,
  ShieldAlert,
  TrendingDown,
  TriangleAlert,
  Users,
  VolumeX,
  X,
} from "lucide-react";
import { DropdownMenu } from "@atlas/design-system";
import type { InsightAlertBoardItem, InsightAlertRuleCard } from "./admin-insights-api";
import {
  csvEscape,
  formatDateTime,
  formatInsightNumber,
  formatMutedUntil,
  formatRelativeTime,
} from "./admin-insights-format";
import {
  insightGhostButtonClassName,
  insightKpiLabelClassName,
  insightKpiValueClassName,
  insightPanelClassName,
  insightPrimaryButtonClassName,
  insightSegmentButtonActiveClassName,
  insightSegmentButtonClassName,
  insightSegmentTrackClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";
import { Shimmer } from "./insight-detail-kit";

export type AlertSeverity = InsightAlertBoardItem["severity"];
export type MuteFor = "1d" | "7d" | "forever";
export type ResolvedTimeframe = "24h" | "7d" | "30d" | "90d";

/** Most severe first. */
export const ALERT_SEVERITIES: readonly AlertSeverity[] = ["critical", "warning", "info"];

export const MUTE_OPTIONS: ReadonlyArray<{ value: MuteFor; label: string }> = [
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "forever", label: "Forever" },
];

export const RESOLVED_TIMEFRAME_LABELS: Record<ResolvedTimeframe, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

export const RESOLVED_TIMEFRAME_HOURS: Record<ResolvedTimeframe, number> = {
  "24h": 24,
  "7d": 7 * 24,
  "30d": 30 * 24,
  "90d": 90 * 24,
};

export const alertMenuPanelClassName =
  "admin-theme admin-dropdown-panel border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]";

const iconButtonClassName =
  "rounded p-1.5 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[color-mix(in_srgb,var(--admin-on-surface)_6%,transparent)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const SEVERITY_TONE: Record<
  AlertSeverity,
  { text: string; bar: string; strip: string; badge: string; label: string }
> = {
  critical: {
    text: "text-[var(--admin-danger)]",
    bar: "bg-[var(--admin-danger)]",
    strip:
      "border-[color-mix(in_srgb,var(--admin-danger)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))]",
    badge:
      "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]",
    label: "Critical",
  },
  warning: {
    text: "text-[var(--admin-warning)]",
    bar: "bg-[var(--admin-warning)]",
    strip:
      "border-[color-mix(in_srgb,var(--admin-warning)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))]",
    badge:
      "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]",
    label: "Warning",
  },
  info: {
    text: "text-[var(--admin-primary)]",
    bar: "bg-[var(--admin-primary)]",
    strip:
      "border-[color-mix(in_srgb,var(--admin-primary)_22%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))]",
    badge:
      "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]",
    label: "Info",
  },
};

export function severityLabel(severity: AlertSeverity): string {
  return SEVERITY_TONE[severity].label;
}

export function SeverityIcon({
  severity,
  className,
}: {
  severity: AlertSeverity;
  className: string;
}) {
  const tone = `${className} ${SEVERITY_TONE[severity].text}`;
  if (severity === "critical") return <AlertCircle className={tone} aria-hidden="true" />;
  if (severity === "warning") return <TriangleAlert className={tone} aria-hidden="true" />;
  return <Info className={tone} aria-hidden="true" />;
}

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] uppercase tracking-wider ${SEVERITY_TONE[severity].badge}`}
    >
      {severity}
    </span>
  );
}

export function ruleIcon(icon: InsightAlertRuleCard["icon"], className: string): ReactNode {
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

export function formatDurationCompact(totalSeconds: number | null): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "-";
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(rest).padStart(2, "0")}s`;
  return `${rest}s`;
}

export function alertsToCsv(items: InsightAlertBoardItem[], ruleColumn: "rule" | "source"): string {
  const lines = [
    [
      "Alert",
      "Severity",
      ruleColumn === "source" ? "Source" : "Rule",
      "Status",
      "First seen",
      "Resolved",
      "Muted until",
    ]
      .map((cell) => csvEscape(cell))
      .join(","),
  ];
  for (const item of items) {
    lines.push(
      [
        item.title,
        item.severity,
        ruleColumn === "source" ? item.source : item.ruleId,
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

/** Whether a resolved alert was raised at one severity and climbed to another before it cleared. */
export function escalated(item: InsightAlertBoardItem): boolean {
  return (
    item.openedSeverity != null &&
    item.peakSeverity != null &&
    item.openedSeverity !== item.peakSeverity
  );
}

/* Summary strip */

export function SummaryStrip({ children }: { children: ReactNode }) {
  return (
    <section
      className="grid grid-cols-1 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-6 md:gap-px"
      aria-label="Alert summary"
    >
      {children}
    </section>
  );
}

export function SummaryTile({
  label,
  value,
  valueTone,
  labelTone,
  caption,
  wide,
  onClick,
}: {
  label: string;
  value: number;
  valueTone?: string | undefined;
  labelTone?: string | undefined;
  caption?: ReactNode;
  wide?: boolean | undefined;
  onClick?: (() => void) | undefined;
}) {
  const body = (
    <>
      <div className={`${insightKpiLabelClassName} ${labelTone ?? ""}`}>{label}</div>
      <div
        className={`${insightKpiValueClassName} ${wide ? "text-[32px]" : ""} ${valueTone ?? ""}`}
      >
        {formatInsightNumber(value)}
      </div>
      {caption ? (
        <div className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">{caption}</div>
      ) : null}
    </>
  );
  const className = `flex flex-col justify-between bg-[var(--admin-surface)] p-5 text-left ${wide ? "md:col-span-2" : ""}`;
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button
      type="button"
      className={`${className} outline-none transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30`}
      onClick={onClick}
    >
      {body}
    </button>
  );
}

/** How the open alerts split by severity, as a stacked bar. */
export function SeverityBar({
  counts,
}: {
  counts: Array<{ severity: AlertSeverity; count: number }>;
}) {
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  return (
    <div
      className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-low)]"
      aria-hidden="true"
    >
      {counts.map(({ severity, count }) => (
        <div
          key={severity}
          className={`h-full ${SEVERITY_TONE[severity].bar}`}
          style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
        />
      ))}
    </div>
  );
}

/* Tabs */

export type AlertsTabId = "open" | "resolved" | "muted" | "rules";

export function AlertTabs({
  tab,
  counts,
  onSelect,
}: {
  tab: AlertsTabId;
  counts: Record<AlertsTabId, number>;
  onSelect: (tab: AlertsTabId) => void;
}) {
  const tabs: Array<[AlertsTabId, string]> = [
    ["open", "Open"],
    ["resolved", "Resolved"],
    ["muted", "Muted"],
    ["rules", "Rules"],
  ];
  return (
    <div
      className="flex flex-wrap gap-x-4 gap-y-2 border-b border-[var(--admin-border)] sm:gap-x-6"
      role="tablist"
      aria-label="Alert views"
    >
      {tabs.map(([id, label]) => {
        const active = tab === id;
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
              onSelect(id);
            }}
          >
            {label}
            <span
              className={`rounded px-1.5 py-0.5 font-data text-[11px] font-medium ${
                active
                  ? "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]"
                  : "text-[var(--admin-on-surface-variant)]"
              }`}
            >
              {counts[id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* Open alerts */

export type AlertActions = {
  disabled: boolean;
  copiedId: string | null;
  onMute: (item: InsightAlertBoardItem, duration: MuteFor) => void;
  onResolve: (ruleId: string) => void;
  onMarkSeen: (ruleId: string) => void;
  onCopy: (id: string) => void;
};

export function AlertGroup({
  title,
  severity,
  rows,
  actions,
}: {
  title: string;
  severity?: AlertSeverity | undefined;
  rows: InsightAlertBoardItem[];
  actions: AlertActions;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-[var(--admin-border)] pb-2">
        {severity ? <SeverityIcon severity={severity} className="h-[18px] w-[18px]" /> : null}
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface)]">
          {title}
        </h2>
        <span className="ml-1 rounded border border-[var(--admin-border)] px-1.5 py-0.5 font-data text-[11px] font-medium text-[var(--admin-on-surface-variant)]">
          {rows.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((item) => (
          <AlertStrip key={item.id} item={item} actions={actions} />
        ))}
      </div>
    </section>
  );
}

function AlertStrip({ item, actions }: { item: InsightAlertBoardItem; actions: AlertActions }) {
  const { disabled } = actions;
  const tone = SEVERITY_TONE[item.severity];
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
      key: "seen",
      label: "Mark as seen",
      disabled,
      onSelect: () => {
        actions.onMarkSeen(item.ruleId);
      },
    },
    ...MUTE_OPTIONS.map((option) => ({
      key: `mute-${option.value}`,
      label: option.value === "forever" ? "Mute forever" : `Mute for ${option.label}`,
      disabled,
      onSelect: () => {
        actions.onMute(item, option.value);
      },
    })),
    {
      key: "resolve",
      label: "Mark as resolved",
      disabled,
      onSelect: () => {
        actions.onResolve(item.ruleId);
      },
    },
    {
      key: "copy",
      label: actions.copiedId === item.id ? "Copied" : "Copy alert id",
      disabled,
      onSelect: () => {
        actions.onCopy(item.id);
      },
    },
  ];

  return (
    <div
      className={`group relative flex flex-col gap-3 rounded border p-4 pl-5 transition-colors md:flex-row md:items-center md:gap-4 ${tone.strip}`}
    >
      <span
        className={`absolute bottom-0 left-0 top-0 w-1.5 rounded-l ${tone.bar}`}
        aria-hidden="true"
      />
      <SeverityIcon severity={item.severity} className="h-6 w-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate pr-4 text-[15px] font-semibold text-[var(--admin-on-surface)]">
          {item.title}
        </h3>
        <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{item.message}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end md:self-auto">
        <time
          dateTime={item.lastSeenAt}
          title={formatDateTime(item.lastSeenAt)}
          className="font-data text-sm text-[var(--admin-on-surface-variant)]"
        >
          {formatRelativeTime(item.lastSeenAt)}
        </time>
        {item.href ? (
          <Link
            href={item.href}
            prefetch={false}
            className={iconButtonClassName}
            aria-label={`Open ${item.title}`}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : null}
        <DropdownMenu
          label={`Actions for ${item.title}`}
          trigger={<MoreVertical className="h-5 w-5" aria-hidden="true" />}
          contentClassName={alertMenuPanelClassName}
          triggerClassName={iconButtonClassName}
          items={items}
        />
      </div>
    </div>
  );
}

/* Empty states */

export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`${insightPanelClassName} min-h-[360px] items-center justify-center px-6 py-16 text-center`}
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">{body}</p>
      {children ? <div className="mt-8 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

export const emptyOpenIcon = <CheckCircle2 className="h-8 w-8" aria-hidden="true" />;
export const emptyMutedIcon = <VolumeX className="h-8 w-8" aria-hidden="true" />;

/** A tinted callout above a list: a warning about what muting hides, or a coverage note. */
export function AlertsCallout({
  tone,
  children,
}: {
  tone: "warning" | "neutral";
  children: ReactNode;
}) {
  return (
    <div
      role="note"
      className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
        tone === "warning"
          ? "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] text-[var(--admin-on-surface)]"
          : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]"
      }`}
    >
      {tone === "warning" ? (
        <TriangleAlert
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
          aria-hidden="true"
        />
      ) : (
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* Tables */

export type AlertColumn = {
  key: string;
  header: string;
  align?: "right" | undefined;
  className?: string | undefined;
  cell: (item: InsightAlertBoardItem) => ReactNode;
};

const cellClassName = "px-4 py-2";

export function alertColumn(): AlertColumn {
  return {
    key: "alert",
    header: "Alert",
    cell: (item) => (
      <>
        <div className="font-semibold text-[var(--admin-on-surface)]">{item.title}</div>
        <div className="mt-0.5 max-w-sm truncate text-xs text-[var(--admin-on-surface-variant)]">
          {item.message}
        </div>
      </>
    ),
  };
}

export function severityColumn(): AlertColumn {
  return {
    key: "severity",
    header: "Severity",
    cell: (item) =>
      item.status === "resolved" && escalated(item) && item.openedSeverity && item.peakSeverity ? (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <SeverityBadge severity={item.openedSeverity} />
            <ArrowRight
              className="h-3.5 w-3.5 text-[var(--admin-on-surface-variant)]"
              aria-label="escalated to"
            />
            <SeverityBadge severity={item.peakSeverity} />
          </div>
          <p className="text-[10px] leading-tight text-[var(--admin-on-surface-variant)]">
            Escalated, then cleared
          </p>
        </div>
      ) : (
        <SeverityBadge severity={item.severity} />
      ),
  };
}

export function ruleColumn(kind: "rule" | "source"): AlertColumn {
  return kind === "source"
    ? {
        key: "source",
        header: "Source",
        className: "text-sm text-[var(--admin-on-surface-variant)]",
        cell: (item) => item.source,
      }
    : {
        key: "rule",
        header: "Rule id",
        className: "font-data text-[10px] text-[var(--admin-on-surface-variant)]",
        cell: (item) => item.ruleId,
      };
}

export function firstSeenColumn(): AlertColumn {
  return {
    key: "first-seen",
    header: "First seen",
    align: "right",
    className: "font-data text-sm text-[var(--admin-on-surface-variant)]",
    cell: (item) => formatDateTime(item.firstSeenAt),
  };
}

/** A table of alerts with the column set the caller picks, for the resolved and muted lists. */
export function AlertsTable({
  items,
  columns,
  action,
}: {
  items: InsightAlertBoardItem[];
  columns: AlertColumn[];
  action?: { header: string; cell: (item: InsightAlertBoardItem) => ReactNode } | undefined;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-left">
        <thead>
          <tr className={insightTableHeadClassName}>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-4 py-3 ${column.align === "right" ? "text-right" : ""}`}
              >
                {column.header}
              </th>
            ))}
            {action ? (
              <th className="w-28 px-4 py-3 text-right">
                {action.header ? action.header : <span className="sr-only">Actions</span>}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={`${insightTableRowClassName} group h-auto`}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`${cellClassName} ${column.align === "right" ? "text-right" : ""} ${column.className ?? ""}`}
                >
                  {column.cell(item)}
                </td>
              ))}
              {action ? (
                <td className={`${cellClassName} text-right`}>{action.cell(item)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function resolvedColumns(): AlertColumn[] {
  return [
    {
      key: "resolved",
      header: "Resolved",
      align: "right",
      cell: (item) =>
        item.resolvedAt ? (
          <>
            <div className="font-data text-sm text-[var(--admin-on-surface)]">
              {formatRelativeTime(item.resolvedAt)}
            </div>
            <div className="text-[10px] text-[var(--admin-on-surface-variant)]">
              {formatDateTime(item.resolvedAt)}
            </div>
          </>
        ) : (
          <span className="font-data text-sm text-[var(--admin-on-surface)]">-</span>
        ),
    },
    {
      key: "resolved-by",
      header: "Resolved by",
      cell: (item) => (
        <span
          className={`text-sm ${
            item.resolvedByLabel === "Automatically"
              ? "italic text-[var(--admin-on-surface-variant)]"
              : "text-[var(--admin-on-surface)]"
          }`}
        >
          {item.resolvedByLabel ?? "-"}
        </span>
      ),
    },
    {
      key: "duration",
      header: "Duration open",
      align: "right",
      className: "font-data text-sm text-[var(--admin-on-surface)]",
      cell: (item) => formatDurationCompact(item.durationSeconds),
    },
  ];
}

export function mutedUntilColumn(): AlertColumn {
  return {
    key: "muted-until",
    header: "Muted until",
    align: "right",
    className: "font-data text-sm text-[var(--admin-warning)]",
    cell: (item) => formatMutedUntil(item.mutedUntil) || "-",
  };
}

export function CopyIdMenu({
  item,
  copiedId,
  onCopy,
}: {
  item: InsightAlertBoardItem;
  copiedId: string | null;
  onCopy: (id: string) => void;
}) {
  return (
    <DropdownMenu
      label={`Actions for ${item.title}`}
      trigger={<MoreVertical className="h-5 w-5" aria-hidden="true" />}
      contentClassName={alertMenuPanelClassName}
      triggerClassName="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
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
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative h-10 w-full lg:w-56">
      <span className="sr-only">{placeholder}</span>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        className="h-full w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
      />
    </label>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className={insightSegmentTrackClassName} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? insightSegmentButtonActiveClassName : insightSegmentButtonClassName}
            onClick={() => {
              onChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
        {label}
      </span>
      {children}
    </div>
  );
}

export function SeverityFilter({
  value,
  severities,
  onChange,
}: {
  value: AlertSeverity | "all";
  severities: readonly AlertSeverity[];
  onChange: (value: AlertSeverity | "all") => void;
}) {
  return (
    <DropdownMenu
      label="Filter by severity"
      trigger={
        <span className="text-sm">{value === "all" ? "All severities" : severityLabel(value)}</span>
      }
      align="start"
      contentClassName={alertMenuPanelClassName}
      triggerClassName="inline-flex h-10 min-w-[11.5rem] items-center justify-between rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[var(--admin-on-surface)] outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
      items={[
        {
          key: "all",
          label: "All severities",
          onSelect: () => {
            onChange("all");
          },
        },
        ...severities.map((severity) => ({
          key: severity,
          label: severityLabel(severity),
          onSelect: () => {
            onChange(severity);
          },
        })),
      ]}
    />
  );
}

export function Pager({
  page,
  pageCount,
  from,
  to,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
      <span>
        Showing {formatInsightNumber(from)}-{formatInsightNumber(to)} of{" "}
        {formatInsightNumber(total)}
      </span>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--admin-outline)] outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:opacity-40"
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
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--admin-outline)] outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:opacity-40"
            disabled={page >= pageCount}
            aria-label="Next page"
            onClick={() => {
              onPageChange(page + 1);
            }}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* Rules */

export function RuleSwitch({
  rule,
  disabled,
  onToggle,
}: {
  rule: InsightAlertRuleCard;
  disabled: boolean;
  onToggle: (ruleId: string, enabled: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={rule.enabled}
      aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.title}`}
      disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:opacity-50 ${
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
  );
}

/**
 * Steps a rule's threshold by one, or takes a typed value when the user
 * leaves the field or presses Enter. Values are kept inside the rule's range.
 */
export function ThresholdStepper({
  rule,
  disabled,
  onThreshold,
}: {
  rule: InsightAlertRuleCard;
  disabled: boolean;
  onThreshold: (ruleId: string, threshold: number) => void;
}) {
  const [draft, setDraft] = useState(String(rule.threshold));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setDraft(String(rule.threshold));
  }, [rule.threshold]);

  const commit = (value: number) => {
    if (!Number.isFinite(value)) {
      setDraft(String(rule.threshold));
      return;
    }
    const next = Math.min(rule.max, Math.max(rule.min, Math.round(value)));
    setDraft(String(next));
    if (next !== rule.threshold) onThreshold(rule.id, next);
  };

  const stepClassName =
    "px-3 py-2 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-primary)]/30 disabled:opacity-40";

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)]">
      <button
        type="button"
        className={`${stepClassName} border-r border-[var(--admin-outline)]`}
        disabled={disabled || rule.threshold <= rule.min}
        aria-label={`Decrease ${rule.title} threshold`}
        onClick={() => {
          commit(rule.threshold - 1);
        }}
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <label className="flex items-center gap-1 px-2">
        <span className="sr-only">{`${rule.title} threshold`}</span>
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min={rule.min}
          max={rule.max}
          value={draft}
          disabled={disabled}
          className="w-14 bg-transparent text-center font-data text-sm font-semibold text-[var(--admin-on-surface)] outline-none [appearance:textfield] disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onBlur={() => {
            commit(Number(draft));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") inputRef.current?.blur();
          }}
        />
        {rule.thresholdKind === "percent" ? (
          <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">%</span>
        ) : null}
      </label>
      <button
        type="button"
        className={`${stepClassName} border-l border-[var(--admin-outline)]`}
        disabled={disabled || rule.threshold >= rule.max}
        aria-label={`Increase ${rule.title} threshold`}
        onClick={() => {
          commit(rule.threshold + 1);
        }}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** What the rule's metric reads now, when the API does not phrase it. */
function readingCaption(rule: InsightAlertRuleCard): string | null {
  if (rule.currentCaption) return rule.currentCaption;
  if (rule.thresholdKind === "none" || rule.health === "disabled") return null;
  const suffix = rule.thresholdKind === "percent" ? "%" : "";
  return `Current reading: ${formatInsightNumber(rule.currentValue)}${suffix}`;
}

export function RuleCard({
  rule,
  text,
  thresholdLabel,
  note,
  disabled,
  onToggle,
  onThreshold,
}: {
  rule: InsightAlertRuleCard;
  text: string;
  thresholdLabel: string;
  note: ReactNode;
  disabled: boolean;
  onToggle: (ruleId: string, enabled: boolean) => void;
  onThreshold: (ruleId: string, threshold: number) => void;
}) {
  const caption = readingCaption(rule);
  const severities = ALERT_SEVERITIES.filter((severity) => rule.severities.includes(severity));
  const hasThreshold = rule.thresholdKind !== "none";

  return (
    <article className={`${insightPanelClassName} gap-4 p-6 ${rule.enabled ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 text-[var(--admin-primary)]">
            {ruleIcon(rule.icon, "h-5 w-5 shrink-0")}
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{rule.title}</h3>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Severity it can produce
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {severities.map((severity) => (
                <SeverityBadge key={severity} severity={severity} />
              ))}
            </div>
          </div>
        </div>
        <RuleSwitch rule={rule} disabled={disabled} onToggle={onToggle} />
      </div>

      <p className="text-sm text-[var(--admin-on-surface-variant)]">{text}</p>

      {hasThreshold || caption || note ? (
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
          {hasThreshold || caption ? (
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              {hasThreshold ? (
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                    {thresholdLabel}
                  </span>
                  <ThresholdStepper
                    rule={rule}
                    disabled={disabled || !rule.enabled}
                    onThreshold={onThreshold}
                  />
                </div>
              ) : null}
              {caption ? (
                <span className="flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                  <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {caption}
                </span>
              ) : null}
            </div>
          ) : null}
          {note ? (
            <div
              className={`text-xs text-[var(--admin-on-surface-variant)] ${
                hasThreshold || caption ? "mt-4 border-t border-[var(--admin-border)] pt-4" : ""
              }`}
            >
              {note}
            </div>
          ) : null}
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

/* Mute dialog */

export function MuteDialog({
  title,
  icon,
  warning,
  muteFor,
  onMuteForChange,
  onCancel,
  onConfirm,
}: {
  title: string;
  icon: ReactNode;
  warning: ReactNode;
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
        aria-labelledby="mute-alert-title"
        className="admin-theme flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <div className="flex items-center gap-3 text-[var(--admin-warning)]">
            <VolumeX className="h-5 w-5 shrink-0" aria-hidden="true" />
            <h2
              id="mute-alert-title"
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

        <div className="flex-1 space-y-4 px-6 py-6">
          <p className="text-sm text-[var(--admin-on-surface)]">
            You are about to mute notifications for the rule:
          </p>
          <div className="flex items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-[var(--admin-on-surface-variant)]">
            {icon}
            <span className="text-sm font-medium text-[var(--admin-on-surface)]">{title}</span>
          </div>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            This stops new alerts from this rule. Existing alerts stay until resolved, and the
            underlying condition does not change.
          </p>
          {warning}
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

/* Loading */

export function AlertsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading alerts">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-6">
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
      <div className="flex flex-col gap-3">
        <Shimmer className="h-4 w-40" />
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="flex min-h-16 items-center gap-4 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4"
          >
            <Shimmer className="h-6 w-6 rounded-full" />
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
