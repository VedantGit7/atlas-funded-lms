"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownUp, BarChart3, ExternalLink, Info } from "lucide-react";
import type { ItemStatisticRow } from "../analytics-studio-shared";
import { getMetricDescription } from "../metric-glossary";
import {
  accuracyBadgeClassName,
  formatAccuracyPercent,
  formatDistractorRates,
  formatLatencySeconds,
  highlightRowKind,
  sectionHeaderClassName,
  tableHeaderClassName,
  tableShellClassName,
} from "../analytics-studio-shared";

type SortKey = "accuracy" | "attempts" | "latency" | "label";
type SortDirection = "asc" | "desc";

type AnalyticsItemBreakdownTableProps = {
  items: ItemStatisticRow[];
  assessmentId: string;
  assessmentTitle?: string;
  availableAssessments?: number;
  loading?: boolean;
};

function qualityBadgeClassName(flag: "bad" | "fair" | "good" | undefined): string {
  if (flag === "good") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)] border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))]";
  }
  if (flag === "bad") {
    return "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)] border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))]";
  }
  if (flag === "fair") {
    return "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)] border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)] border-[var(--admin-border)]";
}

function formatPsychometricRate(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${String(Math.round(value * 1000) / 10)}%`;
}

function formatDiscrimination(value: number | null | undefined): string {
  if (value == null) return "—";
  return String(Math.round(value * 100) / 100);
}

function GlossaryHeader({ label, glossaryKey }: { label: string; glossaryKey: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <span
        className="inline-flex text-[var(--admin-on-surface-variant)]"
        title={getMetricDescription(glossaryKey, label)}
        aria-label={getMetricDescription(glossaryKey, label)}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </span>
  );
}

function sortItems(
  items: ItemStatisticRow[],
  sortKey: SortKey,
  direction: SortDirection,
): ItemStatisticRow[] {
  const sorted = [...items].sort((a, b) => {
    if (sortKey === "label") {
      return a.itemReference.label.localeCompare(b.itemReference.label);
    }
    if (sortKey === "attempts") {
      return a.attemptsCount - b.attemptsCount;
    }
    if (sortKey === "latency") {
      return (a.averageLatencyMs ?? -1) - (b.averageLatencyMs ?? -1);
    }
    return (a.accuracy ?? -1) - (b.accuracy ?? -1);
  });
  return direction === "desc" ? sorted.reverse() : sorted;
}

export function AnalyticsItemBreakdownTable({
  items,
  assessmentId,
  assessmentTitle,
  availableAssessments = 0,
  loading = false,
}: AnalyticsItemBreakdownTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("accuracy");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedItems = useMemo(
    () => sortItems(items, sortKey, sortDirection),
    [items, sortDirection, sortKey],
  );
  const showDistractors = sortedItems.some(
    (item) => item.distractorRates && item.distractorRates.length > 0,
  );

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "label" ? "asc" : "desc");
  }

  if (!assessmentId) {
    return (
      <section
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-14 text-center"
        aria-label="Assessment item breakdown"
      >
        <BarChart3 className="mb-3 h-10 w-10 text-[var(--admin-on-surface-variant)] opacity-50" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
          {availableAssessments === 0 ? "No assessments to analyze" : "Select an assessment"}
        </h2>
        <p className="mt-2 max-w-lg text-sm text-[var(--admin-on-surface-variant)]">
          {availableAssessments === 0 ? (
            <>
              Item-level accuracy and latency require an assessment you authored. Create one in{" "}
              <Link href="/studio/assessments" className="font-medium text-[var(--admin-primary)] hover:underline">
                Studio Assessments
              </Link>
              , then return here.
            </>
          ) : (
            <>
              This section shows per-question performance for one assessment. Choose an assessment
              from the{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">Assessment</span> filter
              above — not &ldquo;All evaluations&rdquo;.
            </>
          )}
        </p>
      </section>
    );
  }

  return (
    <section className={tableShellClassName} aria-label="Assessment item breakdown">
      <div className={sectionHeaderClassName}>
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface)]">
            Assessment item breakdown
          </h2>
          {assessmentTitle ? (
            <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">{assessmentTitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
            onClick={() => {
              toggleSort("accuracy");
            }}
          >
            <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
            Sort by {sortKey}
          </button>
          <Link
            href={`/studio/assessments/${assessmentId}`}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--admin-primary)] hover:underline"
          >
            Open assessment
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
          Loading item statistics…
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
          No item performance data is available for this assessment yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[800px] w-full text-left text-sm">
            <thead>
              <tr className={tableHeaderClassName}>
                <th scope="col" className="px-4 py-3">
                  Item name
                </th>
                <th scope="col" className="px-4 py-3">
                  <button type="button" className="hover:text-[var(--admin-on-surface)]" onClick={() => toggleSort("attempts")}>
                    Attempts
                  </button>
                </th>
                <th scope="col" className="px-4 py-3">
                  Correct
                </th>
                <th scope="col" className="px-4 py-3">
                  <button type="button" className="hover:text-[var(--admin-on-surface)]" onClick={() => toggleSort("accuracy")}>
                    Accuracy
                  </button>
                </th>
                <th scope="col" className="px-4 py-3">
                  <GlossaryHeader label="Difficulty" glossaryKey="difficulty" />
                </th>
                <th scope="col" className="px-4 py-3">
                  <GlossaryHeader label="Discrimination" glossaryKey="discrimination" />
                </th>
                <th scope="col" className="px-4 py-3">
                  <GlossaryHeader label="Quality" glossaryKey="quality_flag" />
                </th>
                {showDistractors ? (
                  <th scope="col" className="px-4 py-3">
                    Distractors
                  </th>
                ) : null}
                <th scope="col" className="px-4 py-3">
                  <button type="button" className="hover:text-[var(--admin-on-surface)]" onClick={() => toggleSort("latency")}>
                    Avg. latency
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {sortedItems.map((item) => {
                const highlight = highlightRowKind(item, items);
                return (
                  <tr
                    key={item.itemReference.itemId}
                    className={`transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_5%,var(--admin-surface))] ${
                      highlight === "top"
                        ? "border-l-4 border-l-[var(--admin-warning)]"
                        : highlight === "alert"
                          ? "border-l-4 border-l-[var(--admin-danger)]"
                          : ""
                    }`}
                  >
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-[var(--admin-on-surface)]">
                          {item.itemReference.label}
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                          {item.sampleSizeWarning
                            ? "Low sample (<50)"
                            : item.attemptsCount >= 10
                              ? "Sufficient data"
                              : "Limited attempts"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 tabular-nums">{item.attemptsCount.toLocaleString()}</td>
                    <td className="px-4 py-4 tabular-nums">{item.correctCount.toLocaleString()}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${accuracyBadgeClassName(item.accuracy)}`}
                      >
                        {formatAccuracyPercent(item.accuracy)}
                      </span>
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {formatPsychometricRate(item.difficulty ?? item.accuracy)}
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {formatDiscrimination(item.discrimination)}
                    </td>
                    <td className="px-4 py-4">
                      {item.qualityFlag ? (
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${qualityBadgeClassName(item.qualityFlag)}`}
                        >
                          {item.qualityFlag}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    {showDistractors ? (
                      <td className="max-w-[12rem] truncate px-4 py-4 text-xs text-[var(--admin-on-surface-variant)]">
                        {formatDistractorRates(item.distractorRates)}
                      </td>
                    ) : null}
                    <td className="px-4 py-4 tabular-nums">
                      {formatLatencySeconds(item.averageLatencyMs)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && sortedItems.length > 0 ? (
        <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-[11px] text-[var(--admin-on-surface-variant)]">
          <span>
            Showing {sortedItems.length} item{sortedItems.length === 1 ? "" : "s"} · rolling 30-day window
          </span>
        </div>
      ) : null}
    </section>
  );
}
