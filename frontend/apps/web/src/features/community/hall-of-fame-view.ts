/**
 * Presentation helpers for the learner Hall of Fame.
 *
 * Leaderboard standings are privacy-anonymized server-side (entries read as
 * "You" or "Rank N" with an XP metric), so nothing here invents names, photos,
 * or metrics. All colour comes from design tokens via `leagueMeta` so light and
 * dark mode swap automatically.
 */

import type { z } from "zod";
import type {
  leaderboardDefinitionDtoSchema,
  leaderboardDetailResponseSchema,
} from "@atlas/contracts/gamification/gamification.schemas";
import type { LeagueTier } from "../gamification/gamification-view";

export type HallOfFameBoard = z.infer<typeof leaderboardDefinitionDtoSchema>;
export type HallOfFameLeaderboardDetail = z.infer<typeof leaderboardDetailResponseSchema>["data"];
export type HallOfFameEntry = HallOfFameLeaderboardDetail["entries"][number];

/** Maps a podium position to its metallic league tier (1 gold, 2 silver, 3 bronze). */
export function podiumTier(rank: number): LeagueTier {
  if (rank <= 1) return "gold";
  if (rank === 2) return "silver";
  return "bronze";
}

/** Human label for a leaderboard window. */
export function windowLabel(windowKey: HallOfFameBoard["windowKey"]): string {
  switch (windowKey) {
    case "all_time":
      return "All-time";
    case "weekly":
      return "This week";
    case "monthly":
      return "This month";
  }
}

/** Admin-set board name, falling back to its window label when unnamed. */
export function boardLabel(board: HallOfFameBoard): string {
  const name = board.name.trim();
  return name.length > 0 ? name : windowLabel(board.windowKey);
}

/** Display name for a standing: "You" for the caller, otherwise the anonymized label. */
export function entryDisplayName(entry: HallOfFameEntry): string {
  return entry.isSelf ? "You" : entry.label;
}

/** Short "as of" caption for a snapshot timestamp, e.g. "Nov 12". */
export function formatSnapshotDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Flattens a structured post body into a plain-text excerpt for story cards. */
export function storyExcerpt(text: string, max = 180): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trimEnd()}...`;
}
