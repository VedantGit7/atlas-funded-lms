"use client";

import { useMemo } from "react";
import { Activity } from "lucide-react";
import {
  type ActivityDay,
  type HeatmapLevel,
  buildActivityHeatmap,
  formatFullDate,
  formatXp,
} from "../progress-view";

type ActivityHeatmapProps = {
  days: ActivityDay[];
  rangeEnd: string;
  activeDays: number;
  totalXp: number;
};

const LEVEL_CLASS: Record<HeatmapLevel, string> = {
  0: "bg-muted",
  1: "bg-primary/25",
  2: "bg-primary/45",
  3: "bg-primary/70",
  4: "bg-primary",
};

const WEEKDAY_LABELS: Record<number, string> = { 1: "Mon", 3: "Wed", 5: "Fri" };

export function ActivityHeatmap({ days, rangeEnd, activeDays, totalXp }: ActivityHeatmapProps) {
  const model = useMemo(() => buildActivityHeatmap(days, rangeEnd), [days, rangeEnd]);
  const labelByColumn = useMemo(() => {
    const map = new Map<number, string>();
    for (const entry of model.monthLabels) map.set(entry.column, entry.label);
    return map;
  }, [model.monthLabels]);

  const summary =
    activeDays > 0
      ? `${String(activeDays)} active days and ${formatXp(totalXp)} XP over the last 52 weeks`
      : "No learning activity recorded in the last 52 weeks yet";

  return (
    <section
      aria-label="Activity momentum"
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      <header className="flex flex-col gap-4 border-b border-border px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Activity className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Activity momentum</h2>
            <p className="text-xs text-muted-foreground">
              Your learning frequency over the last 52 weeks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Less
          </span>
          <div className="flex gap-1" aria-hidden="true">
            {([0, 1, 2, 3, 4] as HeatmapLevel[]).map((level) => (
              <span key={level} className={`h-3 w-3 rounded-sm ${LEVEL_CLASS[level]}`} />
            ))}
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            More
          </span>
        </div>
      </header>

      <div className="overflow-x-auto px-6 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-[840px]" role="img" aria-label={summary}>
          {/* Month labels: absolute so they overflow past their column without shifting cells. */}
          <div className="flex gap-1 pl-9">
            {model.weeks.map((_, column) => (
              <div key={`m-${String(column)}`} className="relative h-4 w-3">
                {labelByColumn.has(column) ? (
                  <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] font-medium text-muted-foreground">
                    {labelByColumn.get(column)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <div className="flex gap-1">
            <div className="mr-1 flex w-8 flex-col gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map((row) => (
                <span
                  key={`d-${String(row)}`}
                  className="flex h-3 items-center text-[10px] leading-none text-muted-foreground"
                >
                  {WEEKDAY_LABELS[row] ?? ""}
                </span>
              ))}
            </div>

            <div className="flex gap-1">
              {model.weeks.map((week, column) => (
                <div key={`w-${String(column)}`} className="flex flex-col gap-1">
                  {week.map((cell) => (
                    <span
                      key={cell.date}
                      title={
                        cell.inRange
                          ? `${formatXp(cell.xp)} XP on ${formatFullDate(cell.date)}`
                          : undefined
                      }
                      className={`h-3 w-3 rounded-sm transition-transform duration-100 hover:scale-[1.35] ${
                        cell.inRange ? LEVEL_CLASS[cell.level] : "bg-transparent"
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
