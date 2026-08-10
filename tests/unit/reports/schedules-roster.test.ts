import { describe, expect, it } from "vitest";
import {
  schedulesRosterBulkBodySchema,
  schedulesRosterListQuerySchema,
} from "@atlas/domain/reports/schedules-roster.dto";
import {
  cadenceLabel,
  classifyCadence,
  parseDelivery,
} from "@atlas/domain/reports/schedules-roster.repository";

describe("schedules roster helpers", () => {
  it("classifies cadence aliases", () => {
    expect(classifyCadence("hourly")).toBe("hourly");
    expect(classifyCadence("daily")).toBe("daily");
    expect(classifyCadence("weekly")).toBe("weekly");
    expect(classifyCadence("monthly")).toBe("monthly");
    expect(classifyCadence("0 15 * * 2")).toBe("weekly");
    expect(cadenceLabel("daily", "UTC")).toContain("UTC");
  });

  it("parses delivery destinations", () => {
    const email = parseDelivery({ emails: ["a@example.com"], mode: "email" });
    expect(email.kinds).toContain("email");
    expect(email.isExternal).toBe(true);

    const download = parseDelivery(null);
    expect(download.kinds).toEqual(["download"]);
    expect(download.isExternal).toBe(false);
  });

  it("parses list query defaults and rejects tenant fields", () => {
    const parsed = schedulesRosterListQuerySchema.parse({});
    expect(parsed.status).toBe("all");
    expect(parsed.sort).toBe("next_run_asc");
    expect(parsed.limit).toBe(50);

    expect(() =>
      schedulesRosterListQuerySchema.parse({
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });

  it("parses bulk body", () => {
    const parsed = schedulesRosterBulkBodySchema.parse({
      action: "pause",
      ids: ["11111111-1111-4111-8111-111111111111"],
    });
    expect(parsed.action).toBe("pause");
  });
});
