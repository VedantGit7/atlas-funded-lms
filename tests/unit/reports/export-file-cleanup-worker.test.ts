import { describe, expect, it, vi } from "vitest";
import {
  runExportFileCleanup,
  type CleanupDependencies,
} from "@atlas/domain/reports/export-file-cleanup";
import type { CleanupRequest } from "@atlas/domain/reports/export-file-cleanup.repository";

const tenantId = "11111111-1111-4111-8111-111111111111";
const request: CleanupRequest = {
  id: "22222222-2222-4222-8222-222222222222",
  tenant_id: tenantId,
  source_type: "export_job",
  source_id: "33333333-3333-4333-8333-333333333333",
  object_key: `tenants/${tenantId}/exports/33333333-3333-4333-8333-333333333333/tenant-export.json`,
  lease_token: "lease",
  artifact_json: { provider: "local-fs", bucket: "atlas-assets", verifiedAt: null },
};

function setup(overrides: Partial<CleanupRequest> = {}) {
  const order: string[] = [];
  const deps: CleanupDependencies = {
    claim: vi.fn(async () => [{ ...request, ...overrides }]),
    complete: vi.fn(async () => {
      order.push("complete");
      return true;
    }),
    fail: vi.fn(async () => {
      order.push("fail");
    }),
    deleteObject: vi.fn(async () => {
      order.push("delete");
    }),
    headObject: vi.fn(async () => {
      order.push("head");
      return null;
    }),
    provider: "local-fs",
    bucket: "atlas-assets",
  };
  return { deps, order };
}

describe("durable export cleanup", () => {
  it("only acknowledges deletion after the object is confirmed absent", async () => {
    const { deps, order } = setup();
    expect(await runExportFileCleanup({ tenantId, requestId: "test" }, deps)).toEqual({
      deleted: 1,
      failed: 0,
    });
    expect(order).toEqual(["delete", "head", "complete"]);
  });
  it.each(["delete", "head", "still-present"])(
    "keeps references retryable after %s failure",
    async (failure) => {
      const { deps } = setup();
      if (failure === "delete")
        vi.mocked(deps.deleteObject).mockRejectedValue(new Error("provider down"));
      if (failure === "head")
        vi.mocked(deps.headObject).mockRejectedValue(new Error("access denied"));
      if (failure === "still-present")
        vi.mocked(deps.headObject).mockResolvedValue({
          sizeBytes: 1,
          contentType: "application/json",
        });
      expect(await runExportFileCleanup({ tenantId, requestId: "test" }, deps)).toEqual({
        deleted: 0,
        failed: 1,
      });
      expect(deps.complete).not.toHaveBeenCalled();
      expect(deps.fail).toHaveBeenCalledOnce();
    },
  );
  it.each([
    { object_key: "tenants/another-tenant/exports/file.json" },
    { object_key: `tenants/${tenantId}/exports/another-source/file.json` },
    { tenant_id: "another-tenant" },
    { artifact_json: null },
    { artifact_json: { provider: "r2", bucket: "atlas-assets" } },
    { artifact_json: { provider: "local-fs", bucket: "another-bucket" } },
  ])("fails closed before storage mutation for unsafe storage identity %j", async (overrides) => {
    const { deps } = setup(overrides);
    expect((await runExportFileCleanup({ tenantId, requestId: "test" }, deps)).failed).toBe(1);
    expect(deps.deleteObject).not.toHaveBeenCalled();
    expect(deps.complete).not.toHaveBeenCalled();
  });
  it("does not count stale lease completion as a deletion", async () => {
    const { deps } = setup();
    vi.mocked(deps.complete).mockResolvedValue(false);
    expect((await runExportFileCleanup({ tenantId, requestId: "test" }, deps)).deleted).toBe(0);
  });
  it("retains a legacy report without recorded storage identity", async () => {
    const { deps } = setup({ source_type: "report_run", artifact_json: null });
    expect((await runExportFileCleanup({ tenantId, requestId: "test" }, deps)).failed).toBe(1);
    expect(deps.deleteObject).not.toHaveBeenCalled();
  });
  it("isolates one failure and completes another artifact", async () => {
    const { deps } = setup();
    vi.mocked(deps.claim).mockResolvedValue([{ ...request, artifact_json: null }, request]);
    expect(await runExportFileCleanup({ tenantId, requestId: "test" }, deps)).toEqual({
      deleted: 1,
      failed: 1,
    });
  });
});
