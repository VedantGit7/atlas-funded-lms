import { describe, expect, it } from "vitest";
import {
  EXPORTS_HISTORY_COLUMNS,
  exportExportsHistoryBodySchema,
  exportsHistoryListQuerySchema,
} from "@atlas/domain/reports/exports-roster.dto";

describe("exports roster dto", () => {
  it("parses list query defaults and columns", () => {
    const parsed = exportsHistoryListQuerySchema.parse({
      page: "2",
      status: "SUCCEEDED",
      sourceType: "report_run",
      columns: "definition_title,status,created_at",
    });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.status).toBe("SUCCEEDED");
    expect(parsed.sourceType).toBe("report_run");
    expect(parsed.columns).toEqual(["definition_title", "status", "created_at"]);

    const fallback = exportsHistoryListQuerySchema.parse({ columns: "nope" });
    expect(fallback.columns).toEqual([...EXPORTS_HISTORY_COLUMNS]);
  });

  it("parses format, fileState, and mine filters", () => {
    const parsed = exportsHistoryListQuerySchema.parse({
      format: "csv",
      fileState: "expiring_soon",
      mine: "true",
    });
    expect(parsed.format).toBe("csv");
    expect(parsed.fileState).toBe("expiring_soon");
    expect(parsed.mine).toBe(true);

    const mineOff = exportsHistoryListQuerySchema.parse({ mine: "0" });
    expect(mineOff.mine).toBe(false);
  });

  it("accepts export body and rejects tenant fields", () => {
    const exported = exportExportsHistoryBodySchema.parse({
      createdFrom: "2026-01-01T00:00:00.000Z",
      status: "SUCCEEDED",
      format: "xlsx",
      fileState: "available",
      mine: true,
    });
    expect(exported.emailDownloadLink).toBe(true);
    expect(exported.status).toBe("SUCCEEDED");
    expect(exported.format).toBe("xlsx");
    expect(exported.fileState).toBe("available");
    expect(exported.mine).toBe(true);

    expect(() =>
      exportExportsHistoryBodySchema.parse({
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });
});
