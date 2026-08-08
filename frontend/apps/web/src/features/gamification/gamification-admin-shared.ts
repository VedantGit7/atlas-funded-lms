import {
  alertErrorClassName,
  alertInfoClassName,
  monoClassName,
  panelBodyClassName,
  panelClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  publishedLiveBadgeClassName,
  statusDraftBadgeClassName,
} from "../competency/competency-admin-shared";
import {
  collapseEase,
  fieldClassName,
  ghostButtonClassName as baseGhostButtonClassName,
  labelClassName,
  outlineButtonClassName as baseOutlineButtonClassName,
  primaryButtonClassName,
  selectClassName,
} from "../../app/admin/branding/_components/branding-admin-shared";
import { dropdownPanelEnterClassName } from "@atlas/design-system";

const buttonIconLayout =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap leading-none";

export const outlineButtonClassName = `${baseOutlineButtonClassName} ${buttonIconLayout}`;
export const ghostButtonClassName = `${baseGhostButtonClassName} ${buttonIconLayout}`;

export const iconButtonClassName =
  "inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:cursor-not-allowed disabled:opacity-50";

export const inlineExpandClassName = dropdownPanelEnterClassName;

export const dropdownPanelSurfaceClassName =
  `overflow-hidden rounded-xl border border-[var(--admin-border)] ${dropdownPanelEnterClassName}`;

export {  alertErrorClassName,
  alertInfoClassName,
  collapseEase,
  fieldClassName,
  labelClassName,
  monoClassName,
  panelClassName,
  panelBodyClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  primaryButtonClassName,
  selectClassName,
};

export const gamificationPageTitleClassName =
  "text-[22px] font-bold leading-8 tracking-[-0.02em] text-[var(--admin-on-surface)]";

export const gamificationPageDescClassName =
  "mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]";

export const gamificationDomainCardClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 transition-[box-shadow,border-color] hover:border-[color-mix(in_srgb,var(--admin-primary)_22%,var(--admin-border))] hover:shadow-md";

export const gamificationDiagramPanelClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm sm:p-6";

export const gamificationFlowConnectorClassName =
  "relative mx-2 hidden h-px flex-1 border-t-2 border-dashed border-[var(--admin-outline)] lg:block";

export const gamificationNodeClassName =
  "relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[var(--admin-border)] bg-[var(--admin-surface-low)] transition-colors hover:border-[var(--admin-primary)]";

export const gamificationNodePrimaryClassName =
  "relative flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]";

export type GamificationTabId =
  | "overview"
  | "badges"
  | "leaderboards"
  | "awards"
  | "points"
  | "streaks"
  | "quests"
  | "shop"
  | "seasonal";

export type GamificationTabDef = {
  id: GamificationTabId;
  label: string;
  enabled: boolean;
};

export const GAMIFICATION_TABS: GamificationTabDef[] = [
  { id: "overview", label: "Overview", enabled: true },
  { id: "badges", label: "Badges", enabled: true },
  { id: "leaderboards", label: "Leaderboards", enabled: true },
  { id: "awards", label: "Manual awards", enabled: true },
  { id: "points", label: "Points & XP", enabled: true },
  { id: "streaks", label: "Streaks", enabled: true },
  { id: "quests", label: "Quests", enabled: true },
  { id: "shop", label: "Rewards shop", enabled: true },
  { id: "seasonal", label: "Seasonal events", enabled: true },
];

export type GamificationEventOption = {
  eventType: string;
  label: string;
  status: "active" | "planned";
};

export type GamificationRules = {
  xpRules: Array<{
    key: string;
    eventType: string;
    points: number;
    condition?: "pass" | undefined;
  }>;
  levelThresholds: Array<{ levelKey: string; minXp: number }>;
  streaks: Array<{ streakKey: string; eventTypes: string[]; cadence?: "daily" | "weekly" }>;
  defaultFreezeInventory: number;
  leaderboardsPublic: boolean;
  streakBonuses: Array<{ days: number; bonusXp: number }>;
};

export function gamificationStatusBadgeClassName(status: string): string {
  switch (status) {
    case "ACTIVE":
      return publishedLiveBadgeClassName;
    case "DRAFT":
      return statusDraftBadgeClassName;
    case "ARCHIVED":
      return "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";
    case "INACTIVE":
      return "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
    default:
      return statusDraftBadgeClassName;
  }
}

export function summarizeDomainStatus(statuses: string[]): string {
  if (statuses.length === 0) return "Empty";
  if (statuses.some((status) => status === "ACTIVE")) return "Active";
  if (statuses.some((status) => status === "DRAFT")) return "Draft";
  if (statuses.every((status) => status === "ARCHIVED")) return "Archived";
  return "Mixed";
}

export function tabTitle(tab: GamificationTabId): string {
  switch (tab) {
    case "overview":
      return "Gamification topology";
    case "badges":
      return "Badge catalogue";
    case "leaderboards":
      return "Leaderboards";
    case "awards":
      return "Manual badge awards";
    case "points":
      return "Points & XP rules";
    case "streaks":
      return "Streak rules";
    case "quests":
      return "Quests & missions";
    case "shop":
      return "Rewards shop";
    case "seasonal":
      return "Seasonal events";
  }
}

export function tabDescription(tab: GamificationTabId): string {
  switch (tab) {
    case "overview":
      return "Institutional overview of engine relationships and configured domains.";
    case "badges":
      return "Create, update, and manage achievement badges for learners.";
    case "leaderboards":
      return "Configure XP leaderboards and ranking windows.";
    case "awards":
      return "Manually award badges to members with an audit reason.";
    case "points":
      return "Configure XP rules per learning event, level thresholds, and leaderboard visibility.";
    case "streaks":
      return "Define streaks, default freeze inventory, and milestone bonus XP.";
    case "quests":
      return "Turn learning goals into missions with steps, deadlines, and rewards.";
    case "shop":
      return "Configure virtual currency, the reward catalog, and redemptions.";
    case "seasonal":
      return "Schedule time-boxed XP boosts and themed competitions.";
  }
}
