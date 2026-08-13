import { describe, expect, it } from "vitest";
import {
  badgeAwardsQuerySchema,
  badgeCriteriaSchema,
  updateGamificationRulesBodySchema,
  createBadgeInputSchema,
  createLeaderboardInputSchema,
  hallOfFameConfigSchema,
  leaderboardConfigSchema,
  postBadgesBodySchema,
  updateBadgeBodySchema,
} from "../../../backend/apps/api/src/server/gamification/gamification.schemas";
import {
  buildXpIdempotencyKey,
  calculateLevelKey,
  getPreviousActivityPeriod,
  getPreviousWeekPeriodKey,
  resolveActivityPeriod,
  resolvePeriodKey,
  resolvePeriodRange,
  selectStreakRulesForEvent,
  selectXpRulesForEvent,
} from "../../../backend/apps/api/src/server/gamification/gamification-config.service";
import { DEFAULT_GAMIFICATION_RULES } from "../../../backend/apps/api/src/server/gamification/gamification-defaults";
import { GAMIFICATION_CONSUMED_EVENT_TYPES } from "../../../backend/apps/api/src/server/gamification/gamification-event.schemas";
import {
  createQuestInputSchema,
  questCriteriaSchema,
} from "../../../backend/apps/api/src/server/gamification/quest.schemas";
import {
  createRewardItemInputSchema,
  postRewardsBodySchema,
} from "../../../backend/apps/api/src/server/gamification/rewards.schemas";
import { sanitizeLeaderboardSnapshot } from "../../../backend/apps/api/src/server/gamification/gamification-rules.helpers";

describe("gamification schemas", () => {
  it("rejects client-supplied tenant and profile fields", () => {
    expect(() =>
      postBadgesBodySchema.parse({
        operation: "create",
        badge: {
          key: "starter",
          name: "Starter",
          criteria: { type: "xp_total", minXp: 10 },
          status: "ACTIVE",
          tenant_id: "00000000-0000-4000-8000-000000000001",
        },
      }),
    ).toThrow();

    expect(() =>
      updateBadgeBodySchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        membershipId: "00000000-0000-4000-8000-000000000002",
      }),
    ).toThrow();
  });

  it("validates compound badge criteria", () => {
    expect(
      badgeCriteriaSchema.parse({
        type: "compound",
        operator: "any",
        criteria: [
          { type: "xp_total", minXp: 100 },
          { type: "streak_current", streakKey: "daily_learning", minCount: 7 },
        ],
      }),
    ).toBeTruthy();

    // Compound criteria cannot nest other compounds.
    expect(() =>
      badgeCriteriaSchema.parse({
        type: "compound",
        operator: "all",
        criteria: [{ type: "compound", operator: "any", criteria: [] }],
      }),
    ).toThrow();

    // At least one child required.
    expect(() =>
      badgeCriteriaSchema.parse({ type: "compound", operator: "all", criteria: [] }),
    ).toThrow();
  });

  it("validates badge criteria and leaderboard config", () => {
    expect(
      badgeCriteriaSchema.parse({
        type: "streak_current",
        streakKey: "daily_learning",
        minCount: 3,
      }),
    ).toBeTruthy();

    expect(() =>
      createBadgeInputSchema.parse({
        key: "starter",
        name: "Starter",
        criteria: { type: "xp_total", minXp: 10 },
        status: "ACTIVE",
        xpTotal: 10,
      }),
    ).toThrow();

    expect(() =>
      leaderboardConfigSchema.parse({
        scopeType: "tenant",
        privacyMode: "named",
        maxEntries: 10,
      }),
    ).toThrow();
  });

  it("accepts revoke_award operations and requires an audit reason", () => {
    expect(
      postBadgesBodySchema.parse({
        operation: "revoke_award",
        badgeId: "00000000-0000-4000-8000-000000000001",
        membershipId: "00000000-0000-4000-8000-000000000002",
        reason: "Awarded in error",
      }),
    ).toBeTruthy();

    expect(() =>
      postBadgesBodySchema.parse({
        operation: "revoke_award",
        badgeId: "00000000-0000-4000-8000-000000000001",
        membershipId: "00000000-0000-4000-8000-000000000002",
      }),
    ).toThrow();
  });

  it("validates award history query bounds", () => {
    expect(badgeAwardsQuerySchema.parse({}).limit).toBe(25);
    expect(badgeAwardsQuerySchema.parse({ limit: "10" }).limit).toBe(10);
    expect(() => badgeAwardsQuerySchema.parse({ limit: "500" })).toThrow();
    expect(() => badgeAwardsQuerySchema.parse({ badgeId: "not-a-uuid" })).toThrow();
  });

  it("validates gamification rules updates", () => {
    expect(
      updateGamificationRulesBodySchema.parse({
        xpRules: [{ key: "lesson.completed", eventType: "lesson.completed", points: 25 }],
        streakBonuses: [{ days: 7, bonusXp: 100 }],
        leaderboardsPublic: false,
      }),
    ).toBeTruthy();

    // Unknown event types are rejected.
    expect(() =>
      updateGamificationRulesBodySchema.parse({
        xpRules: [{ key: "custom", eventType: "unknown.event", points: 5 }],
      }),
    ).toThrow();

    // Duplicate rule keys are rejected.
    expect(() =>
      updateGamificationRulesBodySchema.parse({
        xpRules: [
          { key: "dupe", eventType: "lesson.completed", points: 5 },
          { key: "dupe", eventType: "practice.session_completed", points: 5 },
        ],
      }),
    ).toThrow();

    // Level thresholds must include a 0-XP base level.
    expect(() =>
      updateGamificationRulesBodySchema.parse({
        levelThresholds: [{ levelKey: "level_2", minXp: 100 }],
      }),
    ).toThrow();

    // Duplicate bonus milestones are rejected.
    expect(() =>
      updateGamificationRulesBodySchema.parse({
        streakBonuses: [
          { days: 7, bonusXp: 100 },
          { days: 7, bonusXp: 200 },
        ],
      }),
    ).toThrow();
  });

  it("validates quest definitions", () => {
    expect(
      createQuestInputSchema.parse({
        key: "starter-mission",
        name: "Starter Mission",
        questType: "chain",
        criteria: {
          steps: [
            { type: "complete_lessons", count: 3 },
            { type: "earn_xp", amount: 100 },
          ],
        },
        rewards: { xp: 50, badgeKey: "starter" },
        status: "ACTIVE",
      }),
    ).toBeTruthy();

    // At least one step required.
    expect(() => questCriteriaSchema.parse({ steps: [] })).toThrow();

    // Unknown step types and event types are rejected.
    expect(() => questCriteriaSchema.parse({ steps: [{ type: "win_lottery" }] })).toThrow();
    expect(() =>
      questCriteriaSchema.parse({
        steps: [{ type: "event_count", eventType: "unknown.event", count: 1 }],
      }),
    ).toThrow();

    // Client-controlled fields are rejected.
    expect(() =>
      createQuestInputSchema.parse({
        key: "bad",
        name: "Bad",
        criteria: { steps: [{ type: "earn_xp", amount: 10 }] },
        tenantId: "00000000-0000-4000-8000-000000000001",
      }),
    ).toThrow();
  });

  it("validates reward catalog inputs", () => {
    expect(
      createRewardItemInputSchema.parse({
        key: "discount-10",
        name: "10% Discount",
        costCurrencyKey: "coins",
        costAmount: 50,
        rewardType: "DISCOUNT_CODE",
        rewardPayload: { code: "SAVE10" },
      }),
    ).toBeTruthy();

    // Type-specific payload requirements.
    expect(() =>
      createRewardItemInputSchema.parse({
        key: "discount-10",
        name: "10% Discount",
        costCurrencyKey: "coins",
        costAmount: 50,
        rewardType: "DISCOUNT_CODE",
        rewardPayload: {},
      }),
    ).toThrow();
    expect(() =>
      createRewardItemInputSchema.parse({
        key: "unlock",
        name: "Unlock",
        costCurrencyKey: "coins",
        costAmount: 50,
        rewardType: "CONTENT_UNLOCK",
        rewardPayload: {},
      }),
    ).toThrow();

    // Balance operations require an audit reason.
    expect(() =>
      postRewardsBodySchema.parse({
        operation: "grant_balance",
        membershipId: "00000000-0000-4000-8000-000000000001",
        currencyKey: "coins",
        amount: 10,
      }),
    ).toThrow();
  });

  it("requires courseId for course scope leaderboards", () => {
    expect(() =>
      createLeaderboardInputSchema.parse({
        key: "course",
        name: "Course",
        metricKey: "xp_total",
        windowKey: "all_time",
        config: {
          scopeType: "course",
          privacyMode: "anonymous_rank",
          maxEntries: 10,
        },
        status: "ACTIVE",
      }),
    ).toThrow();
  });
});

describe("gamification rules", () => {
  it("selects generic XP rules and calculates levels", () => {
    const rules = selectXpRulesForEvent(DEFAULT_GAMIFICATION_RULES, "assessment.graded", {
      passed: true,
    });

    expect(rules.map((rule) => rule.key)).toEqual(["assessment.graded.pass"]);
    expect(calculateLevelKey(150, DEFAULT_GAMIFICATION_RULES.levelThresholds)).toBe("level_2");
  });

  it("resolves period ranges for weekly and monthly windows in tenant timezone", () => {
    // 2026-07-06 is a Monday.
    const monday = new Date("2026-07-06T12:00:00.000Z");
    expect(resolvePeriodRange("all_time", "UTC", monday)).toBeNull();

    expect(resolvePeriodRange("weekly", "UTC", monday)).toEqual({
      startDate: "2026-07-06",
      endDate: "2026-07-13",
    });

    // Mid-week date resolves back to the same Monday.
    const thursday = new Date("2026-07-09T12:00:00.000Z");
    expect(resolvePeriodRange("weekly", "UTC", thursday)).toEqual({
      startDate: "2026-07-06",
      endDate: "2026-07-13",
    });

    expect(resolvePeriodRange("monthly", "UTC", thursday)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-08-01",
    });

    // Late-evening UTC on the last day of a month is already the next day/month
    // in a timezone ahead of UTC.
    const monthBoundary = new Date("2026-07-31T20:00:00.000Z");
    expect(resolvePeriodRange("monthly", "Asia/Tokyo", monthBoundary)).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-09-01",
    });
    expect(resolvePeriodRange("monthly", "UTC", monthBoundary)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-08-01",
    });
  });

  it("keeps period keys and period ranges consistent per window", () => {
    const date = new Date("2026-07-09T12:00:00.000Z");
    expect(resolvePeriodKey("all_time", "UTC", date)).toBe("all_time");
    expect(resolvePeriodKey("weekly", "UTC", date)).toBe("2026-W28");
    expect(resolvePeriodKey("monthly", "UTC", date)).toBe("2026-07");
  });

  it("builds deterministic ledger idempotency keys", () => {
    expect(buildXpIdempotencyKey("event-id", "practice.session_completed")).toBe(
      "xp:event-id:practice.session_completed",
    );
  });

  it("calculates level keys exactly at threshold boundaries", () => {
    const thresholds = DEFAULT_GAMIFICATION_RULES.levelThresholds;

    expect(calculateLevelKey(0, thresholds)).toBe("level_1");
    expect(calculateLevelKey(99, thresholds)).toBe("level_1");
    expect(calculateLevelKey(100, thresholds)).toBe("level_2");
    expect(calculateLevelKey(299, thresholds)).toBe("level_2");
    expect(calculateLevelKey(300, thresholds)).toBe("level_3");
    expect(calculateLevelKey(1000, thresholds)).toBe("level_5");
    expect(calculateLevelKey(999999, thresholds)).toBe("level_5");
  });

  it("detects level transitions across an XP accrual (level_up trigger condition)", () => {
    const thresholds = DEFAULT_GAMIFICATION_RULES.levelThresholds;
    const before = calculateLevelKey(95, thresholds);
    const after = calculateLevelKey(95 + 10, thresholds);

    expect(before).toBe("level_1");
    expect(after).toBe("level_2");
    expect(before).not.toBe(after);

    // No transition when the accrual stays inside the same band.
    expect(calculateLevelKey(110, thresholds)).toBe(calculateLevelKey(120, thresholds));
  });

  it("includes daily and weekly practice streaks in default rules", () => {
    const practiceRules = selectStreakRulesForEvent(
      DEFAULT_GAMIFICATION_RULES,
      "practice.session_completed",
    );

    expect(practiceRules.map((rule) => rule.streakKey)).toEqual([
      "daily_learning",
      "practice_daily",
      "practice_weekly",
    ]);
    expect(practiceRules.find((rule) => rule.streakKey === "practice_weekly")?.cadence).toBe(
      "weekly",
    );
    expect(DEFAULT_GAMIFICATION_RULES.leaderboardsPublic).toBe(true);
  });

  it("resolves weekly activity periods and previous week keys", () => {
    const thursday = new Date("2026-07-09T12:00:00.000Z");
    const weekKey = resolveActivityPeriod("weekly", "UTC", thursday);
    expect(weekKey).toBe("2026-W28");
    expect(getPreviousActivityPeriod("weekly", "UTC", weekKey)).toBe("2026-W27");
    expect(getPreviousWeekPeriodKey("2026-W28", "UTC")).toBe("2026-W27");
  });

  it("accepts bulk manual award operations", () => {
    expect(
      postBadgesBodySchema.parse({
        operation: "manual_award_bulk",
        badgeId: "00000000-0000-4000-8000-000000000001",
        membershipIds: [
          "00000000-0000-4000-8000-000000000002",
          "00000000-0000-4000-8000-000000000003",
        ],
        reason: "Cohort award",
      }),
    ).toBeTruthy();

    expect(() =>
      postBadgesBodySchema.parse({
        operation: "manual_award_bulk",
        badgeId: "00000000-0000-4000-8000-000000000001",
        membershipIds: [],
        reason: "Too few",
      }),
    ).toThrow();
  });

  it("includes diagnostic.completed in consumed event taxonomy", () => {
    expect(GAMIFICATION_CONSUMED_EVENT_TYPES).toContain("diagnostic.completed");
    expect(
      selectXpRulesForEvent(DEFAULT_GAMIFICATION_RULES, "diagnostic.completed").map(
        (rule) => rule.points,
      ),
    ).toEqual([25]);
  });

  it("validates group leaderboard scope and hall of fame config", () => {
    expect(
      leaderboardConfigSchema.parse({
        scopeType: "group",
        spaceId: "00000000-0000-4000-8000-000000000001",
        privacyMode: "anonymous_rank",
        maxEntries: 10,
      }),
    ).toBeTruthy();

    expect(
      hallOfFameConfigSchema.parse({
        recognitionSpaceSlug: "recognition",
        leaderboardKey: "weekly-xp",
      }),
    ).toBeTruthy();
  });

  it("sanitizes leaderboard output without personal identifiers", () => {
    const snapshot = sanitizeLeaderboardSnapshot({
      rows: [
        { membership_id: "a", xp_total: 100 },
        { membership_id: "b", xp_total: 80 },
      ],
      callerMembershipId: "b",
      calculatedAt: "2026-06-20T00:00:00.000Z",
    });

    expect(snapshot.entries[1]?.label).toBe("You");
    expect(snapshot.entries[0]?.label).toBe("Rank 1");
    expect(snapshot.entries[0]?.isSelf).toBe(false);
  });
});
