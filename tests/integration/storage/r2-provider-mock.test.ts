import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@atlas/storage/providers/r2-storage-provider", () => ({
  R2StorageProvider: class MockR2StorageProvider {
    readonly mock = true;
  },
}));

import { LocalMockStorageProvider } from "@atlas/storage/providers/local-mock-storage-provider";
import { createStorageProvider } from "@atlas/storage/providers/storage-provider-factory";
import type { StorageProvider } from "@atlas/storage/providers/storage-provider";
import { parseStorageEnv } from "@atlas/storage/schemas/storage-env";

const STORAGE_PROVIDER_METHODS = [
  "createSignedUploadUrl",
  "createSignedDownloadUrl",
  "headObject",
  "deleteObject",
] as const;

const BUCKET = "test-bucket";
const KEY = "tenants/11111111-1111-4111-8111-111111111111/branding/logos/logo.png";

function assertStorageProviderShape(provider: StorageProvider): void {
  for (const method of STORAGE_PROVIDER_METHODS) {
    expect(typeof provider[method]).toBe("function");
  }
}

describe("local-mock storage provider integration", () => {
  let provider: LocalMockStorageProvider;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00.000Z"));

    provider = new LocalMockStorageProvider();

    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    process.env.STORAGE_PROVIDER = "local-mock";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("follows same interface as R2 provider", () => {
    assertStorageProviderShape(provider);

    const providersDir = resolve(import.meta.dirname, "../../../packages/storage/src/providers");
    const r2Source = readFileSync(resolve(providersDir, "r2-storage-provider.ts"), "utf8");
    const mockSource = readFileSync(
      resolve(providersDir, "local-mock-storage-provider.ts"),
      "utf8",
    );

    for (const method of STORAGE_PROVIDER_METHODS) {
      expect(r2Source).toContain(`async ${method}(`);
      expect(mockSource).toContain(`async ${method}(`);
    }

    expect(r2Source).toContain("implements StorageProvider");
    expect(mockSource).toContain("implements StorageProvider");
  });

  it("createSignedUploadUrl returns method-compatible URL", async () => {
    const result = await provider.createSignedUploadUrl({
      bucket: BUCKET,
      key: KEY,
      contentType: "image/png",
      sizeBytes: 1024,
      checksumSha256: null,
      expiresInSeconds: 300,
    });

    expect(result.url).toMatch(/^https?:\/\//);
    expect(result.url).toContain("/upload/");
    expect(result.url).toContain("expires=");
    expect(result.expiresAt.getTime()).toBe(Date.now() + 300_000);
    expect(result.requiredHeaders).toEqual({
      "content-type": "image/png",
    });
  });

  it("headObject validates metadata", async () => {
    await provider.createSignedUploadUrl({
      bucket: BUCKET,
      key: KEY,
      contentType: "image/png",
      sizeBytes: 2048,
      checksumSha256: "a".repeat(64),
      expiresInSeconds: 300,
    });

    const metadata = await provider.headObject({ bucket: BUCKET, key: KEY });

    expect(metadata).toEqual({
      contentType: "image/png",
      sizeBytes: 2048,
      checksumSha256: "a".repeat(64),
    });

    expect(await provider.headObject({ bucket: BUCKET, key: "missing-key" })).toBeNull();
  });

  it("createSignedDownloadUrl works after READY", async () => {
    await provider.createSignedUploadUrl({
      bucket: BUCKET,
      key: KEY,
      contentType: "image/png",
      sizeBytes: 1024,
      expiresInSeconds: 300,
    });

    const metadata = await provider.headObject({ bucket: BUCKET, key: KEY });
    expect(metadata).not.toBeNull();

    const download = await provider.createSignedDownloadUrl({
      bucket: BUCKET,
      key: KEY,
      expiresInSeconds: 300,
    });

    expect(download.url).toMatch(/^https?:\/\//);
    expect(download.url).toContain("/download/");
    expect(download.url).toContain("expires=");
    expect(download.expiresAt.getTime()).toBe(Date.now() + 300_000);
  });

  it("does not require production R2 credentials in test", () => {
    const env = parseStorageEnv({
      STORAGE_PROVIDER: "local-mock",
      R2_BUCKET_NAME: "test-bucket",
    });

    expect(env.STORAGE_PROVIDER).toBe("local-mock");
    expect(env.R2_ACCOUNT_ID).toBeUndefined();
    expect(env.R2_ACCESS_KEY_ID).toBeUndefined();
    expect(env.R2_SECRET_ACCESS_KEY).toBeUndefined();

    const created = createStorageProvider(env);
    expect(created).toBeInstanceOf(LocalMockStorageProvider);
    assertStorageProviderShape(created);
  });
});
