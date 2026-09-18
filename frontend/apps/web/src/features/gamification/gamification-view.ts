/**
 * Presentation helpers for the learner Achievements hub.
 *
 * Every colour resolves to a design token (see `globals.css`) so light and dark
 * mode swap automatically; nothing here hardcodes hex or palette utilities.
 * League accents use the `--league-*` tier tokens, semantic states reuse the
 * shared `--success` / `--warning` / `--destructive` tokens.
 */

import {
  Award,
  BookOpenCheck,
  Gift,
  GraduationCap,
  Medal,
  Ticket,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { RewardType } from "@atlas/contracts/gamification/rewards.schemas";
import { formatXp, humanizeKey } from "../progress/progress-view";

export { formatXp, humanizeKey };

export type LeagueTier = "gold" | "silver" | "bronze";

export type LeagueMeta = {
  tier: LeagueTier;
  label: string;
  icon: LucideIcon;
  /** Decorative metallic disc gradient built from the tier token. */
  discStyle: CSSProperties;
  /** Tinted rank pill (static classes so Tailwind's scanner keeps them). */
  chipClassName: string;
};

function discStyle(accentVar: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${accentVar} 60%, var(--card)), color-mix(in srgb, ${accentVar} 88%, var(--foreground)))`,
    color: "var(--primary-foreground)",
  };
}

const GOLD_CHIP =
  "bg-[color-mix(in_srgb,var(--league-gold)_16%,transparent)] text-[color-mix(in_srgb,var(--league-gold)_58%,var(--foreground))] ring-1 ring-inset ring-[color-mix(in_srgb,var(--league-gold)_34%,transparent)]";
const SILVER_CHIP =
  "bg-[color-mix(in_srgb,var(--league-silver)_18%,transparent)] text-[color-mix(in_srgb,var(--league-silver)_46%,var(--foreground))] ring-1 ring-inset ring-[color-mix(in_srgb,var(--league-silver)_36%,transparent)]";
const BRONZE_CHIP =
  "bg-[color-mix(in_srgb,var(--league-bronze)_16%,transparent)] text-[color-mix(in_srgb,var(--league-bronze)_54%,var(--foreground))] ring-1 ring-inset ring-[color-mix(in_srgb,var(--league-bronze)_34%,transparent)]";

/** Icon + tier label + token-driven accent for a league tier. */
export function leagueMeta(tier: LeagueTier): LeagueMeta {
  switch (tier) {
    case "gold":
      return {
        tier,
        label: "Gold League",
        icon: Trophy,
        discStyle: discStyle("var(--league-gold)"),
        chipClassName: GOLD_CHIP,
      };
    case "silver":
      return {
        tier,
        label: "Silver League",
        icon: Medal,
        discStyle: discStyle("var(--league-silver)"),
        chipClassName: SILVER_CHIP,
      };
    case "bronze":
      return {
        tier,
        label: "Bronze League",
        icon: Award,
        discStyle: discStyle("var(--league-bronze)"),
        chipClassName: BRONZE_CHIP,
      };
  }
}

export type RewardTypeMeta = {
  label: string;
  icon: LucideIcon;
};

/** Icon + short label for a reward-shop item, keyed by reward type. */
export function rewardTypeMeta(rewardType: RewardType): RewardTypeMeta {
  switch (rewardType) {
    case "CONTENT_UNLOCK":
      return { label: "Course unlock", icon: BookOpenCheck };
    case "DISCOUNT_CODE":
      return { label: "Discount code", icon: Ticket };
    case "CERTIFICATE":
      return { label: "Certificate", icon: GraduationCap };
    case "CUSTOM":
      return { label: "Reward", icon: Gift };
  }
}

export type QuestStatus = "not_started" | "in_progress" | "completed";

export type QuestStatusMeta = {
  label: string;
  chipClassName: string;
};

const QUEST_DONE_CHIP =
  "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[color-mix(in_srgb,var(--success)_74%,var(--foreground))] ring-1 ring-inset ring-[color-mix(in_srgb,var(--success)_32%,transparent)]";
const QUEST_ACTIVE_CHIP = "bg-primary/10 text-primary ring-1 ring-inset ring-primary/25";
const QUEST_IDLE_CHIP = "bg-muted text-muted-foreground ring-1 ring-inset ring-border";

/** Status label + tinted pill for a learner quest. */
export function questStatusMeta(status: QuestStatus): QuestStatusMeta {
  switch (status) {
    case "completed":
      return { label: "Completed", chipClassName: QUEST_DONE_CHIP };
    case "in_progress":
      return { label: "In progress", chipClassName: QUEST_ACTIVE_CHIP };
    case "not_started":
      return { label: "Not started", chipClassName: QUEST_IDLE_CHIP };
  }
}

/** Aggregates per-step progress into one 0-100 completion percentage. */
export function questOverallPercent(steps: Array<{ progress: number; target: number }>): number {
  const totals = steps.reduce(
    (acc, step) => {
      const target = Math.max(0, step.target);
      return {
        progress: acc.progress + Math.min(Math.max(0, step.progress), target),
        target: acc.target + target,
      };
    },
    { progress: 0, target: 0 },
  );
  if (totals.target <= 0) return 0;
  return Math.round((totals.progress / totals.target) * 100);
}

/** Human "earned on" caption, e.g. "Earned Nov 12". Null-safe. */
export function formatEarnedDate(iso: string | null | undefined): string {
  if (!iso) return "Earned";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Earned";
  return `Earned ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/**
 * Time-remaining caption for a deadline, e.g. "Ends in 5 days", "Ends today",
 * "Ends in 3 hours", or "Ended". Purely derived from the timestamp.
 */
export function formatDeadline(iso: string): string {
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return "";
  const diffMs = end.getTime() - Date.now();
  if (diffMs <= 0) return "Ended";

  const hours = diffMs / (1000 * 60 * 60);
  if (hours < 1) return "Ends within the hour";
  if (hours < 24) {
    const rounded = Math.round(hours);
    return `Ends in ${String(rounded)} hour${rounded === 1 ? "" : "s"}`;
  }

  const days = Math.round(hours / 24);
  if (days === 1) return "Ends tomorrow";
  return `Ends in ${String(days)} days`;
}
