import { describe, expect, it } from "vitest";
import { parseStorageEnv } from "@atlas/storage/schemas/storage-env";

/**
 * Regression test for audit finding M5.
 *
 * STORAGE_PROVIDER defaults to "local-fs". A production deploy that forgot to
 * set it silently wrote course content, branding assets and certificates to
 * ephemeral container disk, losing every upload on redeploy — with no error at
 * boot to indicate anything was wrong.
 */

const r2Env = {
  STORAGE_PROVIDER: "r2",
  R2_ACCOUNT_ID: "acct",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET_NAME: "bucket",
} as NodeJS.ProcessEnv;

describe("parseStorageEnv fail-closed behaviour", () => {
  it.each(["production", "staging"])(
    "rejects the default local provider when APP_ENV=%s",
    (appEnv) => {
      expect(() => parseStorageEnv({ APP_ENV: appEnv } as NodeJS.ProcessEnv)).toThrow(
        /STORAGE_PROVIDER must be "r2"/,
      );
    },
  );

  it("rejects an explicit local provider in production", () => {
    expect(() =>
      parseStorageEnv({ APP_ENV: "production", STORAGE_PROVIDER: "local-fs" } as NodeJS.ProcessEnv),
    ).toThrow(/STORAGE_PROVIDER must be "r2"/);
  });

  it("accepts r2 in production when fully configured", () => {
    expect(() => parseStorageEnv({ ...r2Env, APP_ENV: "production" })).not.toThrow();
  });

  it("still reports missing R2 settings in production", () => {
    expect(() =>
      parseStorageEnv({ APP_ENV: "production", STORAGE_PROVIDER: "r2" } as NodeJS.ProcessEnv),
    ).toThrow(/missing required env vars/);
  });

  it("leaves local development untouched", () => {
    const parsed = parseStorageEnv({ APP_ENV: "development" } as NodeJS.ProcessEnv);
    expect(parsed.STORAGE_PROVIDER).toBe("local-fs");
  });

  it("leaves an unset APP_ENV untouched", () => {
    const parsed = parseStorageEnv({} as NodeJS.ProcessEnv);
    expect(parsed.STORAGE_PROVIDER).toBe("local-fs");
  });
});
