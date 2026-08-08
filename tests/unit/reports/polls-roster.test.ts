import { describe, expect, it } from "vitest";
import {
  POLL_RESPONDENT_COLUMNS,
  exportPollRosterBodySchema,
  liveSessionPollReportResponseSchema,
  liveSessionsPollsListResponseSchema,
  pollLiveExtendBodySchema,
  pollLiveMonitorResponseSchema,
  pollNonRespondentsListResponseSchema,
  pollNonRespondentsQuerySchema,
  pollOptionDetailResponseSchema,
  pollOptionParamsSchema,
  pollRespondentsQuerySchema,
  pollsCompareQuerySchema,
  pollsCompareResponseSchema,
  pollsListQuerySchema,
  pollsListResponseSchema,
} from "@atlas/domain/reports/polls-roster.dto";

describe("polls roster dto", () => {
  it("parses poll list query defaults", () => {
    const parsed = pollsListQuerySchema.parse({ page: "2", status: "ACTIVE" });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
    expect(parsed.status).toBe("ACTIVE");
    expect(parsed.view).toBe("all");
  });

  it("parses saved views and created date range", () => {
    const parsed = pollsListQuerySchema.parse({
      view: "open",
      createdFrom: "2026-01-01T00:00:00.000Z",
      createdTo: "2026-12-31T23:59:59.999Z",
    });
    expect(parsed.view).toBe("open");
    expect(parsed.createdFrom).toBe("2026-01-01T00:00:00.000Z");
  });

  it("requires summary on list response", () => {
    const parsed = pollsListResponseSchema.parse({
      data: {
        items: [],
        pageInfo: {
          page: 1,
          pageSize: 25,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        summary: {
          totalResponses: 0,
          pollCount: 0,
          avgParticipationPct: null,
          quizPollCount: 0,
          avgQuizCorrectPct: null,
          openNowCount: 0,
          anonymousCount: 0,
        },
      },
    });
    expect(parsed.data.summary.pollCount).toBe(0);
  });

  it("parses respondent columns and sort", () => {
    const parsed = pollRespondentsQuerySchema.parse({
      columns: "learner_name,option_label",
      sortBy: "option_label",
      sortDir: "asc",
      isCorrect: "correct",
    });
    expect(parsed.columns).toEqual(["learner_name", "option_label"]);
    expect(parsed.sortBy).toBe("option_label");
    expect(parsed.isCorrect).toBe("correct");
  });

  it("defaults isCorrect filter to any", () => {
    const parsed = pollRespondentsQuerySchema.parse({});
    expect(parsed.isCorrect).toBe("any");
    expect(parsed.sortBy).toBe("responded_at");
  });

  it("parses option detail params", () => {
    const parsed = pollOptionParamsSchema.parse({
      pollId: "11111111-1111-4111-8111-111111111111",
      optionId: "22222222-2222-4222-8222-222222222222",
    });
    expect(parsed.pollId).toBe("11111111-1111-4111-8111-111111111111");
    expect(parsed.optionId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("requires option detail payload shape", () => {
    const parsed = pollOptionDetailResponseSchema.parse({
      data: {
        pollId: "11111111-1111-4111-8111-111111111111",
        pollTitle: "Risk model",
        pollDescription: null,
        quizMode: true,
        anonymousVote: false,
        isOpen: false,
        openedAt: "2026-01-01T00:00:00.000Z",
        closedAt: "2026-01-01T00:05:00.000Z",
        respondentsHidden: false,
        option: {
          optionId: "22222222-2222-4222-8222-222222222222",
          label: "Fixed fractional",
          sortOrder: 0,
          isCorrect: true,
          count: 58,
          percent: 46.8,
        },
        totalResponses: 124,
        optionCount: 4,
        rank: 1,
        votesAheadOfNext: 26,
        medianResponseSeconds: 7.4,
        overallMedianResponseSeconds: 8.4,
        timingInsight: "Chosen earlier than average - median 7.4s versus 8.4s overall.",
        timing: {
          bucketSeconds: 6,
          durationSeconds: 60,
          buckets: [{ offsetSeconds: 6, optionCount: 10, overallCount: 20 }],
        },
        segments: [{ key: "b1", label: "Batch A", count: 30, percent: 51.7 }],
        siblings: [],
      },
    });
    expect(parsed.data.rank).toBe(1);
    expect(parsed.data.segments[0]?.label).toBe("Batch A");
  });

  it("falls back to all respondent columns when invalid", () => {
    const parsed = pollRespondentsQuerySchema.parse({ columns: "nope" });
    expect(parsed.columns).toEqual([...POLL_RESPONDENT_COLUMNS]);
  });

  it("accepts export body and rejects tenant fields", () => {
    const exported = exportPollRosterBodySchema.parse({
      pollId: "11111111-1111-4111-8111-111111111111",
    });
    expect(exported.emailDownloadLink).toBe(true);

    expect(() =>
      exportPollRosterBodySchema.parse({
        pollId: "11111111-1111-4111-8111-111111111111",
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });

  it("parses non-respondents query defaults", () => {
    const parsed = pollNonRespondentsQuerySchema.parse({});
    expect(parsed.presence).toBe("any");
    expect(parsed.excludeAbsent).toBe(false);
    expect(parsed.sortBy).toBe("learner_name");
    expect(parsed.limit).toBe(25);
  });

  it("accepts non-respondents list response for unknown audience", () => {
    const parsed = pollNonRespondentsListResponseSchema.parse({
      data: {
        pollId: "11111111-1111-4111-8111-111111111111",
        summary: {
          audienceKnown: false,
          audienceSource: "none",
          liveSessionId: null,
          liveSessionTitle: null,
          batchId: null,
          batchName: null,
          pollTitle: "Standalone poll",
          pollIsOpen: true,
          anonymousVote: false,
          eligibleCount: 0,
          respondentCount: 0,
          nonRespondentCount: 0,
          presentNonRespondentCount: 0,
          absentNonRespondentCount: 0,
        },
        items: [],
        pageInfo: {
          page: 1,
          pageSize: 25,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    });
    expect(parsed.data.summary.audienceKnown).toBe(false);
  });

  it("parses live extend body defaults", () => {
    const parsed = pollLiveExtendBodySchema.parse({});
    expect(parsed.seconds).toBe(30);
  });

  it("accepts live monitor snapshot shape", () => {
    const parsed = pollLiveMonitorResponseSchema.parse({
      data: {
        pollId: "11111111-1111-4111-8111-111111111111",
        title: "Which risk model?",
        description: null,
        quizMode: true,
        anonymousVote: false,
        resultVisibility: "after_poll_ends",
        isOpen: true,
        durationSeconds: 60,
        openedAt: "2026-01-01T00:00:00.000Z",
        closedAt: null,
        closesAt: "2026-01-01T00:01:00.000Z",
        liveSessionId: null,
        liveSessionTitle: null,
        serverNow: "2026-01-01T00:00:18.000Z",
        secondsRemaining: 42,
        ranForSeconds: null,
        totalResponses: 87,
        eligibleCount: 186,
        participationPct: 46.8,
        avgResponseSeconds: 14.2,
        correctPct: null,
        recentResponseCount: 12,
        showCorrectAnswers: false,
        options: [
          {
            optionId: "22222222-2222-4222-8222-222222222222",
            label: "VaR",
            sortOrder: 0,
            isCorrect: true,
            count: 58,
            percent: 66.7,
          },
        ],
        timeline: {
          bucketSeconds: 5,
          durationSeconds: 60,
          points: [{ offsetSeconds: 5, responseCount: 10 }],
        },
        recentAnswers: [
          {
            membershipId: "33333333-3333-4333-8333-333333333333",
            learnerName: "A. Chen",
            optionId: "22222222-2222-4222-8222-222222222222",
            optionLabel: "VaR",
            respondedAt: "2026-01-01T00:00:17.000Z",
          },
        ],
        events: [
          {
            kind: "opened",
            at: "2026-01-01T00:00:00.000Z",
            label: "Poll opened",
            detail: "Voting window started",
          },
        ],
      },
    });
    expect(parsed.data.secondsRemaining).toBe(42);
    expect(parsed.data.showCorrectAnswers).toBe(false);
  });

  it("accepts empty live session poll report", () => {
    const parsed = liveSessionPollReportResponseSchema.parse({
      data: {
        session: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          title: "Week 6 live",
          status: "ended",
          scheduledAt: "2026-07-22T13:30:00.000Z",
          startedAt: "2026-07-22T13:30:00.000Z",
          endedAt: "2026-07-22T14:30:00.000Z",
          durationSeconds: 3600,
          attendanceCount: 186,
          hostLabel: "Rajiv Menon",
          courseId: null,
          courseTitle: null,
          batchId: null,
          batchName: null,
          recordingUrl: null,
          hasRecording: false,
          timezoneLabel: "IST",
        },
        summary: {
          pollsRun: 0,
          opinionCount: 0,
          quizCount: 0,
          avgParticipationPct: null,
          mostAnswered: null,
          leastAnswered: null,
          answeredEveryPollCount: 0,
        },
        timeline: {
          durationSeconds: 3600,
          insight: null,
          attendance: { bucketSeconds: 60, points: [] },
          polls: [],
        },
        polls: [],
        matrix: { polls: [], learners: [], truncated: false },
      },
    });
    expect(parsed.data.summary.pollsRun).toBe(0);
  });

  it("keeps anonymous matrix cells honest", () => {
    const parsed = liveSessionPollReportResponseSchema.parse({
      data: {
        session: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          title: "Week 6 live",
          status: "ended",
          scheduledAt: null,
          startedAt: "2026-07-22T13:30:00.000Z",
          endedAt: "2026-07-22T14:30:00.000Z",
          durationSeconds: 3600,
          attendanceCount: 2,
          hostLabel: null,
          courseId: null,
          courseTitle: "Risk Management",
          batchId: null,
          batchName: "FT-2026-Q3",
          recordingUrl: "https://example.com/vod",
          hasRecording: true,
          timezoneLabel: null,
        },
        summary: {
          pollsRun: 2,
          opinionCount: 1,
          quizCount: 1,
          avgParticipationPct: 50,
          mostAnswered: {
            pollId: "11111111-1111-4111-8111-111111111111",
            title: "Risk model",
            responseCount: 10,
          },
          leastAnswered: {
            pollId: "22222222-2222-4222-8222-222222222222",
            title: "Clarity",
            responseCount: 8,
          },
          answeredEveryPollCount: 1,
        },
        timeline: {
          durationSeconds: 3600,
          insight: "Participation fell with each poll — 60% on the first, 40% on the last.",
          attendance: {
            bucketSeconds: 60,
            points: [{ offsetSeconds: 0, concurrent: 2 }],
          },
          polls: [
            {
              pollId: "11111111-1111-4111-8111-111111111111",
              title: "Risk model",
              offsetStartSeconds: 600,
              offsetEndSeconds: 720,
              participationPct: 60,
              responseCount: 10,
            },
          ],
        },
        polls: [
          {
            pollId: "11111111-1111-4111-8111-111111111111",
            title: "Risk model",
            description: null,
            quizMode: false,
            anonymousVote: false,
            isOpen: false,
            pollType: "multiple_choice",
            openedAt: "2026-07-22T13:40:00.000Z",
            closedAt: "2026-07-22T13:42:00.000Z",
            responseCount: 10,
            eligibleCount: 2,
            participationPct: 60,
            correctPct: null,
            options: [
              {
                optionId: "33333333-3333-4333-8333-333333333333",
                label: "VaR",
                sortOrder: 0,
                isCorrect: false,
                count: 10,
                percent: 100,
              },
            ],
          },
          {
            pollId: "22222222-2222-4222-8222-222222222222",
            title: "Clarity",
            description: null,
            quizMode: false,
            anonymousVote: true,
            isOpen: false,
            pollType: "yes_no",
            openedAt: "2026-07-22T13:50:00.000Z",
            closedAt: "2026-07-22T13:52:00.000Z",
            responseCount: 8,
            eligibleCount: 2,
            participationPct: 40,
            correctPct: null,
            options: [],
          },
        ],
        matrix: {
          polls: [
            {
              pollId: "11111111-1111-4111-8111-111111111111",
              title: "Risk model",
              openedAt: "2026-07-22T13:40:00.000Z",
              anonymousVote: false,
              quizMode: false,
              participationPct: 60,
            },
            {
              pollId: "22222222-2222-4222-8222-222222222222",
              title: "Clarity",
              openedAt: "2026-07-22T13:50:00.000Z",
              anonymousVote: true,
              quizMode: false,
              participationPct: 40,
            },
          ],
          learners: [
            {
              membershipId: "44444444-4444-4444-8444-444444444444",
              learnerName: "Alice Smith",
              email: "a@example.com",
              cells: [
                {
                  pollId: "11111111-1111-4111-8111-111111111111",
                  kind: "answered",
                },
                {
                  pollId: "22222222-2222-4222-8222-222222222222",
                  kind: "anonymous",
                },
              ],
              answeredCount: 1,
              trackedPollCount: 1,
            },
          ],
          truncated: false,
        },
      },
    });
    expect(parsed.data.matrix.learners[0]?.cells[1]?.kind).toBe("anonymous");
    expect(parsed.data.session.hasRecording).toBe(true);
  });

  it("accepts live sessions list response", () => {
    const parsed = liveSessionsPollsListResponseSchema.parse({
      data: {
        items: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            title: "Week 6 live",
            status: "ended",
            scheduledAt: "2026-07-22T13:30:00.000Z",
            startedAt: "2026-07-22T13:30:00.000Z",
            endedAt: "2026-07-22T14:30:00.000Z",
            hostLabel: "Rajiv Menon",
            attendanceCount: 186,
            pollCount: 4,
            quizPollCount: 1,
            totalResponses: 412,
            avgParticipationPct: 61.8,
            batchId: null,
            batchName: null,
            courseTitle: "Risk Management",
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
      },
    });
    expect(parsed.data.items[0]?.pollCount).toBe(4);
  });

  it("parses poll compare query from comma-separated ids", () => {
    const parsed = pollsCompareQuerySchema.parse({
      pollIds:
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(parsed.pollIds).toHaveLength(2);
    expect(parsed.alignBy).toBe("label");
  });

  it("rejects fewer than two poll ids for compare", () => {
    expect(() =>
      pollsCompareQuerySchema.parse({
        pollIds: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    ).toThrow();
  });

  it("parses aligned poll compare response", () => {
    const option = {
      optionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      label: "Fixed fractional",
      sortOrder: 0,
      isCorrect: false,
      count: 58,
      percent: 46.8,
    };
    const poll = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Which risk model do you use most?",
      shortName: "Poll 1",
      quizMode: false,
      anonymousVote: false,
      liveSessionId: null,
      liveSessionTitle: "Week 6",
      createdAt: "2026-07-22T13:30:00.000Z",
      openedAt: "2026-07-22T13:30:00.000Z",
      closedAt: "2026-07-22T13:45:00.000Z",
      responseCount: 124,
      eligibleCount: 186,
      participationPct: 66.7,
      medianResponseSeconds: 14.2,
      correctPct: null,
      earlySharePct: 68,
      nonRespondentCount: 62,
      options: [option],
    };
    const parsed = pollsCompareResponseSchema.parse({
      data: {
        alignBy: "label",
        optionsAligned: true,
        polls: [
          poll,
          {
            ...poll,
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            shortName: "Poll 2",
            responseCount: 142,
            participationPct: 88.7,
            options: [{ ...option, count: 74, percent: 52.1 }],
          },
        ],
        optionRows: [
          {
            key: "label:fixed fractional",
            label: "Fixed fractional",
            cells: [
              {
                pollId: poll.id,
                optionId: option.optionId,
                label: option.label,
                count: 58,
                percent: 46.8,
                isCorrect: false,
                deltaPctVsLeft: null,
              },
              {
                pollId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                optionId: option.optionId,
                label: option.label,
                count: 74,
                percent: 52.1,
                isCorrect: false,
                deltaPctVsLeft: 5.3,
              },
            ],
          },
        ],
        trendInsight: null,
      },
    });
    expect(parsed.data.optionsAligned).toBe(true);
    expect(parsed.data.optionRows[0]?.cells[1]?.deltaPctVsLeft).toBe(5.3);
  });

  it("parses mismatched poll compare response with empty option rows", () => {
    const basePoll = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Which risk model do you use most?",
      shortName: "Poll 1",
      quizMode: false,
      anonymousVote: false,
      liveSessionId: null,
      liveSessionTitle: "Week 6",
      createdAt: "2026-07-22T13:30:00.000Z",
      openedAt: "2026-07-22T13:30:00.000Z",
      closedAt: null,
      responseCount: 124,
      eligibleCount: 186,
      participationPct: 66.7,
      medianResponseSeconds: 14.2,
      correctPct: null,
      earlySharePct: 68,
      nonRespondentCount: 62,
      options: [
        {
          optionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          label: "A",
          sortOrder: 0,
          isCorrect: false,
          count: 10,
          percent: 100,
        },
      ],
    };
    const parsed = pollsCompareResponseSchema.parse({
      data: {
        alignBy: "label",
        optionsAligned: false,
        polls: [
          basePoll,
          {
            ...basePoll,
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            shortName: "Poll 2",
            title: "Pick the correct stop distance",
            options: [
              {
                optionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                label: "Different",
                sortOrder: 0,
                isCorrect: true,
                count: 5,
                percent: 100,
              },
            ],
          },
        ],
        optionRows: [],
        trendInsight: null,
      },
    });
    expect(parsed.data.optionsAligned).toBe(false);
    expect(parsed.data.optionRows).toEqual([]);
  });
});
