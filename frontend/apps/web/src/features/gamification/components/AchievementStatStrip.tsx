"use client";

import { Flame, Trophy, Zap } from "lucide-react";
import { cn } from "@atlas/design-system";
import { CountUp } from "../../progress/components/CountUp";
import { formatXp, humanizeKey, type LeagueTier, leagueMeta } from "../gamification-view";

type AchievementStatStripProps = {
  league: LeagueTier | null;
  weeklyRank: number | null;
  rankedMembers: number;
  xpTotal: number;
  levelNumber: number | null;
  levelKey: string | null;
  streak: { currentCount: number; longestCount: number } | null;
};

const cardBase =
  "flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5";
const label = "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";
const value = "mt-1 text-lg font-semibold leading-tight text-foreground";

function TierCard({
  league,
  weeklyRank,
  rankedMembers,
}: {
  league: LeagueTier | null;
  weeklyRank: number | null;
  rankedMembers: number;
}) {
  if (!league) {
    return (
      <section aria-label="League tier" className={cardBase}>
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Trophy className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <p className={label}>Current tier</p>
            <h3 className={value}>Unranked</h3>
          </div>
        </div>
        <span className="max-w-[8rem] text-right text-xs text-muted-foreground">
          Earn XP this week to join a league
        </span>
      </section>
    );
  }

  const meta = leagueMeta(league);
  const Icon = meta.icon;

  return (
    <section aria-label="League tier" className={cardBase}>
      <div className="flex items-center gap-4">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full shadow-sm"
          style={meta.discStyle}
        >
          <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
        </span>
        <div>
          <p className={label}>Current tier</p>
          <h3 className={value}>{meta.label}</h3>
        </div>
      </div>
      {weeklyRank != null ? (
        <span
          className={cn(
            "inline-flex flex-col items-end rounded-lg px-2.5 py-1 text-right",
            meta.chipClassName,
          )}
        >
          <span className="text-sm font-bold leading-none tabular-nums">
            #<CountUp value={weeklyRank} />
          </span>
          {rankedMembers > 0 ? (
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-80 tabular-nums">
              of {rankedMembers}
            </span>
          ) : null}
        </span>
      ) : null}
    </section>
  );
}

export function AchievementStatStrip({
  league,
  weeklyRank,
  rankedMembers,
  xpTotal,
  levelNumber,
  levelKey,
  streak,
}: AchievementStatStripProps) {
  const currentStreak = streak?.currentCount ?? 0;
  const atPersonalBest =
    streak != null && currentStreak > 0 && currentStreak >= streak.longestCount;
  const levelLabel =
    levelNumber != null ? `Lv ${String(levelNumber)}` : levelKey ? humanizeKey(levelKey) : null;

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      <TierCard league={league} weeklyRank={weeklyRank} rankedMembers={rankedMembers} />

      <section aria-label="Lifetime XP" className={cardBase}>
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Zap className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <p className={label}>XP total</p>
            <h3 className={cn(value, "tabular-nums")}>
              <CountUp value={xpTotal} format={formatXp} /> XP
            </h3>
          </div>
        </div>
        {levelLabel ? (
          <span className="inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {levelLabel}
          </span>
        ) : null}
      </section>

      <section aria-label="Daily streak" className={cardBase}>
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--destructive)_14%,transparent)] text-[color-mix(in_srgb,var(--destructive)_72%,var(--foreground))]">
            <Flame className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <p className={label}>Daily streak</p>
            <h3 className={cn(value, "tabular-nums")}>
              <CountUp value={currentStreak} /> {currentStreak === 1 ? "Day" : "Days"}
            </h3>
          </div>
        </div>
        {currentStreak > 0 ? (
          <span
            className={cn(
              "inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold",
              atPersonalBest
                ? "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[color-mix(in_srgb,var(--success)_74%,var(--foreground))]"
                : "bg-[color-mix(in_srgb,var(--destructive)_14%,transparent)] text-[color-mix(in_srgb,var(--destructive)_72%,var(--foreground))]",
            )}
          >
            {atPersonalBest ? "Personal best" : "Active"}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Start today
          </span>
        )}
      </section>
    </div>
  );
}
