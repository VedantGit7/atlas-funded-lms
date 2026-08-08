import { describe, expect, it } from "vitest";
import {
  createEnrollmentGroupBodySchema,
  enrollmentOverviewQuerySchema,
  enrollmentOverviewResponseSchema,
  enrollmentRosterQuerySchema,
  ENROLLMENT_ROSTER_COLUMNS,
  sendEnrollmentMessageBodySchema,
} from "@atlas/domain/reports/enrollments-roster.dto";

describe("enrollments roster dto", () => {
  it("parses roster query defaults and column selection", () => {
    const parsed = enrollmentRosterQuerySchema.parse({
      columns: "learner_name,email,enrolled_at",
      sortBy: "expires_at",
      sortDir: "asc",
      page: "2",
    });

    expect(parsed.columns).toEqual(["learner_name", "email", "enrolled_at"]);
    expect(parsed.sortBy).toBe("expires_at");
    expect(parsed.sortDir).toBe("asc");
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
  });

  it("accepts already-parsed column arrays from route re-entry", () => {
    const parsed = enrollmentRosterQuerySchema.parse({
      columns: ["learner_name", "email", "enrolled_at"],
      page: 1,
    });
    expect(parsed.columns).toEqual(["learner_name", "email", "enrolled_at"]);
  });

  it("falls back to all columns when selection is empty/invalid", () => {
    const parsed = enrollmentRosterQuerySchema.parse({
      columns: "not_a_column",
    });
    expect(parsed.columns).toEqual([...ENROLLMENT_ROSTER_COLUMNS]);
  });

  it("parses overview query filters", () => {
    const parsed = enrollmentOverviewQuerySchema.parse({
      enrolledType: "paid",
      enrolledFrom: "2026-07-01T00:00:00.000Z",
      enrolledTo: "2026-07-31T23:59:59.999Z",
    });
    expect(parsed.enrolledType).toBe("paid");
    expect(parsed.enrolledFrom).toBe("2026-07-01T00:00:00.000Z");
  });

  it("validates overview response shape", () => {
    const parsed = enrollmentOverviewResponseSchema.parse({
      data: {
        summary: {
          totalCount: 12,
          activeCount: 10,
          expiringSoonCount: 2,
          previousPeriodCount: 8,
          changePercent: 50,
          windowLabel: "30 Days",
          windowFrom: "2026-07-05T00:00:00.000Z",
          windowTo: "2026-08-03T12:00:00.000Z",
        },
        byType: [
          { type: "paid", label: "Paid", count: 5, percent: 41.7 },
          { type: "free", label: "Free", count: 4, percent: 33.3 },
          { type: "trial", label: "Trial", count: 2, percent: 16.7 },
          { type: "offline", label: "Offline", count: 1, percent: 8.3 },
        ],
        trend: [
          {
            date: "2026-07-05",
            total: 1,
            paid: 1,
            free: 0,
            trial: 0,
            offline: 0,
          },
        ],
      },
    });
    expect(parsed.data.summary.totalCount).toBe(12);
    expect(parsed.data.byType).toHaveLength(4);
  });

  it("accepts create group and send message bodies", () => {
    const group = createEnrollmentGroupBodySchema.parse({
      title: "August free enrollments",
      description: "From enrollments report",
      enrolledType: "free",
    });
    expect(group.title).toBe("August free enrollments");

    const message = sendEnrollmentMessageBodySchema.parse({
      subject: "Welcome",
      message: "Thanks for enrolling",
      email: "learner@example.com",
    });
    expect(message.subject).toBe("Welcome");
  });

  it("rejects client tenant fields", () => {
    expect(() =>
      createEnrollmentGroupBodySchema.parse({
        title: "Bad",
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });
});
