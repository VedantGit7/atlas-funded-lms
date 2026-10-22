"use client";

import Link from "next/link";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";
import {
  type DomainDefinition,
  type ReportDefinition,
  type ReportParamDefinition,
} from "./admin-reports-api";
import { type DestinationsRosterPayload } from "./admin-export-destinations-api";

export type Phase = "configure" | "running" | "succeeded" | "failed";

export type FormatOption = "csv" | "xlsx" | "json";

export type DeliveryMode = "download" | "email" | "destination";

export type EmptyValuesMode = "blank" | "placeholder";

export type DatePreset = "7d" | "30d" | "90d" | "custom";

export type SectionKey = "report" | "scope" | "columns" | "format" | "delivery";

export type FilterRow = {
  id: string;
  field: string;
  operator: "eq" | "contains";
  value: string;
};

export const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

export const fieldClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

export const THEME_ORDER = ["Learners", "Commerce", "Live", "Operations"] as const;

export const THEME_BY_KEY: Record<string, (typeof THEME_ORDER)[number]> = {
  enrollments: "Learners",
  "progress-score": "Learners",
  certificates: "Learners",
  "at-risk-roster": "Learners",
  "custom-field": "Learners",
  payments: "Commerce",
  "sales-marketing": "Commerce",
  "zoom-insights": "Live",
  "live-class-attendance": "Live",
  "super-live-insights": "Live",
  polls: "Live",
  batches: "Live",
  "resource-usage": "Operations",
  exports: "Operations",
  "active-devices": "Operations",
  "assessment-items": "Operations",
};

export const PII_COLUMN_HINTS = [
  "email",
  "phone",
  "mobile",
  "address",
  "billing",
  "ip",
  "name",
  "learner_name",
  "display_name",
];

export function isPiiColumn(column: string): boolean {
  const lower = column.toLowerCase();
  return PII_COLUMN_HINTS.some((hint) => lower.includes(hint));
}

export function themeFor(definition: ReportDefinition): (typeof THEME_ORDER)[number] {
  return THEME_BY_KEY[definition.key] ?? "Operations";
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function newFilterId(): string {
  return `f-${Math.random().toString(36).slice(2, 9)}`;
}

export function datePresetRange(preset: Exclude<DatePreset, "custom">): {
  from: string;
  to: string;
} {
  const to = new Date();
  const from = new Date(to);
  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  from.setUTCDate(from.getUTCDate() - days);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** The definitions the builder lists. */
export function builderDefinitions(definitions: ReportDefinition[]): ReportDefinition[] {
  return definitions.filter((d) => d.scope !== "tenant" || d.key);
}

/** A report's parameters the filter row offers: not its date bounds or output options. */
export function filterableParamsOf(selected: ReportDefinition | null): ReportParamDefinition[] {
  if (!selected) return [];
  const dates = dateParamKeys(selected.params);
  return selected.params.filter(
    (p) =>
      p.key !== dates.start &&
      p.key !== dates.end &&
      !["columns", "rowLimit", "limit", "format", "delivery"].includes(p.key),
  );
}

export function dateParamKeys(params: ReportParamDefinition[]): { start?: string; end?: string } {
  const start =
    params.find((p) => /^(start|from|startedFrom|joinedFrom|paidFrom)/i.test(p.key))?.key ??
    params.find((p) => p.type === "date" && /start|from/i.test(p.key))?.key;
  const end =
    params.find((p) => /^(end|to|startedTo|joinedTo|paidTo)/i.test(p.key))?.key ??
    params.find((p) => p.type === "date" && /end|to/i.test(p.key))?.key;
  return {
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
  };
}

export function ModuleTabs({ active }: { active: "history" | "new" | "schedules" }) {
  const tabs = [
    { id: "history" as const, label: "History", href: "/admin/reports/exports", enabled: true },
    { id: "new" as const, label: "New export", href: "/admin/reports/exports/new", enabled: true },
    {
      id: "schedules" as const,
      label: "Schedules",
      href: "/admin/reports/exports/schedules",
      enabled: true,
    },
    {
      id: "destinations",
      label: "Destinations",
      href: "/admin/reports/exports/destinations",
      enabled: true,
    },
    {
      id: "settings",
      label: "Settings",
      href: "/admin/reports/exports/settings",
      enabled: true,
    },
  ];
  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--admin-border)]">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        if (!tab.enabled) {
          return (
            <span
              key={tab.id}
              className="px-4 py-2.5 text-sm text-[var(--admin-on-surface-variant)] opacity-50"
              title="Coming soon"
            >
              {tab.label}
            </span>
          );
        }
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-[var(--admin-primary-strong)] text-[var(--admin-primary-strong)]"
                : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function SectionHeader({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-[12px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)]">
          {step}
        </span>
        <h2 className="text-[16px] font-bold tracking-wider text-[var(--admin-on-surface)] uppercase">
          {title}
        </h2>
      </div>
      <p className="pl-8 text-[12px] text-[var(--admin-on-surface-variant)]">{description}</p>
    </div>
  );
}

export function PipelineMini({
  stages,
}: {
  stages: Array<{ key: string; label: string; state: string }>;
}) {
  const currentIndex = Math.max(
    0,
    stages.findIndex((s) => s.state === "current" || s.state === "failed"),
  );
  const progressPct = stages.every((s) => s.state === "complete")
    ? 100
    : Math.round(
        ((currentIndex + (stages[currentIndex]?.state === "complete" ? 1 : 0.5)) / stages.length) *
          100,
      );

  return (
    <div className="relative w-full max-w-2xl pt-2 pb-8">
      <div className="absolute top-4 right-4 left-4 h-0.5 bg-[var(--admin-border)]" />
      <div
        className="absolute top-4 left-4 h-0.5 bg-[var(--admin-primary-strong)] transition-all duration-500"
        style={{ width: `calc(${String(Math.min(progressPct, 100))}% - 2rem)` }}
      />
      <div className="relative z-10 flex justify-between">
        {stages.map((stage) => {
          const complete = stage.state === "complete";
          const current = stage.state === "current";
          const failed = stage.state === "failed";
          return (
            <div key={stage.key} className="flex w-16 flex-col items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full border-2 ${
                  complete || current
                    ? "border-[var(--admin-primary-strong)] bg-[var(--admin-primary-strong)]"
                    : failed
                      ? "border-[var(--admin-danger)] bg-[var(--admin-danger)]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)]"
                } ${current ? "motion-safe:animate-[admin-pipeline-pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" : ""}`}
              />
              <span
                className={`font-mono text-[10px] ${
                  current || failed
                    ? "font-semibold text-[var(--admin-on-surface)]"
                    : "text-[var(--admin-on-surface-variant)]"
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type NewExportPageProps = {
  /** The report definitions as the API returns them, loaded by the server. */
  initialDefinitions?: ReportInitialData<{ items: DomainDefinition[] }> | null;
  /** The destinations the builder offers, loaded by the server. */
  initialDestinations?: ReportInitialData<DestinationsRosterPayload> | null;
};
