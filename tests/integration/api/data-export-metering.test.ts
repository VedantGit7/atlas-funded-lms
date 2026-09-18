import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { readEntitlementUsage } from "@atlas/domain-config";
import { createExportJob, listExportJobs } from "@atlas/domain/data-rights/data-rights.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Data exports charged against the plan (audit finding M11).
 *
 * `data.export.enable` is gated in the service rather than in route metadata,
 * so the route wrapper's metering never reached it — exports could be switched
 * on or off but never limited. This is the case the plan's definition of done
 * names and the entitlement schema uses as its own example.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const KEY = "data.export.enable";

async function seedEntitlement(tenantId: string, value: unknown): Promise<void> {
  await withTenantTx(
    { tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
    async (tx) => {
      await tx.$executeRaw`
        INSERT INTO entitlements (id, tenant_id, key, value_json, source, starts_at, updated_at)
        VALUES (
          ${randomUUID()}::uuid, ${tenantId}::uuid, ${KEY},
          ${JSON.stringify(value)}::jsonb, 'platform', now() - interval '1 hour', now()
        )
      `;
    },
  );
}

function serviceCtx(tenant: IsolationTenantFixture) {
  return {
    tenantId: tenant.tenantId,
    requestId: randomUUID(),
    actorMembershipId: tenant.membershipId,
  };
}

function requestExport(tenant: IsolationTenantFixture) {
  return withTenantTx(tenantCtx(tenant), async (tx) =>
    createExportJob(tx, serviceCtx(tenant) as never),
  );
}

function listExports(tenant: IsolationTenantFixture) {
  return withTenantTx(tenantCtx(tenant), async (tx) =>
    listExportJobs(tx, serviceCtx(tenant) as never, {}),
  );
}

function usage(tenant: IsolationTenantFixture) {
  return withTenantTx(tenantCtx(tenant), async (tx) =>
    readEntitlementUsage(tx, { entitlementKey: KEY, period: "month" }),
  );
}

describeWithDb("data export metering", () => {
  it("charges one unit per export requested", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: true, limit: null, period: "month" });

    await requestExport(tenantA);
    await requestExport(tenantA);

    expect((await usage(tenantA))?.used).toBe(2);
  });

  it("does not charge for listing exports", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: true, limit: null, period: "month" });

    await listExports(tenantA);
    await listExports(tenantA);

    // Reading back an export a tenant already paid for must not bill them
    // again — the gate runs on reads, the meter must not.
    expect(await usage(tenantA)).toBeNull();
  });

  it("refuses the export that would cross the limit", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: true, limit: 2, period: "month" });

    await requestExport(tenantA);
    await requestExport(tenantA);

    await expect(requestExport(tenantA)).rejects.toMatchObject({
      code: "ENTITLEMENT_LIMIT_EXCEEDED",
      status: 402,
    });
  });

  it("reports an exhausted allowance as a limit, not as a missing entitlement", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: true, limit: 1, period: "month" });
    await requestExport(tenantA);

    // ensureExportEntitlement converts every failure it sees into
    // ENTITLEMENT_REQUIRED. Routing the meter through it would tell a paying
    // tenant their plan does not include exports when it does and they have
    // simply used them all.
    await expect(requestExport(tenantA)).rejects.toMatchObject({
      code: "ENTITLEMENT_LIMIT_EXCEEDED",
    });
  });

  it("leaves no export job behind when the limit refuses the request", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: true, limit: 1, period: "month" });
    await requestExport(tenantA);

    await expect(requestExport(tenantA)).rejects.toThrow();

    // Charging after the insert would leave a queued export the tenant was
    // never allowed to request.
    const listed = await listExports(tenantA);
    expect(listed.data.items).toHaveLength(1);
  });

  it("does not advance the counter on the refused request", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: true, limit: 1, period: "month" });
    await requestExport(tenantA);
    await expect(requestExport(tenantA)).rejects.toThrow();

    expect((await usage(tenantA))?.used).toBe(1);
  });

  it("still denies outright when exports are switched off", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: false, limit: 10, period: "month" });

    await expect(requestExport(tenantA)).rejects.toMatchObject({
      code: "ENTITLEMENT_REQUIRED",
    });
    expect(await usage(tenantA)).toBeNull();
  });

  it("keeps a bare boolean entitlement unmetered but counted", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // Every entitlement seeded in this system today is a bare `true`.
    await seedEntitlement(tenantA.tenantId, true);

    await requestExport(tenantA);

    const record = await usage(tenantA);
    expect(record?.used).toBe(1);
    expect(record?.limit).toBeNull();
  });

  it("meters each tenant against its own allowance", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    for (const tenant of [tenantA, tenantB]) {
      await seedEntitlement(tenant.tenantId, { enabled: true, limit: 1, period: "month" });
    }

    await requestExport(tenantA);
    // Tenant A is exhausted; tenant B must still have its own export.
    await requestExport(tenantB);

    expect((await usage(tenantA))?.used).toBe(1);
    expect((await usage(tenantB))?.used).toBe(1);
  });
});
