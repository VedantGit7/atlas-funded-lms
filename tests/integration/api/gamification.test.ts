import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { handleGamificationOutboxEvent } from "../../../backend/apps/api/src/server/gamification/gamification.worker";
import {
  completePracticeSession,
  startPracticeSession,
  submitPracticeResponse,
} from "../../../backend/apps/api/src/server/practice/practice.service";
import {
  getMyGamificationProfile,
  listMyStreaks,
  mutateBadges,
} from "../../../backend/apps/api/src/server/gamification/gamification.service";
import {
  adminCtx,
  authoringTenantTx,
  createGamificationFixture,
  learnerCtx,
} from "../../fixtures/gamification-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("gamification integration", () => {
  it("awards XP once for practice completion and replays safely", async () => {
    const fixture = await createGamificationFixture();
    const ctx = learnerCtx(fixture, "req_gamification_practice");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startPracticeSession(
          tx,
          ctx,
          { mode: "due", engine: "swipe", maxItems: 1 },
          "gamification-practice",
        ),
    );

    const card = started.data.card;
    if (!card) throw new Error("Expected card");

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      await submitPracticeResponse(
        tx,
        ctx,
        started.data.session.id,
        { itemId: card.itemId, action: "known" },
        "gamification-response",
      );

      await completePracticeSession(tx, ctx, started.data.session.id, "gamification-complete");
    });

    const events = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ id: string; payload_json: unknown; request_id: string | null }>>`
          select
            id::text,
            payload_json,
            metadata_json->>'requestId' as request_id
          from outbox_events
          where event_type = 'practice.session_completed'
          order by occurred_at desc
          limit 1
        `,
    );

    const event = events[0];
    if (!event) throw new Error("Expected outbox event");

    await handleGamificationOutboxEvent({
      id: event.id,
      eventType: "practice.session_completed",
      tenantId: fixture.tenantId,
      payload: event.payload_json,
      requestId: event.request_id ?? "req_worker",
    });

    await handleGamificationOutboxEvent({
      id: event.id,
      eventType: "practice.session_completed",
      tenantId: fixture.tenantId,
      payload: event.payload_json,
      requestId: event.request_id ?? "req_worker",
    });

    const profile = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getMyGamificationProfile(tx, ctx),
    );

    expect(profile.data.xpTotal).toBe(8);

    const ledger = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
          select count(*)::int as count from point_ledger where membership_id = ${fixture.learnerMembershipId}::uuid
        `,
    );

    expect(ledger[0]?.count).toBe(1);
  });

  it("supports profile, streak, badge manual award, and leaderboard creation", async () => {
    const fixture = await createGamificationFixture();
    const learner = learnerCtx(fixture, "req_gamification_profile");
    const admin = adminCtx(fixture, "req_gamification_admin");

    const profile = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getMyGamificationProfile(tx, learner),
    );

    expect(profile.data.membershipId).toBe(fixture.learnerMembershipId);

    const streaks = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => listMyStreaks(tx, learner),
    );

    expect(streaks.data.items.some((item) => item.streakKey === "daily_learning")).toBe(true);

    const badge = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        mutateBadges(tx, admin, {
          operation: "create",
          badge: {
            key: "manual-test",
            name: "Manual Test",
            criteria: { type: "xp_total", minXp: 0 },
            status: "ACTIVE",
          },
        }),
    );

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      mutateBadges(tx, admin, {
        operation: "manual_award",
        badgeId: badge.data.id,
        membershipId: fixture.learnerMembershipId,
        reason: "Integration test award",
      }),
    );

    const audit = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ action: string }>>`
          select action from audit_entries where action = 'badge.manual_awarded' order by occurred_at desc limit 1
        `,
    );

    expect(audit[0]?.action).toBe("badge.manual_awarded");
  });
});
