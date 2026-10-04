import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { runProtectedTenantRoutePipeline } from "@atlas/api";
import {
  createDeletionRequest,
  createExportJob,
  getExportJob,
  listDeletionRequests,
  listExportJobs,
  processDeletionRequest,
} from "@atlas/domain/data-rights/data-rights.service";
import {
  createDeletionRequestMetadata,
  createExportMetadata,
  getExportMetadata,
  listDeletionRequestsMetadata,
  listExportsMetadata,
  processDeletionRequestMetadata,
} from "@atlas/domain/data-rights/data-rights.route-metadata";
import {
  DATA_EXPORT_REQUESTED_AUDIT,
  DATA_DELETION_REQUESTED_AUDIT,
  DATA_DELETION_PROCESSED_AUDIT,
  DATA_EXPORT_REQUESTED_EVENT,
} from "@atlas/domain/data-rights/data-rights.events";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  learnerCtx,
  seedDataExportEntitlement,
} from "../../fixtures/data-rights-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("data-rights API integration", () => {
  it("POST /exports creates queued job with audit and outbox", async () => {
    const fixture = await createCourseAuthoringFixture();
    await seedDataExportEntitlement(fixture);
    const admin = adminCtx(fixture, "req_export_post");

    const response = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => {
        await runProtectedTenantRoutePipeline({
          tx,
          ctx: {
            tenantId: fixture.tenantId,
            requestId: admin.requestId,
            actorMembershipId: fixture.adminMembershipId,
            idempotencyKey: "export-create-1",
          },
          metadata: createExportMetadata,
          // Starting an export requires assurance on this session, not enrollment.
          sessionAssuranceLevel: "aal2",
          params: {},
          input: {},
        });

        return createExportJob(tx, {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: admin.requestId,
          idempotencyKey: "export-create-1",
        });
      },
    );

    expect(response.data.status).toBe("QUEUED");

    const audit = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ action: string }>>`
        select action from audit_entries
        where tenant_id = ${fixture.tenantId}::uuid
          and action = ${DATA_EXPORT_REQUESTED_AUDIT}
        order by occurred_at desc
        limit 1
      `,
    );

    const outbox = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ event_type: string }>>`
        select event_type from outbox_events
        where tenant_id = ${fixture.tenantId}::uuid
          and aggregate_id = ${response.data.id}
        limit 1
      `,
    );

    expect(audit[0]?.action).toBe(DATA_EXPORT_REQUESTED_AUDIT);
    expect(outbox[0]?.event_type).toBe(DATA_EXPORT_REQUESTED_EVENT);
  });

  it("GET /exports lists tenant jobs", async () => {
    const fixture = await createCourseAuthoringFixture();
    await seedDataExportEntitlement(fixture);
    const admin = adminCtx(fixture, "req_export_list");

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await createExportJob(tx, {
        tenantId: fixture.tenantId,
        actorMembershipId: fixture.adminMembershipId,
        requestId: admin.requestId,
        idempotencyKey: "export-list-1",
      });
    });

    const listed = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => {
        await runProtectedTenantRoutePipeline({
          tx,
          ctx: {
            tenantId: fixture.tenantId,
            requestId: admin.requestId,
            actorMembershipId: fixture.adminMembershipId,
          },
          metadata: listExportsMetadata,
          params: {},
          input: {},
        });

        return listExportJobs(tx, {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: admin.requestId,
        });
      },
    );

    expect(listed.data.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(listed.data.items)).not.toContain("r2_object_key");
  });

  it("GET /exports/:id omits download for non-success jobs", async () => {
    const fixture = await createCourseAuthoringFixture();
    await seedDataExportEntitlement(fixture);
    const admin = adminCtx(fixture, "req_export_get");

    const created = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        createExportJob(tx, {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: admin.requestId,
          idempotencyKey: "export-get-1",
        }),
    );

    const detail = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => {
        await runProtectedTenantRoutePipeline({
          tx,
          ctx: {
            tenantId: fixture.tenantId,
            requestId: admin.requestId,
            actorMembershipId: fixture.adminMembershipId,
          },
          metadata: getExportMetadata,
          params: { id: created.data.id },
          input: {},
          // The export detail returns a download link, so it requires a
          // step-up (aal2) session (H4 follow-up).
          sessionAssuranceLevel: "aal2",
        });

        return getExportJob(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.adminMembershipId,
            requestId: admin.requestId,
          },
          created.data.id,
        );
      },
    );

    expect(detail.data.download).toBeNull();
  });

  it("POST /deletion-requests creates learner self request with audit", async () => {
    const fixture = await createCourseAuthoringFixture();
    const learner = learnerCtx(fixture, "req_deletion_create");

    const created = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => {
        await runProtectedTenantRoutePipeline({
          tx,
          ctx: {
            tenantId: fixture.tenantId,
            requestId: learner.requestId,
            actorMembershipId: fixture.learnerMembershipId,
            idempotencyKey: "deletion-create-1",
          },
          metadata: createDeletionRequestMetadata,
          params: {},
          input: { confirm: true },
        });

        return createDeletionRequest(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.learnerMembershipId,
            requestId: learner.requestId,
            idempotencyKey: "deletion-create-1",
          },
          { confirm: true },
        );
      },
    );

    expect(created.data.targetId).toBe(fixture.learnerMembershipId);

    const audit = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ action: string }>>`
        select action from audit_entries
        where tenant_id = ${fixture.tenantId}::uuid
          and action = ${DATA_DELETION_REQUESTED_AUDIT}
        order by occurred_at desc
        limit 1
      `,
    );

    expect(audit[0]?.action).toBe(DATA_DELETION_REQUESTED_AUDIT);
  });

  it("GET /deletion-requests lists admin requests", async () => {
    const fixture = await createCourseAuthoringFixture();
    const learner = learnerCtx(fixture, "req_deletion_list");

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      await createDeletionRequest(
        tx,
        {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.learnerMembershipId,
          requestId: learner.requestId,
          idempotencyKey: "deletion-list-1",
        },
        { confirm: true },
      );
    });

    const listed = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => {
        await runProtectedTenantRoutePipeline({
          tx,
          ctx: {
            tenantId: fixture.tenantId,
            requestId: adminCtx(fixture, "req_deletion_list_admin").requestId,
            actorMembershipId: fixture.adminMembershipId,
          },
          metadata: listDeletionRequestsMetadata,
          params: {},
          input: {},
        });

        return listDeletionRequests(tx, {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: adminCtx(fixture, "req_deletion_list_admin").requestId,
        });
      },
    );

    expect(listed.data.items.length).toBeGreaterThan(0);
  });

  it("POST /deletion-requests/:id/process writes processed audit", async () => {
    const fixture = await createCourseAuthoringFixture();
    const learner = learnerCtx(fixture, "req_deletion_process_create");
    const admin = adminCtx(fixture, "req_deletion_process");

    const created = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        createDeletionRequest(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.learnerMembershipId,
            requestId: learner.requestId,
            idempotencyKey: "deletion-process-create",
          },
          { confirm: true },
        ),
    );

    const processed = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => {
        await runProtectedTenantRoutePipeline({
          tx,
          ctx: {
            tenantId: fixture.tenantId,
            requestId: admin.requestId,
            actorMembershipId: fixture.adminMembershipId,
            idempotencyKey: "deletion-process-1",
          },
          metadata: processDeletionRequestMetadata,
          // Processing an erasure requires a session that completed MFA (audit H4).
          sessionAssuranceLevel: "aal2",
          params: { id: created.data.id },
          input: { confirm: true },
        });

        return processDeletionRequest(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.adminMembershipId,
            requestId: admin.requestId,
            idempotencyKey: "deletion-process-1",
          },
          created.data.id,
          { confirm: true },
        );
      },
    );

    expect(processed.data.status).toBe("SUCCEEDED");

    const audit = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ action: string }>>`
        select action from audit_entries
        where tenant_id = ${fixture.tenantId}::uuid
          and action = ${DATA_DELETION_PROCESSED_AUDIT}
        order by occurred_at desc
        limit 1
      `,
    );

    expect(audit[0]?.action).toBe(DATA_DELETION_PROCESSED_AUDIT);
  });
});
