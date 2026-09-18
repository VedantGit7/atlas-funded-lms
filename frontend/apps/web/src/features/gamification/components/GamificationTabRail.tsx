"use client";

import type { LucideIcon } from "lucide-react";
import {
  Award,
  ChevronRight,
  Coins,
  Flame,
  LayoutDashboard,
  Medal,
  ShoppingBag,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import { GAMIFICATION_TABS, type GamificationTabId } from "../gamification-admin-shared";

type GamificationTabRailProps = {
  activeTab: GamificationTabId;
  onTabChange: (tab: GamificationTabId) => void;
};

const TAB_ICONS: Record<GamificationTabId, LucideIcon> = {
  overview: LayoutDashboard,
  badges: Medal,
  leaderboards: Trophy,
  awards: Award,
  points: Star,
  streaks: Flame,
  quests: Sparkles,
  shop: ShoppingBag,
  seasonal: Coins,
};

export function GamificationTabRail({ activeTab, onTabChange }: GamificationTabRailProps) {
  return (
    <aside
      className="w-full shrink-0 lg:w-56 lg:border-r lg:border-[var(--admin-border)] lg:pr-4"
      aria-label="Gamification domains"
    >
      <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--admin-on-surface-variant)]">
        Logic domains
      </p>
      <nav className="flex flex-col gap-0.5">
        {GAMIFICATION_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.id];
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={!tab.enabled}
              onClick={() => {
                if (tab.enabled) onTabChange(tab.id);
              }}
              className={[
                "relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                active
                  ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] font-semibold text-[var(--admin-primary)]"
                  : tab.enabled
                    ? "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                    : "cursor-not-allowed text-[var(--admin-on-surface-variant)] opacity-60",
              ].join(" ")}
              aria-current={active ? "page" : undefined}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                <Icon className="h-4 w-4 stroke-[1.75]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 leading-snug">{tab.label}</span>
              {active ? (
                <span
                  className="absolute right-0 top-1/4 h-1/2 w-0.5 rounded-l bg-[var(--admin-primary)]"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export function FlowConnector({ label }: { label: string }) {
  return (
    <div className="relative mx-2 hidden min-w-[4rem] flex-1 items-center lg:flex">
      <div className="h-px w-full border-t-2 border-dashed border-[var(--admin-outline)]" />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--admin-surface)] px-2 text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
        {label}
      </span>
      <ChevronRight
        className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 translate-x-1 text-[var(--admin-outline)]"
        aria-hidden="true"
      />
    </div>
  );
}
