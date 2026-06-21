import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import { queryAnalyticsDashboard } from "@atlas/domain/analytics/analytics.service";
import { analyticsDashboardQuerySchema } from "@atlas/domain/analytics/analytics.dto";
import { processAnalyticsSourceEvent } from "@atlas/domain/analytics/analytics.worker";
import "../../apps/web/src/server/analytics/analytics-source-adapters";
import {
  authoringTenantTx,
  createCourseAuthoringFixture,
} from "../fixtures/course-authoring-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("analytics tenant isolation", () => {
  it("Tenant B cannot read Tenant A analytics_rollups", async () => {
    const tenantA = await createCourseAuthoringFixture();
    const isolation = await createTenantIsolationFixture();

    await withTenantTx(authoringTenantTx(tenantA), async (tx) => {
      await processAnalyticsSourceEvent(
        tx,
        {
          tenantId: tenantA.tenantId,
          actorMembershipId: tenantA.adminMembershipId,
          requestId: "req_analytics_iso_a",
        },
        {
          id: randomUUID(),
          eventType: "community.post.created",
          payload: {
            postId: randomUUID(),
            spaceId: randomUUID(),
            authorMembershipId: tenantA.learnerMembershipId,
            mentionMembershipIds: [],
          },
        },
      );
    });

    const tenantACount = await withTenantTx(
      authoringTenantTx(tenantA),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
        select count(*)::int as count from analytics_rollups
      `,
    );

    const tenantBCount = await withTenantTx(
      tenantCtx(isolation.tenantB),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
        select count(*)::int as count from analytics_rollups
      `,
    );

    expect(tenantACount[0]?.count ?? 0).toBeGreaterThan(0);
    expect(tenantBCount[0]?.count ?? 0).toBe(0);

    const tenantBResponse = await withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
      queryAnalyticsDashboard(
        tx,
        tenantCtx(isolation.tenantB, "req_analytics_iso_read"),
        analyticsDashboardQuerySchema.parse({ dashboardKey: "tenant.learning" }),
      ),
    );

    expect(tenantBResponse.data.summary.totalEvents).toBe(0);
  });
});
