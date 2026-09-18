// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import type { z } from "zod";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import { DEFAULT_PASS_MARK_PERCENT } from "./gamification-defaults";
import {
  addDaysToDateString,
  buildXpIdempotencyKey,
  calculateLevelKey,
  getTenantLocalDateString,
  resolveGamificationRules,
  resolvePeriodKey,
  resolveTenantTimezone,
  selectStreakRulesForEvent,
  selectXpRulesForEvent,
} from "./gamification-config.service";
import type { BadgeCriteria } from "./gamification.schemas";
import {
  badgeAlreadyAwarded,
  badgeNotFound,
  duplicateBadgeKey,
  duplicateLeaderboardKey,
  freezeNotAvailable,
  freezeNotEligible,
  invalidTargetMembership,
  leaderboardNotFound,
  streakNotFound,
} from "./gamification.errors";
import { gamificationRepository, toBadgeDto, toLeaderboardDto } from "./gamification.repository";
import type { LeaderboardConfig, LeaderboardSnapshotPayload } from "./gamification.types";
import { sanitizeLeaderboardSnapshot } from "./gamification-rules.helpers";
import type {
  createBadgeInputSchema,
  postBadgesBodySchema,
  postLeaderboardsBodySchema,
  updateBadgeBodySchema,
  updateLeaderboardBodySchema,
} from "./gamification.schemas";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function isAssessmentPassed(score: number, possiblePoints: number): boolean {
  if (possiblePoints <= 0) return false;
  return (score / possiblePoints) * 100 >= DEFAULT_PASS_MARK_PERCENT;
}

function formatDateOnly(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export async function ensureGamificationProfile(
  tx: TenantTx,
  ctx: { tenantId: string; membershipId: string },
) {
  const existing = await gamificationRepository.findProfileByMembership(tx, ctx.membershipId);
  if (existing) {
    return existing;
  }

  const created = await gamificationRepository.insertProfile(tx, ctx);
  if (!created) {
    return gamificationRepository.findProfileByMembership(tx, ctx.membershipId);
  }

  const rules = await resolveGamificationRules(tx);
  for (const streakRule of rules.streaks) {
    await gamificationRepository.seedFreezesIfMissing(tx, {
      tenantId: ctx.tenantId,
      membershipId: ctx.membershipId,
      streakKey: streakRule.streakKey,
      inventory: rules.defaultFreezeInventory,
    });
  }

  return created;
}

async function evaluateBadgeCriteria(
  tx: TenantTx,
  membershipId: string,
  criteria: BadgeCriteria,
): Promise<boolean> {
  if (criteria.type === "xp_total") {
    const profile = await gamificationRepository.findProfileByMembership(tx, membershipId);
    return (profile?.xp_total ?? 0) >= criteria.minXp;
  }

  if (criteria.type === "streak_current") {
    const streak = await gamificationRepository.findStreak(tx, {
      membershipId,
      streakKey: criteria.streakKey,
    });
    return (streak?.current_count ?? 0) >= criteria.minCount;
  }

  const count = await gamificationRepository.countLedgerByEventType(tx, {
    membershipId,
    eventType: criteria.eventType,
  });
  return count >= criteria.minCount;
}

async function awardBadgeIfEligible(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    membershipId: string;
    badgeId: string;
    sourceEventId?: string | null;
  },
): Promise<boolean> {
  const inserted = await gamificationRepository.insertBadgeAward(tx, {
    tenantId: ctx.tenantId,
    badgeId: args.badgeId,
    membershipId: args.membershipId,
    sourceEventId: args.sourceEventId ?? null,
  });

  if (!inserted) {
    return false;
  }

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "badge.awarded",
    aggregateType: "badge_award",
    aggregateId: args.badgeId,
    payload: {
      badgeId: args.badgeId,
      membershipId: args.membershipId,
    },
    idempotencyKey: `badge.awarded:${args.badgeId}:${args.membershipId}`,
  });

  return true;
}

async function updateStreakForActivity(
  tx: TenantTx,
  ctx: { tenantId: string; membershipId: string; requestId: string; actorMembershipId: string },
  args: { streakKey: string; activityDate: string },
): Promise<boolean> {
  const existing = await gamificationRepository.findStreak(tx, {
    membershipId: ctx.membershipId,
    streakKey: args.streakKey,
  });

  const lastDate = formatDateOnly(existing?.last_activity_date ?? null);

  if (lastDate === args.activityDate) {
    return false;
  }

  let currentCount = 1;
  if (lastDate) {
    const yesterday = addDaysToDateString(args.activityDate, -1);
    currentCount = lastDate === yesterday ? (existing?.current_count ?? 0) + 1 : 1;
  }

  const longestCount = Math.max(existing?.longest_count ?? 0, currentCount);

  await gamificationRepository.upsertStreak(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.membershipId,
    streakKey: args.streakKey,
    currentCount,
    longestCount,
    lastActivityDate: args.activityDate,
  });

  const streakState = await gamificationRepository.findStreak(tx, {
    membershipId: ctx.membershipId,
    streakKey: args.streakKey,
  });

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "streak.updated",
    aggregateType: "streak_state",
    aggregateId: streakState?.id ?? args.streakKey,
    payload: {
      streakKey: args.streakKey,
      membershipId: ctx.membershipId,
      currentCount,
      longestCount,
      lastActivityDate: args.activityDate,
    },
    idempotencyKey: `streak.updated:${args.streakKey}:${ctx.membershipId}:${args.activityDate}`,
  });

  return true;
}

function sanitizeLeaderboardSnapshotForRefresh(args: {
  rows: Array<{ membership_id: string; xp_total: number }>;
  callerMembershipId: string;
  calculatedAt: string;
}) {
  return sanitizeLeaderboardSnapshot(args);
}

export async function refreshActiveLeaderboardSnapshots(
  tx: TenantTx,
  ctx: ServiceCtx,
  callerMembershipIdForSanitization: string,
) {
  const timezone = await resolveTenantTimezone(tx);
  const leaderboards = await gamificationRepository.listLeaderboards(tx);

  for (const leaderboard of leaderboards) {
    if (leaderboard.status !== "ACTIVE") {
      continue;
    }

    const config = leaderboard.config_json as LeaderboardConfig;
    const periodKey = resolvePeriodKey(
      leaderboard.window_key as "all_time" | "weekly" | "monthly",
      timezone,
    );

    const rows = await gamificationRepository.listTopProfilesByXp(tx, {
      limit: config.maxEntries,
      ...(config.scopeType === "course" && config.courseId ? { courseId: config.courseId } : {}),
    });

    const calculatedAt = new Date().toISOString();
    const snapshot = sanitizeLeaderboardSnapshotForRefresh({
      rows,
      callerMembershipId: callerMembershipIdForSanitization,
      calculatedAt,
    });

    await gamificationRepository.upsertLeaderboardSnapshot(tx, {
      tenantId: ctx.tenantId,
      leaderboardId: leaderboard.id,
      periodKey,
      snapshotJson: snapshot,
    });
  }
}

export async function processGamificationSourceEvent(
  tx: TenantTx,
  ctx: ServiceCtx,
  event: { id: string; eventType: string; payload: unknown },
) {
  const rules = await resolveGamificationRules(tx);
  const timezone = await resolveTenantTimezone(tx);
  const activityDate = getTenantLocalDateString(timezone);

  let membershipId: string;
  let passed: boolean | undefined;

  if (event.eventType === "lesson.completed") {
    membershipId = (event.payload as { membershipId: string }).membershipId;
  } else if (event.eventType === "path.step_completed") {
    membershipId = (event.payload as { membershipId: string }).membershipId;
  } else if (event.eventType === "assessment.submitted") {
    membershipId = (event.payload as { membershipId: string }).membershipId;
  } else if (event.eventType === "assessment.graded") {
    const payload = event.payload as {
      learnerMembershipId: string;
      score: number;
      possiblePoints: number;
    };
    membershipId = payload.learnerMembershipId;
    passed = isAssessmentPassed(payload.score, payload.possiblePoints);
  } else if (event.eventType === "practice.session_completed") {
    membershipId = (event.payload as { membershipId: string }).membershipId;
  } else {
    return;
  }

  await ensureGamificationProfile(tx, { tenantId: ctx.tenantId, membershipId });

  const xpRules = selectXpRulesForEvent(
    rules,
    event.eventType,
    passed === undefined ? undefined : { passed },
  );
  let pointsAwarded = 0;

  for (const rule of xpRules) {
    const inserted = await gamificationRepository.insertPointLedger(tx, {
      tenantId: ctx.tenantId,
      membershipId,
      points: rule.points,
      reasonKey: rule.key,
      sourceEventId: event.id,
      idempotencyKey: buildXpIdempotencyKey(event.id, rule.key),
    });

    if (inserted) {
      pointsAwarded += rule.points;
    }
  }

  if (pointsAwarded > 0) {
    const profile = await gamificationRepository.findProfileByMembership(tx, membershipId);
    const xpTotal = (profile?.xp_total ?? 0) + pointsAwarded;
    const levelKey = calculateLevelKey(xpTotal, rules.levelThresholds);

    await gamificationRepository.updateProfileXp(tx, {
      membershipId,
      xpTotal,
      levelKey,
    });
  }

  for (const streakRule of selectStreakRulesForEvent(rules, event.eventType)) {
    await updateStreakForActivity(
      tx,
      {
        tenantId: ctx.tenantId,
        membershipId,
        requestId: ctx.requestId,
        actorMembershipId: membershipId,
      },
      { streakKey: streakRule.streakKey, activityDate },
    );
  }

  const badges = await gamificationRepository.listBadges(tx);
  for (const badge of badges) {
    if (badge.status !== "ACTIVE") continue;

    const criteria = badge.criteria_json as BadgeCriteria;
    const eligible = await evaluateBadgeCriteria(tx, membershipId, criteria);
    if (!eligible) continue;

    await awardBadgeIfEligible(tx, ctx, {
      membershipId,
      badgeId: badge.id,
      sourceEventId: event.id,
    });
  }

  await refreshActiveLeaderboardSnapshots(tx, ctx, membershipId);
}

export async function getMyGamificationProfile(tx: TenantTx, ctx: ServiceCtx) {
  await ensureGamificationProfile(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
  });

  const profile = await gamificationRepository.findProfileByMembership(tx, ctx.actorMembershipId);
  const badgeCount = await gamificationRepository.countBadgeAwardsForMembership(
    tx,
    ctx.actorMembershipId,
  );

  return {
    data: {
      membershipId: ctx.actorMembershipId,
      xpTotal: profile?.xp_total ?? 0,
      levelKey: profile?.level_key ?? null,
      badgeCount,
    },
  };
}

export async function listMyStreaks(tx: TenantTx, ctx: ServiceCtx) {
  await ensureGamificationProfile(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
  });

  const rules = await resolveGamificationRules(tx);
  const streaks = await gamificationRepository.listStreaks(tx, ctx.actorMembershipId);
  const streakKeys = new Set(streaks.map((row) => row.streak_key));

  for (const rule of rules.streaks) {
    if (!streakKeys.has(rule.streakKey)) {
      streaks.push({
        id: rule.streakKey,
        streak_key: rule.streakKey,
        current_count: 0,
        longest_count: 0,
        last_activity_date: null,
      });
    }
  }

  const items = [];
  for (const streak of streaks) {
    const availableFreezes = await gamificationRepository.countAvailableFreezes(tx, {
      membershipId: ctx.actorMembershipId,
      streakKey: streak.streak_key,
    });

    items.push({
      streakKey: streak.streak_key,
      currentCount: streak.current_count,
      longestCount: streak.longest_count,
      lastActivityDate: formatDateOnly(streak.last_activity_date),
      availableFreezes,
    });
  }

  return { data: { items } };
}

export async function freezeStreak(tx: TenantTx, ctx: ServiceCtx, streakKey: string) {
  const rules = await resolveGamificationRules(tx);
  const configured = rules.streaks.some((rule) => rule.streakKey === streakKey);
  if (!configured) {
    throw streakNotFound();
  }

  const timezone = await resolveTenantTimezone(tx);
  const today = getTenantLocalDateString(timezone);
  const missedDate = addDaysToDateString(today, -1);

  const existingFreeze = await gamificationRepository.findFreezeUsedForDate(tx, {
    membershipId: ctx.actorMembershipId,
    streakKey,
    usedForDate: missedDate,
  });

  const streak = await gamificationRepository.findStreak(tx, {
    membershipId: ctx.actorMembershipId,
    streakKey,
  });

  if (!streak) {
    throw freezeNotEligible();
  }

  const lastDate = formatDateOnly(streak.last_activity_date);
  if (lastDate === today || lastDate === missedDate) {
    throw freezeNotEligible();
  }

  const dayBeforeMissed = addDaysToDateString(missedDate, -1);
  if (lastDate !== dayBeforeMissed) {
    throw freezeNotEligible();
  }

  if (existingFreeze) {
    const availableFreezes = await gamificationRepository.countAvailableFreezes(tx, {
      membershipId: ctx.actorMembershipId,
      streakKey,
    });

    return {
      data: {
        streakKey,
        currentCount: streak.current_count,
        longestCount: streak.longest_count,
        lastActivityDate: lastDate,
        availableFreezes,
      },
    };
  }

  const consumed = await gamificationRepository.consumeAvailableFreeze(tx, {
    membershipId: ctx.actorMembershipId,
    streakKey,
    usedForDate: missedDate,
  });

  if (!consumed) {
    throw freezeNotAvailable();
  }

  await gamificationRepository.upsertStreak(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    streakKey,
    currentCount: streak.current_count,
    longestCount: streak.longest_count,
    lastActivityDate: missedDate,
  });

  const updatedStreak = await gamificationRepository.findStreak(tx, {
    membershipId: ctx.actorMembershipId,
    streakKey,
  });

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "streak.updated",
    aggregateType: "streak_state",
    aggregateId: updatedStreak?.id ?? streak.id,
    payload: {
      streakKey,
      membershipId: ctx.actorMembershipId,
      currentCount: streak.current_count,
      longestCount: streak.longest_count,
      lastActivityDate: missedDate,
    },
    idempotencyKey: `streak.updated:freeze:${streakKey}:${ctx.actorMembershipId}:${missedDate}`,
  });

  const availableFreezes = await gamificationRepository.countAvailableFreezes(tx, {
    membershipId: ctx.actorMembershipId,
    streakKey,
  });

  return {
    data: {
      streakKey,
      currentCount: streak.current_count,
      longestCount: streak.longest_count,
      lastActivityDate: missedDate,
      availableFreezes,
    },
  };
}

export async function listBadges(tx: TenantTx, ctx: ServiceCtx) {
  const badges = await gamificationRepository.listBadges(tx);
  const awards = await gamificationRepository.listBadgeAwardsForMembership(
    tx,
    ctx.actorMembershipId,
  );
  const awardByBadgeId = new Map(awards.map((award) => [award.badge_id, award]));

  return {
    data: {
      items: badges.map((badge) => toBadgeDto(badge, awardByBadgeId.get(badge.id) ?? null)),
    },
  };
}

export async function createBadgeFromPost(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof createBadgeInputSchema>,
) {
  const existing = await gamificationRepository.findBadgeByKey(tx, input.key);
  if (existing) {
    throw duplicateBadgeKey();
  }

  const created = await gamificationRepository.insertBadge(tx, {
    tenantId: ctx.tenantId,
    key: input.key,
    name: input.name,
    iconKey: input.iconKey ?? null,
    criteria: input.criteria,
    status: input.status,
  });

  if (!created) {
    throw badgeNotFound();
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "badge.created",
      target: { type: "badge", id: created.id },
      before: null,
      after: toBadgeDto(created),
      reason: null,
      metadata: {},
    },
  );

  return { data: toBadgeDto(created) };
}

export async function manualAwardBadge(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: { badgeId: string; membershipId: string; reason: string },
) {
  const active = await gamificationRepository.membershipIsActive(tx, input.membershipId);
  if (!active) {
    throw invalidTargetMembership();
  }

  const badge = await gamificationRepository.findBadgeById(tx, input.badgeId);
  if (!badge) {
    throw badgeNotFound();
  }

  const inserted = await gamificationRepository.insertBadgeAward(tx, {
    tenantId: ctx.tenantId,
    badgeId: input.badgeId,
    membershipId: input.membershipId,
  });

  if (!inserted) {
    throw badgeAlreadyAwarded();
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "badge.manual_awarded",
      target: { type: "badge_award", id: input.badgeId },
      before: null,
      after: {
        badgeId: input.badgeId,
        membershipId: input.membershipId,
      },
      reason: input.reason,
      metadata: {},
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "badge.awarded",
    aggregateType: "badge_award",
    aggregateId: input.badgeId,
    payload: {
      badgeId: input.badgeId,
      membershipId: input.membershipId,
    },
    idempotencyKey: `badge.awarded:${input.badgeId}:${input.membershipId}`,
  });

  return {
    data: toBadgeDto(badge, {
      badge_id: input.badgeId,
      membership_id: input.membershipId,
      awarded_at: new Date(),
    }),
  };
}

export async function mutateBadges(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof postBadgesBodySchema>,
) {
  if (input.operation === "create") {
    return createBadgeFromPost(tx, ctx, input.badge);
  }

  return manualAwardBadge(tx, ctx, {
    badgeId: input.badgeId,
    membershipId: input.membershipId,
    reason: input.reason,
  });
}

export async function updateBadge(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof updateBadgeBodySchema>,
) {
  const before = await gamificationRepository.findBadgeById(tx, input.id);
  if (!before) {
    throw badgeNotFound();
  }

  const updated = await gamificationRepository.updateBadge(tx, {
    id: input.id,
    ...(input.name != null ? { name: input.name } : {}),
    ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
    ...(input.criteria != null ? { criteria: input.criteria } : {}),
    ...(input.status != null ? { status: input.status } : {}),
  });

  if (!updated) {
    throw badgeNotFound();
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "badge.updated",
      target: { type: "badge", id: input.id },
      before: toBadgeDto(before),
      after: toBadgeDto(updated),
      reason: null,
      metadata: {},
    },
  );

  return { data: toBadgeDto(updated) };
}

export async function listLeaderboards(tx: TenantTx) {
  const rows = await gamificationRepository.listLeaderboards(tx);
  return {
    data: {
      items: rows.map((row) => toLeaderboardDto(row)),
    },
  };
}

export async function createLeaderboard(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof postLeaderboardsBodySchema>,
) {
  const existing = await gamificationRepository.findLeaderboardByKey(tx, input.leaderboard.key);
  if (existing) {
    throw duplicateLeaderboardKey();
  }

  const created = await gamificationRepository.insertLeaderboard(tx, {
    tenantId: ctx.tenantId,
    key: input.leaderboard.key,
    name: input.leaderboard.name,
    metricKey: input.leaderboard.metricKey,
    windowKey: input.leaderboard.windowKey,
    config: input.leaderboard.config as LeaderboardConfig,
    status: input.leaderboard.status,
  });

  if (!created) {
    throw leaderboardNotFound();
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "leaderboard.created",
      target: { type: "leaderboard_definition", id: created.id },
      before: null,
      after: toLeaderboardDto(created),
      reason: null,
      metadata: {},
    },
  );

  await refreshActiveLeaderboardSnapshots(tx, ctx, ctx.actorMembershipId);

  return { data: toLeaderboardDto(created) };
}

export async function updateLeaderboard(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof updateLeaderboardBodySchema>,
) {
  const before = await gamificationRepository.findLeaderboardById(tx, input.id);
  if (!before) {
    throw leaderboardNotFound();
  }

  const updated = await gamificationRepository.updateLeaderboard(tx, {
    id: input.id,
    ...(input.name != null ? { name: input.name } : {}),
    ...(input.windowKey != null ? { windowKey: input.windowKey } : {}),
    ...(input.config != null ? { config: input.config as LeaderboardConfig } : {}),
    ...(input.status != null ? { status: input.status } : {}),
  });

  if (!updated) {
    throw leaderboardNotFound();
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "leaderboard.updated",
      target: { type: "leaderboard_definition", id: input.id },
      before: toLeaderboardDto(before),
      after: toLeaderboardDto(updated),
      reason: null,
      metadata: {},
    },
  );

  await refreshActiveLeaderboardSnapshots(tx, ctx, ctx.actorMembershipId);

  return { data: toLeaderboardDto(updated) };
}

export async function getLeaderboardDetail(tx: TenantTx, ctx: ServiceCtx, leaderboardId: string) {
  const leaderboard = await gamificationRepository.findLeaderboardById(tx, leaderboardId);
  if (!leaderboard) {
    throw leaderboardNotFound();
  }

  const timezone = await resolveTenantTimezone(tx);
  const periodKey = resolvePeriodKey(
    leaderboard.window_key as "all_time" | "weekly" | "monthly",
    timezone,
  );

  let snapshot = await gamificationRepository.findLeaderboardSnapshot(tx, {
    leaderboardId,
    periodKey,
  });

  if (!snapshot) {
    await refreshActiveLeaderboardSnapshots(tx, ctx, ctx.actorMembershipId);
    snapshot = await gamificationRepository.findLeaderboardSnapshot(tx, {
      leaderboardId,
      periodKey,
    });
  }

  const payload = (snapshot?.snapshot_json ?? {
    entries: [],
    callerRank: null,
    callerMetricValue: null,
    calculatedAt: new Date().toISOString(),
  }) as LeaderboardSnapshotPayload;

  const entries = payload.entries.map((entry) =>
    entry.isSelf
      ? { ...entry, label: "You" }
      : { ...entry, label: `Rank ${String(entry.rank)}`, isSelf: false },
  );

  return {
    data: {
      leaderboard: toLeaderboardDto(leaderboard),
      periodKey,
      calculatedAt: snapshot?.calculated_at.toISOString() ?? payload.calculatedAt,
      entries,
      callerRank: payload.callerRank,
      callerMetricValue: payload.callerMetricValue,
    },
  };
}
