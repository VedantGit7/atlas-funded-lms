"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Crown, Sparkles, TrendingUp, Trophy } from "lucide-react";
import type { z } from "zod";
import { cn } from "@atlas/design-system";
import type { leaderboardDetailResponseSchema } from "@atlas/contracts/gamification/gamification.schemas";
import { CountUp } from "../../progress/components/CountUp";
import { ProgressReveal } from "../../progress/components/ProgressReveal";
import { formatXp, leagueMeta } from "../../gamification/gamification-view";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  type HallOfFameBoard,
  type HallOfFameEntry,
  type HallOfFameLeaderboardDetail,
  boardLabel,
  entryDisplayName,
  formatSnapshotDate,
  podiumTier,
  windowLabel,
} from "../hall-of-fame-view";

type LeaderboardDetailResponse = z.infer<typeof leaderboardDetailResponseSchema>;

type HallOfFameLeaderboardProps = {
  /** Detail of the configured (primary) board, pre-rendered on the server. */
  initialDetail: HallOfFameLeaderboardDetail | null;
  /** Active, tenant-scoped boards offered as switchable categories. */
  boards: HallOfFameBoard[];
  gamificationAvailable: boolean;
  unavailableMessage: string;
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function HallOfFameLeaderboard({
  initialDetail,
  boards,
  gamificationAvailable,
  unavailableMessage,
}: HallOfFameLeaderboardProps) {
  const reduce = useReducedMotion();

  // The primary board may be scoped differently than the tenant category list;
  // union it in so it can always be selected and shown.
  const categories = useMemo<HallOfFameBoard[]>(() => {
    if (!initialDetail) return boards;
    const primary = initialDetail.leaderboard;
    return boards.some((board) => board.id === primary.id) ? boards : [primary, ...boards];
  }, [boards, initialDetail]);

  const [activeId, setActiveId] = useState<string | null>(
    initialDetail?.leaderboard.id ?? categories[0]?.id ?? null,
  );
  const [cache, setCache] = useState<Record<string, HallOfFameLeaderboardDetail>>(() =>
    initialDetail ? { [initialDetail.leaderboard.id]: initialDetail } : {},
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId || cache[activeId] || loadingId === activeId) return;
    let cancelled = false;
    setLoadingId(activeId);
    setError(null);
    void clientApi
      .get<LeaderboardDetailResponse>(`/api/v1/leaderboards/${activeId}`)
      .then((res) => {
        if (!cancelled) setCache((prev) => ({ ...prev, [activeId]: res.data }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ClientApiError
            ? "We couldn't load this leaderboard right now."
            : "Something went wrong loading this leaderboard.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, cache, loadingId]);

  if (!gamificationAvailable) {
    return (
      <section aria-label="Leaderboard" className="space-y-4">
        <SectionHeading title="Top standings" />
        <EmptyPanel
          icon={Trophy}
          title="Standings are unavailable"
          description={unavailableMessage}
        />
      </section>
    );
  }

  const activeDetail = activeId ? (cache[activeId] ?? null) : null;
  const isLoading = loadingId != null && !activeDetail;

  return (
    <section aria-label="Leaderboard" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          title="Top standings"
          hint={
            activeDetail
              ? `${windowLabel(activeDetail.leaderboard.windowKey)} · Updated ${formatSnapshotDate(
                  activeDetail.calculatedAt,
                )}`
              : undefined
          }
        />
        {categories.length >= 2 ? (
          <div
            role="tablist"
            aria-label="Leaderboard categories"
            className="flex flex-wrap gap-2"
          >
            {categories.map((board) => {
              const active = board.id === activeId;
              return (
                <button
                  key={board.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setActiveId(board.id);
                  }}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors active:scale-[0.98]",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  {boardLabel(board)}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] px-4 py-3 text-sm text-[color-mix(in_srgb,var(--destructive)_78%,var(--foreground))]">
          {error}
        </p>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeId ?? "none"}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 1 } : { opacity: 0, y: -8 }}
          transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
          className="space-y-10"
        >
          {isLoading ? (
            <PodiumSkeleton />
          ) : activeDetail && activeDetail.entries.length > 0 ? (
            <LeaderboardBody detail={activeDetail} />
          ) : (
            <EmptyPanel
              icon={Sparkles}
              title="No standings yet"
              description="Earn XP by completing lessons and assessments to climb into the Hall of Fame."
            />
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function LeaderboardBody({ detail }: { detail: HallOfFameLeaderboardDetail }) {
  const podium = detail.entries.filter((entry) => entry.rank <= 3);
  const roster = detail.entries.filter((entry) => entry.rank > 3);
  const selfVisible = detail.entries.some((entry) => entry.isSelf);
  const showCaller = !selfVisible && detail.callerRank != null;

  return (
    <div className="space-y-10">
      <Podium entries={podium} />

      {showCaller && detail.callerRank != null ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Your standing
              </p>
              <p className="text-sm font-semibold text-foreground">
                Rank #{detail.callerRank}
              </p>
            </div>
          </div>
          {detail.callerMetricValue != null ? (
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {formatXp(detail.callerMetricValue)}{" "}
              <span className="text-xs font-medium text-muted-foreground">XP</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {roster.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-foreground">Honoree circle</h3>
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
              Ranks 4-{roster[roster.length - 1]?.rank ?? roster.length + 3}
            </span>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((entry) => (
              <RosterCard key={entry.rank} entry={entry} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Podium({ entries }: { entries: HallOfFameEntry[] }) {
  const byRank = new Map(entries.map((entry) => [entry.rank, entry]));
  const order: Array<{ rank: number; orderClass: string }> = [
    { rank: 2, orderClass: "order-2 md:order-1" },
    { rank: 1, orderClass: "order-1 md:order-2" },
    { rank: 3, orderClass: "order-3 md:order-3" },
  ];

  return (
    <ProgressReveal>
      <div className="grid grid-cols-1 items-end gap-6 md:grid-cols-3">
        {order.map(({ rank, orderClass }) => {
          const entry = byRank.get(rank);
          if (!entry) return null;
          return (
            <div key={rank} className={orderClass}>
              <PodiumColumn entry={entry} />
            </div>
          );
        })}
      </div>
    </ProgressReveal>
  );
}

function PodiumColumn({ entry }: { entry: HallOfFameEntry }) {
  const tier = podiumTier(entry.rank);
  const meta = leagueMeta(tier);
  const Icon = meta.icon;
  const isGold = entry.rank === 1;

  const pedestalHeight =
    entry.rank === 1 ? "h-28 md:h-40" : entry.rank === 2 ? "h-20 md:h-28" : "h-16 md:h-20";
  const discSize = isGold ? "h-24 w-24" : "h-20 w-20";
  const accent = `var(--league-${tier})`;

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex flex-col items-center text-center">
        <div className="relative">
          {isGold ? (
            <Crown
              className="absolute -top-5 left-1/2 h-6 w-6 -translate-x-1/2 text-[var(--league-gold)]"
              strokeWidth={2}
              aria-hidden="true"
            />
          ) : null}
          <span
            className={cn(
              "flex items-center justify-center rounded-full shadow-sm ring-4 ring-card",
              discSize,
            )}
            style={meta.discStyle}
          >
            <Icon
              className={isGold ? "h-9 w-9" : "h-8 w-8"}
              strokeWidth={2}
              aria-hidden="true"
            />
          </span>
          <span
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card text-xs font-bold text-primary-foreground tabular-nums"
            style={{ backgroundColor: accent }}
          >
            {entry.rank}
          </span>
        </div>

        <p
          className={cn(
            "mt-4 font-semibold text-foreground",
            isGold ? "text-lg" : "text-base",
          )}
        >
          {entryDisplayName(entry)}
        </p>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          <CountUp value={entry.metricValue} format={formatXp} />{" "}
          <span className="text-xs font-medium text-muted-foreground">XP</span>
        </p>
        {entry.isSelf ? (
          <span className="mt-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
            You
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          "flex w-full items-start justify-center rounded-t-xl border-t-4 pt-4",
          pedestalHeight,
        )}
        style={{
          borderTopColor: accent,
          backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${accent} 16%, var(--card)), var(--card))`,
        }}
      >
        <span className="text-2xl font-bold text-[color-mix(in_srgb,var(--foreground)_38%,transparent)] tabular-nums">
          {entry.rank}
        </span>
      </div>
    </div>
  );
}

function RosterCard({ entry }: { entry: HallOfFameEntry }) {
  return (
    <li
      className={cn(
        "flex items-center gap-4 rounded-xl border p-4 transition-colors",
        entry.isSelf
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:border-primary/30 hover:bg-muted/40",
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground tabular-nums">
        {entry.rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {formatXp(entry.metricValue)}{" "}
          <span className="text-xs font-medium text-muted-foreground">XP</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {entry.isSelf ? "Your standing" : "Ranked learner"}
        </p>
      </div>
      {entry.isSelf ? (
        <span className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
          You
        </span>
      ) : null}
    </li>
  );
}

function SectionHeading({ title, hint }: { title: string; hint?: string | undefined }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Trophy;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function PodiumSkeleton() {
  const columns = [
    { pedestal: "h-20 md:h-28", order: "order-2 md:order-1" },
    { pedestal: "h-28 md:h-40", order: "order-1 md:order-2" },
    { pedestal: "h-16 md:h-20", order: "order-3 md:order-3" },
  ];
  return (
    <div className="grid grid-cols-1 items-end gap-6 md:grid-cols-3" aria-hidden="true">
      {columns.map((column, index) => (
        <div key={index} className={cn("flex flex-col items-center", column.order)}>
          <div className="mb-4 flex flex-col items-center gap-2">
            <div className="h-20 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          </div>
          <div className={cn("w-full animate-pulse rounded-t-xl bg-muted", column.pedestal)} />
        </div>
      ))}
    </div>
  );
}
