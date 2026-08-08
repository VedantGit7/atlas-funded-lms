import type { TenantTx } from "@atlas/db";
import type { z } from "zod";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import { DEFAULT_PASS_MARK_PERCENT } from "./gamification-defaults";
import {
  activityDateForPeriod,
  addDaysToDateString,
  buildXpIdempotencyKey,
  getPreviousActivityPeriod,
  getTenantLocalDateString,
  mergeCourseXpRules,
  mergeGamificationRules,
  readTenantGamificationPartial,
  resolveActivityPeriod,
  resolveGamificationRules,
  resolvePeriodKey,
  resolvePeriodRange,
  resolveTenantTimezone,
  selectStreakRulesForEvent,
  selectXpRulesForEvent,
} from "./gamification-config.service";
import { readCourseGamificationOverrides } from "./gamification-course-overrides";
import type { BadgeCriteria } from "./gamification.schemas";
import {
  badgeAlreadyAwarded,
  badgeAwardNotFound,
  badgeNotAwarded,
  badgeNotFound,
  duplicateBadgeKey,
  duplicateLeaderboardKey,
  freezeNotAvailable,
  freezeNotEligible,
  hallOfFameConfigInvalid,
  invalidTargetMembership,
  leaderboardNotFound,
  streakNotFound,
} from "./gamification.errors";
import { applyXpDelta } from "./gamification-xp.service";
import { creditCurrenciesForXp, getRewardsAdmin } from "./rewards.service";
import { evaluateQuestsForEvent, listQuestsForAdmin, previewQuestsForEvent } from "./quest.service";
import { listSeasonalEvents, resolveSeasonalMultiplier } from "./seasonal.service";
import { gamificationRepository, toBadgeDto, toLeaderboardDto } from "./gamification.repository";
import type { GamificationStreakRule, LeaderboardConfig, LeaderboardSnapshotPayload } from "./gamification.types";
import { sanitizeLeaderboardSnapshot } from "./gamification-rules.helpers";
import type {
  badgeAwardsQuerySchema,
  createBadgeInputSchema,
  myLedgerQuerySchema,
  postBadgesBodySchema,
  postLeaderboardsBodySchema,
  simulateBodySchema,
  updateBadgeBodySchema,
  updateGamificationRulesBodySchema,
  updateHallOfFameConfigBodySchema,
  updateLeaderboardBodySchema,
} from "./gamification.schemas";
import { communityRepository } from "../community/community.repository";

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

type PrimitiveBadgeCriteria = Extract<
  BadgeCriteria,
  { type: "xp_total" } | { type: "streak_current" } | { type: "event_count" }
>;

export type BadgeCriterionProgress = {
  criteria: PrimitiveBadgeCriteria;
  progress: number;
  target: number;
};

async function measurePrimitiveCriterion(
  tx: TenantTx,
  membershipId: string,
  criteria: PrimitiveBadgeCriteria,
): Promise<BadgeCriterionProgress> {
  if (criteria.type === "xp_total") {
    const profile = await gamificationRepository.findProfileByMembership(tx, membershipId);
    return {
      criteria,
      progress: Math.min(profile?.xp_total ?? 0, criteria.minXp),
      target: criteria.minXp,
    };
  }

  if (criteria.type === "streak_current") {
    const streak = await gamificationRepository.findStreak(tx, {
      membershipId,
      streakKey: criteria.streakKey,
    });
    return {
      criteria,
      progress: Math.min(streak?.current_count ?? 0, criteria.minCount),
      target: criteria.minCount,
    };
  }

  const count = await gamificationRepository.countLedgerByEventType(tx, {
    membershipId,
    eventType: criteria.eventType,
  });
  return { criteria, progress: Math.min(count, criteria.minCount), target: criteria.minCount };
}

export async function measureBadgeCriteria(
  tx: TenantTx,
  membershipId: string,
  criteria: BadgeCriteria,
): Promise<BadgeCriterionProgress[]> {
  if (criteria.type === "compound") {
    const results: BadgeCriterionProgress[] = [];
    for (const child of criteria.criteria) {
      results.push(await measurePrimitiveCriterion(tx, membershipId, child));
    }
    return results;
  }

  return [await measurePrimitiveCriterion(tx, membershipId, criteria)];
}

async function evaluateBadgeCriteria(
  tx: TenantTx,
  membershipId: string,
  criteria: BadgeCriteria,
): Promise<boolean> {
  const measured = await measureBadgeCriteria(tx, membershipId, criteria);

  if (criteria.type === "compound" && criteria.operator === "any") {
    return measured.some((entry) => entry.progress >= entry.target);
  }

  return measured.every((entry) => entry.progress >= entry.target);
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
  args: {
    streakKey: string;
    streakRule: GamificationStreakRule;
    timezone: string;
    activityDate: string;
  },
): Promise<{ changed: boolean; currentCount: number }> {
  const cadence = args.streakRule.cadence ?? "daily";
  const activityPeriod = resolveActivityPeriod(cadence, args.timezone);
  const storedActivityDate = activityDateForPeriod(cadence, args.timezone);

  const existing = await gamificationRepository.findStreak(tx, {
    membershipId: ctx.membershipId,
    streakKey: args.streakKey,
  });

  const lastDate = formatDateOnly(existing?.last_activity_date ?? null);
  const lastPeriod = lastDate
    ? cadence === "weekly"
      ? resolveActivityPeriod("weekly", args.timezone, new Date(`${lastDate}T12:00:00.000Z`))
      : lastDate
    : null;

  if (lastPeriod === activityPeriod) {
    return { changed: false, currentCount: existing?.current_count ?? 0 };
  }

  let currentCount = 1;
  if (lastPeriod) {
    const previousPeriod = getPreviousActivityPeriod(cadence, args.timezone, activityPeriod);
    currentCount = lastPeriod === previousPeriod ? (existing?.current_count ?? 0) + 1 : 1;
  }

  const longestCount = Math.max(existing?.longest_count ?? 0, currentCount);

  await gamificationRepository.upsertStreak(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.membershipId,
    streakKey: args.streakKey,
    currentCount,
    longestCount,
    lastActivityDate: storedActivityDate,
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
      lastActivityDate: storedActivityDate,
    },
    idempotencyKey: `streak.updated:${args.streakKey}:${ctx.membershipId}:${activityPeriod}`,
  });

  return { changed: true, currentCount };
}

async function updateGroupStreakForActivity(
  tx: TenantTx,
  ctx: { tenantId: string; requestId: string; actorMembershipId: string },
  args: {
    spaceId: string;
    streakKey: string;
    cadence: "daily" | "weekly";
    timezone: string;
  },
): Promise<void> {
  const activityPeriod = resolveActivityPeriod(args.cadence, args.timezone);

  const existing = await gamificationRepository.findGroupStreak(tx, {
    spaceId: args.spaceId,
    streakKey: args.streakKey,
  });

  if (existing?.last_activity_period === activityPeriod) {
    return;
  }

  let currentCount = 1;
  if (existing?.last_activity_period) {
    const previousPeriod = getPreviousActivityPeriod(
      args.cadence,
      args.timezone,
      activityPeriod,
    );
    currentCount =
      existing.last_activity_period === previousPeriod ? existing.current_count + 1 : 1;
  }

  const longestCount = Math.max(existing?.longest_count ?? 0, currentCount);

  await gamificationRepository.upsertGroupStreak(tx, {
    tenantId: ctx.tenantId,
    spaceId: args.spaceId,
    streakKey: args.streakKey,
    currentCount,
    longestCount,
    lastActivityPeriod: activityPeriod,
  });
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
    const windowKey = leaderboard.window_key as "all_time" | "weekly" | "monthly";
    const periodKey = resolvePeriodKey(windowKey, timezone);
    const periodRange = resolvePeriodRange(windowKey, timezone);
    const courseScope =
      config.scopeType === "course" && config.courseId ? { courseId: config.courseId } : {};
    const groupScope =
      config.scopeType === "group" && config.spaceId ? { spaceId: config.spaceId } : {};

    // All-time boards rank by accumulated profile XP; weekly/monthly boards rank by
    // points earned inside the current period (tenant-local calendar).
    const rows = periodRange
      ? groupScope.spaceId
        ? await gamificationRepository.listTopMembershipsByLedgerPointsForGroup(tx, {
            limit: config.maxEntries,
            timezone,
            startDate: periodRange.startDate,
            endDate: periodRange.endDate,
            spaceId: groupScope.spaceId,
          })
        : await gamificationRepository.listTopMembershipsByLedgerPoints(tx, {
            limit: config.maxEntries,
            timezone,
            startDate: periodRange.startDate,
            endDate: periodRange.endDate,
            ...courseScope,
          })
      : groupScope.spaceId
        ? await gamificationRepository.listTopProfilesByXpForGroup(tx, {
            limit: config.maxEntries,
            spaceId: groupScope.spaceId,
          })
        : await gamificationRepository.listTopProfilesByXp(tx, {
            limit: config.maxEntries,
            ...courseScope,
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
  let rules = await resolveGamificationRules(tx);
  const timezone = await resolveTenantTimezone(tx);
  const activityDate = getTenantLocalDateString(timezone);

  let membershipId: string;
  let passed: boolean | undefined;
  let courseId: string | undefined;

  if (event.eventType === "lesson.completed") {
    const payload = event.payload as { membershipId: string; courseId: string };
    membershipId = payload.membershipId;
    courseId = payload.courseId;
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
  } else if (event.eventType === "diagnostic.completed") {
    membershipId = (event.payload as { membershipId: string }).membershipId;
  } else {
    return;
  }

  if (courseId) {
    const courseOverrides = await readCourseGamificationOverrides(tx, courseId);
    if (courseOverrides.xpRules?.length) {
      rules = {
        ...rules,
        xpRules: mergeCourseXpRules(rules.xpRules, courseOverrides.xpRules),
      };
    }
  }

  await ensureGamificationProfile(tx, { tenantId: ctx.tenantId, membershipId });

  // Seasonal events boost XP at write time; idempotency keys are unchanged, so
  // replays cannot double-apply the multiplier.
  const seasonal = await resolveSeasonalMultiplier(tx);

  const xpRules = selectXpRulesForEvent(
    rules,
    event.eventType,
    passed === undefined ? undefined : { passed },
  );
  let pointsAwarded = 0;

  for (const rule of xpRules) {
    const points = Math.round(rule.points * seasonal.xpMultiplier);
    const inserted = await gamificationRepository.insertPointLedger(tx, {
      tenantId: ctx.tenantId,
      membershipId,
      points,
      reasonKey: rule.key,
      sourceEventId: event.id,
      idempotencyKey: buildXpIdempotencyKey(event.id, rule.key),
      eventType: event.eventType,
    });

    if (inserted) {
      pointsAwarded += points;
    }
  }

  for (const streakRule of selectStreakRulesForEvent(rules, event.eventType)) {
    const streakResult = await updateStreakForActivity(
      tx,
      {
        tenantId: ctx.tenantId,
        membershipId,
        requestId: ctx.requestId,
        actorMembershipId: membershipId,
      },
      { streakKey: streakRule.streakKey, streakRule, timezone, activityDate },
    );

    if (!streakResult.changed) continue;

    // Milestone bonuses: award extra XP the day a streak reaches a configured length.
    for (const bonus of rules.streakBonuses) {
      if (bonus.days !== streakResult.currentCount) continue;

      const bonusXp = seasonal.applyToStreakBonuses
        ? Math.round(bonus.bonusXp * seasonal.xpMultiplier)
        : bonus.bonusXp;
      const inserted = await gamificationRepository.insertPointLedger(tx, {
        tenantId: ctx.tenantId,
        membershipId,
        points: bonusXp,
        reasonKey: `streak_bonus.${streakRule.streakKey}.${String(bonus.days)}d`,
        sourceEventId: event.id,
        idempotencyKey: `streak-bonus:${streakRule.streakKey}:${String(bonus.days)}:${membershipId}:${activityDate}`,
        eventType: "streak.bonus",
      });

      if (inserted) {
        pointsAwarded += bonusXp;
      }
    }

    if (streakRule.groupScoped) {
      const spaceIds = await gamificationRepository.listSpacesForMembership(tx, membershipId);
      for (const spaceId of spaceIds) {
        await updateGroupStreakForActivity(
          tx,
          {
            tenantId: ctx.tenantId,
            requestId: ctx.requestId,
            actorMembershipId: membershipId,
          },
          {
            spaceId,
            streakKey: streakRule.streakKey,
            cadence: streakRule.cadence ?? "daily",
            timezone,
          },
        );
      }
    }
  }

  await applyXpDelta(tx, ctx, {
    membershipId,
    points: pointsAwarded,
    levelThresholds: rules.levelThresholds,
  });

  // Virtual currency accrual mirrors XP: only ledger-backed points are counted,
  // so event replays credit nothing.
  await creditCurrenciesForXp(tx, ctx, { membershipId, points: pointsAwarded });

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

  await evaluateQuestsForEvent(
    tx,
    { ...ctx, actorMembershipId: membershipId },
    { membershipId, event, pointsAwarded },
  );

  await refreshActiveLeaderboardSnapshots(tx, ctx, membershipId);
}

export async function getGamificationRules(tx: TenantTx) {
  const rules = await resolveGamificationRules(tx);
  return { data: rules };
}

export async function updateGamificationRules(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof updateGamificationRulesBodySchema>,
) {
  const currentPartial = await readTenantGamificationPartial(tx);
  const before = mergeGamificationRules(currentPartial);

  const nextPartial = {
    ...currentPartial,
    ...(input.xpRules !== undefined ? { xpRules: input.xpRules } : {}),
    ...(input.levelThresholds !== undefined
      ? {
          levelThresholds: [...input.levelThresholds].sort((a, b) => a.minXp - b.minXp),
        }
      : {}),
    ...(input.streaks !== undefined ? { streaks: input.streaks } : {}),
    ...(input.defaultFreezeInventory !== undefined
      ? { defaultFreezeInventory: input.defaultFreezeInventory }
      : {}),
    ...(input.leaderboardsPublic !== undefined
      ? { leaderboardsPublic: input.leaderboardsPublic }
      : {}),
    ...(input.streakBonuses !== undefined
      ? { streakBonuses: [...input.streakBonuses].sort((a, b) => a.days - b.days) }
      : {}),
  };

  await gamificationRepository.upsertTenantGamificationConfig(tx, nextPartial);
  const after = mergeGamificationRules(nextPartial);

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "gamification.rules_updated",
      target: { type: "tenant_config", id: ctx.tenantId },
      before,
      after,
      reason: null,
      metadata: {},
    },
  );

  return { data: after };
}

const GAMIFICATION_EVENT_LABELS: Record<string, string> = {
  "lesson.completed": "Lesson completed",
  "path.step_completed": "Learning path step completed",
  "assessment.submitted": "Assessment submitted",
  "assessment.graded": "Assessment graded",
  "practice.session_completed": "Practice session completed",
  "diagnostic.completed": "Diagnostic completed",
};

const PLANNED_GAMIFICATION_EVENTS: Array<{ eventType: string; label: string }> = [
  { eventType: "certificate.issued", label: "Certificate issued" },
];

export function listGamificationEvents() {
  return {
    data: {
      items: [
        ...Object.entries(GAMIFICATION_EVENT_LABELS).map(([eventType, label]) => ({
          eventType,
          label,
          status: "active" as const,
        })),
        ...PLANNED_GAMIFICATION_EVENTS.map((entry) => ({
          ...entry,
          status: "planned" as const,
        })),
      ],
    },
  };
}

function encodeLedgerCursor(row: { occurred_at: Date; id: string }): string {
  return `${row.occurred_at.toISOString()}|${row.id}`;
}

function decodeLedgerCursor(cursor: string): { occurredAt: string; id: string } | null {
  const [occurredAt, id] = cursor.split("|");
  if (!occurredAt || !id) return null;
  return { occurredAt, id };
}

export async function listMyGamificationLedger(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof myLedgerQuerySchema>,
) {
  const cursor = input.cursor ? decodeLedgerCursor(input.cursor) : null;
  const rows = await gamificationRepository.listLedgerForMembership(tx, {
    membershipId: ctx.actorMembershipId,
    limit: input.limit,
    ...(cursor ? { cursor } : {}),
  });

  const hasNextPage = rows.length > input.limit;
  const pageRows = hasNextPage ? rows.slice(0, input.limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return {
    data: {
      items: pageRows.map((row) => ({
        points: row.points,
        reasonKey: row.reason_key,
        eventType: row.event_type,
        occurredAt: row.occurred_at.toISOString(),
      })),
      nextCursor: hasNextPage && lastRow ? encodeLedgerCursor(lastRow) : null,
    },
  };
}

/**
 * Dry-run: "if member X completes event Y, what happens?" — reads only,
 * writes nothing. Graded assessments are assumed passed.
 */
export async function simulateGamificationEvent(
  tx: TenantTx,
  input: z.output<typeof simulateBodySchema>,
) {
  const active = await gamificationRepository.membershipIsActive(tx, input.membershipId);
  if (!active) {
    throw invalidTargetMembership();
  }

  const rules = await resolveGamificationRules(tx);
  const timezone = await resolveTenantTimezone(tx);
  const seasonal = await resolveSeasonalMultiplier(tx);

  const xpRules = selectXpRulesForEvent(rules, input.eventType, { passed: true });
  const xpEntries = xpRules.map((rule) => ({
    ruleKey: rule.key,
    points: Math.round(rule.points * seasonal.xpMultiplier),
  }));
  let xpTotal = xpEntries.reduce((sum, entry) => sum + entry.points, 0);

  const streaks = [];
  const projectedStreakCounts = new Map<string, number>();
  for (const streakRule of selectStreakRulesForEvent(rules, input.eventType)) {
    const cadence = streakRule.cadence ?? "daily";
    const activityPeriod = resolveActivityPeriod(cadence, timezone);
    const streak = await gamificationRepository.findStreak(tx, {
      membershipId: input.membershipId,
      streakKey: streakRule.streakKey,
    });
    const lastDate = formatDateOnly(streak?.last_activity_date ?? null);
    const lastPeriod = lastDate
      ? cadence === "weekly"
        ? resolveActivityPeriod("weekly", timezone, new Date(`${lastDate}T12:00:00.000Z`))
        : lastDate
      : null;
    const wouldAdvance = lastPeriod !== activityPeriod;
    const previousPeriod = getPreviousActivityPeriod(cadence, timezone, activityPeriod);
    const projectedCount = wouldAdvance
      ? lastPeriod === previousPeriod
        ? (streak?.current_count ?? 0) + 1
        : 1
      : (streak?.current_count ?? 0);

    let bonusXp = 0;
    if (wouldAdvance) {
      for (const bonus of rules.streakBonuses) {
        if (bonus.days === projectedCount) {
          bonusXp += seasonal.applyToStreakBonuses
            ? Math.round(bonus.bonusXp * seasonal.xpMultiplier)
            : bonus.bonusXp;
        }
      }
    }

    xpTotal += bonusXp;
    projectedStreakCounts.set(streakRule.streakKey, projectedCount);
    streaks.push({ streakKey: streakRule.streakKey, wouldAdvance, projectedCount, bonusXp });
  }

  // Badges that would newly unlock, evaluated against projected values.
  const profile = await gamificationRepository.findProfileByMembership(tx, input.membershipId);
  const projectedXpTotal = (profile?.xp_total ?? 0) + xpTotal;
  const awards = await gamificationRepository.listBadgeAwardsForMembership(tx, input.membershipId);
  const awardedBadgeIds = new Set(awards.map((award) => award.badge_id));

  async function projectPrimitive(criteria: PrimitiveBadgeCriteria): Promise<boolean> {
    if (criteria.type === "xp_total") {
      return projectedXpTotal >= criteria.minXp;
    }
    if (criteria.type === "streak_current") {
      const projected = projectedStreakCounts.get(criteria.streakKey);
      if (projected != null) return projected >= criteria.minCount;
      const streak = await gamificationRepository.findStreak(tx, {
        membershipId: input.membershipId,
        streakKey: criteria.streakKey,
      });
      return (streak?.current_count ?? 0) >= criteria.minCount;
    }
    const count = await gamificationRepository.countLedgerByEventType(tx, {
      membershipId: input.membershipId,
      eventType: criteria.eventType,
    });
    const projected = count + (criteria.eventType === input.eventType ? 1 : 0);
    return projected >= criteria.minCount;
  }

  const badges = [];
  for (const badge of await gamificationRepository.listBadges(tx)) {
    if (badge.status !== "ACTIVE" || awardedBadgeIds.has(badge.id)) continue;

    const criteria = badge.criteria_json as BadgeCriteria;
    let wouldUnlock: boolean;
    if (criteria.type === "compound") {
      const results = await Promise.all(criteria.criteria.map(projectPrimitive));
      wouldUnlock = criteria.operator === "any" ? results.some(Boolean) : results.every(Boolean);
    } else {
      wouldUnlock = await projectPrimitive(criteria);
    }

    if (wouldUnlock) {
      badges.push({ key: badge.key, name: badge.name });
    }
  }

  const quests = await previewQuestsForEvent(tx, {
    membershipId: input.membershipId,
    event: { id: "00000000-0000-0000-0000-000000000000", eventType: input.eventType, payload: {} },
    pointsAwarded: xpTotal,
  });

  return {
    data: {
      eventType: input.eventType,
      seasonalMultiplier: seasonal.xpMultiplier,
      xp: { total: xpTotal, entries: xpEntries },
      streaks,
      badges,
      quests,
    },
  };
}

/** Export the tenant's full gamification configuration for cloning. */
export async function exportGamificationConfig(tx: TenantTx) {
  const [rules, badges, leaderboards, quests, rewards, seasonal] = await Promise.all([
    resolveGamificationRules(tx),
    gamificationRepository.listBadges(tx),
    gamificationRepository.listLeaderboards(tx),
    listQuestsForAdmin(tx),
    getRewardsAdmin(tx),
    listSeasonalEvents(tx),
  ]);

  return {
    data: {
      exportedAt: new Date().toISOString(),
      rules,
      badges: badges.map((badge) => ({
        key: badge.key,
        name: badge.name,
        iconKey: badge.icon_key,
        criteria: badge.criteria_json,
        status: badge.status,
      })),
      leaderboards: leaderboards.map((board) => toLeaderboardDto(board) as Record<string, unknown>),
      quests: quests.data.items.map((quest) => ({
        key: quest.key,
        name: quest.name,
        description: quest.description,
        questType: quest.questType,
        criteria: quest.criteria,
        rewards: quest.rewards,
        startsAt: quest.startsAt,
        endsAt: quest.endsAt,
        courseId: quest.courseId,
        status: quest.status,
      })),
      rewards: {
        currencies: rewards.data.currencies as unknown as Array<Record<string, unknown>>,
        items: rewards.data.items.map((item) => ({
          key: item.key,
          name: item.name,
          description: item.description,
          costCurrencyKey: item.costCurrencyKey,
          costAmount: item.costAmount,
          rewardType: item.rewardType,
          rewardPayload: item.rewardPayload,
          stock: item.stock,
          status: item.status,
        })),
      },
      seasonalEvents: seasonal.data.items.map((event) => ({
        key: event.key,
        name: event.name,
        status: event.status,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        multiplier: event.multiplier,
        linkedQuestIds: event.linkedQuestIds,
        linkedLeaderboardKey: event.linkedLeaderboardKey,
      })),
    },
  };
}

export async function getGamificationPublicConfig(tx: TenantTx) {
  const rules = await resolveGamificationRules(tx);
  return {
    data: {
      leaderboardsPublic: rules.leaderboardsPublic,
    },
  };
}

/** League tiers by weekly XP percentile: top 20% gold, top 50% silver, rest bronze. */
function leagueForStanding(standing: {
  mine: number;
  ranked: number;
  below: number;
}): "bronze" | "silver" | "gold" | null {
  if (standing.mine <= 0 || standing.ranked === 0) {
    return null;
  }
  const percentile = standing.below / standing.ranked;
  if (percentile >= 0.8) return "gold";
  if (percentile >= 0.5) return "silver";
  return "bronze";
}

/**
 * Turns a weekly XP standing into a 1-indexed rank. `below` is the count of
 * members with strictly fewer weekly points, so members with points >= mine
 * (ranked - below) is the learner's position (ties share the lower rank).
 * Null when the learner has no weekly XP, mirroring `leagueForStanding`.
 */
function weeklyRankForStanding(standing: {
  mine: number;
  ranked: number;
  below: number;
}): number | null {
  if (standing.mine <= 0 || standing.ranked === 0) {
    return null;
  }
  return Math.max(1, standing.ranked - standing.below);
}

/**
 * Derives the learner's position within the configured level ladder from their
 * total XP: which level they're on, and how far into the next one they are.
 * Returns null when no thresholds are configured so callers can hide the meter.
 */
function computeLevelProgress(
  xpTotal: number,
  thresholds: { levelKey: string; minXp: number }[],
) {
  if (thresholds.length === 0) {
    return null;
  }

  const sorted = [...thresholds].sort((a, b) => a.minXp - b.minXp);
  let index = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const threshold = sorted[i];
    if (threshold && xpTotal >= threshold.minXp) {
      index = i;
    }
  }

  const current = sorted[index];
  if (!current) {
    return null;
  }
  const next = sorted[index + 1] ?? null;
  const xpIntoLevel = Math.max(0, xpTotal - current.minXp);
  const xpForNextLevel = next ? next.minXp - current.minXp : null;
  const progressPct =
    next && xpForNextLevel && xpForNextLevel > 0
      ? Math.max(0, Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)))
      : 100;

  return {
    levelNumber: index + 1,
    levelKey: current.levelKey,
    currentLevelMinXp: current.minXp,
    nextLevelKey: next?.levelKey ?? null,
    nextLevelMinXp: next?.minXp ?? null,
    xpIntoLevel,
    xpForNextLevel,
    progressPct,
  };
}

export async function getMyGamificationProfile(tx: TenantTx, ctx: ServiceCtx) {
  await ensureGamificationProfile(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
  });

  const timezone = await resolveTenantTimezone(tx);
  const weekRange = resolvePeriodRange("weekly", timezone);
  const [profile, badgeCount, standing, rules] = await Promise.all([
    gamificationRepository.findProfileByMembership(tx, ctx.actorMembershipId),
    gamificationRepository.countBadgeAwardsForMembership(tx, ctx.actorMembershipId),
    weekRange
      ? gamificationRepository.weeklyXpStanding(tx, {
          membershipId: ctx.actorMembershipId,
          timezone,
          startDate: weekRange.startDate,
          endDate: weekRange.endDate,
        })
      : Promise.resolve({ mine: 0, ranked: 0, below: 0 }),
    resolveGamificationRules(tx),
  ]);

  const xpTotal = profile?.xp_total ?? 0;

  return {
    data: {
      membershipId: ctx.actorMembershipId,
      xpTotal,
      levelKey: profile?.level_key ?? null,
      badgeCount,
      weeklyXp: standing.mine,
      league: leagueForStanding(standing),
      weeklyRank: weeklyRankForStanding(standing),
      rankedMembers: standing.ranked,
      levelProgress: computeLevelProgress(xpTotal, rules.levelThresholds),
    },
  };
}

/**
 * Per-day XP totals for the trailing ~53 weeks, powering the learner activity
 * heatmap and the weekly-momentum chart. Sourced from the point ledger and
 * bucketed in the tenant's timezone.
 */
export async function getMyActivity(tx: TenantTx, ctx: ServiceCtx) {
  await ensureGamificationProfile(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
  });

  const timezone = await resolveTenantTimezone(tx);
  const today = getTenantLocalDateString(timezone);
  const rangeStart = addDaysToDateString(today, -370);
  const rangeEndExclusive = addDaysToDateString(today, 1);

  const rows = await gamificationRepository.sumDailyLedgerForMembership(tx, {
    membershipId: ctx.actorMembershipId,
    timezone,
    startDate: rangeStart,
    endDate: rangeEndExclusive,
  });

  const days = rows.map((row) => ({ date: row.day, xp: row.xp }));
  const totalXp = days.reduce((sum, day) => sum + day.xp, 0);
  const activeDays = days.filter((day) => day.xp > 0).length;
  const maxDailyXp = days.reduce((max, day) => Math.max(max, day.xp), 0);

  return {
    data: {
      timezone,
      rangeStart,
      rangeEnd: today,
      totalXp,
      activeDays,
      maxDailyXp,
      days,
    },
  };
}

export async function listMyBadgeProgress(tx: TenantTx, ctx: ServiceCtx) {
  const badges = await gamificationRepository.listBadges(tx);
  const awards = await gamificationRepository.listBadgeAwardsForMembership(
    tx,
    ctx.actorMembershipId,
  );
  const awardByBadgeId = new Map(awards.map((award) => [award.badge_id, award]));

  const items = [];
  for (const badge of badges) {
    if (badge.status !== "ACTIVE") continue;

    const criteria = badge.criteria_json as BadgeCriteria;
    const award = awardByBadgeId.get(badge.id) ?? null;
    const progress = await measureBadgeCriteria(tx, ctx.actorMembershipId, criteria);

    items.push({
      id: badge.id,
      key: badge.key,
      name: badge.name,
      iconKey: badge.icon_key,
      awarded: award != null,
      awardedAt: award?.awarded_at.toISOString() ?? null,
      operator: criteria.type === "compound" ? criteria.operator : ("all" as const),
      progress,
    });
  }

  return { data: { items } };
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

export async function manualAwardBadgeBulk(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: { badgeId: string; membershipIds: string[]; reason: string },
) {
  const badge = await gamificationRepository.findBadgeById(tx, input.badgeId);
  if (!badge) {
    throw badgeNotFound();
  }

  const awarded: string[] = [];
  const skipped: string[] = [];
  const failures: Array<{ membershipId: string; reason: string }> = [];

  for (const membershipId of input.membershipIds) {
    const active = await gamificationRepository.membershipIsActive(tx, membershipId);
    if (!active) {
      failures.push({ membershipId, reason: "Membership is not active." });
      continue;
    }

    const inserted = await gamificationRepository.insertBadgeAward(tx, {
      tenantId: ctx.tenantId,
      badgeId: input.badgeId,
      membershipId,
    });

    if (!inserted) {
      skipped.push(membershipId);
      continue;
    }

    awarded.push(membershipId);

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
          membershipId,
        },
        reason: input.reason,
        metadata: { bulk: true },
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
        membershipId,
      },
      idempotencyKey: `badge.awarded:${input.badgeId}:${membershipId}`,
    });
  }

  return {
    data: {
      awarded,
      skipped,
      failures,
    },
  };
}

export async function revokeBadgeAward(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: { badgeId: string; membershipId: string; reason: string },
) {
  const badge = await gamificationRepository.findBadgeById(tx, input.badgeId);
  if (!badge) {
    throw badgeNotFound();
  }

  const deleted = await gamificationRepository.deleteBadgeAward(tx, {
    badgeId: input.badgeId,
    membershipId: input.membershipId,
  });

  if (!deleted) {
    throw badgeAwardNotFound();
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
      action: "badge.award_revoked",
      target: { type: "badge_award", id: input.badgeId },
      before: {
        badgeId: input.badgeId,
        membershipId: input.membershipId,
      },
      after: null,
      reason: input.reason,
      metadata: {},
    },
  );

  return { data: toBadgeDto(badge) };
}

function encodeAwardCursor(row: { awarded_at: Date; id: string }): string {
  return `${row.awarded_at.toISOString()}|${row.id}`;
}

function decodeAwardCursor(cursor: string): { awardedAt: string; id: string } | null {
  const [awardedAt, id] = cursor.split("|");
  if (!awardedAt || !id) return null;
  return { awardedAt, id };
}

export async function listBadgeAwardHistory(
  tx: TenantTx,
  input: z.output<typeof badgeAwardsQuerySchema>,
) {
  const cursor = input.cursor ? decodeAwardCursor(input.cursor) : null;
  const rows = await gamificationRepository.listBadgeAwardHistory(tx, {
    limit: input.limit,
    ...(input.badgeId ? { badgeId: input.badgeId } : {}),
    ...(input.membershipId ? { membershipId: input.membershipId } : {}),
    ...(cursor ? { cursor } : {}),
  });

  const hasNextPage = rows.length > input.limit;
  const pageRows = hasNextPage ? rows.slice(0, input.limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return {
    data: {
      items: pageRows.map((row) => ({
        badgeId: row.badge_id,
        badgeKey: row.badge_key,
        badgeName: row.badge_name,
        membershipId: row.membership_id,
        memberLabel: row.member_label ?? row.membership_id,
        awardedAt: row.awarded_at.toISOString(),
        manual: row.source_event_id == null,
      })),
      nextCursor: hasNextPage && lastRow ? encodeAwardCursor(lastRow) : null,
    },
  };
}

export async function getGamificationMetrics(tx: TenantTx) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    badgeCounts,
    leaderboardCounts,
    awardsThisWeek,
    activeStreaks,
    memberProfiles,
    xpThisWeek,
  ] = await Promise.all([
    gamificationRepository.countBadgesByStatus(tx),
    gamificationRepository.countLeaderboardsByStatus(tx),
    gamificationRepository.countAwardsSince(tx, weekAgo),
    gamificationRepository.countActiveStreaks(tx, yesterday),
    gamificationRepository.countGamificationProfiles(tx),
    gamificationRepository.sumLedgerPointsSince(tx, weekAgo),
  ]);

  function toStatusCounts(rows: Array<{ status: string; count: number }>) {
    const byStatus = new Map(rows.map((row) => [row.status, row.count]));
    const counts = {
      active: byStatus.get("ACTIVE") ?? 0,
      draft: byStatus.get("DRAFT") ?? 0,
      inactive: byStatus.get("INACTIVE") ?? 0,
      archived: byStatus.get("ARCHIVED") ?? 0,
    };
    return {
      total: counts.active + counts.draft + counts.inactive + counts.archived,
      ...counts,
    };
  }

  return {
    data: {
      badges: toStatusCounts(badgeCounts),
      leaderboards: toStatusCounts(leaderboardCounts),
      awardsThisWeek,
      activeStreaks,
      memberProfiles,
      xpThisWeek,
    },
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

  if (input.operation === "revoke_award") {
    return revokeBadgeAward(tx, ctx, {
      badgeId: input.badgeId,
      membershipId: input.membershipId,
      reason: input.reason,
    });
  }

  if (input.operation === "manual_award_bulk") {
    return manualAwardBadgeBulk(tx, ctx, {
      badgeId: input.badgeId,
      membershipIds: input.membershipIds,
      reason: input.reason,
    });
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

async function fetchLeaderboardRankingRows(
  tx: TenantTx,
  args: {
    leaderboard: { window_key: string; config_json: unknown };
    timezone: string;
    limit: number;
  },
) {
  const config = args.leaderboard.config_json as LeaderboardConfig;
  const windowKey = args.leaderboard.window_key as "all_time" | "weekly" | "monthly";
  const periodRange = resolvePeriodRange(windowKey, args.timezone);
  const courseScope =
    config.scopeType === "course" && config.courseId ? { courseId: config.courseId } : {};
  const groupScope =
    config.scopeType === "group" && config.spaceId ? { spaceId: config.spaceId } : {};

  if (periodRange) {
    if (groupScope.spaceId) {
      return gamificationRepository.listTopMembershipsByLedgerPointsForGroup(tx, {
        limit: args.limit,
        timezone: args.timezone,
        startDate: periodRange.startDate,
        endDate: periodRange.endDate,
        spaceId: groupScope.spaceId,
      });
    }

    return gamificationRepository.listTopMembershipsByLedgerPoints(tx, {
      limit: args.limit,
      timezone: args.timezone,
      startDate: periodRange.startDate,
      endDate: periodRange.endDate,
      ...courseScope,
    });
  }

  if (groupScope.spaceId) {
    return gamificationRepository.listTopProfilesByXpForGroup(tx, {
      limit: args.limit,
      spaceId: groupScope.spaceId,
    });
  }

  return gamificationRepository.listTopProfilesByXp(tx, {
    limit: args.limit,
    ...courseScope,
  });
}

export async function getLeaderboardDetail(
  tx: TenantTx,
  ctx: ServiceCtx,
  leaderboardId: string,
  options?: { league?: "bronze" | "silver" | "gold" },
) {
  const leaderboard = await gamificationRepository.findLeaderboardById(tx, leaderboardId);
  if (!leaderboard) {
    throw leaderboardNotFound();
  }

  const config = leaderboard.config_json as LeaderboardConfig;
  const timezone = await resolveTenantTimezone(tx);
  const periodKey = resolvePeriodKey(
    leaderboard.window_key as "all_time" | "weekly" | "monthly",
    timezone,
  );
  const weekRange = resolvePeriodRange("weekly", timezone);

  let payload: LeaderboardSnapshotPayload;

  if (options?.league && weekRange) {
    const candidateRows = await fetchLeaderboardRankingRows(tx, {
      leaderboard,
      timezone,
      limit: Math.max(config.maxEntries * 5, 100),
    });

    const filtered: Array<{ membership_id: string; xp_total: number }> = [];
    for (const row of candidateRows) {
      const standing = await gamificationRepository.weeklyXpStanding(tx, {
        membershipId: row.membership_id,
        timezone,
        startDate: weekRange.startDate,
        endDate: weekRange.endDate,
      });
      if (leagueForStanding(standing) === options.league) {
        filtered.push(row);
      }
    }

    const calculatedAt = new Date().toISOString();
    payload = sanitizeLeaderboardSnapshotForRefresh({
      rows: filtered.slice(0, config.maxEntries),
      callerMembershipId: ctx.actorMembershipId,
      calculatedAt,
    });
  } else {
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

    payload = (snapshot?.snapshot_json ?? {
      entries: [],
      callerRank: null,
      callerMetricValue: null,
      calculatedAt: new Date().toISOString(),
    }) as LeaderboardSnapshotPayload;
  }

  const entries = payload.entries.map((entry) =>
    entry.isSelf
      ? { ...entry, label: "You" }
      : { ...entry, label: `Rank ${String(entry.rank)}`, isSelf: false },
  );

  return {
    data: {
      leaderboard: toLeaderboardDto(leaderboard),
      periodKey,
      calculatedAt: payload.calculatedAt,
      entries,
      callerRank: payload.callerRank,
      callerMetricValue: payload.callerMetricValue,
    },
  };
}

export async function getHallOfFameConfig(tx: TenantTx) {
  const config = await gamificationRepository.readTenantHallOfFameConfig(tx);
  return { data: config };
}

export async function updateHallOfFameConfig(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof updateHallOfFameConfigBodySchema>,
) {
  if (input.recognitionSpaceSlug) {
    const space = await communityRepository.findSpaceBySlug(tx, input.recognitionSpaceSlug);
    if (!space) {
      throw hallOfFameConfigInvalid(
        `Recognition space "${input.recognitionSpaceSlug}" was not found.`,
      );
    }
  }

  if (input.leaderboardKey) {
    const leaderboard = await gamificationRepository.findLeaderboardByKey(tx, input.leaderboardKey);
    if (!leaderboard || leaderboard.status !== "ACTIVE") {
      throw hallOfFameConfigInvalid(`Leaderboard "${input.leaderboardKey}" was not found.`);
    }
  }

  const before = await gamificationRepository.readTenantHallOfFameConfig(tx);
  await gamificationRepository.upsertTenantHallOfFameConfig(tx, input);

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "gamification.hall_of_fame_updated",
      target: { type: "tenant_config", id: ctx.tenantId },
      before,
      after: input,
      reason: null,
      metadata: {},
    },
  );

  return { data: input };
}

export async function getOpenBadgeAssertion(tx: TenantTx, ctx: ServiceCtx, badgeKey: string) {
  const badge = await gamificationRepository.findBadgeByKey(tx, badgeKey);
  if (!badge) {
    throw badgeNotFound();
  }

  const award = await gamificationRepository.findBadgeAwardForMembership(tx, {
    badgeId: badge.id,
    membershipId: ctx.actorMembershipId,
  });

  if (!award) {
    throw badgeNotAwarded();
  }

  const tenantName = await gamificationRepository.findTenantDisplayName(tx);
  const assertionId = `urn:uuid:${award.badge_id}:${award.membership_id}`;

  return {
    data: {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://purl.imsglobal.org/spec/ob/v3p0/context.json",
      ],
      id: assertionId,
      type: ["VerifiableCredential", "OpenBadgeCredential"],
      issuer: {
        type: ["Profile"],
        name: tenantName,
      },
      issuanceDate: award.awarded_at.toISOString(),
      credentialSubject: {
        type: ["AchievementSubject"],
        achievement: {
          type: ["Achievement"],
          name: badge.name,
          identifier: badge.key,
        },
      },
    },
  };
}
