import { describe, expect, it, vi } from "vitest";
import { assertAllowedSize } from "@atlas/storage/size-policy";
import type { StorageProvider } from "@atlas/storage/providers/storage-provider";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";

const env = {
  STORAGE_MAX_BRANDING_ASSET_BYTES: 2_000_000,
  STORAGE_MAX_LESSON_ASSET_BYTES: 100_000_000,
};

const { insertPendingAssetReferenceMock } = vi.hoisted(() => ({
  insertPendingAssetReferenceMock: vi.fn(),
}));

vi.mock("@atlas/storage/asset-reference.repository", () => ({
  insertPendingAssetReference: (...args: unknown[]) => insertPendingAssetReferenceMock(...args),
  findAssetReferenceById: vi.fn(),
  markAssetReferenceReady: vi.fn(),
  softDeleteAssetReference: vi.fn(),
}));

import { createPendingAssetReferenceWithUpload } from "@atlas/storage/asset-reference.service";

const tx = { $queryRaw: vi.fn() } as never;

describe("assertAllowedSize", () => {
  it("enforces branding max size", () => {
    expect(() =>
      assertAllowedSize({
        purpose: "branding.logo",
        sizeBytes: env.STORAGE_MAX_BRANDING_ASSET_BYTES,
        env,
      }),
    ).not.toThrow();

    expect(() =>
      assertAllowedSize({
        purpose: "branding.favicon",
        sizeBytes: env.STORAGE_MAX_BRANDING_ASSET_BYTES + 1,
        env,
      }),
    ).toThrow("ASSET_SIZE_LIMIT_EXCEEDED");
  });

  it("enforces lesson max size", () => {
    expect(() =>
      assertAllowedSize({
        purpose: "lesson.asset",
        sizeBytes: env.STORAGE_MAX_LESSON_ASSET_BYTES,
        env,
      }),
    ).not.toThrow();

    expect(() =>
      assertAllowedSize({
        purpose: "lesson.attachment",
        sizeBytes: env.STORAGE_MAX_LESSON_ASSET_BYTES + 1,
        env,
      }),
    ).toThrow("ASSET_SIZE_LIMIT_EXCEEDED");
  });

  it("rejects oversized uploads before signed URL generation", async () => {
    const createSignedUploadUrlMock = vi.fn();
    const provider = {
      createSignedUploadUrl: createSignedUploadUrlMock,
      createSignedDownloadUrl: vi.fn(),
      headObject: vi.fn(),
      deleteObject: vi.fn(),
    } satisfies StorageProvider;

    process.env["STORAGE_PROVIDER"] = "local-mock";
    process.env["R2_BUCKET_NAME"] = "test-bucket";

    await expect(
      createPendingAssetReferenceWithUpload(
        tx,
        provider,
        { tenantId: TENANT_ID },
        {
          purpose: "branding.logo",
          resourceType: "tenant",
          resourceId: null,
          fileName: "logo.png",
          contentType: "image/png",
          sizeBytes: env.STORAGE_MAX_BRANDING_ASSET_BYTES + 1,
        },
      ),
    ).rejects.toThrow("ASSET_SIZE_LIMIT_EXCEEDED");

    expect(insertPendingAssetReferenceMock).not.toHaveBeenCalled();
    expect(createSignedUploadUrlMock).not.toHaveBeenCalled();
  });
});
