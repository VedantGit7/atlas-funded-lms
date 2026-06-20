import { describe, expect, it } from "vitest";
import {
  badgeCriteriaSchema,
  createBadgeInputSchema,
  createLeaderboardInputSchema,
  leaderboardConfigSchema,
  postBadgesBodySchema,
  updateBadgeBodySchema,
} from "../../../apps/web/src/server/gamification/gamification.schemas";
import {
  buildXpIdempotencyKey,
  calculateLevelKey,
  selectXpRulesForEvent,
} from "../../../apps/web/src/server/gamification/gamification-config.service";
import { DEFAULT_GAMIFICATION_RULES } from "../../../apps/web/src/server/gamification/gamification-defaults";
import { sanitizeLeaderboardSnapshot } from "../../../apps/web/src/server/gamification/gamification-rules.helpers";

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
          tenant_id: "00000000-0000-0000-0000-000000000001",
        },
      }),
    ).toThrow();

    expect(() =>
      updateBadgeBodySchema.parse({
        id: "00000000-0000-0000-0000-000000000001",
        membershipId: "00000000-0000-0000-0000-000000000002",
      }),
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

  it("builds deterministic ledger idempotency keys", () => {
    expect(buildXpIdempotencyKey("event-id", "practice.session_completed")).toBe(
      "xp:event-id:practice.session_completed",
    );
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
