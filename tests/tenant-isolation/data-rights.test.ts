import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import {
  createDeletionRequest,
  createExportJob,
  getExportJob,
  processDeletionRequest,
} from "@atlas/domain/data-rights/data-rights.service";
import { processExportRequestedEvent } from "@atlas/domain/data-rights/data-rights.worker";
import { dataExportRequestedPayloadSchema } from "@atlas/domain/data-rights/data-rights.events";
import {
  createTenantIsolationFixture,
  tenantCtx,
} from "../tenant-isolation/tenant-isolation-fixture";
import {
  authoringTenantTx,
  createCourseAuthoringFixture,
  seedDataExportEntitlement,
} from "../fixtures/data-rights-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function seedExportEntitlementForTenant(tenantId: string, membershipId: string) {
  await withTenantTx(
    { tenantId, actorMembershipId: membershipId, requestId: randomUUID() },
    async (tx) => {
      await tx.$executeRaw`
      insert into entitlements (
        id,
        tenant_id,
        key,
        value_json,
        source,
        starts_at,
        expires_at,
        created_at,
        updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${tenantId}::uuid,
        'data.export.enable',
        'true'::jsonb,
        'test-fixture',
        now(),
        null,
        now(),
        now()
      )
      on conflict (tenant_id, key) do update set
        value_json = excluded.value_json,
        updated_at = now()
    `;
    },
  );
}

describeWithDb("data-rights tenant isolation", () => {
  it("tenant A cannot read tenant B export job by id", async () => {
    const fixture = await createCourseAuthoringFixture();
    await seedDataExportEntitlement(fixture);

    const created = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        createExportJob(tx, {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: "req_iso_export_create",
          idempotencyKey: "iso-export-1",
        }),
    );

    const isolation = await createTenantIsolationFixture();
    await seedExportEntitlementForTenant(
      isolation.tenantB.tenantId,
      isolation.tenantB.membershipId,
    );

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        getExportJob(
          tx,
          {
            tenantId: isolation.tenantB.tenantId,
            actorMembershipId: isolation.tenantB.membershipId,
            requestId: "req_iso_export_cross",
          },
          created.data.id,
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("tenant A sees only tenant A export jobs", async () => {
    const fixture = await createCourseAuthoringFixture();
    await seedDataExportEntitlement(fixture);

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await createExportJob(tx, {
        tenantId: fixture.tenantId,
        actorMembershipId: fixture.adminMembershipId,
        requestId: "req_iso_export_a",
        idempotencyKey: "iso-export-a",
      });
    });

    const rows = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ tenant_id: string }>>`select tenant_id::text from export_jobs`,
    );

    expect(rows.every((row) => row.tenant_id === fixture.tenantId)).toBe(true);
  });

  it("tenant A cannot process tenant B deletion request id", async () => {
    const fixture = await createCourseAuthoringFixture();

    const created = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        createDeletionRequest(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.learnerMembershipId,
            requestId: "req_iso_del_create",
            idempotencyKey: "iso-del-1",
          },
          { confirm: true },
        ),
    );

    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        processDeletionRequest(
          tx,
          {
            tenantId: isolation.tenantB.tenantId,
            actorMembershipId: isolation.tenantB.membershipId,
            requestId: "req_iso_del_process",
            idempotencyKey: "iso-del-process",
          },
          created.data.id,
          { confirm: true },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("worker tenant context does not leak across sequential tenant events", async () => {
    const fixtureA = await createCourseAuthoringFixture();
    const fixtureB = await createCourseAuthoringFixture();
    await seedDataExportEntitlement(fixtureA);
    await seedDataExportEntitlement(fixtureB);

    process.env.STORAGE_PROVIDER = "local-mock";
    process.env.R2_BUCKET_NAME = "test-bucket";
    process.env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS = "300";
    process.env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS = "300";

    const jobA = await withTenantTx(
      authoringTenantTx(fixtureA, fixtureA.adminMembershipId),
      async (tx) =>
        createExportJob(tx, {
          tenantId: fixtureA.tenantId,
          actorMembershipId: fixtureA.adminMembershipId,
          requestId: "req_iso_worker_a",
          idempotencyKey: "iso-worker-a",
        }),
    );

    const jobB = await withTenantTx(
      authoringTenantTx(fixtureB, fixtureB.adminMembershipId),
      async (tx) =>
        createExportJob(tx, {
          tenantId: fixtureB.tenantId,
          actorMembershipId: fixtureB.adminMembershipId,
          requestId: "req_iso_worker_b",
          idempotencyKey: "iso-worker-b",
        }),
    );

    await processExportRequestedEvent(
      {
        tenantId: fixtureA.tenantId,
        actorMembershipId: fixtureA.adminMembershipId,
        requestId: "req_iso_worker_a",
      },
      {
        id: randomUUID(),
        eventType: "data.export_requested",
        payload: dataExportRequestedPayloadSchema.parse({
          exportJobId: jobA.data.id,
          requestedAt: new Date().toISOString(),
          requestedByMembershipId: fixtureA.adminMembershipId,
          schemaVersion: 1,
        }),
      },
    );

    await processExportRequestedEvent(
      {
        tenantId: fixtureB.tenantId,
        actorMembershipId: fixtureB.adminMembershipId,
        requestId: "req_iso_worker_b",
      },
      {
        id: randomUUID(),
        eventType: "data.export_requested",
        payload: dataExportRequestedPayloadSchema.parse({
          exportJobId: jobB.data.id,
          requestedAt: new Date().toISOString(),
          requestedByMembershipId: fixtureB.adminMembershipId,
          schemaVersion: 1,
        }),
      },
    );

    const rowA = await withTenantTx(
      authoringTenantTx(fixtureA),
      async (tx) =>
        tx.$queryRaw<Array<{ status: string; r2_object_key: string | null }>>`
        select status, r2_object_key from export_jobs where id = ${jobA.data.id}::uuid
      `,
    );

    const rowB = await withTenantTx(
      authoringTenantTx(fixtureB),
      async (tx) =>
        tx.$queryRaw<Array<{ status: string; r2_object_key: string | null }>>`
        select status, r2_object_key from export_jobs where id = ${jobB.data.id}::uuid
      `,
    );

    expect(rowA[0]?.status).toBe("SUCCEEDED");
    expect(rowB[0]?.status).toBe("SUCCEEDED");
    expect(rowA[0]?.r2_object_key).toContain(fixtureA.tenantId);
    expect(rowB[0]?.r2_object_key).toContain(fixtureB.tenantId);
  });
});
