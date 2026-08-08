import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { processGamificationSourceEvent } from "../../../backend/apps/api/src/server/gamification/gamification.service";
import { gamificationRepository } from "../../../backend/apps/api/src/server/gamification/gamification.repository";
import {
  getMyActiveSeasonalEvent,
  listSeasonalEvents,
  mutateSeasonalEvents,
  resolveSeasonalMultiplier,
  updateSeasonalEvent,
} from "../../../backend/apps/api/src/server/gamification/seasonal.service";
import {
  adminCtx,
  authoringTenantTx,
  createGamificationFixture,
  learnerCtx,
} from "../../fixtures/gamification-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const HOUR = 60 * 60 * 1000;

function window(offsetStartHours: number, offsetEndHours: number) {
  return {
    startsAt: new Date(Date.now() + offsetStartHours * HOUR).toISOString(),
    endsAt: new Date(Date.now() + offsetEndHours * HOUR).toISOString(),
  };
}

describeWithDb("gamification seasonal events", () => {
  it("manages events with lazy status transitions, duplicate rejection, and clone", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_seasonal_crud");

    // Scheduled event whose window has already opened → becomes active on read.
    const created = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        mutateSeasonalEvents(tx, admin, {
          operation: "create",
          event: {
            key: "summer-sprint",
            name: "Summer Sprint",
            status: "scheduled",
            ...window(-1, +24),
            multiplier: { xpMultiplier: 2, applyToStreakBonuses: true },
            linkedQuestIds: [],
            linkedLeaderboardKey: "weekly-xp",
          },
        }),
    );
    expect(created.data.status).toBe("active");

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        mutateSeasonalEvents(tx, admin, {
          operation: "create",
          event: {
            key: "summer-sprint",
            name: "Duplicate",
            status: "scheduled",
            ...window(+1, +2),
            multiplier: { xpMultiplier: 1.5, applyToStreakBonuses: false },
            linkedQuestIds: [],
          },
        }),
      ),
    ).rejects.toThrow(/already exists/i);

    // Scheduled event fully in the past → ends on read.
    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      mutateSeasonalEvents(tx, admin, {
        operation: "create",
        event: {
          key: "spring-sprint",
          name: "Spring Sprint",
          status: "scheduled",
          ...window(-48, -24),
          multiplier: { xpMultiplier: 3, applyToStreakBonuses: true },
          linkedQuestIds: [],
        },
      }),
    );

    const list = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listSeasonalEvents(tx),
    );
    expect(list.data.items.find((item) => item.key === "spring-sprint")?.status).toBe("ended");
    expect(list.data.items.find((item) => item.key === "summer-sprint")?.status).toBe("active");

    // Clone carries multiplier and links into a new window.
    const clone = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        mutateSeasonalEvents(tx, admin, {
          operation: "clone",
          id: created.data.id,
          key: "autumn-sprint",
          name: "Autumn Sprint",
          ...window(+24, +48),
        }),
    );
    expect(clone.data.status).toBe("scheduled");
    expect(clone.data.multiplier.xpMultiplier).toBe(2);
    expect(clone.data.linkedLeaderboardKey).toBe("weekly-xp");
  });

  it("multiplies XP during active events and reverts after they end", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_seasonal_admin");
    const learner = learnerCtx(fixture, "req_seasonal_learner");

    const created = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        mutateSeasonalEvents(tx, admin, {
          operation: "create",
          event: {
            key: "double-xp",
            name: "Double XP Weekend",
            status: "scheduled",
            ...window(-1, +24),
            multiplier: { xpMultiplier: 2, applyToStreakBonuses: true },
            linkedQuestIds: [],
          },
        }),
    );

    const multiplier = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => resolveSeasonalMultiplier(tx),
    );
    expect(multiplier.xpMultiplier).toBe(2);

    // Practice event: 8 XP base → 16 XP boosted; replay adds nothing.
    const event = {
      id: randomUUID(),
      eventType: "practice.session_completed",
      payload: {
        practiceSessionId: randomUUID(),
        membershipId: fixture.learnerMembershipId,
        collectionId: null,
        sessionType: "due",
      },
    };
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, event),
    );
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, event),
    );

    const boosted = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => gamificationRepository.findProfileByMembership(tx, fixture.learnerMembershipId),
    );
    expect(boosted?.xp_total).toBe(16);

    // Learner banner data while active.
    const active = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getMyActiveSeasonalEvent(tx),
    );
    expect(active.data.event?.key).toBe("double-xp");
    expect(active.data.event?.xpMultiplier).toBe(2);

    // End the event: multiplier reverts, banner disappears.
    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      updateSeasonalEvent(tx, admin, { id: created.data.id, status: "ended" }),
    );

    const after = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => resolveSeasonalMultiplier(tx),
    );
    expect(after.xpMultiplier).toBe(1);

    const noneActive = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getMyActiveSeasonalEvent(tx),
    );
    expect(noneActive.data.event).toBeNull();

    const secondEvent = {
      id: randomUUID(),
      eventType: "practice.session_completed",
      payload: {
        practiceSessionId: randomUUID(),
        membershipId: fixture.learnerMembershipId,
        collectionId: null,
        sessionType: "due",
      },
    };
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, secondEvent),
    );

    const reverted = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => gamificationRepository.findProfileByMembership(tx, fixture.learnerMembershipId),
    );
    expect(reverted?.xp_total).toBe(16 + 8);
  });
});
