import { describe, expect, it } from "vitest";
import {
  exportRunActionBodySchema,
  exportRunDetailQuerySchema,
  exportRunDetailSchema,
} from "@atlas/domain/reports/export-run-detail.dto";

describe("export run detail dto", () => {
  it("parses optional sourceType query", () => {
    expect(exportRunDetailQuerySchema.parse({}).sourceType).toBeUndefined();
    expect(exportRunDetailQuerySchema.parse({ sourceType: "report_run" }).sourceType).toBe(
      "report_run",
    );
  });

  it("accepts action body and rejects tenant fields", () => {
    expect(exportRunActionBodySchema.parse({ sourceType: "export_job" }).sourceType).toBe(
      "export_job",
    );
    expect(() =>
      exportRunActionBodySchema.parse({
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });

  it("validates a succeeded detail payload shape", () => {
    const parsed = exportRunDetailSchema.parse({
      sourceType: "report_run",
      id: "11111111-1111-4111-8111-111111111111",
      fileName: "payments-2026-08-04.csv",
      definitionKey: "payments",
      definitionTitle: "Payments",
      status: "SUCCEEDED",
      format: "csv",
      params: { status: ["paid"] },
      filterChips: ["Status is paid"],
      columnChips: ["id", "amount"],
      columnsTotal: 2,
      sortLabel: "Created desc",
      rowLimitLabel: null,
      delivery: {
        kind: "download_only",
        label: "Download only",
        recipients: [],
        status: null,
        deliveredAt: null,
        error: null,
      },
      rowCount: 1284,
      progressPercent: 100,
      estimatedSizeLabel: "~80.3 KB",
      containsPersonalData: true,
      requestedByName: "Ada",
      requestedByEmail: "ada@example.com",
      createdAt: "2026-08-04T14:38:02.000Z",
      startedAt: "2026-08-04T14:38:04.000Z",
      completedAt: "2026-08-04T14:38:46.000Z",
      expiresAt: "2026-08-10T14:38:46.000Z",
      updatedAt: "2026-08-04T14:38:46.000Z",
      durationSeconds: 42,
      errorCode: null,
      errorMessage: null,
      errorTrace: null,
      failedStage: null,
      failureHint: null,
      pipeline: [
        { key: "queued", label: "Queued", state: "complete", at: "2026-08-04T14:38:02.000Z" },
        { key: "started", label: "Started", state: "complete", at: "2026-08-04T14:38:04.000Z" },
        { key: "query", label: "Query", state: "complete", at: null },
        { key: "serialize", label: "Serialize", state: "complete", at: null },
        { key: "upload", label: "Upload", state: "complete", at: null },
        {
          key: "delivered",
          label: "Delivered",
          state: "complete",
          at: "2026-08-04T14:38:46.000Z",
        },
      ],
      hasFile: true,
      canDownload: true,
      canDeleteFile: true,
      canCancel: false,
      canRetry: true,
      download: null,
      accessLog: [],
      accessLogAvailable: false,
    });
    expect(parsed.status).toBe("SUCCEEDED");
    expect(parsed.pipeline).toHaveLength(6);
  });
});
