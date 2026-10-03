import { afterEach, describe, expect, it, vi } from "vitest";
import { parseStorageEnv } from "@atlas/storage/schemas/storage-env";
import {
  getStorageProvider,
  setStorageProviderForTests,
} from "@atlas/storage/providers/storage-provider-factory";
import { deploymentEnv } from "../../helpers/deployment-env";
afterEach(() => {
  setStorageProviderForTests(null);
  vi.unstubAllEnvs();
});
describe("F05 storage environment bypass", () => {
  it("replaces a cached development provider with configured R2 without network calls", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("STORAGE_PROVIDER", "local-mock");
    const local = getStorageProvider();
    for (const [key, value] of Object.entries(deploymentEnv())) vi.stubEnv(key, value);
    expect(getStorageProvider()).not.toBe(local);
    expect(getStorageProvider().constructor.name).toBe("R2StorageProvider");
  });
  it.each([
    { NODE_ENV: "production" },
    { NODE_ENV: "production", APP_ENV: "development" },
    { VERCEL: "1", APP_ENV: "test" },
    { RELEASE_ENV: "production" },
  ])("rejects a local provider under deployed signal %j", (env) => {
    expect(() => parseStorageEnv(env)).toThrow(/STORAGE_PROVIDER/);
  });
  it("does not accept a cached local provider after a deployed transition", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("STORAGE_PROVIDER", "local-mock");
    getStorageProvider();
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getStorageProvider()).toThrow(/STORAGE_PROVIDER/);
  });
});
