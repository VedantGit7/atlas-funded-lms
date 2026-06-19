import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { createLearningPathBodySchema } from "../../apps/web/src/server/learning-paths/learning-path.schemas";
import {
  enrollCurrentMemberInPath,
  getLearningPathById,
  getLearningPathProgress,
  listLearningPaths,
  updateLearningPath,
} from "../../apps/web/src/server/learning-paths/learning-path.service";
import {
  createLearningPathFixture,
  instructorCtx,
  learnerCtx,
  learnerTenantTx,
} from "../fixtures/learning-path-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("learning paths tenant isolation", () => {
  it("Tenant A cannot read Tenant B path by ID", async () => {
    const fixture = await createLearningPathFixture();
    const tenantB = await createTenantIsolationFixture();
    const ctx = learnerCtx(fixture);

    const pathId = await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) => {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into learning_paths (
          id, tenant_id, slug, title, path_type, status, created_by_membership_id, created_at, updated_at
        )
        values (
          ${id}::uuid,
          ${tenantB.tenantA.tenantId}::uuid,
          ${`tenant-b-path-${id.slice(0, 8)}`},
          'Tenant B Path',
          'program',
          'PUBLISHED',
          ${randomUUID()}::uuid,
          now(),
          now()
        )
      `;
      return id;
    });

    await expect(
      withTenantTx(learnerTenantTx(fixture), async (tx) =>
        getLearningPathById(tx, ctx, pathId, {}),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot enroll in Tenant B path", async () => {
    const fixture = await createLearningPathFixture();
    const tenantB = await createTenantIsolationFixture();
    const ctx = learnerCtx(fixture);

    const pathId = await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) => {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into learning_paths (
          id, tenant_id, slug, title, path_type, status, created_by_membership_id, created_at, updated_at
        )
        values (
          ${id}::uuid,
          ${tenantB.tenantA.tenantId}::uuid,
          ${`tenant-b-path-${id.slice(0, 8)}`},
          'Tenant B Path',
          'program',
          'PUBLISHED',
          ${randomUUID()}::uuid,
          now(),
          now()
        )
      `;
      return id;
    });

    await expect(
      withTenantTx(learnerTenantTx(fixture), async (tx) =>
        enrollCurrentMemberInPath(tx, ctx, pathId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A list excludes Tenant B published paths", async () => {
    const fixture = await createLearningPathFixture();
    const ctx = learnerCtx(fixture);

    const result = await withTenantTx(learnerTenantTx(fixture), async (tx) =>
      listLearningPaths(tx, ctx, { limit: 25 }),
    );

    const ids = result.data.items.map((item) => item.id);
    expect(ids).toContain(fixture.publishedPathId);
  });

  it("rejects client tenant_id on create body", () => {
    expect(() =>
      createLearningPathBodySchema.parse({
        title: "Path",
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });

  it("Tenant A cannot update Tenant B path", async () => {
    const fixture = await createLearningPathFixture();
    const tenantB = await createTenantIsolationFixture();
    const ctx = instructorCtx(fixture);

    const pathId = await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) => {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into learning_paths (
          id, tenant_id, slug, title, path_type, status, created_by_membership_id, created_at, updated_at
        )
        values (
          ${id}::uuid,
          ${tenantB.tenantA.tenantId}::uuid,
          ${`tenant-b-draft-${id.slice(0, 8)}`},
          'Tenant B Draft',
          'program',
          'DRAFT',
          ${randomUUID()}::uuid,
          now(),
          now()
        )
      `;
      return id;
    });

    await expect(
      withTenantTx(
        {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.instructorMembershipId,
          requestId: "req_iso_update",
        },
        async (tx) => updateLearningPath(tx, ctx, pathId, { title: "Hijacked" }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("progress for published path does not leak cross-tenant existence", async () => {
    const fixture = await createLearningPathFixture();
    const tenantB = await createTenantIsolationFixture();
    const ctx = learnerCtx(fixture);

    const pathId = await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) => {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into learning_paths (
          id, tenant_id, slug, title, path_type, status, created_by_membership_id, created_at, updated_at
        )
        values (
          ${id}::uuid,
          ${tenantB.tenantA.tenantId}::uuid,
          ${`tenant-b-progress-${id.slice(0, 8)}`},
          'Tenant B Path',
          'program',
          'PUBLISHED',
          ${randomUUID()}::uuid,
          now(),
          now()
        )
      `;
      return id;
    });

    await expect(
      withTenantTx(learnerTenantTx(fixture), async (tx) =>
        getLearningPathProgress(tx, ctx, pathId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
