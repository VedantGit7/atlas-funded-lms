"use client";

import { ArrowDownRight, ArrowUpRight, ChartLine, Minus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;

export type MomentumPoint = {
  label: string;
  value: number;
};

type ReadinessMomentumChartProps = {
  points: MomentumPoint[];
};

const VIEW_W = 640;
const VIEW_H = 240;
const PAD_X = 16;
const PAD_TOP = 18;
const PAD_BOTTOM = 34;

function toX(index: number, count: number): number {
  if (count <= 1) return VIEW_W / 2;
  return PAD_X + (index / (count - 1)) * (VIEW_W - PAD_X * 2);
}

function toY(value: number): number {
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const clamped = Math.max(0, Math.min(100, value));
  return PAD_TOP + (1 - clamped / 100) * plotH;
}

export function ReadinessMomentumChart({ points }: ReadinessMomentumChartProps) {
  const reduce = useReducedMotion();
  const count = points.length;
  const hasData = count >= 2;

  const values = points.map((point) => point.value);
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const delta = Number((last - first).toFixed(1));
  const deltaTrend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const DeltaIcon =
    deltaTrend === "up" ? ArrowUpRight : deltaTrend === "down" ? ArrowDownRight : Minus;
  const deltaColor =
    deltaTrend === "up"
      ? "text-[var(--success)]"
      : deltaTrend === "down"
        ? "text-[var(--destructive)]"
        : "text-muted-foreground";

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${String(toX(index, count))} ${String(toY(point.value))}`,
    )
    .join(" ");

  return (
    <section
      aria-label="Score momentum"
      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ChartLine className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </span>
          Score momentum
        </h2>
        {hasData ? (
          <span className={`inline-flex items-center gap-1 text-sm font-semibold ${deltaColor}`}>
            <DeltaIcon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            {delta > 0 ? "+" : ""}
            {delta} since first snapshot
          </span>
        ) : null}
      </header>

      {hasData ? (
        <div className="flex flex-1 flex-col justify-center px-6 py-6">
          <div
            role="img"
            aria-label={`Composite readiness momentum from ${String(Math.round(first))} to ${String(
              Math.round(last),
            )} over ${String(count)} snapshots`}
          >
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
                  y1={toY(gridValue)}
                  y2={toY(gridValue)}
                  stroke="var(--border)"
                  strokeWidth={1}
                  strokeDasharray="4 6"
                />
              ))}

              <motion.path
                d={linePath}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: reduce ? 1 : 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: reduce ? 0 : 1.2, ease: EASE }}
              />

              {points.map((point, index) => (
                <motion.circle
                  key={`${point.label}-${String(index)}`}
                  cx={toX(index, count)}
                  cy={toY(point.value)}
                  r={4.5}
                  fill="var(--primary)"
                  stroke="var(--card)"
                  strokeWidth={2}
                  initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{
                    duration: reduce ? 0 : 0.3,
                    delay: reduce ? 0 : 0.6 + index * 0.08,
                    ease: EASE,
                  }}
                />
              ))}
            </svg>

            <div className="mt-2 flex justify-between text-[11px] font-medium text-muted-foreground">
              {points.map((point, index) => (
                <span key={`${point.label}-label-${String(index)}`}>{point.label}</span>
              ))}
            </div>
          </div>

          <p className="sr-only">
            {points.map((point) => `${point.label}: ${String(Math.round(point.value))}`).join(", ")}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ChartLine className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">
            Not enough history yet. Your momentum line appears once you have at least two readiness
            snapshots.
          </p>
        </div>
      )}
    </section>
  );
}
