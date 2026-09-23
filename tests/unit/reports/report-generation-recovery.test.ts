import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeTransactions: 0,
  status: "QUEUED" as string,
  find: vi.fn(),
  claim: vi.fn(),
  lock: vi.fn(),
  definition: vi.fn(),
  progress: vi.fn(),
  succeeded: vi.fn(),
  failed: vi.fn(),
  requeue: vi.fn(),
  dataset: vi.fn(),
  render: vi.fn(),
  store: vi.fn(),
  publish: vi.fn(),
  retention: vi.fn(),
}));

vi.mock("@atlas/db", () => ({
  withTenantTx: async (_options: unknown, callback: (tx: object) => Promise<unknown>) => {
    const statusBefore = mocks.status;
    mocks.activeTransactions += 1;
    try {
      return await callback({});
    } catch (error) {
      mocks.status = statusBefore;
      throw error;
    } finally {
      mocks.activeTransactions -= 1;
    }
  },
}));
vi.mock("@atlas/events", () => ({ outbox: { publish: mocks.publish } }));
vi.mock("@atlas/domain/reports/export-settings.repository", () => ({
  exportSettingsRepository: { getFileRetentionMs: mocks.retention },
}));
vi.mock("@atlas/domain/reports/reports.repository", () => ({
  reportsRepository: {
    findReportRunById: mocks.find,
    claimReportRunForProcessing: mocks.claim,
    lockRunningReportRun: mocks.lock,
    findDefinitionById: mocks.definition,
    updateReportRunProgress: mocks.progress,
    markReportRunSucceeded: mocks.succeeded,
    markReportRunFailed: mocks.failed,
    requeueReportRun: mocks.requeue,
  },
}));
vi.mock("@atlas/domain/reports/reports.datasets", () => ({
  buildReportDataset: mocks.dataset,
  DATASET_BUILDERS: {},
}));
vi.mock("@atlas/domain/reports/reports-export-runner", () => ({
  renderReportArtifact: mocks.render,
  storeReportArtifact: mocks.store,
}));

import { processReportGenerateStandalone } from "@atlas/domain/reports/reports.worker";
import { REPORT_GENERATE_REQUESTED_EVENT } from "@atlas/domain/reports/reports.events";

const reportRunId = "11111111-1111-4111-8111-111111111111";
const args = {
  tenantId: "22222222-2222-4222-8222-222222222222",
  requestId: "request-one",
  event: {
    id: "33333333-3333-4333-8333-333333333333",
    eventType: REPORT_GENERATE_REQUESTED_EVENT,
    payload: {
      reportRunId,
      reportDefinitionKey: "enrollments",
      requestedAt: "2026-09-20T00:00:00.000Z",
      requestedByMembershipId: "44444444-4444-4444-8444-444444444444",
      format: "csv",
      schemaVersion: 1,
    },
  },
};
const run = { id: reportRunId, report_definition_id: "definition", format: "csv", params_json: {} };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.activeTransactions = 0;
  mocks.status = "QUEUED";
  mocks.retention.mockImplementation(() => {
    expect(mocks.activeTransactions).toBe(1);
    return 2 * 3_600_000;
  });
  mocks.find.mockImplementation(() => ({ ...run, status: mocks.status }));
  mocks.claim.mockImplementation(() => {
    if (mocks.status !== "QUEUED") return null;
    mocks.status = "RUNNING";
    return { ...run, status: mocks.status };
  });
  mocks.lock.mockImplementation(() => mocks.status === "RUNNING");
  mocks.definition.mockResolvedValue({
    key: "enrollments",
    title: "Enrollments",
    dataset_key: "enrollments",
    scope: "system",
  });
  mocks.dataset.mockResolvedValue({ columns: ["id"], rows: [{ id: "one" }] });
  mocks.render.mockResolvedValue({
    content: new Uint8Array([1]),
    contentType: "text/csv",
    fileExtension: "csv",
  });
  mocks.store.mockResolvedValue({ objectKey: "exports/report.csv", expiresAt: new Date() });
  mocks.succeeded.mockImplementation(() => {
    mocks.status = "SUCCEEDED";
    return { ...run, status: mocks.status };
  });
  mocks.failed.mockImplementation(() => {
    mocks.status = "FAILED";
  });
  mocks.requeue.mockImplementation(() => {
    if (mocks.status === "RUNNING") mocks.status = "QUEUED";
  });
});

describe("report generation durable retries", () => {
  it("uploads outside any tenant transaction", async () => {
    mocks.store.mockImplementation(() => {
      expect(mocks.activeTransactions).toBe(0);
      return { objectKey: "exports/report.csv", expiresAt: new Date() };
    });
    await processReportGenerateStandalone(args);
    expect(mocks.status).toBe("SUCCEEDED");
    expect(mocks.publish).toHaveBeenCalledOnce();
    expect(mocks.store).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ retentionMs: 2 * 3_600_000 }),
    );
  });

  it("retries a transient upload failure instead of acknowledging a failed run", async () => {
    mocks.store.mockRejectedValueOnce(new Error("temporary upload outage"));
    await expect(processReportGenerateStandalone(args)).rejects.toMatchObject({
      kind: "retryable",
    });
    expect(mocks.status).toBe("QUEUED");
    await processReportGenerateStandalone({ ...args, requestId: "request-two" });
    expect(mocks.status).toBe("SUCCEEDED");
    expect(mocks.publish).toHaveBeenCalledOnce();
  });

  it("holds an interrupted RUNNING run for reconciliation without taking it over", async () => {
    mocks.status = "RUNNING";
    await expect(processReportGenerateStandalone(args)).rejects.toMatchObject({
      kind: "reconciliation_required",
      code: "REPORT_RUN_ALREADY_RUNNING",
    });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.requeue).not.toHaveBeenCalled();
    expect(mocks.store).not.toHaveBeenCalled();
  });

  it("does not start another generation while the claimed worker is rendering", async () => {
    let finishRender!: (artifact: {
      content: Uint8Array;
      contentType: string;
      fileExtension: string;
    }) => void;
    let started!: () => void;
    const rendering = new Promise<void>((resolve) => {
      started = resolve;
    });
    mocks.render.mockImplementation(() => {
      started();
      return new Promise((resolve) => {
        finishRender = resolve;
      });
    });
    const first = processReportGenerateStandalone(args);
    await rendering;
    await expect(processReportGenerateStandalone(args)).rejects.toMatchObject({
      kind: "reconciliation_required",
    });
    expect(mocks.claim).toHaveBeenCalledOnce();
    finishRender({ content: new Uint8Array([1]), contentType: "text/csv", fileExtension: "csv" });
    await first;
    expect(mocks.store).toHaveBeenCalledOnce();
    expect(mocks.publish).toHaveBeenCalledOnce();
  });

  it("retries a dataset failure without leaving a terminal report run", async () => {
    mocks.dataset.mockRejectedValueOnce(new Error("database temporarily unavailable"));
    await expect(processReportGenerateStandalone(args)).rejects.toMatchObject({
      kind: "retryable",
    });
    expect(mocks.status).toBe("QUEUED");
    await processReportGenerateStandalone(args);
    expect(mocks.status).toBe("SUCCEEDED");
  });

  it("retries a rolled-back completion using the same success-event identity", async () => {
    mocks.publish.mockRejectedValueOnce(new Error("transaction failed"));
    await expect(processReportGenerateStandalone(args)).rejects.toMatchObject({
      kind: "retryable",
    });
    expect(mocks.status).toBe("QUEUED");
    await processReportGenerateStandalone({ ...args, requestId: "retry-request" });
    expect(mocks.status).toBe("SUCCEEDED");
    for (const call of mocks.publish.mock.calls) {
      expect(call[1]).toMatchObject({ idempotencyKey: `report-ready:${reportRunId}` });
    }
  });

  it.each(["FAILED", "CANCELLED"])("rejects terminal %s runs permanently", async (status) => {
    mocks.status = status;
    await expect(processReportGenerateStandalone(args)).rejects.toMatchObject({
      kind: "permanent",
    });
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("acknowledges an already completed run without another upload or event", async () => {
    mocks.status = "SUCCEEDED";
    await processReportGenerateStandalone(args);
    expect(mocks.store).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("rejects a missing run permanently", async () => {
    mocks.find.mockResolvedValue(null);
    await expect(processReportGenerateStandalone(args)).rejects.toMatchObject({
      kind: "permanent",
    });
  });

  it("commits missing-definition failure then reports permanent delivery failure", async () => {
    mocks.definition.mockResolvedValue(null);
    await expect(processReportGenerateStandalone(args)).rejects.toMatchObject({
      kind: "permanent",
      code: "REPORT_DEFINITION_NOT_FOUND",
    });
    expect(mocks.status).toBe("FAILED");
    expect(mocks.requeue).not.toHaveBeenCalled();
  });

  it("does not silently acknowledge losing the atomic claim", async () => {
    mocks.claim.mockResolvedValue(null);
    await expect(processReportGenerateStandalone(args)).rejects.toMatchObject({
      kind: "retryable",
    });
    expect(mocks.requeue).not.toHaveBeenCalled();
  });

  it("does not overwrite cancellation that occurs while uploading", async () => {
    mocks.store.mockImplementation(() => {
      mocks.status = "CANCELLED";
      return { objectKey: "exports/report.csv", expiresAt: new Date() };
    });
    await expect(processReportGenerateStandalone(args)).rejects.toMatchObject({
      kind: "permanent",
    });
    expect(mocks.status).toBe("CANCELLED");
    expect(mocks.succeeded).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});
