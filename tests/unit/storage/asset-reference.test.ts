import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageProvider } from "@atlas/storage/providers/storage-provider";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "33333333-3333-4333-8333-333333333333";

const {
  insertPendingAssetReferenceMock,
  findAssetReferenceByIdMock,
  markAssetReferenceReadyMock,
  softDeleteAssetReferenceMock,
} = vi.hoisted(() => ({
  insertPendingAssetReferenceMock: vi.fn(),
  findAssetReferenceByIdMock: vi.fn(),
  markAssetReferenceReadyMock: vi.fn(),
  softDeleteAssetReferenceMock: vi.fn(),
}));

vi.mock("@atlas/storage/asset-reference.repository", () => ({
  insertPendingAssetReference: (...args: unknown[]) => insertPendingAssetReferenceMock(...args),
  findAssetReferenceById: (...args: unknown[]) => findAssetReferenceByIdMock(...args),
  markAssetReferenceReady: (...args: unknown[]) => markAssetReferenceReadyMock(...args),
  softDeleteAssetReference: (...args: unknown[]) => softDeleteAssetReferenceMock(...args),
}));

import {
  confirmAssetUpload,
  createPendingAssetReferenceWithUpload,
  deleteAssetReference,
} from "@atlas/storage/asset-reference.service";

const tx = { $queryRaw: vi.fn() } as never;

const uploadInput = {
  purpose: "branding.logo" as const,
  resourceType: "tenant",
  resourceId: null,
  fileName: "logo.png",
  contentType: "image/png",
  sizeBytes: 50_000,
};

function pendingAssetRow() {
  return {
    id: ASSET_ID,
    tenant_id: TENANT_ID,
    bucket: "test-bucket",
    object_key: `tenants/${TENANT_ID}/branding/logos/logo.png`,
    purpose: "branding.logo",
    resource_type: "tenant",
    resource_id: null,
    file_name: "logo.png",
    content_type: "image/png",
    size_bytes: 50_000,
    checksum_sha256: null,
    visibility: "private",
    status: "PENDING_UPLOAD",
    created_at: new Date("2025-06-01T00:00:00.000Z"),
    updated_at: new Date("2025-06-01T00:00:00.000Z"),
  };
}

function createProvider(
  metadata: {
    contentType: string;
    sizeBytes: number;
    checksumSha256?: string | null;
  } | null,
): StorageProvider {
  return {
    createSignedUploadUrl: vi.fn(),
    createSignedDownloadUrl: vi.fn(),
    headObject: vi.fn().mockResolvedValue(
      metadata
        ? {
            contentType: metadata.contentType,
            sizeBytes: metadata.sizeBytes,
            checksumSha256: metadata.checksumSha256 ?? null,
          }
        : null,
    ),
    deleteObject: vi.fn(),
  };
}

describe("asset reference lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

    markAssetReferenceReadyMock.mockImplementation(async (_tx, input) => ({
      ...pendingAssetRow(),
      status: "READY",
      checksum_sha256: input.checksumSha256 ?? null,
    }));

    softDeleteAssetReferenceMock.mockResolvedValue({
      ...pendingAssetRow(),
      status: "DELETED",
    });
  });

  it("stores asset metadata in storage_references", async () => {
    const provider = createProvider(null);
    provider.createSignedUploadUrl = vi.fn().mockResolvedValue({
      url: "https://signed.example/upload",
      expiresAt: new Date("2025-06-01T00:05:00.000Z"),
      requiredHeaders: { "content-type": "image/png" },
    });

    await createPendingAssetReferenceWithUpload(tx, provider, { tenantId: TENANT_ID }, uploadInput);

    expect(insertPendingAssetReferenceMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tenantId: TENANT_ID,
        bucket: "test-bucket",
        purpose: "branding.logo",
        resourceType: "tenant",
        fileName: "logo.png",
        contentType: "image/png",
        sizeBytes: 50_000,
      }),
    );
  });

  it("does not store binary file content in Postgres", async () => {
    const repositorySource = readFileSync(
      resolve(import.meta.dirname, "../../../packages/storage/src/asset-reference.repository.ts"),
      "utf8",
    );

    expect(repositorySource).toContain("INSERT INTO storage_references");
    expect(repositorySource).not.toMatch(/bytea|blob|binary|file_content|file_data/i);

    const provider = createProvider(null);
    provider.createSignedUploadUrl = vi.fn().mockResolvedValue({
      url: "https://signed.example/upload",
      expiresAt: new Date("2025-06-01T00:05:00.000Z"),
      requiredHeaders: { "content-type": "image/png" },
    });

    await createPendingAssetReferenceWithUpload(tx, provider, { tenantId: TENANT_ID }, uploadInput);

    const inserted = insertPendingAssetReferenceMock.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(inserted)).not.toEqual(
      expect.arrayContaining(["body", "buffer", "bytes", "content", "fileData"]),
    );
    expect(inserted).not.toHaveProperty("body");
    expect(inserted).not.toHaveProperty("buffer");
  });

  it("confirm checks object metadata", async () => {
    findAssetReferenceByIdMock.mockResolvedValue(pendingAssetRow());
    const provider = createProvider({
      contentType: "image/png",
      sizeBytes: 50_000,
    });

    await confirmAssetUpload(tx, provider, { tenantId: TENANT_ID }, { assetReferenceId: ASSET_ID });

    expect(provider.headObject).toHaveBeenCalledWith({
      bucket: "test-bucket",
      key: `tenants/${TENANT_ID}/branding/logos/logo.png`,
    });
  });

  it("confirm marks READY only after metadata match", async () => {
    findAssetReferenceByIdMock.mockResolvedValue(pendingAssetRow());
    const provider = createProvider({
      contentType: "application/pdf",
      sizeBytes: 50_000,
    });

    await expect(
      confirmAssetUpload(tx, provider, { tenantId: TENANT_ID }, { assetReferenceId: ASSET_ID }),
    ).rejects.toThrow("ASSET_CONTENT_TYPE_MISMATCH");

    expect(markAssetReferenceReadyMock).not.toHaveBeenCalled();

    provider.headObject = vi.fn().mockResolvedValue({
      contentType: "image/png",
      sizeBytes: 50_000,
      checksumSha256: null,
    });

    const result = await confirmAssetUpload(
      tx,
      provider,
      { tenantId: TENANT_ID },
      { assetReferenceId: ASSET_ID },
    );

    expect(markAssetReferenceReadyMock).toHaveBeenCalledOnce();
    expect(result.data.status).toBe("READY");
  });

  it("rejects size mismatch during confirm", async () => {
    findAssetReferenceByIdMock.mockResolvedValue(pendingAssetRow());
    const provider = createProvider({
      contentType: "image/png",
      sizeBytes: 99_999,
    });

    await expect(
      confirmAssetUpload(tx, provider, { tenantId: TENANT_ID }, { assetReferenceId: ASSET_ID }),
    ).rejects.toThrow("ASSET_SIZE_MISMATCH");

    expect(markAssetReferenceReadyMock).not.toHaveBeenCalled();
  });

  it("rejects checksum mismatch during confirm", async () => {
    findAssetReferenceByIdMock.mockResolvedValue({
      ...pendingAssetRow(),
      checksum_sha256: "a".repeat(64),
    });
    const provider = createProvider({
      contentType: "image/png",
      sizeBytes: 50_000,
      checksumSha256: "b".repeat(64),
    });

    await expect(
      confirmAssetUpload(tx, provider, { tenantId: TENANT_ID }, { assetReferenceId: ASSET_ID }),
    ).rejects.toThrow("ASSET_CHECKSUM_MISMATCH");

    expect(markAssetReferenceReadyMock).not.toHaveBeenCalled();
  });

  it("soft delete marks asset DELETED", async () => {
    findAssetReferenceByIdMock.mockResolvedValue(pendingAssetRow());
    const provider = createProvider(null);

    const result = await deleteAssetReference(
      tx,
      provider,
      { tenantId: TENANT_ID },
      { assetReferenceId: ASSET_ID },
    );

    expect(softDeleteAssetReferenceMock).toHaveBeenCalledWith(tx, ASSET_ID);
    expect(result.data.status).toBe("DELETED");
  });
});
