import { beforeAll, describe, expect, it } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type TenantIsolationFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Named statements keep their plans per connection
 * (backend/packages/db/src/statement-names.ts). Row-level security must hold
 * once PostgreSQL reuses a plan: the policies read the tenant from
 * current_setting() when a statement runs, so one cached plan serves every
 * tenant correctly. These run on the application's own client and
 * withTenantTx, against PostgreSQL.
 */
const suite =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

suite("statement plan reuse under row-level security", () => {
  let fixture: TenantIsolationFixture;

  beforeAll(async () => {
    fixture = await createTenantIsolationFixture();
  });

  const switchTenant = (tx: TenantTx, tenantId: string) =>
    tx.$executeRaw`select set_config('app.tenant_id', ${tenantId}, true)`;
  // Both tenants' courses are asked for every time; RLS must return only the
  // current tenant's.
  const visibleCourses = (tx: TenantTx) =>
    tx.$queryRaw<Array<{ id: string }>>`
      select id::text from courses
      where id = any(${[fixture.tenantA.courseId, fixture.tenantB.courseId]}::uuid[])
      order by id
    `;
  const preparedCourseStatements = (tx: TenantTx) =>
    tx.$queryRaw<Array<{ name: string; generic_plans: bigint; custom_plans: bigint }>>`
      select name, generic_plans, custom_plans
      from pg_prepared_statements
      where statement like '%from courses%where id = any%'
        and statement not like '%pg_prepared_statements%'
    `;

  it("keeps each tenant's rows apart across custom and generic plans of one statement", async () => {
    const seen = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      const answers: Array<{ tenant: "A" | "B"; ids: string[] }> = [];
      // Twelve runs on one connection: unnamed at first, then named, planned
      // per run for five runs, then a generic plan when it is no worse.
      for (let run = 0; run < 12; run += 1) {
        const tenant = run % 2 === 0 ? fixture.tenantA : fixture.tenantB;
        await switchTenant(tx, tenant.tenantId);
        const rows = await visibleCourses(tx);
        answers.push({ tenant: run % 2 === 0 ? "A" : "B", ids: rows.map((row) => row.id) });
      }
      return { answers, prepared: await preparedCourseStatements(tx) };
    });

    for (const { tenant, ids } of seen.answers)
      expect(ids, `tenant ${tenant}`).toEqual([
        tenant === "A" ? fixture.tenantA.courseId : fixture.tenantB.courseId,
      ]);

    // The statement was named and kept on this connection, and PostgreSQL
    // switched to one generic plan for every tenant.
    expect(seen.prepared).toHaveLength(1);
    const [statement] = seen.prepared;
    expect(statement?.name).toMatch(/^atlas_[0-9a-f]{24}$/);
    expect(Number(statement?.generic_plans)).toBeGreaterThan(0);
  });

  it("refuses a tenant's rows to another tenant's transaction after the plan is cached", async () => {
    // A fresh transaction for B on whichever connection the pool hands out,
    // with the statement already named in this process.
    const asB = await withTenantTx(tenantCtx(fixture.tenantB), visibleCourses);
    expect(asB.map((row) => row.id)).toEqual([fixture.tenantB.courseId]);
    const asA = await withTenantTx(tenantCtx(fixture.tenantA), visibleCourses);
    expect(asA.map((row) => row.id)).toEqual([fixture.tenantA.courseId]);
  });
});
