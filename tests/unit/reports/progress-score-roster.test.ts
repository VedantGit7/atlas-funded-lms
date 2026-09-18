import { describe, expect, it } from "vitest";
import {
  PROGRESS_LEARNER_COLUMNS,
  SCORE_LEARNER_COLUMNS,
  createProgressGroupBodySchema,
  exportProgressScoreBodySchema,
  extendProgressLearnerBodySchema,
  progressLearnerDetailParamsSchema,
  progressLearnerDetailResponseSchema,
  progressLearnersQuerySchema,
  progressProductLearnersParamsSchema,
  progressProductItemSchema,
  progressProductsQuerySchema,
  progressProductsListResponseSchema,
  regradeScoreAttemptsBodySchema,
  resetProgressLearnerBodySchema,
  saveAttemptGradingBodySchema,
  scoreAttemptHistoryQuerySchema,
  scoreAttemptReviewParamsSchema,
  scoreAttemptReviewResponseSchema,
  scoreLearnersQuerySchema,
  voidAttemptBodySchema,
  grantExtraAttemptBodySchema,
  cohortGroupsQuerySchema,
  cohortGroupsResponseSchema,
  cohortMessagesQuerySchema,
  cohortMessagesResponseSchema,
  retryCohortMessageParamsSchema,
  retryCohortMessageBodySchema,
  sendProgressMessageBodySchema,
  scoreProductTypeParamsSchema,
  scoreProductsQuerySchema,
  scoreQuizzesQuerySchema,
  scoreQuizItemSchema,
  scoreQuizzesListResponseSchema,
} from "@atlas/domain/reports/progress-score-roster.dto";

describe("progress-score roster dto", () => {
  it("parses progress learner query defaults and columns", () => {
    const parsed = progressLearnersQuerySchema.parse({
      columns: "learner_name,completion_pct,enrolled_at",
      sortBy: "completion_pct",
      sortDir: "asc",
      page: "2",
    });
    expect(parsed.columns).toEqual(["learner_name", "completion_pct", "enrolled_at"]);
    expect(parsed.sortBy).toBe("completion_pct");
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
    expect(parsed.view).toBe("all");
  });

  it("defaults learner roster sort to last activity", () => {
    const parsed = progressLearnersQuerySchema.parse({});
    expect(parsed.sortBy).toBe("last_activity_at");
    expect(parsed.sortDir).toBe("desc");
    expect(parsed.view).toBe("all");
  });

  it("parses learner roster view and activity filters", () => {
    const parsed = progressLearnersQuerySchema.parse({
      view: "stalled",
      completionBand: "early",
      activityStatus: "stalled",
      sortBy: "last_activity_at",
    });
    expect(parsed.view).toBe("stalled");
    expect(parsed.completionBand).toBe("early");
    expect(parsed.activityStatus).toBe("stalled");
  });

  it("falls back to all progress columns when invalid", () => {
    const parsed = progressLearnersQuerySchema.parse({ columns: "nope" });
    expect(parsed.columns).toEqual([...PROGRESS_LEARNER_COLUMNS]);
  });

  it("parses score learner filters", () => {
    const parsed = scoreLearnersQuerySchema.parse({
      columns: ["learner_name", "score_pct"],
      resultStatus: "pass",
      minScore: "70",
      sortBy: "score_pct",
    });
    expect(parsed.columns).toEqual(["learner_name", "score_pct"]);
    expect(parsed.resultStatus).toBe("pass");
    expect(parsed.minScore).toBe(70);
  });

  it("parses score learner views and attempts filter", () => {
    const parsed = scoreLearnersQuerySchema.parse({
      view: "ungraded",
      attemptsFilter: "more_than_one",
      minAttempts: "2",
    });
    expect(parsed.view).toBe("ungraded");
    expect(parsed.attemptsFilter).toBe("more_than_one");
    expect(parsed.minAttempts).toBe(2);
    expect(parsed.columns).toEqual([...SCORE_LEARNER_COLUMNS]);
  });

  it("falls back to all score columns when invalid", () => {
    const parsed = scoreLearnersQuerySchema.parse({ columns: "bad" });
    expect(parsed.columns).toEqual([...SCORE_LEARNER_COLUMNS]);
  });

  it("accepts group and export bodies for course and non-course products", () => {
    const group = createProgressGroupBodySchema.parse({
      courseId: "11111111-1111-4111-8111-111111111111",
      title: "Low completion",
      enrolledType: "paid",
    });
    expect(group.title).toBe("Low completion");
    expect(group.productType).toBe("course");

    const seriesGroup = createProgressGroupBodySchema.parse({
      productType: "test_series",
      productId: "11111111-1111-4111-8111-111111111111",
      title: "Series lagging",
    });
    expect(seriesGroup.productType).toBe("test_series");

    const exported = exportProgressScoreBodySchema.parse({
      tab: "scores",
      assessmentId: "11111111-1111-4111-8111-111111111111",
      productType: "mock_test",
      productId: "11111111-1111-4111-8111-111111111111",
    });
    expect(exported.tab).toBe("scores");
    expect(exported.productType).toBe("mock_test");

    expect(() =>
      createProgressGroupBodySchema.parse({
        courseId: "11111111-1111-4111-8111-111111111111",
        title: "Bad",
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();

    expect(() =>
      createProgressGroupBodySchema.parse({
        productType: "bundle",
        title: "Missing product id",
      }),
    ).toThrow();
  });

  it("parses product type route params", () => {
    expect(scoreProductTypeParamsSchema.parse({ productType: "mock_test" }).productType).toBe(
      "mock_test",
    );
    expect(
      progressProductLearnersParamsSchema.parse({
        productType: "subscription",
        productId: "11111111-1111-4111-8111-111111111111",
      }).productType,
    ).toBe("subscription");
  });

  it("parses progress products query defaults for picker filters", () => {
    const parsed = progressProductsQuerySchema.parse({
      status: "PUBLISHED",
      sortBy: "avg_completion",
      sortDir: "asc",
      page: "2",
    });
    expect(parsed.status).toBe("PUBLISHED");
    expect(parsed.sortBy).toBe("avg_completion");
    expect(parsed.sortDir).toBe("asc");
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
  });

  it("parses enriched progress product list response", () => {
    const parsed = progressProductsListResponseSchema.parse({
      data: {
        items: [
          progressProductItemSchema.parse({
            id: "11111111-1111-4111-8111-111111111111",
            title: "Funded Trader Foundations",
            slug: "funded-trader-foundations",
            status: "PUBLISHED",
            enrolledCount: 12,
            quizCount: 3,
            avgCompletionPct: 68.5,
            completionBands: {
              not_started: 2,
              early: 1,
              in_progress: 4,
              nearly_done: 3,
              complete: 2,
            },
            notStartedCount: 2,
            lastActivityAt: "2026-08-05T08:00:00.000Z",
          }),
        ],
        pageInfo: {
          page: 1,
          pageSize: 25,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        summary: { productCount: 1, enrolmentCount: 12 },
      },
    });
    expect(parsed.data.items[0]?.avgCompletionPct).toBe(68.5);
    expect(parsed.data.summary.enrolmentCount).toBe(12);
  });

  it("parses individual learner detail params", () => {
    const parsed = progressLearnerDetailParamsSchema.parse({
      productType: "course",
      productId: "11111111-1111-4111-8111-111111111111",
      enrollmentId: "22222222-2222-4222-8222-222222222222",
    });
    expect(parsed.productType).toBe("course");
    expect(parsed.enrollmentId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("requires reason on progress reset body", () => {
    expect(() =>
      resetProgressLearnerBodySchema.parse({
        clearAssessmentAttempts: true,
        reason: "",
      }),
    ).toThrow();

    const parsed = resetProgressLearnerBodySchema.parse({
      clearAssessmentAttempts: false,
      reason: "Learner requested restart after curriculum update",
    });
    expect(parsed.clearAssessmentAttempts).toBe(false);
    expect(parsed.reason).toContain("restart");
  });

  it("requires future expiry on extend body", () => {
    const parsed = extendProgressLearnerBodySchema.parse({
      expiresAt: "2026-12-31T23:59:59.000Z",
      reason: "Support extension",
    });
    expect(parsed.expiresAt).toBe("2026-12-31T23:59:59.000Z");
  });

  it("accepts a minimal learner detail response shape", () => {
    const parsed = progressLearnerDetailResponseSchema.parse({
      data: {
        product: {
          productType: "course",
          productId: "11111111-1111-4111-8111-111111111111",
          title: "Foundations",
        },
        learner: {
          enrollmentId: "22222222-2222-4222-8222-222222222222",
          membershipId: "33333333-3333-4333-8333-333333333333",
          displayName: "Ada Lovelace",
          email: "ada@example.com",
          avatarUrl: null,
          paymentStatus: "paid",
          accessStatus: "active",
          expiresAt: null,
        },
        summary: {
          completionPct: 40,
          completedLessons: 2,
          totalLessons: 5,
          timeOnContentLabel: null,
          lastActiveAt: "2026-08-01T12:00:00.000Z",
          assessmentsPassed: 1,
          assessmentsTotal: 2,
        },
        modules: [],
        activity: { days: [], longestGapDays: null, longestGapLabel: null },
        assessments: [],
        enrolment: {
          enrollmentId: "22222222-2222-4222-8222-222222222222",
          enrolledType: "Direct Purchase",
          sourceLabel: null,
          grantedByLabel: null,
          enrolledAt: "2026-01-01T00:00:00.000Z",
          certificateIssued: false,
          certificateLabel: "N/A (Incomplete)",
        },
        capabilities: {
          canResetProgress: true,
          canExtendAccess: true,
          canMessage: true,
          curriculumAvailable: true,
        },
      },
    });
    expect(parsed.data.learner.displayName).toBe("Ada Lovelace");
    expect(parsed.data.capabilities.canResetProgress).toBe(true);
  });

  it("parses score products query with pass-rate and ungraded filters", () => {
    const parsed = scoreProductsQuerySchema.parse({
      q: "risk",
      passRateBand: "below_50",
      hasUngraded: "true",
      sortBy: "attempts",
      sortDir: "desc",
      page: "1",
      limit: "25",
    });
    expect(parsed.q).toBe("risk");
    expect(parsed.passRateBand).toBe("below_50");
    expect(parsed.hasUngraded).toBe(true);
    expect(parsed.sortBy).toBe("attempts");
  });

  it("defaults score products sort to attempts desc", () => {
    const parsed = scoreProductsQuerySchema.parse({});
    expect(parsed.sortBy).toBe("attempts");
    expect(parsed.sortDir).toBe("desc");
    expect(parsed.limit).toBe(25);
  });

  it("parses score quizzes query with assessment filters", () => {
    const parsed = scoreQuizzesQuerySchema.parse({
      q: "risk",
      assessmentType: "quiz",
      passRateBand: "below_50",
      hasUngraded: "true",
      sortBy: "pass_rate",
      sortDir: "desc",
      page: "2",
      limit: "25",
    });
    expect(parsed.q).toBe("risk");
    expect(parsed.assessmentType).toBe("quiz");
    expect(parsed.passRateBand).toBe("below_50");
    expect(parsed.hasUngraded).toBe(true);
    expect(parsed.sortBy).toBe("pass_rate");
    expect(parsed.page).toBe(2);
  });

  it("defaults score quizzes sort to title asc", () => {
    const parsed = scoreQuizzesQuerySchema.parse({});
    expect(parsed.sortBy).toBe("title");
    expect(parsed.sortDir).toBe("asc");
    expect(parsed.limit).toBe(25);
  });

  it("accepts a score quizzes list response with summary and spread", () => {
    const parsed = scoreQuizzesListResponseSchema.parse({
      data: {
        product: {
          productType: "course",
          productId: "11111111-1111-4111-8111-111111111111",
          title: "Funded Trader Foundations",
          slug: "funded-trader-foundations",
          status: "PUBLISHED",
        },
        courseId: "11111111-1111-4111-8111-111111111111",
        courseTitle: "Funded Trader Foundations",
        summary: {
          assessmentCount: 4,
          learnersAttempted: 312,
          attemptCount: 1204,
          attemptsPerLearner: 3.9,
          avgScorePct: 71.2,
          passRatePct: 68.4,
          ungradedCount: 12,
          medianTimeLabel: "14m 20s",
        },
        items: [
          scoreQuizItemSchema.parse({
            assessmentId: "22222222-2222-4222-8222-222222222222",
            title: "Risk basics",
            assessmentType: "quiz",
            lessonId: "33333333-3333-4333-8333-333333333333",
            lessonTitle: "Module 1",
            questionCount: 12,
            passMarkPct: 60,
            attemptCount: 400,
            learnerCount: 200,
            avgScorePct: 74.5,
            passRatePct: 70,
            ungradedCount: 3,
            lastAttemptAt: "2026-08-05T10:00:00.000Z",
            scoreSpread: { min: 20, q1: 55, median: 72, q3: 85, max: 98 },
          }),
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
    expect(parsed.data.summary.assessmentCount).toBe(4);
    expect(parsed.data.items[0]?.scoreSpread?.median).toBe(72);
  });

  it("parses attempt history query defaults", () => {
    const parsed = scoreAttemptHistoryQuerySchema.parse({
      flag: "tab_switched",
      page: "2",
    });
    expect(parsed.flag).toBe("tab_switched");
    expect(parsed.sortBy).toBe("submitted_at");
    expect(parsed.page).toBe(2);
  });

  it("requires attempt or membership ids for selected regrade scope", () => {
    expect(() =>
      regradeScoreAttemptsBodySchema.parse({
        scope: "selected",
      }),
    ).toThrow();

    const selected = regradeScoreAttemptsBodySchema.parse({
      scope: "selected",
      membershipIds: ["11111111-1111-4111-8111-111111111111"],
      notifyLearners: true,
    });
    expect(selected.notifyLearners).toBe(true);

    const all = regradeScoreAttemptsBodySchema.parse({ scope: "all" });
    expect(all.scope).toBe("all");
    expect(all.notifyLearners).toBe(false);
  });

  it("parses attempt review params", () => {
    const parsed = scoreAttemptReviewParamsSchema.parse({
      assessmentId: "11111111-1111-4111-8111-111111111111",
      attemptId: "22222222-2222-4222-8222-222222222222",
    });
    expect(parsed.assessmentId).toBe("11111111-1111-4111-8111-111111111111");
    expect(parsed.attemptId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("parses attempt review response including available-slot history", () => {
    const parsed = scoreAttemptReviewResponseSchema.parse({
      data: {
        assessment: {
          assessmentId: "11111111-1111-4111-8111-111111111111",
          title: "Module Quiz",
          assessmentType: "QUIZ",
          passMarkPercent: 70,
          timeLimitSeconds: 1800,
          attemptsAllowed: 2,
          productType: "course",
          productId: "33333333-3333-4333-8333-333333333333",
          productTitle: "Course A",
          courseId: "33333333-3333-4333-8333-333333333333",
          courseTitle: "Course A",
        },
        learner: {
          membershipId: "44444444-4444-4444-8444-444444444444",
          learnerName: "Ada Lovelace",
          email: "ada@example.com",
        },
        attempt: {
          attemptId: "22222222-2222-4222-8222-222222222222",
          attemptNumber: 1,
          ofAllowed: 2,
          status: "GRADED",
          resultStatus: "fail",
          scorePct: 65,
          startedAt: "2026-08-01T10:00:00.000Z",
          submittedAt: "2026-08-01T10:20:00.000Z",
          durationSeconds: 1200,
          shortId: "22222222",
        },
        summary: {
          correctCount: 6,
          answeredCount: 9,
          unansweredCount: 1,
          questionCount: 10,
          timeLimitSeconds: 1800,
          pointsShortfall: 5,
          needsGradingCount: 1,
        },
        questions: [
          {
            assessmentItemId: "55555555-5555-4555-8555-555555555555",
            itemId: "66666666-6666-4666-8666-666666666666",
            position: 0,
            stem: "What is 2+2?",
            itemTypeKey: "single_choice",
            pointsMax: 1,
            pointsAwarded: 1,
            outcome: "correct",
            durationSeconds: 12,
            cohortCorrectRatePct: 80,
            options: [
              {
                optionId: "77777777-7777-4777-8777-777777777777",
                label: "4",
                isCorrect: true,
                selectedByLearner: true,
              },
            ],
            learnerAnswerText: null,
            selectedOptionIds: ["77777777-7777-4777-8777-777777777777"],
            correctOptionIds: ["77777777-7777-4777-8777-777777777777"],
            feedback: null,
            isManual: false,
          },
        ],
        history: [
          {
            attemptId: "22222222-2222-4222-8222-222222222222",
            attemptNumber: 1,
            scorePct: 65,
            scoreDelta: null,
            resultStatus: "fail",
            submittedAt: "2026-08-01T10:20:00.000Z",
            isCurrent: true,
            isAvailableSlot: false,
          },
          {
            attemptId: null,
            attemptNumber: 2,
            scorePct: null,
            scoreDelta: null,
            resultStatus: "pending",
            submittedAt: null,
            isCurrent: false,
            isAvailableSlot: true,
          },
        ],
        integrity: [
          {
            key: "tab_switched",
            label: "Tab switches detected",
            severity: "medium",
            recordedAt: "2026-08-01T10:15:00.000Z",
          },
        ],
        nav: {
          prevAttemptId: null,
          nextAttemptId: null,
        },
        grants: {
          extraAttemptsGranted: 0,
          effectiveAttemptsAllowed: 2,
        },
      },
    });
    expect(parsed.data.history[1]?.attemptId).toBeNull();
    expect(parsed.data.history[1]?.isAvailableSlot).toBe(true);
    expect(parsed.data.questions[0]?.outcome).toBe("correct");
  });

  it("requires grading items and bounds points", () => {
    expect(() => saveAttemptGradingBodySchema.parse({ items: [] })).toThrow();
    expect(() =>
      saveAttemptGradingBodySchema.parse({
        items: [
          {
            assessmentItemId: "55555555-5555-4555-8555-555555555555",
            pointsAwarded: -1,
          },
        ],
      }),
    ).toThrow();

    const parsed = saveAttemptGradingBodySchema.parse({
      items: [
        {
          assessmentItemId: "55555555-5555-4555-8555-555555555555",
          pointsAwarded: 2.5,
          feedback: "Partial credit",
        },
      ],
    });
    expect(parsed.notifyLearner).toBe(false);
    expect(parsed.items[0]?.pointsAwarded).toBe(2.5);
  });

  it("requires a void reason and defaults grant count", () => {
    expect(() => voidAttemptBodySchema.parse({ reason: "" })).toThrow();
    expect(() => voidAttemptBodySchema.parse({})).toThrow();

    const voided = voidAttemptBodySchema.parse({ reason: " Duplicate submission " });
    expect(voided.reason).toBe("Duplicate submission");

    const grant = grantExtraAttemptBodySchema.parse({});
    expect(grant.count).toBe(1);

    const grantTwo = grantExtraAttemptBodySchema.parse({ count: 2, reason: "Retake" });
    expect(grantTwo.count).toBe(2);
  });

  it("parses cohort groups query defaults and response", () => {
    const query = cohortGroupsQuerySchema.parse({});
    expect(query.page).toBe(1);
    expect(query.limit).toBe(25);

    const parsed = cohortGroupsResponseSchema.parse({
      data: {
        items: [
          {
            batchId: "11111111-1111-4111-8111-111111111111",
            key: "prg-remediation",
            name: "Module 3 Remediation",
            description: null,
            sourceKind: "scores",
            productType: "course",
            productId: "22222222-2222-4222-8222-222222222222",
            productTitle: "Funded Trader",
            assessmentId: "33333333-3333-4333-8333-333333333333",
            assessmentTitle: "Mod 3 Checkpoint",
            criteriaSummary: "Score < 70%",
            memberCount: 1245,
            syncType: "static",
            createdAt: "2026-08-01T10:00:00.000Z",
            createdByLabel: null,
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
    expect(parsed.data.items[0]?.syncType).toBe("static");
    expect(parsed.data.items[0]?.sourceKind).toBe("scores");
  });

  it("parses cohort messages response and retry params", () => {
    const query = cohortMessagesQuerySchema.parse({ page: "2" });
    expect(query.page).toBe(2);

    const parsed = cohortMessagesResponseSchema.parse({
      data: {
        items: [
          {
            campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            subject: "Reminder",
            audienceCaption: "42 learners",
            sourceKind: "progress",
            productTitle: "Foundations",
            assessmentTitle: null,
            deliveredCount: 42,
            skippedCount: 0,
            failedCount: 0,
            openedCount: null,
            recipientCount: 42,
            status: "sent",
            sentByLabel: "Admin",
            sentAt: "2026-08-01T09:41:00.000Z",
            reportHref: "/admin/reports/progress-score/progress",
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
    expect(parsed.data.items[0]?.openedCount).toBeNull();
    expect(parsed.data.items[0]?.status).toBe("sent");

    const retryParams = retryCohortMessageParamsSchema.parse({
      campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(retryParams.campaignId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(retryCohortMessageBodySchema.parse({})).toEqual({});
  });

  it("accepts excludeMessagedWithinDays on message bodies", () => {
    const progress = sendProgressMessageBodySchema.parse({
      productType: "course",
      productId: "11111111-1111-4111-8111-111111111111",
      subject: "Hello",
      message: "Body",
      excludeMessagedWithinDays: 7,
    });
    expect(progress.excludeMessagedWithinDays).toBe(7);
    expect(progress.audienceCaption).toBeUndefined();
  });
});
