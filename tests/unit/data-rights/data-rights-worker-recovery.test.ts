import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportArtifact } from "@atlas/domain/data-rights/export-artifact";
import { OutboxDeliveryError } from "@atlas/events/services/outbox-worker.service";
import type { ExportSpool, ExportSection } from "@atlas/domain/data-rights/export-spool";

const mocks = vi.hoisted(() => ({
  activeTransactions: 0,
  status: "QUEUED" as string,
  find: vi.fn(),
  claim: vi.fn(),
  lock: vi.fn(),
  requeue: vi.fn(),
  succeeded: vi.fn(),
  readPage: vi.fn(),
  spool: vi.fn(),
  store: vi.fn(),
  register: vi.fn(),
  stopped: vi.fn(),
  failed: vi.fn(),
  cleanup: vi.fn(),
  fetch: vi.fn(),
  put: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("@atlas/db", () => ({
  withTenantTx: async (_options: unknown, callback: (tx: object) => Promise<unknown>) => {
    const statusBefore = mocks.status;
    mocks.activeTransactions += 1;
    try {
      return await callback({ $queryRaw: vi.fn().mockResolvedValue([]) });
    } catch (error) {
      mocks.status = statusBefore;
      throw error;
    } finally {
      mocks.activeTransactions -= 1;
    }
  },
}));
vi.mock("@atlas/storage", () => ({
  parseStorageEnv: () => ({
    STORAGE_PROVIDER: "r2",
    R2_BUCKET_NAME: "bucket",
    STORAGE_SIGNED_UPLOAD_TTL_SECONDS: 300,
    STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS: 300,
  }),
  getStorageProvider: () => ({ createSignedUploadUrl: mocks.sign, putObject: mocks.put }),
  buildTenantStorageKey: (args: { tenantId: string; resourceId: string; fileName: string }) =>
    `tenants/${args.tenantId}/${args.resourceId}/${args.fileName}`,
}));
vi.mock("@atlas/domain/data-rights/data-rights.repository", () => ({
  dataRightsRepository: {
    findExportJobById: mocks.find,
    claimExportJobForProcessing: mocks.claim,
    lockRunningExportJob: mocks.lock,
    requeueExportJob: mocks.requeue,
    markExportJobSucceeded: mocks.succeeded,
    readExportPage: mocks.readPage,
    registerExportArtifact: mocks.register,
    markExportWriterStopped: mocks.stopped,
    markExportJobFailed: mocks.failed,
  },
}));
vi.mock("@atlas/domain/data-rights/export-spool", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  spoolTenantExport: mocks.spool,
}));
vi.mock("@atlas/domain/data-rights/export-artifact", () => ({ storeExportArtifact: mocks.store }));
vi.mock("@atlas/domain/data-rights/export-pages.repository", () => ({
  readExportPage: mocks.readPage,
}));

import { handleDataRightsOutboxEvent } from "@atlas/domain/data-rights/data-rights.worker";
import { DATA_EXPORT_REQUESTED_EVENT } from "@atlas/domain/data-rights/data-rights.events";
import { ExportLimitError } from "@atlas/domain/data-rights/export-spool";
import { storeReportArtifact } from "@atlas/domain/reports/reports-export-runner";

const exportJobId = "11111111-1111-4111-8111-111111111111";
const event = {
  id: "22222222-2222-4222-8222-222222222222",
  tenantId: "33333333-3333-4333-8333-333333333333",
  requestId: "export-request",
  eventType: DATA_EXPORT_REQUESTED_EVENT,
  payload: {
    exportJobId,
    requestedAt: "2026-09-20T00:00:00.000Z",
    requestedByMembershipId: "44444444-4444-4444-8444-444444444444",
    schemaVersion: 1,
  },
};
const file: ExportSpool = {
  path: "spooled-export.json",
  sizeBytes: 321,
  checksumSha256: "a".repeat(64),
  cleanup: mocks.cleanup,
};
const artifact: ExportArtifact = {
  version: 1,
  provider: "r2",
  bucket: "bucket",
  contentType: "application/json",
  sizeBytes: file.sizeBytes,
  checksumSha256: file.checksumSha256,
  verifiedAt: "2026-09-20T00:00:00.000Z",
};
type StoreArgs = {
  exportJobId: string;
  file: ExportSpool;
  retentionMs: number;
  onPrepared: (prepared: {
    objectKey: string;
    expiresAt: Date;
    artifact: ExportArtifact;
  }) => Promise<void>;
};
async function store(_ctx: unknown, args: StoreArgs) {
  expect(mocks.activeTransactions).toBe(0);
  const stored = {
    objectKey: `tenants/${event.tenantId}/exports/${args.exportJobId}/tenant-export.json`,
    expiresAt: new Date(Date.now() + args.retentionMs),
    artifact,
  };
  await args.onPrepared({ ...stored, artifact: { ...artifact, verifiedAt: null } });
  return stored;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.activeTransactions = 0;
  mocks.status = "QUEUED";
  mocks.find.mockImplementation(() => ({ id: exportJobId, status: mocks.status }));
  mocks.claim.mockImplementation(() => {
    if (mocks.status !== "QUEUED") return null;
    mocks.status = "RUNNING";
    return { id: exportJobId, status: mocks.status };
  });
  mocks.lock.mockImplementation(() => mocks.status === "RUNNING");
  mocks.requeue.mockImplementation(() => {
    if (mocks.status === "RUNNING") mocks.status = "QUEUED";
  });
  mocks.succeeded.mockImplementation(() => {
    mocks.status = "SUCCEEDED";
    return { id: exportJobId };
  });
  mocks.failed.mockImplementation(() => {
    if (mocks.status === "RUNNING") mocks.status = "FAILED";
  });
  mocks.readPage.mockResolvedValue([]);
  mocks.spool.mockImplementation(
    async (
      _ctx: unknown,
      loadPage: (section: ExportSection, cursor?: string) => Promise<unknown>,
    ) => {
      expect(mocks.activeTransactions).toBe(0);
      await loadPage("memberships");
      await loadPage("memberProfiles", "last-cursor");
      return file;
    },
  );
  mocks.store.mockImplementation(store);
  mocks.register.mockResolvedValue(true);
  mocks.cleanup.mockResolvedValue(undefined);
  mocks.stopped.mockResolvedValue(undefined);
  mocks.sign.mockResolvedValue({ url: "https://storage.test/upload", requiredHeaders: {} });
  mocks.fetch.mockResolvedValue({ ok: true });
  mocks.put.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("data rights export recovery", () => {
  it("keeps an uncertain remote upload for reconciliation without retry or cleanup acknowledgment", async () => {
    mocks.store.mockRejectedValueOnce(
      new OutboxDeliveryError("reconciliation_required", "EXPORT_UPLOAD_OUTCOME_UNKNOWN"),
    );
    await expect(handleDataRightsOutboxEvent(event)).rejects.toMatchObject({
      kind: "reconciliation_required",
    });
    expect(mocks.status).toBe("RUNNING");
    expect(mocks.requeue).not.toHaveBeenCalled();
    expect(mocks.stopped).not.toHaveBeenCalled();
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });
  it("reads each page in a short transaction and spools/uploads outside transactions", async () => {
    mocks.readPage.mockImplementation(() => {
      expect(mocks.activeTransactions).toBe(1);
      return [];
    });
    mocks.register.mockImplementation(() => {
      expect(mocks.activeTransactions).toBe(1);
      return true;
    });
    await handleDataRightsOutboxEvent(event);
    expect(mocks.readPage).toHaveBeenCalledTimes(2);
    expect(mocks.register).toHaveBeenCalledOnce();
    expect(mocks.status).toBe("SUCCEEDED");
    expect(mocks.store.mock.calls[0]?.[1].file).toBe(file);
    expect(mocks.cleanup).toHaveBeenCalledOnce();
    expect(mocks.stopped).not.toHaveBeenCalled();
  });

  it("retries a transient upload failure with the same export identity and cleans each spool", async () => {
    mocks.store.mockImplementationOnce(async (ctx: unknown, args: StoreArgs) => {
      await store(ctx, args);
      throw new Error("network failure");
    });
    await expect(handleDataRightsOutboxEvent(event)).rejects.toMatchObject({ kind: "retryable" });
    expect(mocks.status).toBe("QUEUED");
    expect(mocks.cleanup).toHaveBeenCalledOnce();
    await handleDataRightsOutboxEvent({ ...event, requestId: "retry-request" });
    expect(mocks.status).toBe("SUCCEEDED");
    expect(mocks.store.mock.calls[0]?.[1].exportJobId).toBe(
      mocks.store.mock.calls[1]?.[1].exportJobId,
    );
    expect(mocks.cleanup).toHaveBeenCalledTimes(2);
    expect(mocks.stopped).toHaveBeenCalledOnce();
  });

  it("retries a page read failure before uploading", async () => {
    mocks.readPage.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(handleDataRightsOutboxEvent(event)).rejects.toMatchObject({ kind: "retryable" });
    expect(mocks.store).not.toHaveBeenCalled();
    expect(mocks.status).toBe("QUEUED");
    expect(mocks.cleanup).not.toHaveBeenCalled();
    expect(mocks.stopped).toHaveBeenCalledOnce();
    await handleDataRightsOutboxEvent(event);
    expect(mocks.status).toBe("SUCCEEDED");
  });

  it("marks export resource limits permanent instead of retrying forever", async () => {
    mocks.spool.mockRejectedValueOnce(new ExportLimitError("EXPORT_BYTE_LIMIT"));
    await expect(handleDataRightsOutboxEvent(event)).rejects.toMatchObject({ kind: "permanent" });
    expect(mocks.failed).toHaveBeenCalledOnce();
    expect(mocks.requeue).not.toHaveBeenCalled();
    expect(mocks.store).not.toHaveBeenCalled();
    expect(mocks.stopped).toHaveBeenCalledOnce();
  });

  it("requeues after a completion transaction fails and retries the same export", async () => {
    mocks.succeeded.mockRejectedValueOnce(new Error("completion transaction rolled back"));
    await expect(handleDataRightsOutboxEvent(event)).rejects.toMatchObject({ kind: "retryable" });
    expect(mocks.status).toBe("QUEUED");
    expect(mocks.cleanup).toHaveBeenCalledOnce();
    await handleDataRightsOutboxEvent(event);
    expect(mocks.status).toBe("SUCCEEDED");
  });

  it("does not acknowledge a claim lost to another worker", async () => {
    mocks.claim.mockResolvedValue(null);
    await expect(handleDataRightsOutboxEvent(event)).rejects.toMatchObject({ kind: "retryable" });
    expect(mocks.requeue).not.toHaveBeenCalled();
    expect(mocks.store).not.toHaveBeenCalled();
    expect(mocks.stopped).not.toHaveBeenCalled();
  });

  it("acknowledges stopped provider I/O before requeueing and cleans the spool on cancellation", async () => {
    const started = Promise.withResolvers<undefined>();
    const uploading = Promise.withResolvers<never>();
    mocks.store.mockImplementationOnce(() => {
      started.resolve(undefined);
      return uploading.promise;
    });
    const result = expect(handleDataRightsOutboxEvent(event)).rejects.toMatchObject({
      kind: "retryable",
    });
    await started.promise;
    expect(mocks.stopped).not.toHaveBeenCalled();
    expect(mocks.requeue).not.toHaveBeenCalled();
    uploading.reject(new DOMException("Upload aborted", "AbortError"));
    await result;
    expect(mocks.status).toBe("QUEUED");
    expect(mocks.cleanup).toHaveBeenCalledOnce();
    expect(mocks.stopped.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.requeue.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("requires reconciliation for an existing RUNNING export without stealing it", async () => {
    mocks.status = "RUNNING";
    await expect(handleDataRightsOutboxEvent(event)).rejects.toMatchObject({
      kind: "reconciliation_required",
    });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.requeue).not.toHaveBeenCalled();
    expect(mocks.store).not.toHaveBeenCalled();
    expect(mocks.stopped).not.toHaveBeenCalled();
  });

  it.each(["FAILED", "CANCELLED"])("rejects terminal %s exports permanently", async (status) => {
    mocks.status = status;
    await expect(handleDataRightsOutboxEvent(event)).rejects.toMatchObject({ kind: "permanent" });
    expect(mocks.store).not.toHaveBeenCalled();
  });

  it("only acknowledges a previously successful export", async () => {
    mocks.status = "SUCCEEDED";
    await handleDataRightsOutboxEvent(event);
    expect(mocks.store).not.toHaveBeenCalled();
  });

  it("rejects missing exports instead of acknowledging them", async () => {
    mocks.find.mockResolvedValue(null);
    await expect(handleDataRightsOutboxEvent(event)).rejects.toMatchObject({ kind: "permanent" });
  });

  it("does not overwrite cancellation during upload", async () => {
    mocks.store.mockImplementation(async (ctx: unknown, args: StoreArgs) => {
      const result = await store(ctx, args);
      mocks.status = "CANCELLED";
      return result;
    });
    await expect(handleDataRightsOutboxEvent(event)).rejects.toMatchObject({ kind: "permanent" });
    expect(mocks.status).toBe("CANCELLED");
    expect(mocks.succeeded).not.toHaveBeenCalled();
    expect(mocks.cleanup).toHaveBeenCalledOnce();
    expect(mocks.stopped).toHaveBeenCalledOnce();
  });
});

it("also bounds report artifact PUT requests", async () => {
  const timeout = vi.spyOn(AbortSignal, "timeout");
  await storeReportArtifact(
    {
      tenantId: event.tenantId,
      actorMembershipId: event.payload.requestedByMembershipId,
      requestId: event.requestId,
    },
    {
      reportRunId: exportJobId,
      content: new Uint8Array([1]),
      contentType: "text/csv",
      fileExtension: "csv",
    },
  );
  expect(timeout).toHaveBeenCalledWith(30_000);
  expect(mocks.fetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});
