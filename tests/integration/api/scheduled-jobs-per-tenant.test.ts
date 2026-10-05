import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  createFxRateLoader,
  refreshFxRatesForTenantIfStale,
} from "@atlas/domain-config/services/fx.service";
import { expireDueCertificatesForTenant } from "../../../backend/apps/api/src/server/certificates/certificate-expiry.service";
import {
  authoringTenantTx,
  createCourseAuthoringFixture,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

/**
 * Audit M5: certificate expiry and FX refresh ran as daily crons that walked
 * every tenant inside one HTTP request. They are now per-tenant worker tasks;
 * these check their per-tenant behaviour against Postgres.
 */
const suite =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

suite("scheduled jobs run per tenant (audit M5)", () => {
  let tenantA: CourseAuthoringFixture;
  let tenantB: CourseAuthoringFixture;
  const asTenant = <T>(
    fixture: CourseAuthoringFixture,
    fn: Parameters<typeof withTenantTx<T>>[1],
  ) => withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), fn);

  beforeAll(async () => {
    [tenantA, tenantB] = await Promise.all([
      createCourseAuthoringFixture(),
      createCourseAuthoringFixture(),
    ]);
  });

  it("expires only this tenant's due certificates, and is idempotent", async () => {
    const insert = (fixture: CourseAuthoringFixture, expiresAt: string) =>
      asTenant(fixture, async (tx) => {
        const id = randomUUID();
        await tx.$executeRaw`
          insert into certificates (id, tenant_id, template_id, membership_id, credential_id, status, expires_at, updated_at)
          values (${id}::uuid, ${fixture.tenantId}::uuid, ${randomUUID()}::uuid,
                  ${fixture.learnerMembershipId}::uuid, ${`m5-${id}`}, 'issued', ${expiresAt}::timestamptz, now())
        `;
        return id;
      });
    const status = (fixture: CourseAuthoringFixture, id: string) =>
      asTenant(fixture, async (tx) => {
        const rows = await tx.$queryRaw<Array<{ status: string }>>`
          select status from certificates where id = ${id}::uuid
        `;
        return rows[0]?.status;
      });

    const dueA = await insert(tenantA, "2000-01-01T00:00:00Z");
    const futureA = await insert(tenantA, "2999-01-01T00:00:00Z");
    const dueB = await insert(tenantB, "2000-01-01T00:00:00Z");

    expect(
      await expireDueCertificatesForTenant({ tenantId: tenantA.tenantId, requestId: "m5-a" }),
    ).toBe(1);
    expect(await status(tenantA, dueA)).toBe("expired");
    expect(await status(tenantA, futureA)).toBe("issued");
    expect(await status(tenantB, dueB)).toBe("issued");

    expect(
      await expireDueCertificatesForTenant({ tenantId: tenantA.tenantId, requestId: "m5-a2" }),
    ).toBe(0);
  });

  it("refreshes FX at most once per UTC day per tenant, with one fetch for all of them", async () => {
    const fetchRates = vi.fn(async () => ({
      asOf: "2026-10-02",
      rates: { USD: 1, INR: 83.2, EUR: 0.92 },
    }));
    const loadRates = createFxRateLoader(fetchRates);
    const refresh = (fixture: CourseAuthoringFixture, now?: Date) =>
      refreshFxRatesForTenantIfStale({
        tenantId: fixture.tenantId,
        requestId: `m5-fx-${fixture.slug}`,
        loadRates,
        ...(now ? { now } : {}),
      });

    expect(await refresh(tenantA)).toBe(1);
    expect(await refresh(tenantB)).toBe(1);
    expect(fetchRates).toHaveBeenCalledOnce();

    // Fetched today: nothing to do, even though the provider's as-of date is
    // older (no ECB rates at weekends).
    expect(await refresh(tenantA)).toBe(0);

    const rates = await asTenant(
      tenantA,
      (tx) =>
        tx.$queryRaw<Array<{ quote_currency: string }>>`
        select quote_currency from fx_rates where tenant_id = ${tenantA.tenantId}::uuid
      `,
    );
    expect(rates.map((row) => row.quote_currency).sort()).toEqual(["EUR", "INR", "USD"]);

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(await refresh(tenantA, tomorrow)).toBe(1);
  });
});
