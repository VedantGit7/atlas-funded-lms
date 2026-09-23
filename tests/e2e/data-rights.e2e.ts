import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import {
  createExportJob,
  createDeletionRequest,
} from "@atlas/domain/data-rights/data-rights.service";
import { processExportRequestedEvent } from "@atlas/domain/data-rights/data-rights.worker";
import { dataExportRequestedPayloadSchema } from "@atlas/domain/data-rights/data-rights.events";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  learnerCtx,
  seedDataExportEntitlement,
} from "../fixtures/data-rights-fixture";

const describeWithE2E =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithE2E("data-rights e2e", () => {
  it("admin export becomes downloadable after worker success", async () => {
    const fixture = await createCourseAuthoringFixture();
    await seedDataExportEntitlement(fixture);
    const admin = adminCtx(fixture, "e2e_export");

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
          idempotencyKey: "e2e-export",
        }),
    );

    expect(created.data.status).toBe("QUEUED");

    await processExportRequestedEvent(
      {
        tenantId: fixture.tenantId,
        actorMembershipId: fixture.adminMembershipId,
        requestId: admin.requestId,
      },
      {
        id: randomUUID(),
        eventType: "data.export_requested",
        payload: dataExportRequestedPayloadSchema.parse({
          exportJobId: created.data.id,
          requestedAt: new Date().toISOString(),
          requestedByMembershipId: fixture.adminMembershipId,
          schemaVersion: 1,
        }),
      },
    );

    const { getExportJob } = await import("@atlas/domain/data-rights/data-rights.service");

    const detail = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        getExportJob(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.adminMembershipId,
            requestId: admin.requestId,
          },
          created.data.id,
        ),
    );

    expect(detail.data.status).toBe("SUCCEEDED");
    expect(detail.data.download?.url).toContain("http");
  });

  it("learner can file own deletion request", async () => {
    const fixture = await createCourseAuthoringFixture();
    const learner = learnerCtx(fixture, "e2e_deletion_self");

    const created = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        createDeletionRequest(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.learnerMembershipId,
            requestId: learner.requestId,
            idempotencyKey: "e2e-deletion-self",
          },
          { confirm: true },
        ),
    );

    expect(created.data.targetId).toBe(fixture.learnerMembershipId);
    expect(created.data.status).toBe("QUEUED");
  });
});
