import type { TenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import { calculateLevelKey } from "./gamification-config.service";
import { gamificationRepository } from "./gamification.repository";
import type { GamificationLevelThreshold } from "./gamification.types";

/**
 * Applies an XP delta to the member profile and emits `gamification.level_up`
 * when the accrual crosses a level boundary. Ledger rows must already have been
 * written (idempotently) by the caller.
 */
export async function applyXpDelta(
  tx: TenantTx,
  ctx: { tenantId: string; requestId: string },
  args: {
    membershipId: string;
    points: number;
    levelThresholds: GamificationLevelThreshold[];
  },
): Promise<void> {
  if (args.points <= 0) {
    return;
  }

  const profile = await gamificationRepository.findProfileByMembership(tx, args.membershipId);
  const previousLevelKey = profile?.level_key ?? null;
  const xpTotal = (profile?.xp_total ?? 0) + args.points;
  const levelKey = calculateLevelKey(xpTotal, args.levelThresholds);

  await gamificationRepository.updateProfileXp(tx, {
    membershipId: args.membershipId,
    xpTotal,
    levelKey,
  });

  if (previousLevelKey !== null && previousLevelKey !== levelKey) {
    await outbox.publish(tx, {
      ctx: {
        tenantId: ctx.tenantId,
        actorMembershipId: args.membershipId,
        requestId: ctx.requestId,
      },
      eventType: "gamification.level_up",
      aggregateType: "gamification_profile",
      aggregateId: profile?.id ?? args.membershipId,
      payload: {
        membershipId: args.membershipId,
        previousLevelKey,
        levelKey,
        xpTotal,
      },
      idempotencyKey: `gamification.level_up:${args.membershipId}:${levelKey}`,
    });
  }
}
