import { describe, expect, it } from "vitest";
import {
  LIVE_ATTENDANCE_COLUMNS,
  exportLiveClassAttendanceRosterBodySchema,
  liveAttendeesQuerySchema,
  liveSessionsListQuerySchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";

describe("live class attendance roster dto", () => {
  it("parses session list query defaults", () => {
    const parsed = liveSessionsListQuerySchema.parse({ page: "2", status: "ended" });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.sortBy).toBe("scheduled_at");
    expect(parsed.status).toBe("ended");
  });

  it("parses attendance rate band filter", () => {
    const parsed = liveSessionsListQuerySchema.parse({ attendanceRateBand: "below_40" });
    expect(parsed.attendanceRateBand).toBe("below_40");
  });

  it("parses attendee columns and sort", () => {
    const parsed = liveAttendeesQuerySchema.parse({
      columns: "learner_name,email",
      sortBy: "duration_seconds",
      sortDir: "desc",
      status: "attended",
    });
    expect(parsed.columns).toEqual(["learner_name", "email"]);
    expect(parsed.sortBy).toBe("duration_seconds");
    expect(parsed.status).toBe("attended");
  });

  it("falls back to all attendee columns when invalid", () => {
    const parsed = liveAttendeesQuerySchema.parse({ columns: "nope" });
    expect(parsed.columns).toEqual([...LIVE_ATTENDANCE_COLUMNS]);
  });

  it("accepts export body and rejects tenant fields", () => {
    const exported = exportLiveClassAttendanceRosterBodySchema.parse({
      sessionId: "11111111-1111-4111-8111-111111111111",
      learnerName: "Alex",
    });
    expect(exported.emailDownloadLink).toBe(true);
    expect(exported.learnerName).toBe("Alex");

    expect(() =>
      exportLiveClassAttendanceRosterBodySchema.parse({
        sessionId: "11111111-1111-4111-8111-111111111111",
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });
});
