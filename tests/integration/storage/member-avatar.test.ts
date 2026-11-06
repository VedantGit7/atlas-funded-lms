import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";

/**
 * Launch plan 5.1 (staging, 6 November 2026): with no public R2 endpoint an
 * avatar had no address and never showed; removing or replacing one left the
 * photo in storage; and confirm didn't check whose upload it was.
 */

// A fake bucket: what was "uploaded", and what the code deleted.
const bucket = vi.hoisted(() => ({
  objects: new Map<string, Buffer>(),
  deleted: [] as string[],
}));
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24),
]);

vi.mock("@atlas/storage/providers/storage-provider-factory", () => ({
  getStorageProvider: () => ({
    createSignedUploadUrl: (input: { key: string }) =>
      Promise.resolve({
        url: `https://acct.r2.cloudflarestorage.com/atlas-assets/${input.key}?upload`,
        method: "PUT",
        requiredHeaders: {},
        expiresAt: new Date(Date.now() + 60_000),
      }),
    createSignedDownloadUrl: (input: { key: string }) =>
      Promise.resolve({
        url: `https://acct.r2.cloudflarestorage.com/atlas-assets/${input.key}?signed`,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    headObject: ({ key }: { key: string }) => {
      const body = bucket.objects.get(key);
      return Promise.resolve(
        body ? { contentType: "image/png", sizeBytes: body.length, checksumSha256: null } : null,
      );
    },
    getObjectBody: ({ key }: { key: string }) => Promise.resolve(bucket.objects.get(key) ?? null),
    putObject: () => Promise.resolve(),
    deleteObject: ({ key }: { key: string }) => {
      bucket.deleted.push(key);
      bucket.objects.delete(key);
      return Promise.resolve();
    },
  }),
}));

import {
  confirmMemberAvatarUpload,
  createMemberAvatarUpload,
  memberAvatarPath,
  retireMemberAvatars,
  signMemberAvatarDownload,
} from "@atlas/storage/member-avatar.service";
import { getStorageProvider } from "@atlas/storage/providers/storage-provider-factory";
import {
  authoringTenantTx,
  createCourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("member avatars", () => {
  beforeEach(() => {
    bucket.objects.clear();
    bucket.deleted.length = 0;
  });

  async function uploadAvatar(
    fixture: Awaited<ReturnType<typeof createCourseAuthoringFixture>>,
    membershipId: string,
  ) {
    const signed = await withTenantTx(authoringTenantTx(fixture, membershipId), (tx) =>
      createMemberAvatarUpload(
        tx,
        { tenantId: fixture.tenantId },
        { membershipId, fileName: "me.png", contentType: "image/png", sizeBytes: PNG.length },
      ),
    );
    bucket.objects.set(signed.data.asset.key, PNG);
    return { id: signed.data.asset.id, key: signed.data.asset.key };
  }

  const confirm = (
    fixture: Awaited<ReturnType<typeof createCourseAuthoringFixture>>,
    membershipId: string,
    assetReferenceId: string,
  ) =>
    withTenantTx(authoringTenantTx(fixture, membershipId), (tx) =>
      confirmMemberAvatarUpload(
        tx,
        { tenantId: fixture.tenantId },
        { assetReferenceId, membershipId },
      ),
    );

  it("gives a confirmed avatar a lasting app address that signs a download", async () => {
    const fixture = await createCourseAuthoringFixture();
    const avatar = await uploadAvatar(fixture, fixture.learnerMembershipId);

    const { avatarUrl } = await confirm(fixture, fixture.learnerMembershipId, avatar.id);

    expect(avatarUrl).toBe(memberAvatarPath(avatar.id));
    const signed = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      (tx) => signMemberAvatarDownload(tx, avatar.id),
    );
    expect(signed).toBe(`https://acct.r2.cloudflarestorage.com/atlas-assets/${avatar.key}?signed`);
  });

  it("deletes the avatar it replaces, and removing deletes the rest", async () => {
    const fixture = await createCourseAuthoringFixture();
    const first = await uploadAvatar(fixture, fixture.learnerMembershipId);
    await confirm(fixture, fixture.learnerMembershipId, first.id);
    const second = await uploadAvatar(fixture, fixture.learnerMembershipId);
    await confirm(fixture, fixture.learnerMembershipId, second.id);

    expect(bucket.deleted).toEqual([first.key]);
    const firstSigned = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      (tx) => signMemberAvatarDownload(tx, first.id),
    );
    expect(firstSigned).toBeNull();

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
      retireMemberAvatars(tx, getStorageProvider(), { membershipId: fixture.learnerMembershipId }),
    );
    expect(bucket.deleted).toEqual([first.key, second.key]);
  });

  it("refuses to confirm another member's upload", async () => {
    const fixture = await createCourseAuthoringFixture();
    const theirs = await uploadAvatar(fixture, fixture.instructorMembershipId);

    await expect(confirm(fixture, fixture.learnerMembershipId, theirs.id)).rejects.toThrow(
      "ASSET_REFERENCE_NOT_FOUND",
    );
  });

  it("signs nothing for an unknown, pending or other academy's avatar", async () => {
    const fixture = await createCourseAuthoringFixture();
    const other = await createCourseAuthoringFixture();
    const pending = await uploadAvatar(fixture, fixture.learnerMembershipId);
    const otherAcademy = await uploadAvatar(other, other.learnerMembershipId);
    await confirm(other, other.learnerMembershipId, otherAcademy.id);

    const results = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => [
        await signMemberAvatarDownload(tx, randomUUID()),
        await signMemberAvatarDownload(tx, pending.id),
        await signMemberAvatarDownload(tx, otherAcademy.id),
      ],
    );
    expect(results).toEqual([null, null, null]);
  });
});
