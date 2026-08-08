import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  exportGamificationConfig,
  getMyGamificationProfile,
  listMyBadgeProgress,
  mutateBadges,
  processGamificationSourceEvent,
  simulateGamificationEvent,
} from "../../../backend/apps/api/src/server/gamification/gamification.service";
import { createQuest } from "../../../backend/apps/api/src/server/gamification/quest.service";
import {
  adminCtx,
  authoringTenantTx,
  createGamificationFixture,
  learnerCtx,
} from "../../fixtures/gamification-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

function practiceEvent(membershipId: string) {
  return {
    id: randomUUID(),
    eventType: "practice.session_completed",
    payload: {
      practiceSessionId: randomUUID(),
      membershipId,
      collectionId: null,
      sessionType: "due",
    },
  };
}

describeWithDb("gamification advanced mechanics", () => {
  it("evaluates compound badge criteria and reports progress", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_compound_admin");
    const learner = learnerCtx(fixture, "req_compound_learner");

    // AND badge: needs 8 XP AND 2 practice sessions.
    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      mutateBadges(tx, admin, {
        operation: "create",
        badge: {
          key: "compound-and",
          name: "Compound AND",
          criteria: {
            type: "compound",
            operator: "all",
            criteria: [
              { type: "xp_total", minXp: 8 },
              { type: "event_count", eventType: "practice.session_completed", minCount: 2 },
            ],
          },
          status: "ACTIVE",
        },
      }),
    );

    // OR badge: 1 practice session OR 1000 XP.
    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      mutateBadges(tx, admin, {
        operation: "create",
        badge: {
          key: "compound-or",
          name: "Compound OR",
          criteria: {
            type: "compound",
            operator: "any",
            criteria: [
              { type: "event_count", eventType: "practice.session_completed", minCount: 1 },
              { type: "xp_total", minXp: 1000 },
            ],
          },
          status: "ACTIVE",
        },
      }),
    );

    // First practice session: OR badge unlocks (1 session), AND badge doesn't (needs 2).
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, practiceEvent(fixture.learnerMembershipId)),
    );

    const midway = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => listMyBadgeProgress(tx, learner),
    );
    const orBadge = midway.data.items.find((item) => item.key === "compound-or");
    const andBadge = midway.data.items.find((item) => item.key === "compound-and");
    expect(orBadge?.awarded).toBe(true);
    expect(andBadge?.awarded).toBe(false);
    expect(andBadge?.operator).toBe("all");
    expect(andBadge?.progress).toHaveLength(2);
    // XP condition already satisfied (8/8); session count is 1/2.
    expect(andBadge?.progress[0]?.progress).toBe(8);
    expect(andBadge?.progress[1]?.progress).toBe(1);
    expect(andBadge?.progress[1]?.target).toBe(2);

    // Second session completes the AND badge.
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, practiceEvent(fixture.learnerMembershipId)),
    );

    const done = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => listMyBadgeProgress(tx, learner),
    );
    expect(done.data.items.find((item) => item.key === "compound-and")?.awarded).toBe(true);
  });

  it("assigns leagues from weekly XP percentile", async () => {
    const fixture = await createGamificationFixture();
    const learner = learnerCtx(fixture, "req_league");

    // No activity yet: unranked.
    const before = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getMyGamificationProfile(tx, learner),
    );
    expect(before.data.league).toBeNull();
    expect(before.data.weeklyXp).toBe(0);

    // Sole active member this week → 0 members below them → bronze.
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, practiceEvent(fixture.learnerMembershipId)),
    );

    const after = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getMyGamificationProfile(tx, learner),
    );
    expect(after.data.weeklyXp).toBe(8);
    expect(after.data.league).toBe("bronze");
  });

  it("simulates events without writing anything", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_simulate");
    const learner = learnerCtx(fixture, "req_simulate_learner");

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      mutateBadges(tx, admin, {
        operation: "create",
        badge: {
          key: "first-practice",
          name: "First Practice",
          criteria: { type: "event_count", eventType: "practice.session_completed", minCount: 1 },
          status: "ACTIVE",
        },
      }),
    );
    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      createQuest(tx, admin, {
        key: "sim-quest",
        name: "Sim Quest",
        questType: "single_step",
        criteria: {
          steps: [{ type: "event_count", eventType: "practice.session_completed", count: 1 }],
        },
        rewards: { xp: 10 },
        status: "ACTIVE",
      }),
    );

    const report = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        simulateGamificationEvent(tx, {
          membershipId: fixture.learnerMembershipId,
          eventType: "practice.session_completed",
        }),
    );

    expect(report.data.xp.total).toBe(8);
    expect(report.data.seasonalMultiplier).toBe(1);
    expect(report.data.streaks.some((entry) => entry.wouldAdvance)).toBe(true);
    expect(report.data.badges.map((badge) => badge.key)).toContain("first-practice");
    expect(report.data.quests[0]?.key).toBe("sim-quest");
    expect(report.data.quests[0]?.wouldComplete).toBe(true);

    // Nothing was written: no ledger rows, no awards, no quest progress.
    const counts = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ ledger: number; awards: number; progress: number }>>`
          select
            (select count(*)::int from point_ledger) as ledger,
            (select count(*)::int from badge_awards) as awards,
            (select count(*)::int from quest_progress) as progress
        `,
    );
    expect(counts[0]).toEqual({ ledger: 0, awards: 0, progress: 0 });
  });

  it("exports the full gamification configuration", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_export");

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      mutateBadges(tx, admin, {
        operation: "create",
        badge: {
          key: "export-badge",
          name: "Export Badge",
          criteria: { type: "xp_total", minXp: 100 },
          status: "ACTIVE",
        },
      }),
    );

    const exported = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => exportGamificationConfig(tx),
    );

    expect(exported.data.rules.xpRules.length).toBeGreaterThan(0);
    expect(exported.data.badges).toHaveLength(1);
    expect(exported.data.badges[0]?.["key"]).toBe("export-badge");
    // Exported records are key-addressed (no tenant-specific ids) for cloning.
    expect(exported.data.badges[0]?.["id"]).toBeUndefined();
    expect(exported.data.exportedAt).toBeTruthy();
  });
});
