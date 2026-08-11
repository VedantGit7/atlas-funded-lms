"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Info,
  RefreshCw,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import { ADMIN_INSIGHTS_HREF, adminInsightHref } from "./admin-insights-catalog";
import type {
  InsightSettingsAccessRow,
  InsightSettingsBoard,
  InsightSettingsMutation,
  InsightSettingsPatch,
} from "./admin-insights-api";
import { formatRelativeTime } from "./admin-insights-format";
import {
  INSIGHT_RANGE_OPTIONS,
  insightGhostButtonClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPageTitleClassName,
  insightPrimaryButtonClassName,
  insightSegmentButtonActiveClassName,
  insightSegmentButtonClassName,
  insightSegmentTrackClassName,
  insightSelectContentClassName,
  insightSelectTriggerClassName,
  insightShimmerClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";

type InsightSettingsViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightSettingsBoard | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  onRetry: () => void;
  onMutate: (body: InsightSettingsMutation) => Promise<InsightSettingsBoard | null>;
};

const REFRESH_OPTIONS = [
  { value: "15", label: "Every 15 minutes" },
  { value: "30", label: "Every 30 minutes" },
  { value: "60", label: "Every hour" },
];

const CACHE_OPTIONS = [
  { value: "5", label: "5 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "60 minutes" },
];

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

function patchFromBoard(board: InsightSettingsBoard): InsightSettingsPatch {
  const row = board.settings;
  return {
    defaultSection: row.defaultSection,
    defaultPeriod: row.defaultPeriod,
    weekStartsOn: row.weekStartsOn,
    numberFormat: row.numberFormat,
    autoRefresh: row.autoRefresh,
    refreshIntervalMinutes: row.refreshIntervalMinutes,
    showLastUpdated: row.showLastUpdated,
    cacheMinutes: row.cacheMinutes,
  };
}

function patchesEqual(left: InsightSettingsPatch, right: InsightSettingsPatch): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function dataClassLabel(value: InsightSettingsAccessRow["dataClass"]): string {
  if (value === "personal") return "Personal data";
  if (value === "financial") return "Financial data";
  return "Aggregated";
}

function dataClassClass(value: InsightSettingsAccessRow["dataClass"]): string {
  if (value === "aggregated") {
    return "border-[color-mix(in_srgb,var(--admin-success)_20%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] text-[var(--admin-success)]";
  }
  return "border-[color-mix(in_srgb,var(--admin-warning)_20%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] text-[var(--admin-warning)]";
}

export function InsightSettingsView({
  slug,
  sectionTitle,
  board,
  loading,
  mutating,
  error,
  onRetry,
  onMutate,
}: InsightSettingsViewProps) {
  const [draft, setDraft] = useState<InsightSettingsPatch | null>(null);
  const [restrictRow, setRestrictRow] = useState<InsightSettingsAccessRow | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    if (board) setDraft(patchFromBoard(board));
  }, [board]);

  const saved = board ? patchFromBoard(board) : null;
  const dirty = Boolean(draft && saved && !patchesEqual(draft, saved));

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [dirty]);

  const sectionOptions = useMemo(
    () =>
      (board?.sections ?? [])
        .filter((section) => !(board?.settings.restrictedSlugs.includes(section.slug) ?? false))
        .map((section) => ({ value: section.slug, label: section.title })),
    [board],
  );

  const formatSample =
    draft?.numberFormat === "european"
      ? "1.234.567,89"
      : (board?.numberFormatSample ?? "1,234,567.89");

  return (
    <div className={insightPageClassName}>
      <nav className="flex items-center gap-2 text-[12px] text-[var(--admin-on-surface-variant)]">
        <Link href="/admin" prefetch={false} className="hover:text-[var(--admin-primary)]">
          Admin
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href={ADMIN_INSIGHTS_HREF}
          prefetch={false}
          className="hover:text-[var(--admin-primary)]"
        >
          Insights
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href={adminInsightHref(slug)}
          prefetch={false}
          className="hover:text-[var(--admin-primary)]"
        >
          {sectionTitle}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">Settings</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={insightPageTitleClassName}>Settings</h1>
          <p className={insightPageDescClassName}>
            Defaults, refresh behaviour, and access for every insights dashboard.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {dirty ? (
            <span className="inline-flex items-center gap-2 rounded bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] px-3 py-1 text-[12px] text-[var(--admin-warning)]">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Unsaved changes
            </span>
          ) : null}
          <Link href="/admin/audit" prefetch={false} className={insightGhostButtonClassName}>
            View audit log
          </Link>
          {dirty ? (
            <button
              type="button"
              className={insightGhostButtonClassName}
              onClick={() => {
                setDiscardOpen(true);
              }}
            >
              Discard
            </button>
          ) : null}
          <button
            type="button"
            className={insightPrimaryButtonClassName}
            disabled={!dirty || mutating || !draft}
            onClick={() => {
              if (!draft) return;
              void onMutate({ action: "save", settings: draft });
            }}
          >
            Save changes
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_24%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--admin-on-surface)]">
              Could not update settings
            </p>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
          </div>
          <button type="button" className={insightGhostButtonClassName} onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {loading && !board ? <SettingsSkeleton /> : null}

      {board && draft ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-8 lg:col-span-8">
            <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <h2 className="mb-6 text-base font-semibold text-[var(--admin-on-surface)]">
                Defaults
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                    Default section
                  </span>
                  <Select
                    ariaLabel="Default section"
                    value={draft.defaultSection}
                    onValueChange={(value) => {
                      setDraft({ ...draft, defaultSection: value });
                    }}
                    options={sectionOptions}
                    className={insightSelectTriggerClassName}
                    contentClassName={insightSelectContentClassName}
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                    Default period
                  </span>
                  <Select
                    ariaLabel="Default period"
                    value={draft.defaultPeriod}
                    onValueChange={(value) => {
                      setDraft({
                        ...draft,
                        defaultPeriod: value as InsightSettingsPatch["defaultPeriod"],
                      });
                    }}
                    options={[...INSIGHT_RANGE_OPTIONS]}
                    className={insightSelectTriggerClassName}
                    contentClassName={insightSelectContentClassName}
                  />
                </label>
                <div className="flex flex-col gap-2">
                  <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                    Display currency
                  </span>
                  <div className="flex h-11 items-center rounded-lg border border-[var(--admin-outline)] px-3 font-data text-sm text-[var(--admin-on-surface)]">
                    {board.currency}
                  </div>
                  <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                    Amounts use the academy's recorded payment currency. No conversion is applied.
                  </span>
                </div>
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                    Number formatting
                  </span>
                  <Select
                    ariaLabel="Number formatting"
                    value={draft.numberFormat}
                    onValueChange={(value) => {
                      setDraft({
                        ...draft,
                        numberFormat: value as InsightSettingsPatch["numberFormat"],
                      });
                    }}
                    options={[
                      { value: "international", label: "International" },
                      { value: "european", label: "European" },
                    ]}
                    className={insightSelectTriggerClassName}
                    contentClassName={insightSelectContentClassName}
                  />
                  <span className="font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                    Sample: {formatSample}
                  </span>
                </label>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                    Week starts on
                  </span>
                  <div className={insightSegmentTrackClassName}>
                    {(["monday", "sunday"] as const).map((day) => (
                      <button
                        key={day}
                        type="button"
                        className={
                          draft.weekStartsOn === day
                            ? insightSegmentButtonActiveClassName
                            : insightSegmentButtonClassName
                        }
                        onClick={() => {
                          setDraft({ ...draft, weekStartsOn: day });
                        }}
                      >
                        {day === "monday" ? "Monday" : "Sunday"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <h2 className="mb-6 text-base font-semibold text-[var(--admin-on-surface)]">
                Refresh behaviour
              </h2>
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-[var(--admin-on-surface)]">
                      Refresh dashboards automatically
                    </div>
                    <div className="text-[12px] text-[var(--admin-on-surface-variant)]">
                      Reloads open dashboards on an interval.
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Select
                      ariaLabel="Refresh interval"
                      value={String(draft.refreshIntervalMinutes)}
                      onValueChange={(value) => {
                        setDraft({
                          ...draft,
                          refreshIntervalMinutes: Number(
                            value,
                          ) as InsightSettingsPatch["refreshIntervalMinutes"],
                        });
                      }}
                      options={[...REFRESH_OPTIONS]}
                      className={insightSelectTriggerClassName}
                      contentClassName={insightSelectContentClassName}
                    />
                    <TokenSwitch
                      checked={draft.autoRefresh}
                      label="Automatic refresh"
                      onToggle={() => {
                        setDraft({ ...draft, autoRefresh: !draft.autoRefresh });
                      }}
                    />
                  </div>
                </div>
                <hr className="border-[var(--admin-border)]" />
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-[var(--admin-on-surface)]">
                      Show the last-updated time
                    </div>
                    <div className="text-[12px] text-[var(--admin-on-surface-variant)]">
                      Displays a timestamp on each dashboard.
                    </div>
                  </div>
                  <TokenSwitch
                    checked={draft.showLastUpdated}
                    label="Show last-updated time"
                    onToggle={() => {
                      setDraft({ ...draft, showLastUpdated: !draft.showLastUpdated });
                    }}
                  />
                </div>
                <hr className="border-[var(--admin-border)]" />
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-[var(--admin-on-surface)]">
                      Minimum refresh gap
                    </div>
                    <div className="text-[12px] text-[var(--admin-on-surface-variant)]">
                      Automatic reloads wait at least this long between requests.
                    </div>
                  </div>
                  <Select
                    ariaLabel="Minimum refresh gap"
                    value={String(draft.cacheMinutes)}
                    onValueChange={(value) => {
                      setDraft({
                        ...draft,
                        cacheMinutes: Number(value) as InsightSettingsPatch["cacheMinutes"],
                      });
                    }}
                    options={[...CACHE_OPTIONS]}
                    className={insightSelectTriggerClassName}
                    contentClassName={insightSelectContentClassName}
                  />
                </div>
              </div>
            </section>
          </div>

          <section className="flex flex-col rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-4">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Recent activity
              </h2>
              <Link
                href="/admin/audit"
                prefetch={false}
                className="inline-flex items-center gap-1 text-[12px] text-[var(--admin-primary)] hover:underline"
              >
                View all
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {board.activity.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Changes to defaults, access, and layouts will show up here.
              </p>
            ) : (
              <div className="relative flex flex-col gap-6 border-l-2 border-[var(--admin-border)] pl-4">
                {board.activity.map((entry) => (
                  <div key={`${entry.at}-${entry.action}`} className="relative">
                    <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--admin-surface)] bg-[var(--admin-outline)]" />
                    <div className="mb-1 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                      {formatRelativeTime(entry.at)}
                    </div>
                    <div className="text-sm text-[var(--admin-on-surface)]">{entry.action}</div>
                    <div className="mt-0.5 text-[12px] text-[var(--admin-on-surface-variant)]">
                      by {entry.actorLabel}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-12">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Dashboard access and data policy
              </h2>
              <div className="inline-flex items-center gap-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                <Info className="h-4 w-4" aria-hidden="true" />
                Visibility and tenant layouts for each section.
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                    <th className={`${insightTableHeadClassName} px-4 py-3`}>Section</th>
                    <th className={`${insightTableHeadClassName} px-4 py-3`}>Visible to</th>
                    <th className={`${insightTableHeadClassName} px-4 py-3`}>Data</th>
                    <th className={`${insightTableHeadClassName} px-4 py-3`}>Default layout</th>
                    <th className={`${insightTableHeadClassName} px-4 py-3`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {board.access.map((row) => (
                    <tr key={row.slug} className={`${insightTableRowClassName} h-11`}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-[var(--admin-on-surface)]">
                          {row.title}
                        </div>
                        <div className="font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                          /{row.slug}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.restricted ? (
                          <span className="rounded bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] px-2 py-0.5 text-xs text-[var(--admin-danger)]">
                            Restricted
                          </span>
                        ) : row.visibleTo.length === 0 ? (
                          <span className="text-sm text-[var(--admin-on-surface-variant)]">
                            Anyone with Insights
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {row.visibleTo.map((role) => (
                              <span
                                key={role.key}
                                className="rounded bg-[var(--admin-surface-high)] px-2 py-0.5 text-xs text-[var(--admin-on-surface-variant)]"
                              >
                                {role.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded border px-2 py-0.5 font-data text-[11px] uppercase ${dataClassClass(row.dataClass)}`}
                        >
                          {dataClassLabel(row.dataClass)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                        {row.layoutSource === "tenant" ? "Tenant custom" : "Shipped default"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            disabled={mutating || row.layoutSource !== "tenant"}
                            className="text-sm font-medium text-[var(--admin-primary)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--admin-outline)] disabled:no-underline"
                            onClick={() => {
                              void onMutate({ action: "reset-layout", targetSlug: row.slug });
                            }}
                          >
                            Reset
                          </button>
                          {row.restricted ? (
                            <button
                              type="button"
                              disabled={mutating}
                              className="text-sm font-medium text-[var(--admin-primary)] hover:underline disabled:opacity-50"
                              onClick={() => {
                                void onMutate({ action: "unrestrict", targetSlug: row.slug });
                              }}
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={mutating}
                              className="text-sm font-medium text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)] disabled:opacity-50"
                              onClick={() => {
                                setRestrictRow(row);
                              }}
                            >
                              Restrict
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {restrictRow ? (
        <RestrictModal
          row={restrictRow}
          mutating={mutating}
          onCancel={() => {
            setRestrictRow(null);
          }}
          onConfirm={() => {
            void onMutate({ action: "restrict", targetSlug: restrictRow.slug }).then((result) => {
              if (result) setRestrictRow(null);
            });
          }}
        />
      ) : null}

      {discardOpen ? (
        <DiscardModal
          onCancel={() => {
            setDiscardOpen(false);
          }}
          onConfirm={() => {
            if (board) setDraft(patchFromBoard(board));
            setDiscardOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function TokenSwitch({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-6 w-11 rounded-full border transition-colors ${
        checked
          ? "border-[var(--admin-primary)] bg-[var(--admin-primary)]"
          : "border-[var(--admin-outline)] bg-[var(--admin-surface-high)]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--admin-surface)] transition-[left] ${
          checked ? "left-6" : "left-0.5"
        }`}
      />
    </button>
  );
}

function RestrictModal({
  row,
  mutating,
  onCancel,
  onConfirm,
}: {
  row: InsightSettingsAccessRow;
  mutating: boolean;
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

  const total = row.visibleTo.reduce((sum, role) => sum + role.memberCount, 0);
  const roleSummary =
    row.visibleTo.length === 0
      ? "operators with Insights access"
      : row.visibleTo.map((role) => `${role.memberCount} ${role.name}`).join(" and ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="restrict-section-title"
        className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]"
      >
        <div className="flex items-center gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] text-[var(--admin-danger)]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2
            id="restrict-section-title"
            className="text-base font-semibold text-[var(--admin-on-surface)]"
          >
            Restrict section access?
          </h2>
        </div>
        <div className="px-6 py-6 text-sm text-[var(--admin-on-surface-variant)]">
          You are about to hide {row.title}.{" "}
          {total > 0
            ? `${roleSummary} will lose access to this dashboard.`
            : "Operators with Insights access will lose this dashboard."}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <button
            type="button"
            className={insightGhostButtonClassName}
            onClick={onCancel}
            disabled={mutating}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={mutating}
            onClick={onConfirm}
            className="inline-flex h-11 items-center justify-center rounded bg-[var(--admin-danger)] px-5 text-sm font-medium text-[var(--admin-on-primary)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm restriction
          </button>
        </div>
      </div>
    </div>
  );
}

function DiscardModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-settings-title"
        className="w-full max-w-md overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]"
      >
        <div className="px-6 pb-4 pt-6">
          <div className="mb-2 flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] text-[var(--admin-danger)]">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2
              id="discard-settings-title"
              className="text-base font-semibold text-[var(--admin-on-surface)]"
            >
              Discard changes?
            </h2>
          </div>
          <p className="ml-14 text-sm text-[var(--admin-on-surface-variant)]">
            You have unsaved changes in Settings. Discarding will revert every modification on this
            page.
          </p>
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <button type="button" className={insightGhostButtonClassName} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-11 items-center justify-center rounded bg-[var(--admin-danger)] px-4 text-sm text-[var(--admin-on-primary)] hover:opacity-90"
          >
            Discard changes
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="flex flex-col gap-6 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-8">
        <Shimmer className="h-6 w-40 rounded" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Shimmer className="h-4 w-24 rounded" />
              <Shimmer className="h-11 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-4">
        <Shimmer className="h-6 w-32 rounded" />
        <Shimmer className="h-4 w-full rounded" />
        <Shimmer className="h-4 w-4/5 rounded" />
        <Shimmer className="h-4 w-full rounded" />
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-12">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6">
          <Shimmer className="h-6 w-48 rounded" />
        </div>
        <div className="flex flex-col p-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4"
            >
              <Shimmer className="h-4 w-32 rounded" />
              <Shimmer className="h-4 w-40 rounded" />
              <Shimmer className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
