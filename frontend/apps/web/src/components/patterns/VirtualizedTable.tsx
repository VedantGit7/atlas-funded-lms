"use client";

import { useMemo, useState, type ReactNode } from "react";

type VirtualizedTableProps<TRow> = {
  rows: TRow[];
  rowHeight?: number;
  maxHeight?: number;
  getRowKey: (row: TRow, index: number) => string;
  renderRow: (row: TRow, index: number) => ReactNode;
  header: ReactNode;
  emptyMessage?: string;
  shellClassName?: string;
  emptyShellClassName?: string;
};

export function VirtualizedTable<TRow>({
  rows,
  rowHeight = 52,
  maxHeight = 480,
  getRowKey,
  renderRow,
  header,
  emptyMessage = "No rows to display.",
  shellClassName = "overflow-hidden rounded border",
  emptyShellClassName = "overflow-hidden rounded border",
}: VirtualizedTableProps<TRow>) {
  const [scrollTop, setScrollTop] = useState(0);

  const { startIndex, endIndex, totalHeight, offsetY } = useMemo(() => {
    const visibleCount = Math.ceil(maxHeight / rowHeight) + 4;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
    const end = Math.min(rows.length, start + visibleCount);
    return {
      startIndex: start,
      endIndex: end,
      totalHeight: rows.length * rowHeight,
      offsetY: start * rowHeight,
    };
  }, [maxHeight, rowHeight, rows.length, scrollTop]);

  if (rows.length === 0) {
    return (
      <div className={emptyShellClassName}>
        {header}
        <p className="px-6 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
          {emptyMessage}
        </p>
      </div>
    );
  }

  const windowRows = rows.slice(startIndex, endIndex);

  return (
    <div className={shellClassName}>
      {header}
      <div
        className="overflow-y-auto"
        style={{ maxHeight }}
        onScroll={(event) => {
          setScrollTop(event.currentTarget.scrollTop);
        }}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {windowRows.map((row, index) => (
              <div key={getRowKey(row, startIndex + index)} style={{ minHeight: rowHeight }}>
                {renderRow(row, startIndex + index)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
