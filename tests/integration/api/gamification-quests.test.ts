import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  mutateBadges,
  processGamificationSourceEvent,
} from "../../../backend/apps/api/src/server/gamification/gamification.service";
import { gamificationRepository } from "../../../backend/apps/api/src/server/gamification/gamification.repository";
import {
  createQuest,
  listMyQuests,
  listQuestsForAdmin,
  updateQuest,
} from "../../../backend/apps/api/src/server/gamification/quest.service";
import {
  adminCtx,
  authoringTenantTx,
  createGamificationFixture,
  learnerCtx,
} from "../../fixtures/gamification-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

function practiceEvent(membershipId: string, eventId = randomUUID()) {
  return {
    id: eventId,
    eventType: "practice.session_completed",
    payload: {
      practiceSessionId: randomUUID(),
      membershipId,
      collectionId: null,
      sessionType: "due",
    },
  };
}

describeWithDb("gamification quests", () => {
  it("supports admin CRUD with analytics counts and duplicate-key rejection", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_quest_crud");

    const created = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        createQuest(tx, admin, {
          key: "starter-mission",
          name: "Starter Mission",
          description: "Do one practice session.",
          questType: "single_step",
          criteria: {
            steps: [{ type: "event_count", eventType: "practice.session_completed", count: 1 }],
          },
          rewards: { xp: 50 },
          status: "ACTIVE",
        }),
    );

    expect(created.data.key).toBe("starter-mission");
    expect(created.data.rewards.xp).toBe(50);

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        createQuest(tx, admin, {
          key: "starter-mission",
          name: "Duplicate",
          questType: "single_step",
          criteria: { steps: [{ type: "earn_xp", amount: 10 }] },
          rewards: {},
          status: "ACTIVE",
        }),
      ),
    ).rejects.toThrow(/already exists/i);

    const updated = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => updateQuest(tx, admin, { id: created.data.id, name: "Starter Mission v2" }),
    );
    expect(updated.data.name).toBe("Starter Mission v2");

    const list = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listQuestsForAdmin(tx),
    );
    expect(list.data.items).toHaveLength(1);
    expect(list.data.items[0]?.startedCount).toBe(0);
    expect(list.data.items[0]?.completedCount).toBe(0);
  });

  it("tracks progress, completes quests, grants rewards idempotently", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_quest_admin");
    const learner = learnerCtx(fixture, "req_quest_learner");

    const badge = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        mutateBadges(tx, admin, {
          operation: "create",
          badge: {
            key: "quest-champion",
            name: "Quest Champion",
            criteria: { type: "xp_total", minXp: 9999999 },
            status: "ACTIVE",
          },
        }),
    );

    const quest = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        createQuest(tx, admin, {
          key: "practice-twice",
          name: "Practice Twice",
          questType: "single_step",
          criteria: {
            steps: [{ type: "event_count", eventType: "practice.session_completed", count: 2 }],
          },
          rewards: { xp: 100, badgeKey: "quest-champion" },
          status: "ACTIVE",
        }),
    );

    // First practice session: progress 1/2.
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, practiceEvent(fixture.learnerMembershipId)),
    );

    const midway = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => listMyQuests(tx, learner),
    );
    expect(midway.data.items[0]?.progressStatus).toBe("in_progress");
    expect(midway.data.items[0]?.stepProgress[0]?.progress).toBe(1);

    // Second practice session completes the quest.
    const completingEvent = practiceEvent(fixture.learnerMembershipId);
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, completingEvent),
    );

    // Replay of the same event is safe.
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, completingEvent),
    );

    const done = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => listMyQuests(tx, learner),
    );
    expect(done.data.items[0]?.progressStatus).toBe("completed");
    expect(done.data.items[0]?.completedAt).not.toBeNull();

    // 2 practice sessions × 8 XP + 100 quest reward. Replay adds nothing.
    const profile = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => gamificationRepository.findProfileByMembership(tx, fixture.learnerMembershipId),
    );
    expect(profile?.xp_total).toBe(8 + 8 + 100);

    // Reward badge awarded exactly once.
    const awards = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
          select count(*)::int as count from badge_awards
          where badge_id = ${badge.data.id}::uuid
            and membership_id = ${fixture.learnerMembershipId}::uuid
        `,
    );
    expect(awards[0]?.count).toBe(1);

    // quest.completed outbox event emitted.
    const outboxRows = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ payload_json: unknown }>>`
          select payload_json from outbox_events
          where event_type = 'quest.completed'
          order by occurred_at desc limit 1
        `,
    );
    const payload = outboxRows[0]?.payload_json as { questKey?: string } | undefined;
    expect(payload?.questKey).toBe("practice-twice");

    // Admin analytics reflect the completion.
    const list = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listQuestsForAdmin(tx),
    );
    const adminQuest = list.data.items.find((item) => item.id === quest.data.id);
    expect(adminQuest?.startedCount).toBe(1);
    expect(adminQuest?.completedCount).toBe(1);
  });

  it("evaluates chain quests strictly in step order", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_chain_admin");
    const learner = learnerCtx(fixture, "req_chain_learner");

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      createQuest(tx, admin, {
        key: "chain-mission",
        name: "Chain Mission",
        questType: "chain",
        criteria: {
          steps: [
            { type: "complete_lessons", count: 1 },
            { type: "event_count", eventType: "practice.session_completed", count: 1 },
          ],
        },
        rewards: {},
        status: "ACTIVE",
      }),
    );

    // Practice first: step 2 must NOT progress while step 1 is incomplete.
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, practiceEvent(fixture.learnerMembershipId)),
    );

    const blocked = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => listMyQuests(tx, learner),
    );
    const blockedQuest = blocked.data.items.find((item) => item.key === "chain-mission");
    expect(blockedQuest?.stepProgress[1]?.progress ?? 0).toBe(0);
    expect(blockedQuest?.progressStatus).not.toBe("completed");
  });
});
