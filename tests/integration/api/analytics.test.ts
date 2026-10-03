import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import { processOutboxBatch } from "@atlas/events/services/outbox-worker.service";
import {
  queryAnalyticsDashboard,
  queryAnalyticsFunnel,
} from "@atlas/domain/analytics/analytics.service";
import {
  analyticsDashboardQuerySchema,
  analyticsFunnelQuerySchema,
} from "@atlas/domain/analytics/analytics.dto";
import { processAnalyticsSourceEvent } from "@atlas/domain/analytics/analytics.worker";
import { createAnalyticsOutboxConsumers } from "../../../backend/apps/api/src/events/outbox-consumers";
import "../../../backend/apps/api/src/server/analytics/analytics-source-adapters";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("analytics API integration", () => {
  it("processes lesson.completed into analytics_rollups", async () => {
    const fixture = await createCourseAuthoringFixture();
    const courseId = fixture.draftCourseId;

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await processAnalyticsSourceEvent(
        tx,
        {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: "req_analytics_worker",
        },
        {
          id: randomUUID(),
          eventType: "lesson.completed",
          payload: {
            lessonId: randomUUID(),
            courseId,
            moduleId: randomUUID(),
            membershipId: fixture.learnerMembershipId,
            enrollmentId: randomUUID(),
            completedAt: new Date().toISOString(),
          },
        },
      );
    });

    const rows = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ count_value: number }>>`
        select (metrics_json->>'count')::int as count_value
        from analytics_rollups
        where tenant_id = ${fixture.tenantId}::uuid
          and rollup_key = 'lessons_completed'
          and subject_type = 'course'
          and subject_id = ${courseId}
      `,
    );

    expect(rows[0]?.count_value).toBe(1);
  });

  it("skips duplicate outbox delivery for analytics worker destination", async () => {
    const fixture = await createCourseAuthoringFixture();
    const outboxEventId = randomUUID();
    const requestId = "req_analytics_idempotent";

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await tx.$executeRaw`
        insert into outbox_events (
          id,
          tenant_id,
          event_type,
          aggregate_type,
          aggregate_id,
          payload_json,
          metadata_json,
          occurred_at,
          available_at
        )
        values (
          ${outboxEventId}::uuid,
          ${fixture.tenantId}::uuid,
          'lesson.completed',
          'lesson',
          ${randomUUID()}::uuid,
          ${JSON.stringify({
            lessonId: randomUUID(),
            courseId: fixture.draftCourseId,
            moduleId: randomUUID(),
            membershipId: fixture.learnerMembershipId,
            enrollmentId: randomUUID(),
            completedAt: new Date().toISOString(),
          })}::jsonb,
          ${JSON.stringify({ requestId })}::jsonb,
          now(),
          now()
        )
      `;
    });

    const db = {
      transaction: <T>(fn: Parameters<typeof withTenantTx<T>>[1]) =>
        withTenantTx(authoringTenantTx(fixture), fn),
    };

    const first = await processOutboxBatch(db, {
      limit: 10,
      maxRetries: 3,
      handlers: createAnalyticsOutboxConsumers(),
    });
    const second = await processOutboxBatch(db, {
      limit: 10,
      maxRetries: 3,
      handlers: createAnalyticsOutboxConsumers(),
    });

    expect(first.delivered).toBeGreaterThan(0);

    // The second pass must not deliver again. `skipped` used to be the signal,
    // but that counter only increments for events the poll hands back and the
    // in-loop delivery check then rejects. Since pollOutboxEventsForProcessing
    // started excluding already-delivered (event, destination) pairs in SQL —
    // the fix for the outbox head-of-line block — a duplicate never reaches the
    // loop, so it is now correctly counted as nothing at all.
    expect(second.processed).toBe(0);
    expect(second.delivered).toBe(0);
    expect(second.failed).toBe(0);

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      const deliveries = await tx.$queryRaw<Array<{ count: number }>>`
        select count(*)::int as count
        from event_deliveries
        where outbox_event_id = ${outboxEventId}::uuid
          -- The worker's SUCCEEDED maps onto the shared DispatchStatus enum,
          -- which spells a successful delivery SENT.
          and status = 'SENT'
      `;
      expect(deliveries[0]?.count).toBe(1);
    });
  });

  it("GET dashboards returns safe DTO from projection tables only", async () => {
    const fixture = await createCourseAuthoringFixture();
    const admin = adminCtx(fixture, "req_analytics_dashboard");

    const response = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      queryAnalyticsDashboard(
        tx,
        {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: admin.requestId,
        },
        analyticsDashboardQuerySchema.parse({ dashboardKey: "tenant.learning" }),
      ),
    );

    expect(response.data.dashboardKey).toBe("tenant.learning");
    expect(JSON.stringify(response)).not.toContain("metrics_json");
    expect(JSON.stringify(response)).not.toContain("tenant_id");
  });

  it("GET funnel reads funnel_daily_rollups only", async () => {
    const fixture = await createCourseAuthoringFixture();

    const response = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      queryAnalyticsFunnel(
        tx,
        {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: "req_analytics_funnel",
        },
        analyticsFunnelQuerySchema.parse({ funnelKey: "learning.engagement" }),
      ),
    );

    expect(response.data.funnelKey).toBe("learning.engagement");
    expect(Array.isArray(response.data.days)).toBe(true);
  });
});
