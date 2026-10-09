"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { InsightWidget } from "./admin-insights-api";
import {
  formatInsightMoneyWithCode,
  formatInsightNumber,
  formatPeriodLong,
} from "./admin-insights-format";
import { insightTableHeadClassName, insightTableRowClassName } from "./admin-insights-shared";
import {
  cell,
  exportColumns,
  formatAmount,
  isMeasureColumn,
  numericValue,
  StatusPill,
  stringValue,
  type InsightRow,
  type StatusTone,
} from "./insight-detail-kit";

const PAGE_SIZE = 8;

function compareCells(a: InsightRow, b: InsightRow, key: string, dir: "asc" | "desc"): number {
  const av = cell(a, key);
  const bv = cell(b, key);
  const an = typeof av === "number" ? av : Number(av);
  const bn = typeof bv === "number" ? bv : Number(bv);
  if (Number.isFinite(an) && Number.isFinite(bn)) return dir === "asc" ? an - bn : bn - an;
  return dir === "asc"
    ? stringValue(av).localeCompare(stringValue(bv))
    : stringValue(bv).localeCompare(stringValue(av));
}

function SortMark({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return null;
  return dir === "desc" ? (
    <ArrowDown className="h-3.5 w-3.5 text-[var(--admin-primary)]" aria-hidden="true" />
  ) : (
    <ArrowUp className="h-3.5 w-3.5 text-[var(--admin-primary)]" aria-hidden="true" />
  );
}

/**
 * A table widget's rows with search, sorting and paging. Key it by widget so a
 * new widget starts unfiltered on its first page.
 */
export function InsightDataTable({
  widget,
  currency,
  isMoneyColumn,
  shareKey,
  initialSortKey,
  searchPlaceholder = "Search records...",
  statusTone,
  chipColumns = [],
  leadEmphasis = false,
  isDangerRow,
}: {
  widget: InsightWidget;
  currency?: string | undefined;
  isMoneyColumn?: ((key: string) => boolean) | undefined;
  /** Adds a Share column: each row's part of this measure's total. */
  shareKey?: string | null | undefined;
  initialSortKey?: string | undefined;
  searchPlaceholder?: string | undefined;
  /** Renders the `status` column as pills in these tones. */
  statusTone?: ((status: string) => StatusTone) | undefined;
  /** Columns shown as neutral chips, such as a type or channel. */
  chipColumns?: string[] | undefined;
  /** Colours the first column, usually the record's name. */
  leadEmphasis?: boolean | undefined;
  /** Marks rows that need attention, such as failed payments or runs. */
  isDangerRow?: ((row: InsightRow) => boolean) | undefined;
}) {
  const columns = exportColumns(widget);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string>(
    initialSortKey ?? columns.find(isMeasureColumn)?.key ?? columns[0]?.key ?? "title",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const showShare = shareKey != null && widget.data.rows.length > 0;
  const grandTotal = shareKey
    ? widget.data.rows.reduce((sum, row) => sum + numericValue(cell(row, shareKey)), 0) || 1
    : 1;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle
      ? widget.data.rows.filter((row) =>
          columns.some((column) =>
            stringValue(cell(row, column.key)).toLowerCase().includes(needle),
          ),
        )
      : widget.data.rows;
    return [...rows].sort((a, b) => compareCells(a, b, sortKey, sortDir));
  }, [columns, query, sortDir, sortKey, widget.data.rows]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: string, measure: boolean) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(measure ? "desc" : "asc");
  }

  const pageButtonClassName =
    "flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:opacity-40";

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
        <label className="relative h-9 w-72 max-w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-full w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="sticky top-0 z-[1] bg-[var(--admin-surface-low)]">
            <tr>
              {columns.map((column) => {
                const measure = isMeasureColumn(column);
                return (
                  <th
                    key={column.key}
                    className={`${insightTableHeadClassName} px-4 py-3 ${measure ? "text-right" : ""}`}
                  >
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 ${measure ? "w-full justify-end" : ""}`}
                      onClick={() => {
                        toggleSort(column.key, measure);
                      }}
                    >
                      {column.label}
                      <SortMark active={sortKey === column.key} dir={sortDir} />
                    </button>
                  </th>
                );
              })}
              {showShare ? (
                <th className={`${insightTableHeadClassName} px-4 py-3 text-right`}>Share</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, index) => {
              const href = stringValue(cell(row, "href"));
              const danger = isDangerRow?.(row) ?? false;
              const share = shareKey
                ? Math.round((numericValue(cell(row, shareKey)) / grandTotal) * 1000) / 10
                : 0;
              return (
                <tr
                  key={`${stringValue(cell(row, columns[0]?.key ?? "id"), "row")}-${String(index)}`}
                  className={`${insightTableRowClassName} group ${
                    danger
                      ? "bg-[color-mix(in_srgb,var(--admin-danger)_5%,var(--admin-surface))]"
                      : ""
                  }`}
                >
                  {columns.map((column, columnIndex) => {
                    const raw = cell(row, column.key);
                    const measure = isMeasureColumn(column);
                    const lead = columnIndex === 0;
                    let display = stringValue(raw, "");
                    if (measure && isMoneyColumn?.(column.key)) {
                      display = formatInsightMoneyWithCode(numericValue(raw), currency);
                    } else if (measure) {
                      display = formatInsightNumber(numericValue(raw));
                    } else if (
                      column.key === "period" ||
                      column.key === "created" ||
                      column.kind === "date"
                    ) {
                      display = formatPeriodLong(stringValue(raw));
                    }
                    if (column.key === "status" && statusTone) {
                      return (
                        <td key={column.key} className="px-4 py-2">
                          <StatusPill tone={statusTone(display)}>{display || "-"}</StatusPill>
                        </td>
                      );
                    }
                    if (chipColumns.includes(column.key)) {
                      return (
                        <td key={column.key} className="px-4 py-2">
                          <span className="inline-flex rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                            {display || "-"}
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={column.key}
                        className={`px-4 py-2 text-sm ${
                          measure ? "text-right font-data" : "text-[var(--admin-on-surface)]"
                        } ${lead && danger ? "border-l-2 border-[var(--admin-danger)]" : ""} ${
                          lead && leadEmphasis ? "font-medium text-[var(--admin-primary)]" : ""
                        }`}
                      >
                        {lead && href ? (
                          <Link
                            href={href}
                            prefetch={false}
                            className="outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                          >
                            {display || "Untitled"}
                          </Link>
                        ) : (
                          display
                        )}
                      </td>
                    );
                  })}
                  {showShare ? (
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-data text-sm">{`${formatAmount(share)}%`}</span>
                        <div className="h-[3px] w-16 overflow-hidden rounded-full bg-[var(--admin-surface-variant)]">
                          <div
                            className="h-full bg-[var(--admin-primary)]"
                            style={{ width: `${String(share)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex h-12 items-center justify-between border-t border-[var(--admin-border)] px-4 text-xs text-[var(--admin-on-surface-variant)]">
        <span>
          {filtered.length === 0
            ? "No matching rows"
            : `Showing ${String(safePage * PAGE_SIZE + 1)}-${String(Math.min((safePage + 1) * PAGE_SIZE, filtered.length))} of ${String(filtered.length)}`}
        </span>
        {filtered.length > PAGE_SIZE ? (
          <div className="flex gap-1">
            <button
              type="button"
              className={pageButtonClassName}
              disabled={safePage === 0}
              onClick={() => {
                setPage((current) => Math.max(0, current - 1));
              }}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-[18px] w-[18px]" />
            </button>
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`flex h-8 w-8 items-center justify-center rounded text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${
                  index === safePage
                    ? "bg-[var(--admin-primary-container)] font-medium text-[var(--admin-primary)]"
                    : "text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                }`}
                onClick={() => {
                  setPage(index);
                }}
                aria-current={index === safePage ? "page" : undefined}
              >
                {index + 1}
              </button>
            ))}
            <button
              type="button"
              className={pageButtonClassName}
              disabled={safePage >= pageCount - 1}
              onClick={() => {
                setPage((current) => current + 1);
              }}
              aria-label="Next page"
            >
              <ChevronRight className="h-[18px] w-[18px]" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
