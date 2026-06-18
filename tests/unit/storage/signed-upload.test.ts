import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageProvider } from "@atlas/storage/providers/storage-provider";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "33333333-3333-4333-8333-333333333333";
const SIGNED_URL = "https://signed.example/upload?token=secret";

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

function createProvider(): StorageProvider {
  return {
    createSignedUploadUrl: vi.fn().mockImplementation(async (input) => ({
      url: SIGNED_URL,
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
      requiredHeaders: {
        "content-type": input.contentType,
      },
    })),
    createSignedDownloadUrl: vi.fn(),
    headObject: vi.fn(),
    deleteObject: vi.fn(),
  };
}

const uploadInput = {
  purpose: "branding.logo" as const,
  resourceType: "tenant",
  resourceId: null,
  fileName: "logo.png",
  contentType: "image/png",
  sizeBytes: 50_000,
};

describe("createPendingAssetReferenceWithUpload", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00.000Z"));

    process.env.STORAGE_PROVIDER = "local-mock";
    process.env.R2_BUCKET_NAME = "test-bucket";
    process.env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS = "300";

    insertPendingAssetReferenceMock.mockImplementation(async (_tx, input) => ({
      id: ASSET_ID,
      tenant_id: input.tenantId,
      bucket: input.bucket,
      object_key: input.key,
      purpose: input.purpose,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      file_name: input.fileName,
      content_type: input.contentType,
      size_bytes: input.sizeBytes,
      checksum_sha256: input.checksumSha256 ?? null,
      visibility: input.visibility,
      status: "PENDING_UPLOAD",
      created_at: new Date("2025-06-01T00:00:00.000Z"),
      updated_at: new Date("2025-06-01T00:00:00.000Z"),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("creates PENDING_UPLOAD asset reference", async () => {
    const provider = createProvider();

    const result = await createPendingAssetReferenceWithUpload(
      tx,
      provider,
      { tenantId: TENANT_ID },
      uploadInput,
    );

    expect(insertPendingAssetReferenceMock).toHaveBeenCalledOnce();
    expect(result.data.asset.status).toBe("PENDING_UPLOAD");
  });

  it("generates signed upload URL", async () => {
    const provider = createProvider();

    const result = await createPendingAssetReferenceWithUpload(
      tx,
      provider,
      { tenantId: TENANT_ID },
      uploadInput,
    );

    expect(provider.createSignedUploadUrl).toHaveBeenCalledOnce();
    expect(result.data.upload.method).toBe("PUT");
    expect(result.data.upload.url).toBe(SIGNED_URL);
    expect(result.data.upload.requiredHeaders).toEqual({
      "content-type": "image/png",
    });
  });

  it("signed URL expires within configured TTL", async () => {
    process.env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS = "600";
    const provider = createProvider();

    const result = await createPendingAssetReferenceWithUpload(
      tx,
      provider,
      { tenantId: TENANT_ID },
      uploadInput,
    );

    expect(provider.createSignedUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: 600 }),
    );
    expect(new Date(result.data.upload.expiresAt).getTime()).toBe(Date.now() + 600_000);
  });

  it("generates object key server-side with tenant prefix", async () => {
    const provider = createProvider();

    await createPendingAssetReferenceWithUpload(
      tx,
      provider,
      { tenantId: TENANT_ID },
      {
        ...uploadInput,
        fileName: "../../../evil.png",
      },
    );

    const insertedKey = insertPendingAssetReferenceMock.mock.calls[0][1].key as string;

    expect(insertedKey).toMatch(new RegExp(`^tenants/${TENANT_ID}/branding/logos/`));
    expect(insertedKey).not.toContain("../");

    expect(provider.createSignedUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ key: insertedKey }),
    );
  });

  it("rejects unsupported MIME before signed URL generation", async () => {
    const provider = createProvider();

    await expect(
      createPendingAssetReferenceWithUpload(
        tx,
        provider,
        { tenantId: TENANT_ID },
        {
          ...uploadInput,
          contentType: "video/mp4",
        },
      ),
    ).rejects.toThrow("SELF_HOSTED_VIDEO_FORBIDDEN");

    expect(insertPendingAssetReferenceMock).not.toHaveBeenCalled();
    expect(provider.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("rejects oversized file before signed URL generation", async () => {
    process.env.STORAGE_MAX_BRANDING_ASSET_BYTES = "2000000";
    const provider = createProvider();

    await expect(
      createPendingAssetReferenceWithUpload(
        tx,
        provider,
        { tenantId: TENANT_ID },
        {
          ...uploadInput,
          sizeBytes: 2_000_001,
        },
      ),
    ).rejects.toThrow("ASSET_SIZE_LIMIT_EXCEEDED");

    expect(insertPendingAssetReferenceMock).not.toHaveBeenCalled();
    expect(provider.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("does not log signed URL", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);

    const provider = createProvider();

    const result = await createPendingAssetReferenceWithUpload(
      tx,
      provider,
      { tenantId: TENANT_ID },
      uploadInput,
    );

    const signedUrl = result.data.upload.url;
    const allCalls = [
      ...logSpy.mock.calls,
      ...infoSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
      ...debugSpy.mock.calls,
    ];

    for (const call of allCalls) {
      expect(JSON.stringify(call)).not.toContain(signedUrl);
    }

    logSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    debugSpy.mockRestore();
  });
});
