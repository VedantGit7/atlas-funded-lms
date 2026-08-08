import { describe, expect, it } from "vitest";
import {
  SUPER_LIVE_INSIGHT_COLUMNS,
  exportSuperLiveInsightsRosterBodySchema,
  superLiveInsightsListQuerySchema,
} from "@atlas/domain/reports/super-live-insights-roster.dto";

describe("super live insights roster dto", () => {
  it("parses list query defaults", () => {
    const parsed = superLiveInsightsListQuerySchema.parse({
      page: "2",
      status: "ended",
      minAttended: "3",
    });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.sortBy).toBe("scheduled_at");
    expect(parsed.status).toBe("ended");
    expect(parsed.minAttended).toBe(3);
  });

  it("parses columns and falls back when invalid", () => {
    const selected = superLiveInsightsListQuerySchema.parse({
      columns: "title,attended_count,attendance_rate",
    });
    expect(selected.columns).toEqual(["title", "attended_count", "attendance_rate"]);

    const fallback = superLiveInsightsListQuerySchema.parse({ columns: "nope" });
    expect(fallback.columns).toEqual([...SUPER_LIVE_INSIGHT_COLUMNS]);
  });

  it("accepts export body and rejects tenant fields", () => {
    const exported = exportSuperLiveInsightsRosterBodySchema.parse({
      sessionId: "11111111-1111-4111-8111-111111111111",
      q: "math",
    });
    expect(exported.emailDownloadLink).toBe(true);
    expect(exported.q).toBe("math");

    expect(() =>
      exportSuperLiveInsightsRosterBodySchema.parse({
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });
});
