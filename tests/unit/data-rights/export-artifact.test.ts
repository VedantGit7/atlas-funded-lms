import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { readFile, stat } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { spoolTenantExport } from "@atlas/domain/data-rights/export-spool";
import {
  resolveVerifiedExportDownload,
  storeExportArtifact,
} from "@atlas/domain/data-rights/export-artifact";

const mocks = vi.hoisted(() => ({
  provider: {} as Record<string, unknown>,
  providerKind: "local-fs",
}));
vi.mock("@atlas/storage", () => ({
  getStorageProvider: () => mocks.provider,
  parseStorageEnv: () => ({
    STORAGE_PROVIDER: mocks.providerKind,
    R2_BUCKET_NAME: "exports",
    STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS: 300,
  }),
  assertTenantKeyPrefix: ({ tenantId, key }: { tenantId: string; key: string }) => {
    if (!key.startsWith(`tenants/${tenantId}/`)) throw new Error("Tenant mismatch");
  },
}));
const ctx = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  actorMembershipId: "22222222-2222-4222-8222-222222222222",
  requestId: "test",
};
const id = "33333333-3333-4333-8333-333333333333";
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  mocks.providerKind = "local-fs";
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.restoreAllMocks();
});
async function file() {
  const result = await spoolTenantExport(
    ctx,
    async (section) =>
      section === "memberships"
        ? [{ cursor: id, data: { id, status: "ACTIVE", joinedAt: "2026-09-20T00:00:00.000Z" } }]
        : [],
    { maxRows: 100, maxBytes: 10000 },
  );
  cleanups.push(result.cleanup);
  return result;
}
function provider(bytes: Buffer) {
  mocks.provider = {
    putObjectStream: vi.fn(async ({ body }: { body: Readable }) => {
      for await (const _part of body) void _part;
    }),
    headObject: vi.fn(async () => ({ sizeBytes: bytes.length, contentType: "application/json" })),
    getObjectStream: vi.fn(async () => Readable.from([bytes])),
    createSignedDownloadUrl: vi.fn(async (input: { expiresInSeconds: number }) => ({
      url: "https://example.test/download",
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
    })),
  };
}
describe("F15 bounded verified artifacts", () => {
  it("requires reconciliation for an uncertain remote PUT instead of racing a retry", async () => {
    const result = await file();
    provider(await readFile(result.path));
    mocks.providerKind = "r2";
    mocks.provider.putObjectStream = vi.fn(async () => {
      throw new Error("Lost remote response");
    });
    await expect(
      storeExportArtifact(ctx, { exportJobId: id, file: result, retentionMs: 86400000 }),
    ).rejects.toMatchObject({ kind: "reconciliation_required" });
  });
  it("pages in order, rejects stalled cursors and oversized records", async () => {
    const page = Array.from({ length: 100 }, (_, i) => ({
      cursor: String(i).padStart(4, "0"),
      data: { id: i },
    }));
    const load = vi.fn(async (section: string, cursor?: string) =>
      section === "memberships" ? (cursor ? [{ cursor: "0100", data: { id: 100 } }] : page) : [],
    );
    const result = await spoolTenantExport(ctx, load);
    cleanups.push(result.cleanup);
    expect(JSON.parse((await readFile(result.path)).toString()).memberships).toHaveLength(101);
    expect(load).toHaveBeenCalledWith("memberships", "0099");
    await expect(spoolTenantExport(ctx, async () => page)).rejects.toThrow("EXPORT_CURSOR_INVALID");
    await expect(spoolTenantExport(ctx, async () => [{ cursor: id, data: null }])).rejects.toThrow(
      "EXPORT_RECORD_LIMIT",
    );
  });
  it("spools the actual coverage and SHA256 and removes the private file", async () => {
    const result = await file();
    const bytes = await readFile(result.path);
    expect(result.sizeBytes).toBe(bytes.length);
    expect(result.checksumSha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(JSON.parse(bytes.toString()).coverage.completePersonalDataExport).toBe(false);
    await result.cleanup();
    await expect(stat(result.path)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("fails closed on row and byte limits rather than publishing a truncated success", async () => {
    await expect(
      spoolTenantExport(ctx, async () => [{ cursor: id, data: { name: "too much" } }], {
        maxRows: 1,
        maxBytes: 10000,
      }),
    ).rejects.toThrow("EXPORT_ROW_LIMIT");
    await expect(
      spoolTenantExport(ctx, async () => [], { maxRows: 100, maxBytes: 10 }),
    ).rejects.toThrow("EXPORT_BYTE_LIMIT");
  });
  it("registers a pending reference before writing and verifies bytes before returning success", async () => {
    const result = await file();
    const bytes = await readFile(result.path);
    provider(bytes);
    const registered = vi.fn(async () => {
      expect(mocks.provider.putObjectStream).not.toHaveBeenCalled();
    });
    const stored = await storeExportArtifact(ctx, {
      exportJobId: id,
      file: result,
      retentionMs: 7 * 86400000,
      onPrepared: registered,
    });
    expect(registered).toHaveBeenCalledOnce();
    expect(stored.artifact.checksumSha256).toBe(result.checksumSha256);
    expect(stored.artifact.verifiedAt).toBeTruthy();
    expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(6 * 86400000);
  });
  it("rejects corrupted readback, missing objects, wrong size/type and write failure", async () => {
    const result = await file();
    const bytes = await readFile(result.path);
    for (const kind of ["corrupt", "missing", "size", "type", "write"]) {
      provider(bytes);
      if (kind === "corrupt")
        mocks.provider.getObjectStream = vi.fn(async () =>
          Readable.from([Buffer.alloc(bytes.length, 0)]),
        );
      if (kind === "missing") mocks.provider.headObject = vi.fn(async () => null);
      if (kind === "size")
        mocks.provider.headObject = vi.fn(async () => ({
          sizeBytes: 1,
          contentType: "application/json",
        }));
      if (kind === "type")
        mocks.provider.headObject = vi.fn(async () => ({
          sizeBytes: bytes.length,
          contentType: "text/plain",
        }));
      if (kind === "write")
        mocks.provider.putObjectStream = vi.fn(async () => {
          throw Error("Write failed");
        });
      await expect(
        storeExportArtifact(ctx, { exportJobId: id, file: result, retentionMs: 86400000 }),
      ).rejects.toThrow();
    }
  });
  it("denies expired/unverified/provider-mismatched artifacts and caps link TTL", async () => {
    const result = await file();
    const bytes = await readFile(result.path);
    provider(bytes);
    const stored = await storeExportArtifact(ctx, {
      exportJobId: id,
      file: result,
      retentionMs: 86400000,
    });
    const job = {
      id,
      tenant_id: ctx.tenantId,
      status: "SUCCEEDED",
      r2_object_key: stored.objectKey,
      artifact_json: stored.artifact,
      expires_at: new Date(Date.now() + 90000),
    };
    expect(await resolveVerifiedExportDownload(ctx, job as never)).not.toBeNull();
    expect(mocks.provider.createSignedDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: expect.any(Number) }),
    );
    const call = vi.mocked(mocks.provider.createSignedDownloadUrl as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0];
    expect(call.expiresInSeconds).toBeLessThanOrEqual(90);
    for (const replacement of [
      { expires_at: new Date(0) },
      { artifact_json: null },
      { artifact_json: { ...stored.artifact, bucket: "changed" } },
      { tenant_id: "foreign" },
    ]) {
      expect(
        await resolveVerifiedExportDownload(ctx, { ...job, ...replacement } as never),
      ).toBeNull();
    }
  });
});
