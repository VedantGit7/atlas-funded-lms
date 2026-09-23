import type * as StorageModule from "@atlas/storage";
import { afterEach, describe, expect, it, vi } from "vitest";
import { storeReportArtifact } from "@atlas/domain/reports/reports-export-runner";
vi.mock("@atlas/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof StorageModule>()),
  parseStorageEnv: () => ({
    STORAGE_PROVIDER: "local-fs",
    R2_BUCKET_NAME: "test",
    STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS: 60,
    STORAGE_SIGNED_UPLOAD_TTL_SECONDS: 60,
  }),
  getStorageProvider: () => ({
    createSignedUploadUrl: async () => ({ url: "unused", requiredHeaders: {} }),
    putObject: async () => {},
  }),
}));
afterEach(() => vi.useRealTimers());
const ctx = { tenantId: "tenant", actorMembershipId: "owner", requestId: "test" };
const input = {
  reportRunId: "run",
  content: Buffer.from("data"),
  contentType: "text/csv",
  fileExtension: "csv",
};
describe("report artifact retention", () => {
  it("records the storage identity for later retention cleanup", async () => {
    expect((await storeReportArtifact(ctx, input)).artifact).toEqual({
      provider: "local-fs",
      bucket: "test",
    });
  });
  it("retains artifacts for seven days by default independently of download URL TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    expect((await storeReportArtifact(ctx, input)).expiresAt.toISOString()).toBe(
      "2026-09-08T00:00:00.000Z",
    );
  });
  it("honors the tenant retention duration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    expect(
      (
        await storeReportArtifact(ctx, { ...input, retentionMs: 2 * 3_600_000 })
      ).expiresAt.toISOString(),
    ).toBe("2026-09-01T02:00:00.000Z");
  });
});
