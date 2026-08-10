import { describe, expect, it } from "vitest";
import {
  ZOOM_PARTICIPANT_COLUMNS,
  exportZoomInsightsRosterBodySchema,
  zoomMeetingDetailResponseSchema,
  zoomMeetingsListQuerySchema,
  zoomMeetingsListResponseSchema,
  zoomParticipantDetailResponseSchema,
  zoomParticipantMatchBodySchema,
  zoomParticipantsListResponseSchema,
  zoomParticipantsQuerySchema,
  zoomMatchingRulesBodySchema,
  zoomMatchingRulesResponseSchema,
  zoomPeopleListQuerySchema,
  zoomPeopleListResponseSchema,
  zoomPersonMeetingsQuerySchema,
  zoomPersonMeetingsResponseSchema,
  zoomUnmatchedBulkMatchBodySchema,
  zoomUnmatchedListQuerySchema,
  zoomUnmatchedListResponseSchema,
} from "@atlas/domain/reports/zoom-insights-roster.dto";
import {
  zoomConnectionBackfillBodySchema,
  zoomConnectionDetailResponseSchema,
  zoomConnectionDisconnectBodySchema,
  zoomConnectionScheduleBodySchema,
} from "@atlas/domain/reports/zoom-insights-connection.dto";

describe("zoom insights roster dto", () => {
  it("parses meeting list query defaults", () => {
    const parsed = zoomMeetingsListQuerySchema.parse({ page: "2", q: "live" });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.sortBy).toBe("started_at");
    expect(parsed.view).toBe("all");
    expect(parsed.q).toBe("live");
  });

  it("parses saved views", () => {
    const parsed = zoomMeetingsListQuerySchema.parse({ view: "has_unmatched" });
    expect(parsed.view).toBe("has_unmatched");
  });

  it("parses participant columns, match state, and sort", () => {
    const parsed = zoomParticipantsQuerySchema.parse({
      columns: "display_name,email,match_state,coverage,rejoins",
      sortBy: "rejoins",
      sortDir: "desc",
      matchState: "guest",
      durationBucket: "over_30",
      rejoinedOnly: "true",
    });
    expect(parsed.columns).toEqual(["display_name", "email", "match_state", "coverage", "rejoins"]);
    expect(parsed.sortBy).toBe("rejoins");
    expect(parsed.sortDir).toBe("desc");
    expect(parsed.matchState).toBe("guest");
    expect(parsed.durationBucket).toBe("over_30");
    expect(parsed.rejoinedOnly).toBe(true);
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

  it("parses list response with connection meta and summary", () => {
    const parsed = zoomMeetingsListResponseSchema.parse({
      data: {
        items: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            externalMeetingId: "84920175513",
            topic: "Week 6 — Position sizing live",
            startedAt: "2026-07-22T19:00:00.000Z",
            endedAt: "2026-07-22T20:04:00.000Z",
            durationSeconds: 3840,
            attendanceCount: 184,
            matchedCount: 171,
            unmatchedCount: 13,
            totalAttendanceSeconds: 662880,
          },
        ],
        pageInfo: {
          page: 1,
          pageSize: 50,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        connectionStatus: "connected",
        connection: {
          status: "connected",
          connectedAt: "2026-06-01T10:00:00.000Z",
          lastSyncedAt: "2026-08-08T12:00:00.000Z",
          meetingsImportedToday: 3,
          hasConnectionRecord: true,
        },
        summary: {
          meetingCount: 1,
          participantCount: 184,
          matchedCount: 171,
          unmatchedCount: 13,
          totalAttendanceSeconds: 662880,
          avgAttendancePerMeeting: 184,
          avgDurationSeconds: 3840,
        },
      },
    });
    expect(parsed.data.connection.meetingsImportedToday).toBe(3);
    expect(parsed.data.summary.unmatchedCount).toBe(13);
    expect(parsed.data.items[0]?.matchedCount).toBe(171);
  });

  it("parses meeting detail with timeline and connection", () => {
    const parsed = zoomMeetingDetailResponseSchema.parse({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        externalMeetingId: "84920175513",
        topic: "Week 6 — Position sizing live",
        startedAt: "2026-07-22T19:00:00.000Z",
        endedAt: "2026-07-22T20:04:00.000Z",
        durationSeconds: 3840,
        attendanceCount: 184,
        matchedCount: 171,
        unmatchedCount: 13,
        totalAttendanceSeconds: 662880,
        avgDurationSeconds: 2892,
        connection: {
          status: "connected",
          connectedAt: "2026-06-01T10:00:00.000Z",
          lastSyncedAt: "2026-08-08T12:00:00.000Z",
          meetingsImportedToday: 3,
          hasConnectionRecord: true,
        },
        timeline: [
          { minuteOffset: 0, at: "2026-07-22T19:00:00.000Z", concurrent: 12 },
          { minuteOffset: 12, at: "2026-07-22T19:12:00.000Z", concurrent: 172 },
        ],
        peakConcurrent: 172,
        peakAt: "2026-07-22T19:12:00.000Z",
        biggestDropCount: 40,
        biggestDropFrom: "2026-07-22T19:50:00.000Z",
        biggestDropTo: "2026-07-22T19:55:00.000Z",
        linkedSession: null,
      },
    });
    expect(parsed.data.peakConcurrent).toBe(172);
    expect(parsed.data.timeline).toHaveLength(2);
    expect(parsed.data.connection.status).toBe("connected");
  });

  it("parses aggregated participants with guest match state", () => {
    const parsed = zoomParticipantsListResponseSchema.parse({
      data: {
        meetingId: "11111111-1111-4111-8111-111111111111",
        topic: "Week 6 — Position sizing live",
        meetingDurationSeconds: 3840,
        items: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            membershipId: null,
            externalUserId: "z-1",
            displayName: "Guest User 42",
            zoomDisplayName: null,
            email: null,
            joinTime: "2026-07-22T19:30:00.000Z",
            leaveTime: "2026-07-22T20:00:00.000Z",
            durationSeconds: 1800,
            matchState: "guest",
            sessionCount: 1,
            rejoinCount: 0,
          },
        ],
        pageInfo: {
          page: 1,
          pageSize: 25,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        columns: [...ZOOM_PARTICIPANT_COLUMNS],
        summary: { matchedCount: 171, unmatchedCount: 10, guestCount: 3 },
      },
    });
    expect(parsed.data.items[0]?.matchState).toBe("guest");
    expect(parsed.data.summary.guestCount).toBe(3);
  });

  it("parses participant detail with sessions and history", () => {
    const parsed = zoomParticipantDetailResponseSchema.parse({
      data: {
        id: "22222222-2222-4222-8222-222222222222",
        meetingId: "11111111-1111-4111-8111-111111111111",
        meetingTopic: "Week 6 — Position sizing live",
        meetingExternalId: "84920175513",
        meetingStartedAt: "2026-07-22T19:00:00.000Z",
        meetingEndedAt: "2026-07-22T20:04:00.000Z",
        meetingDurationSeconds: 3840,
        membershipId: "33333333-3333-4333-8333-333333333333",
        externalUserId: "z-1",
        displayName: "Priya Raghunathan",
        zoomDisplayName: "priya (iPhone)",
        email: "priya.r@acme-corp.com",
        matchState: "matched",
        totalDurationSeconds: 2892,
        coveragePercent: 75.3,
        sessionCount: 3,
        rejoinCount: 2,
        firstJoinedAt: "2026-07-22T19:04:00.000Z",
        lastLeftAt: "2026-07-22T20:02:00.000Z",
        longestGapSeconds: 401,
        deviceHint: "mobile",
        sessions: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            index: 1,
            joinTime: "2026-07-22T19:04:00.000Z",
            leaveTime: "2026-07-22T19:28:00.000Z",
            durationSeconds: 1440,
            shareOfMeeting: 37.5,
            deviceHint: "mobile",
          },
        ],
        attendanceHistory: [
          {
            meetingId: "11111111-1111-4111-8111-111111111111",
            topic: "Week 6 — Position sizing live",
            startedAt: "2026-07-22T19:00:00.000Z",
            coveragePercent: 75.3,
            isCurrent: true,
          },
        ],
        lmsCrossCheck: {
          enrollmentStatus: "active",
          matchMethod: "membership",
          zoomDurationSeconds: 2892,
          lmsDurationSeconds: null,
          discrepancySeconds: null,
        },
        otherUnmatchedMeetingCount: 0,
      },
    });
    expect(parsed.data.sessionCount).toBe(3);
    expect(parsed.data.sessions[0]?.shareOfMeeting).toBe(37.5);
  });

  it("requires membershipId when matching a learner", () => {
    expect(() =>
      zoomParticipantMatchBodySchema.parse({
        action: "match",
      }),
    ).toThrow();

    const matched = zoomParticipantMatchBodySchema.parse({
      action: "match",
      membershipId: "33333333-3333-4333-8333-333333333333",
      applyToOtherMeetings: true,
    });
    expect(matched.applyToOtherMeetings).toBe(true);
  });

  it("parses people list query defaults and filters", () => {
    const parsed = zoomPeopleListQuerySchema.parse({
      q: "alice",
      matchState: "unmatched",
      meetingsMin: "2",
      coverageMax: "40",
      sortBy: "avg_coverage",
      sortDir: "asc",
      page: "1",
    });
    expect(parsed.limit).toBe(25);
    expect(parsed.meetingsMin).toBe(2);
    expect(parsed.coverageMax).toBe(40);
    expect(parsed.sortBy).toBe("avg_coverage");
    expect(parsed.matchState).toBe("unmatched");
  });

  it("parses people list response with summary band", () => {
    const parsed = zoomPeopleListResponseSchema.parse({
      data: {
        items: [
          {
            identityKey: "m:33333333-3333-4333-8333-333333333333",
            membershipId: "33333333-3333-4333-8333-333333333333",
            externalUserId: null,
            displayName: "Alice Chen",
            zoomDisplayName: null,
            email: "alice.c@example.com",
            matchState: "matched",
            meetingsAttended: 42,
            meetingsInRange: 84,
            totalDurationSeconds: 137520,
            avgDurationSeconds: 3274,
            avgCoveragePercent: 92.4,
            firstSeenAt: "2023-10-12T10:00:00.000Z",
            lastSeenAt: "2023-11-11T10:00:00.000Z",
            representativeMeetingId: "11111111-1111-4111-8111-111111111111",
            representativeParticipantId: "22222222-2222-4222-8222-222222222222",
          },
        ],
        pageInfo: {
          page: 1,
          pageSize: 25,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        connectionStatus: "connected",
        connection: {
          status: "connected",
          connectedAt: "2026-06-01T10:00:00.000Z",
          lastSyncedAt: "2026-08-08T12:00:00.000Z",
          meetingsImportedToday: 3,
          hasConnectionRecord: true,
        },
        summary: {
          peopleCount: 462,
          matchedCount: 431,
          unmatchedCount: 28,
          guestCount: 3,
          avgMeetingsAttended: 4.2,
          totalDurationSeconds: 2_205_600,
          avgCoveragePercent: 74.8,
          attendedOnceOnlyCount: 118,
          meetingsInRange: 84,
        },
        range: {
          attendedFrom: "2023-10-12T00:00:00.000Z",
          attendedTo: "2023-11-11T23:59:59.999Z",
        },
      },
    });
    expect(parsed.data.summary.peopleCount).toBe(462);
    expect(parsed.data.items[0]?.avgCoveragePercent).toBe(92.4);
  });

  it("parses person meetings drawer response with attendance pulse", () => {
    const query = zoomPersonMeetingsQuerySchema.parse({
      identityKey: "n:alice|alice.c@example.com",
    });
    expect(query.identityKey).toContain("alice");

    const parsed = zoomPersonMeetingsResponseSchema.parse({
      data: {
        identityKey: "n:alice|alice.c@example.com",
        membershipId: null,
        displayName: "Alice Chen",
        email: "alice.c@example.com",
        matchState: "unmatched",
        totalMeetings: 2,
        totalDurationSeconds: 4200,
        avgCoveragePercent: 70,
        meetings: [
          {
            meetingId: "11111111-1111-4111-8111-111111111111",
            participantId: "22222222-2222-4222-8222-222222222222",
            topic: "Q3 Engineering Sync",
            externalMeetingId: "892-114-555",
            startedAt: "2023-10-12T10:00:00.000Z",
            durationSeconds: 3480,
            coveragePercent: 95,
            rejoinCount: 0,
          },
        ],
        attendancePulse: [
          {
            date: "2023-10-12",
            state: "high",
            coveragePercent: 95,
            meetingCount: 1,
          },
        ],
        representativeMeetingId: "11111111-1111-4111-8111-111111111111",
        representativeParticipantId: "22222222-2222-4222-8222-222222222222",
      },
    });
    expect(parsed.data.attendancePulse[0]?.state).toBe("high");
    expect(parsed.data.meetings).toHaveLength(1);
  });

  it("parses unmatched identities query defaults and groups", () => {
    const parsed = zoomUnmatchedListQuerySchema.parse({ page: "1", group: "high" });
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(50);
    expect(parsed.group).toBe("high");
  });

  it("requires bulk-match items when mode is selected", () => {
    expect(() => zoomUnmatchedBulkMatchBodySchema.parse({ mode: "selected" })).toThrow();
    const parsed = zoomUnmatchedBulkMatchBodySchema.parse({
      mode: "all_high",
      applyToOtherMeetings: true,
    });
    expect(parsed.mode).toBe("all_high");
    expect(parsed.applyToOtherMeetings).toBe(true);
  });

  it("parses matching rules and unmatched list response", () => {
    const rules = zoomMatchingRulesResponseSchema.parse({
      data: {
        matchOnExactEmail: true,
        matchOnNormalizedDisplayName: true,
        matchOnEmailDomainPlusEnrollment: false,
        autoMatchHighConfidenceOnImport: false,
        guestEmailDomains: ["gmail.com"],
      },
    });
    expect(rules.data.guestEmailDomains).toEqual(["gmail.com"]);

    const body = zoomMatchingRulesBodySchema.parse({
      matchOnExactEmail: true,
      matchOnNormalizedDisplayName: false,
      matchOnEmailDomainPlusEnrollment: false,
      autoMatchHighConfidenceOnImport: false,
      guestEmailDomains: ["Outlook.com"],
    });
    expect(body.guestEmailDomains).toEqual(["outlook.com"]);

    const list = zoomUnmatchedListResponseSchema.parse({
      data: {
        items: [],
        groups: { high: [], medium: [], guest: [], none: [] },
        pageInfo: {
          page: 1,
          pageSize: 50,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        connectionStatus: "connected",
        connection: {
          status: "connected",
          connectedAt: "2026-06-01T10:00:00.000Z",
          lastSyncedAt: "2026-08-08T12:00:00.000Z",
          meetingsImportedToday: 1,
          hasConnectionRecord: true,
        },
        summary: {
          unmatchedIdentities: 0,
          meetingCount: 0,
          joinRecordCount: 0,
          highConfidence: 0,
          needsReview: 0,
          likelyGuests: 0,
          attendanceNotCountedSeconds: 0,
          reconciledLast30Days: 12,
        },
      },
    });
    expect(list.data.summary.reconciledLast30Days).toBe(12);
  });

  it("parses connection detail, disconnect, schedule, and backfill bodies", () => {
    const detail = zoomConnectionDetailResponseSchema.parse({
      data: {
        connection: {
          status: "connected",
          connectedAt: "2026-01-14T10:00:00.000Z",
          lastSyncedAt: "2026-08-08T12:00:00.000Z",
          meetingsImportedToday: 3,
          hasConnectionRecord: true,
          id: "11111111-1111-4111-8111-111111111111",
          accountId: "884-291-384",
          accountName: "Zoom account",
          accountEmail: "admin@example.com",
          appId: "app_3921",
          scopes: ["meeting:read", "user:read", "report:read"],
          tokenExpiresAt: "2026-08-20T10:00:00.000Z",
          disconnectedAt: null,
          scheduleEnabled: true,
          scheduleIntervalMinutes: 30,
          nextRunAt: "2026-08-08T12:30:00.000Z",
          nextRunInSeconds: 1080,
          coverageGapCount: 3,
          meetingsImported: 84,
          webhookEndpoint: "/api/v1/zoom/webhooks",
          webhookSecretMasked: "•••••••••••••••",
          hasWebhookSecret: true,
        },
        syncPulse: [{ index: 0, status: "success", runId: "22222222-2222-4222-8222-222222222222" }],
        syncRuns: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            trigger: "manual",
            status: "completed",
            startedAt: "2026-08-08T12:00:00.000Z",
            finishedAt: "2026-08-08T12:00:05.000Z",
            meetingsCount: 3,
            participantsCount: 42,
            skippedCount: 0,
            errorMessage: null,
            logLines: ["Sync completed"],
          },
        ],
        webhookEvents: [],
        lastWebhookAt: null,
      },
    });
    expect(detail.data.connection.scheduleIntervalMinutes).toBe(30);

    const disconnect = zoomConnectionDisconnectBodySchema.parse({
      confirmation: "admin@example.com",
    });
    expect(disconnect.confirmation).toBe("admin@example.com");

    const schedule = zoomConnectionScheduleBodySchema.parse({ scheduleEnabled: false });
    expect(schedule.scheduleEnabled).toBe(false);

    const backfill = zoomConnectionBackfillBodySchema.parse({
      rangeFrom: "2023-09-01T00:00:00.000Z",
      rangeTo: "2023-10-31T23:59:59.999Z",
      skipAlreadyImported: true,
    });
    expect(backfill.skipAlreadyImported).toBe(true);
  });
});
