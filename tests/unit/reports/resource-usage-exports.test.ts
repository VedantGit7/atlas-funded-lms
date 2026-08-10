import { describe, expect, it } from "vitest";
import {
  createResourceUsageExportBodySchema,
  resourceUsageExportsResponseSchema,
  RU_EXPORT_DATASETS,
} from "@atlas/domain/reports/resource-usage-exports.dto";

describe("resource usage exports dto", () => {
  it("defaults create body to meter snapshot csv download", () => {
    const parsed = createResourceUsageExportBodySchema.parse({});
    expect(parsed.dataset).toBe("meter_snapshot");
    expect(parsed.format).toBe("csv");
    expect(parsed.delivery).toBe("download");
    expect(parsed.scheduleEnabled).toBe(false);
    expect(parsed.scopeMode).toBe("all");
  });

  it("accepts all resource usage export datasets", () => {
    for (const dataset of RU_EXPORT_DATASETS) {
      const parsed = createResourceUsageExportBodySchema.parse({
        dataset,
        format: "xlsx",
        scheduleEnabled: true,
        cadence: "monthly",
        time: "07:00",
        timezone: "UTC",
      });
      expect(parsed.dataset).toBe(dataset);
      expect(parsed.scheduleEnabled).toBe(true);
    }
  });

  it("accepts exports list response with unmetered note", () => {
    const response = resourceUsageExportsResponseSchema.parse({
      data: {
        history: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            fileName: "resource-usage-meter-snapshot-20260810.csv",
            format: "csv",
            dataset: "meter_snapshot",
            datasetLabel: "Meter snapshot",
            scopeLabel: "As of now",
            rowCount: 7,
            sizeLabel: "~1KB",
            requestedByLabel: "You",
            status: "SUCCEEDED",
            expired: false,
            expiresAt: null,
            createdAt: "2026-08-10T12:00:00.000Z",
            completedAt: "2026-08-10T12:00:01.000Z",
            errorCode: null,
            errorMessage: null,
            errorTrace: null,
            progressPercent: 100,
            downloadAvailable: true,
          },
        ],
        schedules: [],
        capabilities: {
          formats: ["csv", "xlsx", "json"],
          datasets: [...RU_EXPORT_DATASETS],
          columns: ["metric_key", "learner_name", "email"],
          canSchedule: true,
          canEmailDelivery: true,
          note: "Ready files are deleted after 7 days.",
          unmeteredNote: "Bandwidth is not metered.",
        },
        estimates: {
          meterSnapshotRows: 7,
          inactiveLearnerRows: 12,
        },
      },
    });
    expect(response.data.history).toHaveLength(1);
    expect(response.data.capabilities.unmeteredNote).toContain("Bandwidth");
  });
});
