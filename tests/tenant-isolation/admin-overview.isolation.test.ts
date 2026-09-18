import { withTenantTx } from "@atlas/db";
import { describe, expect, it } from "vitest";
import { getAdminOverview } from "../../backend/apps/api/src/server/admin/admin-overview.service";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

/**
 * Real tenant isolation for the `admin` domain.
 *
 * The release-readiness registry maps each domain to an isolation test and
 * fails when a route with a resource loader has none. For `admin` it pointed at
 * `admin-shell.test.ts` — a check that read `TenantAdminShellClient.tsx` and
 * asserted aria-labels and file existence. It could not have detected a
 * cross-tenant read on `admin/overview`, and would have passed on a build where
 * the overview returned every tenant's numbers.
 *
 * That only surfaced when 3.6 moved the structural checks to
 * `tests/lint-rules/`, at which point the registry correctly reported the admin
 * domain as uncovered. This is the coverage it was supposed to have.
 *
 * `getAdminOverview` takes the tenant from `ctx` and runs inside
 * `withTenantTx`, so it is exercised through the real transaction with RLS
 * applied rather than a mocked `tx`.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("admin overview tenant isolation", () => {
  it("scopes every counter to the requesting tenant", async () => {
    const fixture = await createTenantIsolationFixture();

    const [overviewA, overviewB] = await Promise.all([
      withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
        getAdminOverview(tx, { tenantId: fixture.tenantA.tenantId }),
      ),
      withTenantTx(tenantCtx(fixture.tenantB), async (tx) =>
        getAdminOverview(tx, { tenantId: fixture.tenantB.tenantId }),
      ),
    ]);

    // The fixture provisions two tenants with one member each. That makes the
    // member count the discriminating signal: correctly scoped it is 1, and a
    // query that reached across tenants — or dropped the tenant predicate
    // entirely — would report 2 or more.
    for (const [label, overview] of [
      ["tenantA", overviewA],
      ["tenantB", overviewB],
    ] as const) {
      expect(overview.data.kpis.learnerCount, `${label} learnerCount`).toBe(1);
      expect(overview.data.kpis.enrollmentCount, `${label} enrollmentCount`).toBe(0);
      expect(overview.data.kpis.productCount, `${label} productCount`).toBe(0);
      expect(overview.data.kpis.enrollmentValueCents, `${label} enrollmentValueCents`).toBe(0);
    }
  });

  it("does not leak another tenant's identifiers in the payload", async () => {
    const fixture = await createTenantIsolationFixture();

    const overview = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      getAdminOverview(tx, { tenantId: fixture.tenantA.tenantId }),
    );

    const serialized = JSON.stringify(overview);
    expect(serialized).not.toContain(fixture.tenantB.tenantId);
    expect(serialized).not.toContain(fixture.tenantB.slug);
  });

  it("reads the tenant from context, not from a caller-supplied value", async () => {
    const fixture = await createTenantIsolationFixture();

    // Ask tenant A's transaction for tenant B's overview. RLS scopes the rows
    // to the transaction's tenant, so this must not return tenant B's data —
    // the C5 scenario applied to this surface.
    const overview = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      getAdminOverview(tx, { tenantId: fixture.tenantB.tenantId }),
    );

    const serialized = JSON.stringify(overview);
    expect(serialized).not.toContain(fixture.tenantB.slug);
  });
});
