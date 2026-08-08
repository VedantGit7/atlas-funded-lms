import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  getGamificationMetrics,
  listBadgeAwardHistory,
  mutateBadges,
} from "../../../backend/apps/api/src/server/gamification/gamification.service";
import {
  adminCtx,
  authoringTenantTx,
  createGamificationFixture,
} from "../../fixtures/gamification-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("gamification admin surface", () => {
  it("lists award history and revokes awards with an audit trail", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_award_history");

    const badge = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        mutateBadges(tx, admin, {
          operation: "create",
          badge: {
            key: "history-test",
            name: "History Test",
            criteria: { type: "xp_total", minXp: 999999 },
            status: "ACTIVE",
          },
        }),
    );

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      mutateBadges(tx, admin, {
        operation: "manual_award",
        badgeId: badge.data.id,
        membershipId: fixture.learnerMembershipId,
        reason: "History test award",
      }),
    );

    const history = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listBadgeAwardHistory(tx, { limit: 10, badgeId: badge.data.id }),
    );

    expect(history.data.items).toHaveLength(1);
    expect(history.data.items[0]?.badgeKey).toBe("history-test");
    expect(history.data.items[0]?.membershipId).toBe(fixture.learnerMembershipId);
    expect(history.data.items[0]?.manual).toBe(true);
    expect(history.data.items[0]?.memberLabel).toBeTruthy();
    expect(history.data.nextCursor).toBeNull();

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      mutateBadges(tx, admin, {
        operation: "revoke_award",
        badgeId: badge.data.id,
        membershipId: fixture.learnerMembershipId,
        reason: "Awarded in error",
      }),
    );

    const afterRevoke = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listBadgeAwardHistory(tx, { limit: 10, badgeId: badge.data.id }),
    );

    expect(afterRevoke.data.items).toHaveLength(0);

    const audit = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ action: string; reason: string | null }>>`
          select action, metadata_json->>'reason' as reason
          from audit_entries
          where action = 'badge.award_revoked'
          order by occurred_at desc
          limit 1
        `,
    );

    expect(audit[0]?.action).toBe("badge.award_revoked");
    expect(audit[0]?.reason).toBe("Awarded in error");

    // Revoking again fails: award no longer exists.
    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        mutateBadges(tx, admin, {
          operation: "revoke_award",
          badgeId: badge.data.id,
          membershipId: fixture.learnerMembershipId,
          reason: "Double revoke",
        }),
      ),
    ).rejects.toThrow(/award not found/i);
  });

  it("bulk awards badges to multiple memberships", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_bulk_award");

    const badge = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        mutateBadges(tx, admin, {
          operation: "create",
          badge: {
            key: "bulk-test",
            name: "Bulk Test",
            criteria: { type: "xp_total", minXp: 999999 },
            status: "ACTIVE",
          },
        }),
    );

    const result = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        mutateBadges(tx, admin, {
          operation: "manual_award_bulk",
          badgeId: badge.data.id,
          membershipIds: [fixture.learnerMembershipId, fixture.adminMembershipId],
          reason: "Bulk cohort award",
        }),
    );

    expect(result.data.awarded).toContain(fixture.learnerMembershipId);
    expect(result.data.awarded).toContain(fixture.adminMembershipId);
    expect(result.data.skipped).toEqual([]);
    expect(result.data.failures).toEqual([]);

    const repeat = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        mutateBadges(tx, admin, {
          operation: "manual_award_bulk",
          badgeId: badge.data.id,
          membershipIds: [fixture.learnerMembershipId],
          reason: "Bulk cohort award retry",
        }),
    );

    expect(repeat.data.awarded).toEqual([]);
    expect(repeat.data.skipped).toEqual([fixture.learnerMembershipId]);
  });

  it("reports live gamification metrics", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_metrics");

    const badge = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        mutateBadges(tx, admin, {
          operation: "create",
          badge: {
            key: "metrics-test",
            name: "Metrics Test",
            criteria: { type: "xp_total", minXp: 999999 },
            status: "ACTIVE",
          },
        }),
    );

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      mutateBadges(tx, admin, {
        operation: "manual_award",
        badgeId: badge.data.id,
        membershipId: fixture.learnerMembershipId,
        reason: "Metrics test award",
      }),
    );

    const metrics = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => getGamificationMetrics(tx),
    );

    expect(metrics.data.badges.total).toBe(1);
    expect(metrics.data.badges.active).toBe(1);
    expect(metrics.data.awardsThisWeek).toBe(1);
    expect(metrics.data.leaderboards.total).toBe(0);
    expect(metrics.data.activeStreaks).toBe(0);
  });
});
