import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toSafeErrorEnvelope } from "@atlas/api/error-envelope";
import {
  SignedDownloadResponseSchema,
  SignedUploadResponseSchema,
} from "@atlas/storage/schemas/asset-reference";
import { parseStorageEnv } from "@atlas/storage/schemas/storage-env";
import type { StorageProvider } from "@atlas/storage/providers/storage-provider";
import {
  createPendingAssetReferenceWithUpload,
  createSignedAssetDownload,
} from "@atlas/storage/asset-reference.service";

vi.mock("@atlas/storage/providers/r2-storage-provider", () => ({
  R2StorageProvider: class MockR2StorageProvider {
    readonly mock = true;
  },
}));

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "33333333-3333-4333-8333-333333333333";
const RAW_OBJECT_KEY = `tenants/${TENANT_ID}/branding/logos/logo.png`;
const R2_SECRET = "test-r2-secret-access-key-value";
const R2_ACCESS_KEY = "test-r2-access-key-id";
const R2_ACCOUNT_ID = "test-r2-account-id";
const SIGNED_UPLOAD_URL =
  "https://test-account.r2.cloudflarestorage.com/atlas-assets/logo.png?X-Amz-Signature=abc123";
const SIGNED_DOWNLOAD_URL =
  "https://test-account.r2.cloudflarestorage.com/atlas-assets/logo.png?X-Amz-Signature=def456";
const PUBLIC_URL = "https://cdn.example.com/atlas-assets/tenants/public/logo.png";

const { insertPendingAssetReferenceMock, findAssetReferenceByIdMock } = vi.hoisted(() => ({
  insertPendingAssetReferenceMock: vi.fn(),
  findAssetReferenceByIdMock: vi.fn(),
}));

vi.mock("@atlas/storage/asset-reference.repository", () => ({
  insertPendingAssetReference: (...args: unknown[]) => insertPendingAssetReferenceMock(...args),
  findAssetReferenceById: (...args: unknown[]) => findAssetReferenceByIdMock(...args),
  markAssetReferenceReady: vi.fn(),
  softDeleteAssetReference: vi.fn(),
}));

const tx = { $queryRaw: vi.fn() } as never;

const uploadInput = {
  purpose: "branding.logo" as const,
  resourceType: "tenant",
  resourceId: null,
  fileName: "logo.png",
  contentType: "image/png",
  sizeBytes: 50_000,
};

function createUploadProvider(): StorageProvider {
  return {
    createSignedUploadUrl: vi.fn().mockResolvedValue({
      url: SIGNED_UPLOAD_URL,
      expiresAt: new Date("2025-06-01T00:05:00.000Z"),
      requiredHeaders: { "content-type": "image/png" },
    }),
    createSignedDownloadUrl: vi.fn(),
    headObject: vi.fn(),
    deleteObject: vi.fn(),
  };
}

function createDownloadProvider(): StorageProvider {
  return {
    createSignedUploadUrl: vi.fn(),
    createSignedDownloadUrl: vi.fn().mockResolvedValue({
      url: SIGNED_DOWNLOAD_URL,
      expiresAt: new Date("2025-06-01T00:05:00.000Z"),
    }),
    headObject: vi.fn(),
    deleteObject: vi.fn(),
  };
}

function readyAssetRow() {
  return {
    id: ASSET_ID,
    tenant_id: TENANT_ID,
    bucket: "atlas-assets",
    object_key: RAW_OBJECT_KEY,
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

function assertNoSecretLeak(payload: unknown, secrets: string[]): void {
  const serialized = JSON.stringify(payload);
  for (const secret of secrets) {
    expect(serialized).not.toContain(secret);
  }
}

describe("storage secret leakage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00.000Z"));

    process.env.STORAGE_PROVIDER = "local-mock";
    process.env.R2_BUCKET_NAME = "atlas-assets";
    process.env.R2_SECRET_ACCESS_KEY = R2_SECRET;
    process.env.R2_ACCESS_KEY_ID = R2_ACCESS_KEY;
    process.env.R2_ACCOUNT_ID = R2_ACCOUNT_ID;
    process.env.R2_PUBLIC_ENDPOINT = "https://cdn.example.com";
    process.env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS = "300";
    process.env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS = "300";

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

    findAssetReferenceByIdMock.mockResolvedValue(readyAssetRow());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_PUBLIC_ENDPOINT;
  });

  it("does not log R2 signed URLs during upload or download flows", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);

    const uploadResult = await createPendingAssetReferenceWithUpload(
      tx,
      createUploadProvider(),
      { tenantId: TENANT_ID },
      uploadInput,
    );

    const downloadResult = await createSignedAssetDownload(
      tx,
      createDownloadProvider(),
      { tenantId: TENANT_ID },
      { assetReferenceId: ASSET_ID },
    );

    const logged = [
      ...logSpy.mock.calls,
      ...infoSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
      ...debugSpy.mock.calls,
    ];

    for (const call of logged) {
      const output = JSON.stringify(call);
      expect(output).not.toContain(uploadResult.data.upload.url);
      expect(output).not.toContain(downloadResult.data.url);
      expect(output).not.toContain("X-Amz-Signature");
    }

    logSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it("does not expose R2 secret env vars client-side", () => {
    parseStorageEnv(process.env);

    const clientDownloadShape = Object.keys(SignedDownloadResponseSchema.shape.data.shape);
    const clientUploadShape = Object.keys(SignedUploadResponseSchema.shape.data.shape);

    expect(clientDownloadShape).toEqual(["url", "expiresAt"]);
    expect(clientUploadShape).toEqual(["asset", "upload"]);
    expect(clientDownloadShape).not.toContain("R2_SECRET_ACCESS_KEY");
    expect(clientUploadShape).not.toContain("R2_ACCESS_KEY_ID");

    const providerSource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../backend/packages/storage/src/providers/r2-storage-provider.ts",
      ),
      "utf8",
    );

    expect(providerSource).toContain("secretAccessKey");
    expect(providerSource).toContain("R2_SECRET_ACCESS_KEY");
    expect(providerSource).not.toMatch(/return\s*\{[^}]*R2_SECRET_ACCESS_KEY/s);
  });

  it("does not return raw object keys in error envelopes", () => {
    const storageErrors = [
      new Error("STORAGE_KEY_TENANT_PREFIX_VIOLATION"),
      new Error("ASSET_REFERENCE_NOT_FOUND"),
      new Error("ASSET_OBJECT_NOT_FOUND"),
      new Error(`internal headObject failure for ${RAW_OBJECT_KEY}`),
    ];

    for (const error of storageErrors) {
      const envelope = toSafeErrorEnvelope(error, "request-id");
      const serialized = JSON.stringify(envelope.body);

      expect(serialized).not.toContain(RAW_OBJECT_KEY);
      expect(serialized).not.toContain("tenants/");
      expect(envelope.body.error).toEqual(
        expect.objectContaining({
          requestId: "request-id",
        }),
      );
    }
  });

  it("does not include service keys in signed download responses", async () => {
    const result = await createSignedAssetDownload(
      tx,
      createDownloadProvider(),
      { tenantId: TENANT_ID },
      { assetReferenceId: ASSET_ID },
    );

    SignedDownloadResponseSchema.parse(result);
    assertNoSecretLeak(result, [R2_SECRET, R2_ACCESS_KEY, R2_ACCOUNT_ID]);
    expect(JSON.stringify(result.data)).not.toContain(RAW_OBJECT_KEY);
    expect(result.data).not.toHaveProperty("key");
    expect(result.data).not.toHaveProperty("bucket");
    expect(result.data).not.toHaveProperty("R2_SECRET_ACCESS_KEY");
    expect(result.data).not.toHaveProperty("R2_ACCESS_KEY_ID");
  });

  it("does not return a permanent public URL for protected assets", async () => {
    findAssetReferenceByIdMock.mockResolvedValue({
      ...readyAssetRow(),
      visibility: "private",
    });

    const result = await createSignedAssetDownload(
      tx,
      createDownloadProvider(),
      { tenantId: TENANT_ID },
      { assetReferenceId: ASSET_ID },
    );

    expect(result.data.url).not.toBe(PUBLIC_URL);
    expect(result.data.url).not.toMatch(/^https:\/\/cdn\.example\.com\/atlas-assets\//);
    expect(result.data.url).toContain("X-Amz-Signature=");
    expect(new Date(result.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
