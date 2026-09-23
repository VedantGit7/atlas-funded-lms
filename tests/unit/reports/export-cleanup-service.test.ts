import type * as StorageModule from "@atlas/storage";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import {
  deleteExportRunFile,
  getExportRunDetail,
} from "@atlas/domain/reports/export-run-detail.service";
import { reportsRepository } from "@atlas/domain/reports/reports.repository";
import { dataRightsRepository } from "@atlas/domain/data-rights/data-rights.repository";
import { purgeExpiredExportFiles } from "@atlas/domain/reports/export-settings.service";
import { getStorageProvider } from "@atlas/storage";
import { getReportRun } from "@atlas/domain/reports/reports.service";

vi.mock("@atlas/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof StorageModule>()),
  getStorageProvider: vi.fn(() => {
    throw new Error("Storage unavailable");
  }),
}));

const id = "11111111-1111-4111-8111-111111111111";
const ctx = { tenantId: id, actorMembershipId: id, requestId: "test" };
const now = new Date();
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function setup(status = "SUCCEEDED") {
  vi.spyOn(auditWriter, "write").mockResolvedValue(undefined);
  vi.spyOn(reportsRepository, "findReportRunById").mockResolvedValue({
    id,
    tenant_id: id,
    report_definition_id: id,
    report_schedule_id: null,
    status,
    params_json: {},
    format: "csv",
    error_json: null,
    r2_object_key: `tenants/${id}/exports/${id}/test.csv`,
    created_at: now,
    updated_at: now,
    started_at: now,
    completed_at: now,
    expires_at: now,
    requested_by_membership_id: id,
    definition_key: "learners",
    definition_title: "Learners",
    progress_percent: 100,
    row_count: 1,
  } as Awaited<ReturnType<typeof reportsRepository.findReportRunById>>);
  vi.spyOn(reportsRepository, "findRequesterProfile").mockResolvedValue({
    name: "Admin",
    email: "admin@example.test",
  });
  vi.spyOn(dataRightsRepository, "findExportJobById").mockResolvedValue(null);
  const query = vi.fn(async () => [{ count: 1 }]);
  return { tx: { $queryRaw: query } as unknown as TenantTx, query };
}

describe("export deletion service", () => {
  it("does not sign report downloads against a changed storage bucket", async () => {
    const { tx } = setup();
    const run = await reportsRepository.findReportRunById(tx, id);
    if (!run) throw new Error("Missing fixture");
    run.expires_at = new Date(Date.now() + 86_400_000);
    run.artifact_json = { provider: "local-fs", bucket: "no-longer-configured" };
    expect((await getReportRun(tx, ctx, id)).data.download).toBeNull();
    expect((await getExportRunDetail(tx, ctx, id)).data.download).toBeNull();
    expect(getStorageProvider).not.toHaveBeenCalled();
  });
  it("does not issue a download through the report route after artifact expiry", async () => {
    const { tx } = setup();
    expect((await getReportRun(tx, ctx, id)).data.download).toBeNull();
    expect(getStorageProvider).not.toHaveBeenCalled();
  });
  it("can durably accept deletion during a storage outage without claiming success", async () => {
    const { tx } = setup();
    expect((await deleteExportRunFile(tx, ctx, id, { sourceType: "report_run" })).data).toEqual({
      id,
      sourceType: "report_run",
      deleted: false,
      hasFile: true,
      deletionPending: true,
    });
    expect(getStorageProvider).not.toHaveBeenCalled();
    expect(auditWriter.write).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      expect.objectContaining({ action: "report.export.file_deletion_requested" }),
    );
  });
  it("rejects deletion while the source is running", async () => {
    const { tx, query } = setup("RUNNING");
    await expect(deleteExportRunFile(tx, ctx, id, { sourceType: "report_run" })).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
    expect(auditWriter.write).not.toHaveBeenCalled();
  });
  it("does not queue a file from a different tenant", async () => {
    const { tx, query } = setup();
    await expect(
      deleteExportRunFile(tx, { ...ctx, tenantId: "22222222-2222-4222-8222-222222222222" }, id),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
  it("returns queued counts and zero freed bytes before background deletion", async () => {
    const { tx } = setup();
    expect((await purgeExpiredExportFiles(tx, ctx)).data).toEqual({
      queuedCount: 2,
      deletedCount: 0,
      estimatedBytesFreed: 0,
    });
    expect(getStorageProvider).not.toHaveBeenCalled();
  });
});
