// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { LeaderboardSnapshotPayload } from "./gamification.types";

export function sanitizeLeaderboardSnapshot(args: {
  rows: Array<{ membership_id: string; xp_total: number }>;
  callerMembershipId: string;
  calculatedAt: string;
}): LeaderboardSnapshotPayload {
  const entries = args.rows.map((row, index) => {
    const rank = index + 1;
    const isSelf = row.membership_id === args.callerMembershipId;
    return {
      rank,
      label: isSelf ? "You" : `Rank ${String(rank)}`,
      metricValue: row.xp_total,
      isSelf,
    };
  });

  const callerIndex = args.rows.findIndex((row) => row.membership_id === args.callerMembershipId);

  return {
    entries,
    callerRank: callerIndex >= 0 ? callerIndex + 1 : null,
    callerMetricValue: callerIndex >= 0 ? (args.rows[callerIndex]?.xp_total ?? null) : null,
    calculatedAt: args.calculatedAt,
  };
}
