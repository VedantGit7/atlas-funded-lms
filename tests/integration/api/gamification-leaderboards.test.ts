import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  createLeaderboard,
  getLeaderboardDetail,
  processGamificationSourceEvent,
  refreshActiveLeaderboardSnapshots,
} from "../../../backend/apps/api/src/server/gamification/gamification.service";
import { gamificationRepository } from "../../../backend/apps/api/src/server/gamification/gamification.repository";
import {
  adminCtx,
  authoringTenantTx,
  createGamificationFixture,
  learnerCtx,
  type GamificationFixture,
} from "../../fixtures/gamification-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function seedProfile(
  fixture: GamificationFixture,
  membershipId: string,
  xpTotal: number,
): Promise<void> {
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      insert into gamification_profiles (
        id, tenant_id, membership_id, xp_total, level_key, created_at, updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${fixture.tenantId}::uuid,
        ${membershipId}::uuid,
        ${xpTotal},
        'level_1',
        now(),
        now()
      )
      on conflict (tenant_id, membership_id) do update set
        xp_total = excluded.xp_total,
        updated_at = now()
    `;
  });
}

async function seedLedgerRow(
  fixture: GamificationFixture,
  args: { membershipId: string; points: number; daysAgo: number; eventType?: string },
): Promise<void> {
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    const metadataJson = args.eventType ? JSON.stringify({ eventType: args.eventType }) : null;
    await tx.$executeRaw`
      insert into point_ledger (
        id, tenant_id, membership_id, points, reason_key, source_event_id,
        idempotency_key, metadata_json, occurred_at
      )
      values (
        ${randomUUID()}::uuid,
        ${fixture.tenantId}::uuid,
        ${args.membershipId}::uuid,
        ${args.points},
        'test-seed',
        null,
        ${`test:${randomUUID()}`},
        ${metadataJson}::jsonb,
        now() - make_interval(days => ${args.daysAgo})
      )
    `;
  });
}

describeWithDb("gamification leaderboard windows", () => {
  it("ranks weekly boards by current-period points and all-time boards by profile XP", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_lb_admin");
    const learner = learnerCtx(fixture, "req_lb_learner");

    // Learner accumulated most XP long ago; instructor earned more this week.
    await seedProfile(fixture, fixture.learnerMembershipId, 1010);
    await seedProfile(fixture, fixture.instructorMembershipId, 50);
    await seedLedgerRow(fixture, {
      membershipId: fixture.learnerMembershipId,
      points: 1000,
      daysAgo: 60,
    });
    await seedLedgerRow(fixture, {
      membershipId: fixture.learnerMembershipId,
      points: 10,
      daysAgo: 0,
    });
    await seedLedgerRow(fixture, {
      membershipId: fixture.instructorMembershipId,
      points: 50,
      daysAgo: 0,
    });

    const weekly = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        createLeaderboard(tx, admin, {
          operation: "create",
          leaderboard: {
            key: "weekly-xp",
            name: "Weekly XP",
            metricKey: "xp_total",
            windowKey: "weekly",
            config: { scopeType: "tenant", privacyMode: "anonymous_rank", maxEntries: 10 },
            status: "ACTIVE",
          },
        }),
    );

    const allTime = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        createLeaderboard(tx, admin, {
          operation: "create",
          leaderboard: {
            key: "all-time-xp",
            name: "All-Time XP",
            metricKey: "xp_total",
            windowKey: "all_time",
            config: { scopeType: "tenant", privacyMode: "anonymous_rank", maxEntries: 10 },
            status: "ACTIVE",
          },
        }),
    );

    // Refresh snapshots from the learner's perspective so callerRank reflects the learner.
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      refreshActiveLeaderboardSnapshots(tx, learner, fixture.learnerMembershipId),
    );

    const weeklyDetail = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getLeaderboardDetail(tx, learner, weekly.data.id),
    );

    // This week the instructor (50) outranks the learner (10) despite lower lifetime XP.
    expect(weeklyDetail.data.periodKey).toMatch(/^\d{4}-W\d{2}$/);
    expect(weeklyDetail.data.entries[0]?.metricValue).toBe(50);
    expect(weeklyDetail.data.callerRank).toBe(2);
    expect(weeklyDetail.data.callerMetricValue).toBe(10);

    const allTimeDetail = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getLeaderboardDetail(tx, learner, allTime.data.id),
    );

    expect(allTimeDetail.data.periodKey).toBe("all_time");
    expect(allTimeDetail.data.callerRank).toBe(1);
    expect(allTimeDetail.data.callerMetricValue).toBe(1010);
  });

  it("restricts course-scoped boards to enrolled members", async () => {
    const fixture = await createGamificationFixture();
    const admin = adminCtx(fixture, "req_lb_course_admin");
    const learner = learnerCtx(fixture, "req_lb_course_learner");

    await seedProfile(fixture, fixture.learnerMembershipId, 500);
    await seedProfile(fixture, fixture.instructorMembershipId, 900);
    await seedLedgerRow(fixture, {
      membershipId: fixture.learnerMembershipId,
      points: 500,
      daysAgo: 0,
    });
    await seedLedgerRow(fixture, {
      membershipId: fixture.instructorMembershipId,
      points: 900,
      daysAgo: 0,
    });

    // Only the learner is enrolled in the course.
    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await tx.$executeRaw`
        insert into enrollments (id, tenant_id, course_id, membership_id, status, enrolled_at)
        values (
          ${randomUUID()}::uuid,
          ${fixture.tenantId}::uuid,
          ${fixture.draftCourseId}::uuid,
          ${fixture.learnerMembershipId}::uuid,
          'active',
          now()
        )
        on conflict (tenant_id, course_id, membership_id) do nothing
      `;
    });

    const courseBoard = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        createLeaderboard(tx, admin, {
          operation: "create",
          leaderboard: {
            key: "course-weekly-xp",
            name: "Course Weekly XP",
            metricKey: "xp_total",
            windowKey: "weekly",
            config: {
              scopeType: "course",
              courseId: fixture.draftCourseId,
              privacyMode: "anonymous_rank",
              maxEntries: 10,
            },
            status: "ACTIVE",
          },
        }),
    );

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      refreshActiveLeaderboardSnapshots(tx, learner, fixture.learnerMembershipId),
    );

    const detail = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getLeaderboardDetail(tx, learner, courseBoard.data.id),
    );

    // The instructor's larger score is excluded because they are not enrolled.
    expect(detail.data.entries).toHaveLength(1);
    expect(detail.data.entries[0]?.metricValue).toBe(500);
    expect(detail.data.callerRank).toBe(1);
  });

  it("counts event_count badge criteria via structured metadata with legacy fallback", async () => {
    const fixture = await createGamificationFixture();

    // Structured row: reason_key does NOT start with the event type.
    await seedLedgerRow(fixture, {
      membershipId: fixture.learnerMembershipId,
      points: 5,
      daysAgo: 0,
      eventType: "practice.session_completed",
    });
    // Legacy row (no metadata): falls back to reason_key prefix; 'test-seed' should not match.
    await seedLedgerRow(fixture, {
      membershipId: fixture.learnerMembershipId,
      points: 5,
      daysAgo: 0,
    });

    const count = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        gamificationRepository.countLedgerByEventType(tx, {
          membershipId: fixture.learnerMembershipId,
          eventType: "practice.session_completed",
        }),
    );

    expect(count).toBe(1);
  });

  it("emits gamification.level_up when XP accrual crosses a level threshold", async () => {
    const fixture = await createGamificationFixture();
    const learner = learnerCtx(fixture, "req_level_up");

    // 95 XP + 8 XP for practice.session_completed crosses the level_2 threshold (100).
    await seedProfile(fixture, fixture.learnerMembershipId, 95);

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, {
        id: randomUUID(),
        eventType: "practice.session_completed",
        payload: {
          practiceSessionId: randomUUID(),
          membershipId: fixture.learnerMembershipId,
          collectionId: null,
          sessionType: "due",
        },
      }),
    );

    const rows = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ payload_json: unknown }>>`
          select payload_json
          from outbox_events
          where event_type = 'gamification.level_up'
          order by occurred_at desc
          limit 1
        `,
    );

    const payload = rows[0]?.payload_json as
      | { membershipId: string; previousLevelKey: string; levelKey: string; xpTotal: number }
      | undefined;

    expect(payload).toBeDefined();
    expect(payload?.membershipId).toBe(fixture.learnerMembershipId);
    expect(payload?.previousLevelKey).toBe("level_1");
    expect(payload?.levelKey).toBe("level_2");
    expect(payload?.xpTotal).toBe(103);
  });
});
