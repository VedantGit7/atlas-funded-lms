import { describe, expect, it } from "vitest";
import { DEFAULT_OUTLIER_THRESHOLDS } from "@atlas/domain/reports/super-live-insights-outliers.dto";
import {
  createSuperLiveInsightsExportBodySchema,
  superLiveInsightsExportsResponseSchema,
  SLI_EXPORT_DATASETS,
} from "@atlas/domain/reports/super-live-insights-exports.dto";

describe("super live insights exports dto", () => {
  it("defaults create body to session metrics csv download", () => {
    const parsed = createSuperLiveInsightsExportBodySchema.parse({});
    expect(parsed.dataset).toBe("session_metrics");
    expect(parsed.format).toBe("csv");
    expect(parsed.delivery).toBe("download");
    expect(parsed.includeBenchmarks).toBe(true);
    expect(parsed.granularity).toBe("week");
    expect(parsed.seriesKind).toBe("course");
  });

  it("accepts all screen-6 datasets", () => {
    for (const dataset of SLI_EXPORT_DATASETS) {
      const parsed = createSuperLiveInsightsExportBodySchema.parse({
        dataset,
        format: "xlsx",
        scheduleEnabled: true,
        cadence: "monthly",
        time: "07:00",
        timezone: "Asia/Kolkata",
      });
      expect(parsed.dataset).toBe(dataset);
      expect(parsed.scheduleEnabled).toBe(true);
    }
  });

  it("accepts exports list response", () => {
    const response = superLiveInsightsExportsResponseSchema.parse({
      data: {
        history: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            fileName: "live-insights-session-metrics-20260810.csv",
            format: "csv",
            dataset: "session_metrics",
            datasetLabel: "Session metrics",
            scopeLabel: "Last 30 days",
            rowCount: 42,
            sizeLabel: "~3KB",
            requestedByLabel: "You",
            status: "SUCCEEDED",
            expired: false,
            expiresAt: "2026-08-17T00:00:00.000Z",
            createdAt: "2026-08-10T00:00:00.000Z",
            completedAt: "2026-08-10T00:01:00.000Z",
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
          datasets: [...SLI_EXPORT_DATASETS],
          columns: [
            "title",
            "status",
            "course_title",
            "batch_name",
            "scheduled_at",
            "started_at",
            "ended_at",
            "duration_seconds",
            "attended_count",
            "registered_count",
            "absent_count",
            "total_count",
            "avg_duration_seconds",
            "attendance_rate",
            "tenant_avg_rate",
            "course_avg_rate",
          ],
          canSchedule: true,
          canEmailDelivery: true,
          note: "Ready files are deleted after 7 days.",
        },
        estimates: {
          sessionMetricsRows: 12,
          outlierFindingsRows: null,
        },
      },
    });
    expect(response.data.history).toHaveLength(1);
    expect(DEFAULT_OUTLIER_THRESHOLDS.rateDeltaPts).toBe(20);
  });
});
