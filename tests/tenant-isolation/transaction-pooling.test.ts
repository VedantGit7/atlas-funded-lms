import { describe, expect, it } from "vitest";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";
import { withTenantTx } from "@atlas/db";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("transaction-local tenant context", () => {
  it("does not leak tenant GUCs across rapid A/B transactions", async () => {
    const fixture = await createTenantIsolationFixture();

    const checks = Array.from({ length: 24 }, (_, index) => {
      const current = index % 2 === 0 ? fixture.tenantA : fixture.tenantB;

      return withTenantTx(tenantCtx(current), async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{
            tenant_id: string | null;
            visible_course_count: bigint;
          }>
        >`
          SELECT
            current_setting('app.tenant_id', true) AS tenant_id,
            COUNT(*)::bigint AS visible_course_count
          FROM courses
          WHERE slug IN (${fixture.tenantA.courseSlug}, ${fixture.tenantB.courseSlug})
        `;

        return {
          expectedTenantId: current.tenantId,
          actualTenantId: rows[0]?.tenant_id,
          visibleCourseCount: Number(rows[0]?.visible_course_count ?? 0),
        };
      });
    });

    const results = await Promise.all(checks);

    for (const result of results) {
      expect(result.actualTenantId).toBe(result.expectedTenantId);
      expect(result.visibleCourseCount).toBe(1);
    }
  });
});
