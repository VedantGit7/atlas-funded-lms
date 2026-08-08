"use client";

import { TrendingUp } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type WeekBucket, formatXp } from "../progress-view";

type MasteryVelocityChartProps = {
  weeks: WeekBucket[];
  currentLevel: number | null;
};

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEW_W = 640;
const VIEW_H = 220;
const PAD_X = 12;
const PAD_TOP = 34;
const PAD_BOTTOM = 20;

export function MasteryVelocityChart({ weeks, currentLevel }: MasteryVelocityChartProps) {
  const reduce = useReducedMotion();
  const maxXp = weeks.reduce((max, week) => Math.max(max, week.xp), 0);
  const count = weeks.length;
  const hasData = count >= 2 && maxXp > 0;
  const totalXp = weeks.reduce((sum, week) => sum + week.xp, 0);

  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const toX = (index: number) =>
    count <= 1 ? VIEW_W / 2 : PAD_X + (index / (count - 1)) * (VIEW_W - PAD_X * 2);
  const toY = (xp: number) => PAD_TOP + (1 - (maxXp > 0 ? xp / maxXp : 0)) * plotH;

  const linePath = weeks
    .map((week, index) => `${index === 0 ? "M" : "L"} ${String(toX(index))} ${String(toY(week.xp))}`)
    .join(" ");
  const baseline = toY(0);
  const areaPath = hasData
    ? `${linePath} L ${String(toX(count - 1))} ${String(baseline)} L ${String(toX(0))} ${String(baseline)} Z`
    : "";

  const lastIndex = count - 1;
  const flagLeft = hasData ? (toX(lastIndex) / VIEW_W) * 100 : 0;
  const flagTop = hasData ? (toY(weeks[lastIndex]?.xp ?? 0) / VIEW_H) * 100 : 0;

  return (
    <section
      aria-label="Mastery velocity"
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </span>
          Mastery velocity
        </h2>
        {hasData ? (
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {formatXp(totalXp)} XP in {count} weeks
          </span>
        ) : null}
      </header>

      {hasData ? (
        <div className="flex flex-1 flex-col justify-center px-6 py-6">
          <div
            className="relative"
            role="img"
            aria-label={`Weekly XP gained over the last ${String(count)} weeks, ${formatXp(totalXp)} XP total`}
          >
            <svg
              viewBox={`0 0 ${String(VIEW_W)} ${String(VIEW_H)}`}
              className="h-auto w-full overflow-visible"
              preserveAspectRatio="none"
            >
              <motion.path
                d={areaPath}
                fill="color-mix(in srgb, var(--primary) 12%, transparent)"
                stroke="none"
                initial={{ opacity: reduce ? 1 : 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: reduce ? 0 : 0.8, ease: EASE }}
              />
              <motion.path
                d={linePath}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: reduce ? 1 : 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: reduce ? 0 : 1.1, ease: EASE }}
              />
              {weeks.map((week, index) => (
                <motion.circle
                  key={week.weekStart}
                  cx={toX(index)}
                  cy={toY(week.xp)}
                  r={3.5}
                  fill="var(--primary)"
                  stroke="var(--card)"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  initial={{ opacity: reduce ? 1 : 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : 0.5, ease: EASE }}
                />
              ))}
            </svg>

            {currentLevel != null ? (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-[140%]"
                style={{ left: `${String(flagLeft)}%`, top: `${String(flagTop)}%` }}
              >
                <span className="inline-block whitespace-nowrap rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm">
                  Lv {currentLevel}
                </span>
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex justify-between text-[10px] font-medium text-muted-foreground">
            {weeks.map((week) => (
              <span key={`label-${week.weekStart}`}>{week.label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <TrendingUp className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="max-w-xs text-sm text-muted-foreground">
            Earn XP across a few weeks and your momentum curve will chart here.
          </p>
        </div>
      )}
    </section>
  );
}
