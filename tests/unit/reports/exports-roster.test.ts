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

  it("accepts export body and rejects tenant fields", () => {
    const exported = exportExportsHistoryBodySchema.parse({
      createdFrom: "2026-01-01T00:00:00.000Z",
      status: "SUCCEEDED",
    });
    expect(exported.emailDownloadLink).toBe(true);
    expect(exported.status).toBe("SUCCEEDED");

    expect(() =>
      exportExportsHistoryBodySchema.parse({
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });
});
