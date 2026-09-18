"use client";

import Link from "next/link";
import {
  ArrowRight,
  Coins,
  ExternalLink,
  Flame,
  Medal,
  ShoppingBag,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import {
  gamificationDomainCardClassName,
  gamificationDiagramPanelClassName,
  gamificationNodeClassName,
  gamificationNodePrimaryClassName,
  gamificationStatusBadgeClassName,
  monoClassName,
  summarizeDomainStatus,
  type GamificationEventOption,
  type GamificationTabId,
} from "../gamification-admin-shared";
import { FlowConnector } from "./GamificationTabRail";
import { GamificationSimulatePanel } from "./GamificationSimulatePanel";
import { HallOfFameConfigPanel } from "./HallOfFameConfigPanel";
import { GamificationExportButton } from "./GamificationExportButton";

type DomainSummary = {
  badges: Array<{ status: string }>;
  leaderboards: Array<{ status: string }>;
};

export type GamificationMetrics = {
  badges: { total: number; active: number; draft: number; inactive: number; archived: number };
  leaderboards: {
    total: number;
    active: number;
    draft: number;
    inactive: number;
    archived: number;
  };
  awardsThisWeek: number;
  activeStreaks: number;
  memberProfiles: number;
  xpThisWeek: number;
};

type GamificationOverviewPanelProps = {
  summary: DomainSummary;
  metrics?: GamificationMetrics | null;
  onNavigate: (tab: GamificationTabId) => void;
  members?: Array<{ id: string; label: string }>;
  eventOptions?: GamificationEventOption[];
  leaderboards?: Array<{ key: string; name: string }>;
};

function DomainCard({
  title,
  description,
  statusLabel,
  footer,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  statusLabel: string;
  footer: string;
  icon: typeof Medal;
  onClick?: () => void;
}) {
  const className = onClick
    ? `${gamificationDomainCardClassName} cursor-pointer text-left`
    : gamificationDomainCardClassName;

  const content = (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] p-2">
          <Icon className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
        </div>
        <span className={gamificationStatusBadgeClassName(statusLabel)}>{statusLabel}</span>
      </div>
      <h3 className="text-sm font-bold text-[var(--admin-on-surface)]">{title}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--admin-on-surface-variant)]">
        {description}
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-[var(--admin-border)] pt-3 text-[11px] text-[var(--admin-outline)]">
        <span className={monoClassName}>{footer}</span>
        {onClick ? <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}

export function GamificationOverviewPanel({
  summary,
  metrics = null,
  onNavigate,
  members = [],
  eventOptions = [],
  leaderboards = [],
}: GamificationOverviewPanelProps) {
  const badgeStatuses = summary.badges.map((badge) => badge.status);
  const boardStatuses = summary.leaderboards.map((board) => board.status);
  const badgeTotal = metrics?.badges.total ?? summary.badges.length;
  const boardTotal = metrics?.leaderboards.total ?? summary.leaderboards.length;
  const activeBadges =
    metrics?.badges.active ?? badgeStatuses.filter((status) => status === "ACTIVE").length;
  const activeBoards =
    metrics?.leaderboards.active ?? boardStatuses.filter((status) => status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <section
        className={gamificationDiagramPanelClassName}
        aria-labelledby="engine-diagram-heading"
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
            <h2
              id="engine-diagram-heading"
              className="font-semibold text-[var(--admin-on-surface)]"
            >
              Engine relationship diagram
            </h2>
          </div>
          <div className="flex flex-wrap gap-4 text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--admin-primary)]" />
              Trigger
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--admin-warning)]" />
              Reward
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-8 py-4 lg:flex-row lg:py-8">
          <div className="flex flex-col items-center gap-3">
            <div className={gamificationNodeClassName}>
              <Zap className="h-8 w-8 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--admin-primary)] motion-safe:animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold">Learning activity</p>
              <div className="mt-2 flex flex-wrap justify-center gap-1">
                <span className="rounded-full border border-[color-mix(in_srgb,var(--admin-success)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold text-[var(--admin-success)]">
                  Courses
                </span>
                <span className="rounded-full border border-[color-mix(in_srgb,var(--admin-primary)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold text-[var(--admin-primary)]">
                  Quizzes
                </span>
              </div>
            </div>
          </div>

          <FlowConnector label="Generate" />

          <div className="flex flex-col items-center gap-3">
            <div className={gamificationNodePrimaryClassName}>
              <Star className="h-10 w-10 text-[var(--admin-primary)]" aria-hidden="true" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold">Experience (XP)</p>
              <p className="text-[11px] text-[var(--admin-outline)]">Accumulation layer</p>
            </div>
          </div>

          <FlowConnector label="Unlocks" />

          <div className="flex flex-col items-center gap-3">
            <div className={gamificationNodeClassName}>
              <Trophy
                className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold">Leaderboards</p>
              <p className="text-[11px] text-[var(--admin-outline)]">Ranking logic</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-6 border-t border-[var(--admin-border)] pt-8 lg:flex-row">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))]">
              <Flame className="h-7 w-7 text-[var(--admin-warning)]" aria-hidden="true" />
            </div>
            <p className="text-sm font-bold">Streaks</p>
            <span className="rounded-full bg-[var(--admin-surface-high)] px-2 py-0.5 text-[10px] font-bold text-[var(--admin-on-surface-variant)]">
              Learner-managed
            </span>
          </div>
          <FlowConnector label="Earns" />
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))]">
              <Medal className="h-7 w-7 text-[var(--admin-warning)]" aria-hidden="true" />
            </div>
            <p className="text-sm font-bold">Badges</p>
            <p className="text-[11px] text-[var(--admin-outline)]">Achievement layer</p>
          </div>
          <FlowConnector label="Feeds" />
          <div className="flex flex-col items-center gap-2">
            <div className={gamificationNodePrimaryClassName}>
              <Coins className="h-8 w-8 text-[var(--admin-warning)]" aria-hidden="true" />
            </div>
            <p className="text-sm font-bold">Recognition</p>
            <p className="text-[11px] text-[var(--admin-outline)]">Hall of fame</p>
            <Link
              href="/hall-of-fame"
              className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--admin-primary)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              View page
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <FlowConnector label="Spends" />
          <div className="flex flex-col items-center gap-2">
            <div className={gamificationNodeClassName}>
              <ShoppingBag
                className="h-7 w-7 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
            </div>
            <p className="text-sm font-bold">Rewards shop</p>
            <p className="text-[11px] text-[var(--admin-outline)]">Currency & catalog</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DomainCard
          icon={Medal}
          title="Badges"
          description={`${String(badgeTotal)} badge definition(s) configured for automatic and manual awards.`}
          statusLabel={summarizeDomainStatus(badgeStatuses)}
          footer={`${String(activeBadges)} active`}
          onClick={() => {
            onNavigate("badges");
          }}
        />
        <DomainCard
          icon={Trophy}
          title="Leaderboards"
          description={`${String(boardTotal)} leaderboard(s) ranking tenant XP totals.`}
          statusLabel={summarizeDomainStatus(boardStatuses)}
          footer={`${String(activeBoards)} active`}
          onClick={() => {
            onNavigate("leaderboards");
          }}
        />
        <DomainCard
          icon={Star}
          title="Points & XP"
          description={
            metrics
              ? `${String(metrics.xpThisWeek)} XP earned across ${String(metrics.memberProfiles)} member profile(s) this week.`
              : "XP totals accrue from learner activity and feed leaderboard rankings automatically."
          }
          statusLabel="Active"
          footer="System-managed"
        />
        <DomainCard
          icon={Medal}
          title="Manual awards"
          description={
            metrics
              ? `${String(metrics.awardsThisWeek)} badge award(s) in the last 7 days.`
              : "Grant badges directly to members with a recorded reason for audit."
          }
          statusLabel={summary.badges.length > 0 ? "Ready" : "Setup needed"}
          footer="Admin action"
          onClick={() => {
            onNavigate("awards");
          }}
        />
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 lg:col-span-2">
          <h3 className="font-semibold text-[var(--admin-on-surface)]">Configuration summary</h3>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Badges
              </dt>
              <dd className="mt-1 text-2xl font-bold text-[var(--admin-on-surface)]">
                {badgeTotal}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Leaderboards
              </dt>
              <dd className="mt-1 text-2xl font-bold text-[var(--admin-on-surface)]">
                {boardTotal}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Active badges
              </dt>
              <dd className="mt-1 text-2xl font-bold text-[var(--admin-primary)]">
                {activeBadges}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Active boards
              </dt>
              <dd className="mt-1 text-2xl font-bold text-[var(--admin-primary)]">
                {activeBoards}
              </dd>
            </div>
          </dl>
          {metrics ? (
            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--admin-border)] pt-4 sm:grid-cols-4">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                  Awards (7d)
                </dt>
                <dd className="mt-1 text-2xl font-bold text-[var(--admin-on-surface)]">
                  {metrics.awardsThisWeek}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                  XP earned (7d)
                </dt>
                <dd className="mt-1 text-2xl font-bold text-[var(--admin-on-surface)]">
                  {metrics.xpThisWeek}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                  Active streaks
                </dt>
                <dd className="mt-1 text-2xl font-bold text-[var(--admin-warning)]">
                  {metrics.activeStreaks}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                  Member profiles
                </dt>
                <dd className="mt-1 text-2xl font-bold text-[var(--admin-on-surface)]">
                  {metrics.memberProfiles}
                </dd>
              </div>
            </dl>
          ) : null}
        </article>
        <article className="rounded-xl bg-[var(--admin-primary)] p-5 text-[var(--admin-on-primary)]">
          <h3 className="font-bold">Quick actions</h3>
          <p className="mt-2 text-sm leading-relaxed opacity-90">
            Jump into the domains you can configure today: badges, leaderboards, and manual awards.
          </p>
          <div className="mt-4 space-y-2">
            <button
              type="button"
              className="w-full rounded-lg bg-[var(--admin-surface)] px-3 py-2 text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:opacity-90"
              onClick={() => {
                onNavigate("badges");
              }}
            >
              Create badge
            </button>
            <button
              type="button"
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--admin-on-primary)_35%,transparent)] px-3 py-2 text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--admin-on-primary)_12%,transparent)]"
              onClick={() => {
                onNavigate("leaderboards");
              }}
            >
              Manage leaderboards
            </button>
            <button
              type="button"
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--admin-on-primary)_35%,transparent)] px-3 py-2 text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--admin-on-primary)_12%,transparent)]"
              onClick={() => {
                onNavigate("points");
              }}
            >
              Configure XP rules
            </button>
            <GamificationExportButton />
          </div>
        </article>
      </section>

      <HallOfFameConfigPanel leaderboards={leaderboards} />

      {members.length > 0 && eventOptions.length > 0 ? (
        <GamificationSimulatePanel members={members} events={eventOptions} />
      ) : null}
    </div>
  );
}
