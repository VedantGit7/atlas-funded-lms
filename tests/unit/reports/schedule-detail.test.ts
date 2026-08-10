import { describe, expect, it } from "vitest";
import { scheduleDetailQuerySchema } from "@atlas/domain/reports/schedule-detail.dto";

describe("schedule detail dto", () => {
  it("parses defaults and rejects tenant fields", () => {
    const parsed = scheduleDetailQuerySchema.parse({});
    expect(parsed.runsPage).toBe(1);
    expect(parsed.runsLimit).toBe(10);

    expect(() =>
      scheduleDetailQuerySchema.parse({
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });
});
