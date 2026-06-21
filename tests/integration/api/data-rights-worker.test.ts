import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import { processOutboxBatch } from "@atlas/events/services/outbox-worker.service";
import { createExportJob } from "@atlas/domain/data-rights/data-rights.service";
import {
  DATA_EXPORT_REQUESTED_EVENT,
  dataExportRequestedPayloadSchema,
} from "@atlas/domain/data-rights/data-rights.events";
import { processExportRequestedEvent } from "@atlas/domain/data-rights/data-rights.worker";
import { createDataRightsOutboxConsumers } from "../../../apps/web/src/events/outbox-consumers";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  seedDataExportEntitlement,
} from "../../fixtures/data-rights-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("data-rights worker", () => {
  it("validates export event payload schema version", () => {
    expect(() =>
      dataExportRequestedPayloadSchema.parse({
        exportJobId: randomUUID(),
        requestedAt: new Date().toISOString(),
        requestedByMembershipId: randomUUID(),
        schemaVersion: 1,
      }),
    ).not.toThrow();
  });

  it("processes export_requested into succeeded job with protected reference", async () => {
    const fixture = await createCourseAuthoringFixture();
    await seedDataExportEntitlement(fixture);
    const admin = adminCtx(fixture, "req_export_worker");

    process.env.STORAGE_PROVIDER = "local-mock";
    process.env.R2_BUCKET_NAME = "test-bucket";
    process.env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS = "300";
    process.env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS = "300";

    const created = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        createExportJob(tx, {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: admin.requestId,
          idempotencyKey: "export-worker-1",
        }),
    );

    const payload = dataExportRequestedPayloadSchema.parse({
      exportJobId: created.data.id,
      requestedAt: new Date().toISOString(),
      requestedByMembershipId: fixture.adminMembershipId,
      schemaVersion: 1,
    });

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await processExportRequestedEvent(
        tx,
        {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: admin.requestId,
        },
        {
          id: randomUUID(),
          eventType: DATA_EXPORT_REQUESTED_EVENT,
          payload,
        },
      );
    });

    const job = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ status: string; r2_object_key: string | null }>>`
        select status, r2_object_key
        from export_jobs
        where id = ${created.data.id}::uuid
      `,
    );

    expect(job[0]?.status).toBe("SUCCEEDED");
    expect(job[0]?.r2_object_key).toMatch(/^tenants\//);
  });

  it("duplicate export delivery is idempotent no-op", async () => {
    const fixture = await createCourseAuthoringFixture();
    await seedDataExportEntitlement(fixture);
    const admin = adminCtx(fixture, "req_export_worker_dup");

    process.env.STORAGE_PROVIDER = "local-mock";
    process.env.R2_BUCKET_NAME = "test-bucket";
    process.env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS = "300";
    process.env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS = "300";

    const created = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        createExportJob(tx, {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: admin.requestId,
          idempotencyKey: "export-worker-dup",
        }),
    );

    const outboxEventId = randomUUID();
    const payload = dataExportRequestedPayloadSchema.parse({
      exportJobId: created.data.id,
      requestedAt: new Date().toISOString(),
      requestedByMembershipId: fixture.adminMembershipId,
      schemaVersion: 1,
    });

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await tx.$executeRaw`
        insert into outbox_events (
          id,
          tenant_id,
          event_type,
          aggregate_type,
          aggregate_id,
          payload_json,
          idempotency_key,
          occurred_at,
          available_at
        )
        values (
          ${outboxEventId}::uuid,
          ${fixture.tenantId}::uuid,
          ${DATA_EXPORT_REQUESTED_EVENT},
          'export_job',
          ${created.data.id},
          ${JSON.stringify(payload)}::jsonb,
          ${`worker-dup:${created.data.id}`},
          now(),
          now()
        )
      `;

      const first = await processOutboxBatch(tx, {
        limit: 5,
        maxRetries: 1,
        handlers: createDataRightsOutboxConsumers(),
      });

      const second = await processOutboxBatch(tx, {
        limit: 5,
        maxRetries: 1,
        handlers: createDataRightsOutboxConsumers(),
      });

      expect(first.delivered).toBeGreaterThan(0);
      expect(second.skipped).toBeGreaterThan(0);
    });

    const job = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ status: string }>>`
        select status
        from export_jobs
        where id = ${created.data.id}::uuid
      `,
    );

    expect(job[0]?.status).toBe("SUCCEEDED");
  });
});
