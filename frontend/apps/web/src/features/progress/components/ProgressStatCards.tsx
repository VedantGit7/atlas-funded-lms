"use client";

import { Award, Flame, Gauge, Sparkles, TrendingUp } from "lucide-react";
import { motion, useReducedMotion } from "../../../components/motion/animation-boundary";
import { cn } from "@atlas/design-system";
import { CountUp } from "./CountUp";
import { formatXp, humanizeKey, padCount } from "../progress-view";

const EASE = [0.16, 1, 0.3, 1] as const;

export type LevelProgressView = {
  levelNumber: number;
  levelKey: string;
  currentLevelMinXp: number;
  nextLevelKey: string | null;
  nextLevelMinXp: number | null;
  xpIntoLevel: number;
  xpForNextLevel: number | null;
  progressPct: number;
};

type ProgressStatCardsProps = {
  levelProgress: LevelProgressView | null;
  levelKey: string | null;
  xpTotal: number;
  weeklyXp: number;
  streak: { currentCount: number; longestCount: number };
  certificatesCount: number;
  certificatesHasMore: boolean;
};

const cardBase = "flex flex-col rounded-2xl border border-border bg-card p-6";
const label = "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";

function IconChip({
  children,
  tone = "primary",
}: {
  children: React.ReactNode;
  tone?: "primary" | "success";
}) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg",
        tone === "success"
          ? "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[color-mix(in_srgb,var(--success)_78%,var(--foreground))]"
          : "bg-primary/10 text-primary",
      )}
    >
      {children}
    </span>
  );
}

export function ProgressStatCards({
  levelProgress,
  levelKey,
  xpTotal,
  weeklyXp,
  streak,
  certificatesCount,
  certificatesHasMore,
}: ProgressStatCardsProps) {
  const reduce = useReducedMotion();
  const atPersonalBest = streak.currentCount > 0 && streak.currentCount >= streak.longestCount;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {/* Level + XP progress (featured, offset shadow echoes the source style) */}
      <section
        aria-label="Current level"
        className={cn(
          cardBase,
          "shadow-[5px_5px_0_0_color-mix(in_srgb,var(--primary)_16%,transparent)]",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <span className={label}>Current Level</span>
          <IconChip>
            <Gauge className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </IconChip>
        </div>

        {levelProgress ? (
          <>
            <p className="text-3xl font-semibold leading-none tracking-tight text-primary tabular-nums">
              Lv. <CountUp value={levelProgress.levelNumber} />
            </p>
            <div
              className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={levelProgress.progressPct}
              aria-label="Progress to next level"
            >
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: reduce ? `${String(levelProgress.progressPct)}%` : "0%" }}
                whileInView={{ width: `${String(levelProgress.progressPct)}%` }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: reduce ? 0 : 1, ease: EASE }}
              />
            </div>
            <p className="mt-2 text-right text-xs font-medium text-muted-foreground tabular-nums">
              {levelProgress.xpForNextLevel != null
                ? `${formatXp(levelProgress.xpIntoLevel)} / ${formatXp(levelProgress.xpForNextLevel)} XP`
                : "Top level reached"}
            </p>
          </>
        ) : (
          <>
            <p className="text-3xl font-semibold leading-none tracking-tight text-primary">
              {levelKey ? humanizeKey(levelKey) : "Getting started"}
            </p>
            <p className="mt-4 text-sm text-muted-foreground tabular-nums">
              {formatXp(xpTotal)} XP earned
            </p>
          </>
        )}
      </section>

      {/* Daily momentum / streak */}
      <section aria-label="Daily momentum" className={cardBase}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <span className={label}>Daily Momentum</span>
          <IconChip tone="success">
            <Flame className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </IconChip>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-[color-mix(in_srgb,var(--success)_82%,var(--foreground))]">
            <CountUp value={streak.currentCount} />
          </span>
          <span className="text-sm text-muted-foreground">Day streak</span>
        </div>
        <div className="mt-3">
          {atPersonalBest ? (
            <span className="inline-flex items-center rounded-md bg-[color-mix(in_srgb,var(--success)_16%,transparent)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--success)_74%,var(--foreground))] ring-1 ring-inset ring-[color-mix(in_srgb,var(--success)_32%,transparent)]">
              Personal best
            </span>
          ) : streak.longestCount > 0 ? (
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Best {streak.longestCount} days
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Complete a lesson to begin</span>
          )}
        </div>
      </section>

      {/* Lifetime XP + weekly trend */}
      <section aria-label="Lifetime mastery" className={cardBase}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <span className={label}>Lifetime Mastery</span>
          <IconChip>
            <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </IconChip>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold leading-none tracking-tight text-primary tabular-nums">
            <CountUp value={xpTotal} format={formatXp} />
          </span>
          <span className="text-sm text-muted-foreground">XP</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
          {weeklyXp > 0 ? (
            <span className="inline-flex items-center gap-1 text-[color-mix(in_srgb,var(--success)_74%,var(--foreground))]">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              {`+${formatXp(weeklyXp)} XP this week`}
            </span>
          ) : (
            <span className="text-muted-foreground">No XP earned yet this week</span>
          )}
        </div>
      </section>

      {/* Certificates count */}
      <section aria-label="Validations" className={cardBase}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <span className={label}>Validations</span>
          <IconChip>
            <Award className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </IconChip>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold leading-none tracking-tight text-primary tabular-nums">
            {padCount(certificatesCount)}
            {certificatesHasMore ? "+" : ""}
          </span>
          <span className="text-sm text-muted-foreground">
            {certificatesCount === 1 ? "Certificate" : "Certificates"}
          </span>
        </div>
        <a
          href="#credentials"
          className="mt-3 inline-flex w-fit items-center rounded-md border border-primary px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all
        </a>
      </section>
    </div>
  );
}
