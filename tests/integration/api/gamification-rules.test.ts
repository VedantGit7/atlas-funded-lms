import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  getGamificationRules,
  listMyGamificationLedger,
  processGamificationSourceEvent,
  updateGamificationRules,
} from "../../../backend/apps/api/src/server/gamification/gamification.service";
import { DEFAULT_GAMIFICATION_RULES } from "../../../backend/apps/api/src/server/gamification/gamification-defaults";
import { gamificationRepository } from "../../../backend/apps/api/src/server/gamification/gamification.repository";
import { getTenantLocalDateString } from "../../../backend/apps/api/src/server/gamification/gamification-config.service";
import {
  adminCtx,
  authoringTenantTx,
  createGamificationFixture,
  learnerCtx,
} from "../../fixtures/gamification-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("gamification rules API", () => {
  it("returns defaults, persists partial updates, and audits changes", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_rules");

    const initial = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => getGamificationRules(tx),
    );

    expect(initial.data.xpRules).toEqual(DEFAULT_GAMIFICATION_RULES.xpRules);
    expect(initial.data.leaderboardsPublic).toBe(true);

    const updated = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        updateGamificationRules(tx, admin, {
          xpRules: [{ key: "lesson.completed", eventType: "lesson.completed", points: 25 }],
          leaderboardsPublic: false,
        }),
    );

    expect(updated.data.xpRules).toEqual([
      { key: "lesson.completed", eventType: "lesson.completed", points: 25 },
    ]);
    expect(updated.data.leaderboardsPublic).toBe(false);
    // Untouched sections keep defaults.
    expect(updated.data.levelThresholds).toEqual(DEFAULT_GAMIFICATION_RULES.levelThresholds);
    expect(updated.data.streaks).toEqual(DEFAULT_GAMIFICATION_RULES.streaks);

    // A second partial update must not clobber the first.
    const second = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        updateGamificationRules(tx, admin, {
          defaultFreezeInventory: 5,
        }),
    );

    expect(second.data.xpRules).toEqual([
      { key: "lesson.completed", eventType: "lesson.completed", points: 25 },
    ]);
    expect(second.data.defaultFreezeInventory).toBe(5);
    expect(second.data.leaderboardsPublic).toBe(false);

    const audit = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
          select count(*)::int as count
          from audit_entries
          where action = 'gamification.rules_updated'
        `,
    );

    expect(audit[0]?.count).toBe(2);
  });

  it("awards streak milestone bonus XP once", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_bonus_admin");
    const learner = learnerCtx(fixture, "req_bonus");

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      updateGamificationRules(tx, admin, {
        streakBonuses: [{ days: 2, bonusXp: 100 }],
      }),
    );

    // Seed a 1-day streak that ended yesterday so today's activity extends it to 2.
    const today = getTenantLocalDateString("UTC");
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      for (const streakKey of ["daily_learning", "practice_daily"]) {
        await gamificationRepository.upsertStreak(tx, {
          tenantId: fixture.tenantId,
          membershipId: fixture.learnerMembershipId,
          streakKey,
          currentCount: 1,
          longestCount: 1,
          lastActivityDate: yesterday,
        });
      }
    });

    const eventId = randomUUID();
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, {
        id: eventId,
        eventType: "practice.session_completed",
        payload: {
          practiceSessionId: randomUUID(),
          membershipId: fixture.learnerMembershipId,
          collectionId: null,
          sessionType: "due",
        },
      }),
    );

    // Replay must not double-award.
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, {
        id: eventId,
        eventType: "practice.session_completed",
        payload: {
          practiceSessionId: randomUUID(),
          membershipId: fixture.learnerMembershipId,
          collectionId: null,
          sessionType: "due",
        },
      }),
    );

    const profile = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => gamificationRepository.findProfileByMembership(tx, fixture.learnerMembershipId),
    );

    // 8 XP for the practice session + 100 bonus for each of the two streaks hitting 2 days.
    expect(profile?.xp_total).toBe(8 + 100 + 100);

    const ledger = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => listMyGamificationLedger(tx, learner, { limit: 10 }),
    );

    const bonusRows = ledger.data.items.filter((item) =>
      item.reasonKey.startsWith("streak_bonus."),
    );
    expect(bonusRows).toHaveLength(2);
    expect(bonusRows[0]?.eventType).toBe("streak.bonus");
    expect(ledger.data.items.some((item) => item.reasonKey === "practice.session_completed")).toBe(
      true,
    );
    void today;
  });

  it("paginates the learner ledger with a cursor", async () => {
    const fixture = await createGamificationFixture();
    const learner = learnerCtx(fixture, "req_ledger");

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      for (let index = 0; index < 5; index += 1) {
        await gamificationRepository.insertPointLedger(tx, {
          tenantId: fixture.tenantId,
          membershipId: fixture.learnerMembershipId,
          points: 10 + index,
          reasonKey: `test-${String(index)}`,
          sourceEventId: randomUUID(),
          idempotencyKey: `ledger-test-${String(index)}-${randomUUID()}`,
          eventType: "lesson.completed",
        });
      }
    });

    const firstPage = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => listMyGamificationLedger(tx, learner, { limit: 3 }),
    );

    expect(firstPage.data.items).toHaveLength(3);
    expect(firstPage.data.nextCursor).not.toBeNull();

    const secondPage = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        listMyGamificationLedger(tx, learner, {
          limit: 3,
          cursor: firstPage.data.nextCursor ?? undefined,
        }),
    );

    expect(secondPage.data.items).toHaveLength(2);
    expect(secondPage.data.nextCursor).toBeNull();

    const firstKeys = new Set(firstPage.data.items.map((item) => item.reasonKey));
    for (const item of secondPage.data.items) {
      expect(firstKeys.has(item.reasonKey)).toBe(false);
    }
  });
});
