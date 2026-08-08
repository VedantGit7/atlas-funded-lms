import { describe, expect, it } from "vitest";
import {
  ZOOM_PARTICIPANT_COLUMNS,
  exportZoomInsightsRosterBodySchema,
  zoomMeetingsListQuerySchema,
  zoomParticipantsQuerySchema,
} from "@atlas/domain/reports/zoom-insights-roster.dto";

describe("zoom insights roster dto", () => {
  it("parses meeting list query defaults", () => {
    const parsed = zoomMeetingsListQuerySchema.parse({ page: "2", q: "live" });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.sortBy).toBe("started_at");
    expect(parsed.q).toBe("live");
  });

  it("parses participant columns and sort", () => {
    const parsed = zoomParticipantsQuerySchema.parse({
      columns: "display_name,email",
      sortBy: "duration_seconds",
      sortDir: "desc",
    });
    expect(parsed.columns).toEqual(["display_name", "email"]);
    expect(parsed.sortBy).toBe("duration_seconds");
    expect(parsed.sortDir).toBe("desc");
  });

  it("falls back to all participant columns when invalid", () => {
    const parsed = zoomParticipantsQuerySchema.parse({ columns: "nope" });
    expect(parsed.columns).toEqual([...ZOOM_PARTICIPANT_COLUMNS]);
  });

  it("accepts export body and rejects tenant fields", () => {
    const exported = exportZoomInsightsRosterBodySchema.parse({
      meetingId: "11111111-1111-4111-8111-111111111111",
      displayName: "Alex",
    });
    expect(exported.emailDownloadLink).toBe(true);
    expect(exported.displayName).toBe("Alex");

    expect(() =>
      exportZoomInsightsRosterBodySchema.parse({
        meetingId: "11111111-1111-4111-8111-111111111111",
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });
});
