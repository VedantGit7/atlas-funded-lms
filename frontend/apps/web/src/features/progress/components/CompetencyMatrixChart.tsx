"use client";

import { useMemo } from "react";
import { ChartLine } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { z } from "zod";
import type {
  competencyScoreDtoSchema,
  competencySnapshotDtoSchema,
} from "@atlas/contracts/competency/competency-projection.schemas";

type CompetencyScore = z.infer<typeof competencyScoreDtoSchema>;
type CompetencySnapshot = z.infer<typeof competencySnapshotDtoSchema>;

type CompetencyMatrixChartProps = {
  scores: CompetencyScore[];
  snapshots: CompetencySnapshot[];
};

const EASE = [0.16, 1, 0.3, 1] as const;
const SERIES_COLORS = ["var(--primary)", "var(--success)", "var(--warning)", "var(--accent)"];
const MAX_SERIES = 4;

const VIEW_W = 640;
const VIEW_H = 220;
const PAD_X = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 24;

function x(index: number, count: number): number {
  if (count <= 1) return VIEW_W / 2;
  return PAD_X + (index / (count - 1)) * (VIEW_W - PAD_X * 2);
}

function y(score: number): number {
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const clamped = Math.max(0, Math.min(100, score));
  return PAD_TOP + (1 - clamped / 100) * plotH;
}

export function CompetencyMatrixChart({ scores, snapshots }: CompetencyMatrixChartProps) {
  const reduce = useReducedMotion();

  const { series, count, hasData } = useMemo(() => {
    const dims: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    for (const score of scores) {
      if (seen.has(score.dimensionId)) continue;
      seen.add(score.dimensionId);
      dims.push({ id: score.dimensionId, name: score.dimensionName });
      if (dims.length >= MAX_SERIES) break;
    }

    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );

    const built = dims.map((dim, index) => {
      const points: { i: number; score: number }[] = [];
      sorted.forEach((snapshot, snapshotIndex) => {
        const match = snapshot.scores.find((entry) => entry.dimensionId === dim.id);
        if (match) points.push({ i: snapshotIndex, score: match.score });
      });
      return { ...dim, color: SERIES_COLORS[index] ?? "var(--primary)", points };
    });

    return {
      series: built,
      count: sorted.length,
      hasData: sorted.length >= 2 && built.some((entry) => entry.points.length >= 2),
    };
  }, [scores, snapshots]);

  return (
    <section
      aria-label="Competency matrix"
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card"
    >
      <header className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ChartLine className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </span>
          Competency matrix
        </h2>
        {hasData ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {series
              .filter((entry) => entry.points.length >= 2)
              .map((entry) => (
                <li key={entry.id} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] font-medium text-muted-foreground">{entry.name}</span>
                </li>
              ))}
          </ul>
        ) : null}
      </header>

      {hasData ? (
        <div className="flex flex-1 flex-col justify-center px-6 py-6">
          <div className="relative pl-7">
            <div className="pointer-events-none absolute -left-0 top-0 flex h-full flex-col justify-between py-[10px] text-[10px] text-muted-foreground">
              {[100, 75, 50, 25, 0].map((tick) => (
                <span key={tick} className="tabular-nums">
                  {tick}
                </span>
              ))}
            </div>
            <svg
              viewBox={`0 0 ${String(VIEW_W)} ${String(VIEW_H)}`}
              className="h-auto w-full overflow-visible"
              preserveAspectRatio="none"
            >
              {[25, 50, 75].map((gridValue) => (
                <line
                  key={gridValue}
                  x1={PAD_X}
                  x2={VIEW_W - PAD_X}
                  y1={y(gridValue)}
                  y2={y(gridValue)}
                  stroke="var(--border)"
                  strokeWidth={1}
                  strokeDasharray="4 6"
                />
              ))}

              {series
                .filter((entry) => entry.points.length >= 2)
                .map((entry) => {
                  const path = entry.points
                    .map(
                      (point, index) =>
                        `${index === 0 ? "M" : "L"} ${String(x(point.i, count))} ${String(y(point.score))}`,
                    )
                    .join(" ");
                  return (
                    <motion.path
                      key={entry.id}
                      d={path}
                      fill="none"
                      stroke={entry.color}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      initial={{ pathLength: reduce ? 1 : 0 }}
                      whileInView={{ pathLength: 1 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ duration: reduce ? 0 : 1.2, ease: EASE }}
                    />
                  );
                })}
            </svg>
          </div>
          <p className="mt-3 pl-7 text-[11px] text-muted-foreground">
            Dimensional scores across your last {count} assessments.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ChartLine className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="max-w-xs text-sm text-muted-foreground">
            Your competency lines appear once you have at least two scored assessments.
          </p>
        </div>
      )}
    </section>
  );
}
