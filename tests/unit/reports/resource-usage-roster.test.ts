import { describe, expect, it } from "vitest";
import {
  RESOURCE_USAGE_COLUMNS,
  exportResourceUsageRosterBodySchema,
  resourceUsageDormantQuerySchema,
  resourceUsageHistoryQuerySchema,
  resourceUsageInactiveQuerySchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";

describe("resource usage roster dto", () => {
  it("parses history query defaults and columns", () => {
    const parsed = resourceUsageHistoryQuerySchema.parse({
      page: "2",
      metricKey: "usage.storage_gb",
      columns: "metric_key,period,value",
    });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.metricKey).toBe("usage.storage_gb");
    expect(parsed.columns).toEqual(["metric_key", "period", "value"]);

    const fallback = resourceUsageHistoryQuerySchema.parse({ columns: "nope" });
    expect(fallback.columns).toEqual([...RESOURCE_USAGE_COLUMNS]);
  });

  it("parses dormant and inactive queries", () => {
    const dormant = resourceUsageDormantQuerySchema.parse({ q: "math", page: "1" });
    expect(dormant.q).toBe("math");
    expect(dormant.limit).toBe(25);

    const inactive = resourceUsageInactiveQuerySchema.parse({ q: "ada" });
    expect(inactive.q).toBe("ada");
  });

  it("accepts export body and rejects tenant fields", () => {
    const exported = exportResourceUsageRosterBodySchema.parse({
      reportTab: "dormant",
      q: "intro",
    });
    expect(exported.emailDownloadLink).toBe(true);
    expect(exported.reportTab).toBe("dormant");

    expect(() =>
      exportResourceUsageRosterBodySchema.parse({
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });
});
