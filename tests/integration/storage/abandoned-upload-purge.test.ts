import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import { insertPendingAssetReference } from "@atlas/storage/asset-reference.repository";
import {
  ABANDONED_UPLOAD_AFTER_MS,
  purgeAbandonedUploads,
} from "@atlas/storage/abandoned-upload-purge";
import {
  authoringTenantTx,
  createCourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

/**
 * Launch plan 5.1 (staging, 6 November 2026): an upload that was signed but
 * never confirmed stayed PENDING_UPLOAD forever, and any bytes it sent stayed
 * in the bucket. The worker now removes them a day later.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("abandoned upload purge", () => {
  it("removes day-old pending uploads and their objects, and nothing else", async () => {
    const fixture = await createCourseAuthoringFixture();
    const tenantTx = () => authoringTenantTx(fixture, fixture.adminMembershipId);

    const pending = (key: string) =>
      withTenantTx(tenantTx(), (tx) =>
        insertPendingAssetReference(tx, {
          tenantId: fixture.tenantId,
          bucket: "atlas-assets",
          key,
          purpose: "member.avatar",
          resourceType: "member_profile",
          resourceId: fixture.learnerMembershipId,
          fileName: "avatar.png",
          contentType: "image/png",
          sizeBytes: 10,
          checksumSha256: null,
          visibility: "public-safe",
        }),
      );
    const tag = randomUUID();
    const abandoned = await pending(`t/${tag}/abandoned.png`);
    const recent = await pending(`t/${tag}/recent.png`);
    const confirmed = await pending(`t/${tag}/confirmed.png`);
    const dayAgo = new Date(Date.now() - ABANDONED_UPLOAD_AFTER_MS - 60_000);
    await withTenantTx(tenantTx(), async (tx) => {
      await tx.$executeRaw`update storage_references set created_at = ${dayAgo}
        where id in (${abandoned.id}::uuid, ${confirmed.id}::uuid)`;
      await tx.$executeRaw`update storage_references set status = 'READY'
        where id = ${confirmed.id}::uuid`;
    });

    const deletedKeys: string[] = [];
    const outcome = await withTenantTx(tenantTx(), (tx) =>
      purgeAbandonedUploads(tx, ({ key }) => {
        deletedKeys.push(key);
        return Promise.resolve();
      }),
    );

    expect(outcome).toEqual({ deleted: 1, failed: 0 });
    expect(deletedKeys).toEqual([abandoned.object_key]);
    const statuses = await withTenantTx(
      tenantTx(),
      (tx) =>
        tx.$queryRaw<Array<{ id: string; status: string }>>`
        select id::text, status from storage_references
        where id in (${abandoned.id}::uuid, ${recent.id}::uuid, ${confirmed.id}::uuid)`,
    );
    const statusOf = Object.fromEntries(statuses.map((row) => [row.id, row.status]));
    expect(statusOf[abandoned.id]).toBe("DELETED");
    expect(statusOf[recent.id]).toBe("PENDING_UPLOAD");
    expect(statusOf[confirmed.id]).toBe("READY");
  });

  it("keeps a reference pending when its object can't be deleted, for the next sweep", async () => {
    const fixture = await createCourseAuthoringFixture();
    const tenantTx = () => authoringTenantTx(fixture, fixture.adminMembershipId);
    const row = await withTenantTx(tenantTx(), (tx) =>
      insertPendingAssetReference(tx, {
        tenantId: fixture.tenantId,
        bucket: "atlas-assets",
        key: `t/${randomUUID()}/stuck.png`,
        purpose: "member.avatar",
        resourceType: "member_profile",
        resourceId: fixture.learnerMembershipId,
        fileName: "avatar.png",
        contentType: "image/png",
        sizeBytes: 10,
        checksumSha256: null,
        visibility: "public-safe",
      }),
    );
    const dayAgo = new Date(Date.now() - ABANDONED_UPLOAD_AFTER_MS - 60_000);
    await withTenantTx(
      tenantTx(),
      (tx) =>
        tx.$executeRaw`update storage_references set created_at = ${dayAgo} where id = ${row.id}::uuid`,
    );

    const outcome = await withTenantTx(tenantTx(), (tx) =>
      purgeAbandonedUploads(tx, () => Promise.reject(new Error("R2 unavailable"))),
    );

    expect(outcome).toEqual({ deleted: 0, failed: 1 });
    const [after] = await withTenantTx(
      tenantTx(),
      (tx) =>
        tx.$queryRaw<Array<{ status: string }>>`
        select status from storage_references where id = ${row.id}::uuid`,
    );
    expect(after?.status).toBe("PENDING_UPLOAD");
  });
});
