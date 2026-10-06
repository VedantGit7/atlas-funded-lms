import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UPLOAD_CORS_RULE, type CorsRule } from "@atlas/storage/r2-cors";
import { setStorageProviderForTests } from "@atlas/storage/providers/storage-provider-factory";
import type { StorageProvider } from "@atlas/storage/providers/storage-provider";
import { startFakeR2Preflight } from "../storage/fake-r2-preflight";

/** At startup the API checks R2 would accept a browser upload, and never fails startup (audit M8). */

const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("@atlas/observability/logger", () => ({ structuredLogger: logger }));

const R2_ENV = {
  STORAGE_PROVIDER: "r2",
  R2_ACCOUNT_ID: "acct",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET_NAME: "atlas-assets",
  PLATFORM_HOST: "academy.atlas.example",
};

describe("startup R2 upload CORS check", () => {
  const servers: Array<{ close: () => Promise<void> }> = [];

  beforeEach(() => {
    for (const [key, value] of Object.entries(R2_ENV)) vi.stubEnv(key, value);
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    setStorageProviderForTests(null);
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  async function bucketWith(rules: CorsRule[]) {
    const r2 = await startFakeR2Preflight(rules);
    servers.push(r2);
    setStorageProviderForTests({
      createSignedUploadUrl: async () => ({
        url: r2.url,
        expiresAt: new Date(),
        requiredHeaders: {},
      }),
    } as unknown as StorageProvider);
    return r2;
  }
  const check = async () =>
    (await import("../../../backend/apps/api/src/server/check-r2-upload-cors")).checkR2UploadCors();

  it("reports a bucket that accepts uploads", async () => {
    const r2 = await bucketWith([UPLOAD_CORS_RULE]);
    await check();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "storage.r2_cors_ok", bucket: "atlas-assets" }),
    );
    expect(r2.state.requests.map((headers) => headers.origin)).toEqual([
      "https://academy.atlas.example",
      "https://custom-domain.cors-probe.invalid",
    ]);
  });

  it("raises an error event when R2 would refuse uploads", async () => {
    await bucketWith([
      { AllowedOrigins: ["*"], AllowedMethods: ["PUT"], AllowedHeaders: ["content-type"] },
    ]);
    await expect(check()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "storage.r2_cors_misconfigured",
        origins: ["https://academy.atlas.example", "https://custom-domain.cors-probe.invalid"],
      }),
    );
  });

  it("warns, without blaming CORS, when R2 cannot be reached", async () => {
    const r2 = await bucketWith([]);
    await r2.close();
    servers.pop();
    await expect(check()).resolves.toBeUndefined();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "storage.r2_cors_check_failed" }),
    );
  });

  it("does nothing without R2", async () => {
    vi.stubEnv("STORAGE_PROVIDER", "local-fs");
    const r2 = await bucketWith([UPLOAD_CORS_RULE]);
    await check();
    expect(r2.state.requests).toEqual([]);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
