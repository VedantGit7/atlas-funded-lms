import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageProvider } from "@atlas/storage/providers/storage-provider";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "33333333-3333-4333-8333-333333333333";
const SIGNED_DOWNLOAD_URL = "https://signed.example/download?token=secret&expires=1750000000000";
const PUBLIC_URL = "https://cdn.example.com/test-bucket/tenants/public/logo.png";

const { findAssetReferenceByIdMock } = vi.hoisted(() => ({
  findAssetReferenceByIdMock: vi.fn(),
}));

vi.mock("@atlas/storage/asset-reference.repository", () => ({
  insertPendingAssetReference: vi.fn(),
  findAssetReferenceById: (...args: unknown[]) => findAssetReferenceByIdMock(...args),
  markAssetReferenceReady: vi.fn(),
  softDeleteAssetReference: vi.fn(),
}));

import { createSignedAssetDownload } from "@atlas/storage/asset-reference.service";

const tx = { $queryRaw: vi.fn() } as never;

function readyAssetRow() {
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
    status: "READY",
    created_at: new Date("2025-06-01T00:00:00.000Z"),
    updated_at: new Date("2025-06-01T00:00:00.000Z"),
  };
}

function createProvider(): StorageProvider {
  return {
    createSignedUploadUrl: vi.fn(),
    createSignedDownloadUrl: vi.fn().mockImplementation(async (input) => ({
      url: SIGNED_DOWNLOAD_URL,
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
    })),
    headObject: vi.fn(),
    deleteObject: vi.fn(),
  };
}

describe("createSignedAssetDownload", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00.000Z"));

    process.env.STORAGE_PROVIDER = "local-mock";
    process.env.R2_BUCKET_NAME = "test-bucket";
    process.env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS = "300";
    process.env.R2_PUBLIC_ENDPOINT = "https://cdn.example.com";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("returns signed download URL for READY asset", async () => {
    findAssetReferenceByIdMock.mockResolvedValue(readyAssetRow());
    const provider = createProvider();

    const result = await createSignedAssetDownload(
      tx,
      provider,
      { tenantId: TENANT_ID },
      { assetReferenceId: ASSET_ID },
    );

    expect(provider.createSignedDownloadUrl).toHaveBeenCalledOnce();
    expect(result.data.url).toBe(SIGNED_DOWNLOAD_URL);
    expect(result.data.expiresAt).toBeTruthy();
  });

  it("rejects PENDING_UPLOAD asset", async () => {
    findAssetReferenceByIdMock.mockResolvedValue({
      ...readyAssetRow(),
      status: "PENDING_UPLOAD",
    });
    const provider = createProvider();

    await expect(
      createSignedAssetDownload(
        tx,
        provider,
        { tenantId: TENANT_ID },
        { assetReferenceId: ASSET_ID },
      ),
    ).rejects.toThrow("ASSET_REFERENCE_NOT_FOUND");

    expect(provider.createSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it("rejects DELETED asset", async () => {
    findAssetReferenceByIdMock.mockResolvedValue(null);
    const provider = createProvider();

    await expect(
      createSignedAssetDownload(
        tx,
        provider,
        { tenantId: TENANT_ID },
        { assetReferenceId: ASSET_ID },
      ),
    ).rejects.toThrow("ASSET_REFERENCE_NOT_FOUND");

    expect(provider.createSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it("signed URL expires within configured TTL", async () => {
    process.env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS = "600";
    findAssetReferenceByIdMock.mockResolvedValue(readyAssetRow());
    const provider = createProvider();

    const result = await createSignedAssetDownload(
      tx,
      provider,
      { tenantId: TENANT_ID },
      { assetReferenceId: ASSET_ID },
    );

    expect(provider.createSignedDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: 600 }),
    );
    expect(new Date(result.data.expiresAt).getTime()).toBe(Date.now() + 600_000);
  });

  it("never returns a permanent public URL for protected assets", async () => {
    findAssetReferenceByIdMock.mockResolvedValue({
      ...readyAssetRow(),
      visibility: "private",
    });
    const provider = createProvider();

    const result = await createSignedAssetDownload(
      tx,
      provider,
      { tenantId: TENANT_ID },
      { assetReferenceId: ASSET_ID },
    );

    expect(result.data.url).not.toBe(PUBLIC_URL);
    expect(result.data.url).not.toMatch(/^https:\/\/cdn\.example\.com\/test-bucket\//);
    expect(result.data.url).toContain("expires=");
    expect(new Date(result.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
