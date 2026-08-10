import { describe, expect, it } from "vitest";
import {
  RESOURCE_USAGE_COLUMNS,
  exportResourceUsageRosterBodySchema,
  resourceUsageDormantArchiveBodySchema,
  resourceUsageDormantCourseDetailResponseSchema,
  resourceUsageDormantCourseParamsSchema,
  resourceUsageDormantCourseQuerySchema,
  resourceUsageDormantQuerySchema,
  resourceUsageHistoryQuerySchema,
  resourceUsageInactiveDeactivateBodySchema,
  resourceUsageInactiveQuerySchema,
  resourceUsageInactiveResponseSchema,
  resourceUsageMetricParamsSchema,
  resourceUsageOverviewQuerySchema,
  resourceUsageOverviewResponseSchema,
  resourceUsageStorageQuerySchema,
  resourceUsageStorageResponseSchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";

describe("resource usage roster dto", () => {
  it("parses overview period query and response shape", () => {
    const query = resourceUsageOverviewQuerySchema.parse({ period: "ytd" });
    expect(query.period).toBe("ytd");

    const fallback = resourceUsageOverviewQuerySchema.parse({});
    expect(fallback.period).toBe("this_month");

    const overview = resourceUsageOverviewResponseSchema.parse({
      data: {
        period: "this_month",
        meters: {
          storageGb: 12.5,
          activeUsers30d: 10,
          currentMau: 8,
          totalLearners: 40,
          testSubmits: 3,
          products: 2,
          questions: 100,
          messageSends: 20,
          bandwidthGb: 0,
          drmTokens: 0,
          videoTranscodingHours: 0,
        },
        limits: { storageGb: 50, mau: 500 },
        trends: {
          storageSparkline: [1, 2, 12.5],
          storageDeltaGb: 10.5,
          generatedAt: "2026-08-10T10:00:00.000Z",
        },
        optimization: {
          dormantContentCount: 1,
          inactiveLearnerCount: 2,
          dormantStorageGb: 0.4,
        },
        notes: {
          bandwidthMetered: false,
          drmMetered: false,
          videoHoursMetered: false,
        },
        isEmpty: false,
      },
    });
    expect(overview.data.limits.storageGb).toBe(50);
    expect(overview.data.trends.storageSparkline).toHaveLength(3);
  });

  it("parses history query defaults and columns", () => {
    const parsed = resourceUsageHistoryQuerySchema.parse({
      page: "2",
      metricKey: "usage.storage_gb",
      columns: "metric_key,period,value",
      sort: "highest_delta",
      rangeMonths: "12",
    });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.metricKey).toBe("usage.storage_gb");
    expect(parsed.columns).toEqual(["metric_key", "period", "value"]);
    expect(parsed.sort).toBe("highest_delta");
    expect(parsed.rangeMonths).toBe(12);

    const fallback = resourceUsageHistoryQuerySchema.parse({ columns: "nope" });
    expect(fallback.columns).toEqual([...RESOURCE_USAGE_COLUMNS]);
    expect(fallback.sort).toBe("newest");
    expect(fallback.rangeMonths).toBe(24);
  });

  it("parses dormant and inactive queries", () => {
    const dormant = resourceUsageDormantQuerySchema.parse({
      q: "math",
      page: "1",
      view: "unpublished",
      dormantDays: "60",
      includeArchived: "false",
      includeUnpublished: "true",
      sort: "dormant_desc",
    });
    expect(dormant.q).toBe("math");
    expect(dormant.limit).toBe(25);
    expect(dormant.view).toBe("unpublished");
    expect(dormant.dormantDays).toBe(60);
    expect(dormant.includeArchived).toBe(false);
    expect(dormant.includeUnpublished).toBe(true);
    expect(dormant.sort).toBe("dormant_desc");

    const inactive = resourceUsageInactiveQuerySchema.parse({ q: "ada" });
    expect(inactive.q).toBe("ada");
    expect(inactive.inactiveDays).toBe(90);
    expect(inactive.view).toBe("all");
  });

  it("parses inactive deactivate body", () => {
    const body = resourceUsageInactiveDeactivateBodySchema.parse({
      membershipIds: ["11111111-1111-4111-8111-111111111111"],
      reason: "inactivity",
      excludePaid: true,
    });
    expect(body.excludePaid).toBe(true);
    expect(body.reason).toBe("inactivity");
  });

  it("parses inactive query defaults and summary response shape", () => {
    const inactive = resourceUsageInactiveQuerySchema.parse({
      q: "ada",
      view: "never_active",
      inactiveDays: "90",
      paidFilter: "has_paid",
    });
    expect(inactive.q).toBe("ada");
    expect(inactive.view).toBe("never_active");
    expect(inactive.inactiveDays).toBe(90);
    expect(inactive.paidFilter).toBe("has_paid");
    expect(inactive.includeInvitedNeverSignedIn).toBe(true);

    const response = resourceUsageInactiveResponseSchema.parse({
      data: {
        summary: {
          inactiveLearnerCount: 10,
          totalLearnerCount: 100,
          inactiveLearnerPct: 10,
          neverActiveCount: 2,
          inactiveOverYearCount: 1,
          enrolmentsHeld: 20,
          paidAmongThem: 3,
          viewCounts: { all: 10, neverActive: 2, paidHolding: 3 },
          settings: {
            inactiveDays: 90,
            includeInvitedNeverSignedIn: true,
            excludeActivePaidEnrolment: false,
          },
        },
        items: [
          {
            membershipId: "11111111-1111-4111-8111-111111111111",
            learnerName: "Ada",
            email: "ada@example.com",
            status: "ACTIVE",
            activityLabel: "never_active",
            enrolmentCount: 1,
            lastActiveAt: null,
            inactiveDays: 120,
            createdAt: "2025-01-01T00:00:00.000Z",
            hasPaid: false,
            selectable: true,
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
        isEmpty: false,
      },
    });
    expect(response.data.summary.paidAmongThem).toBe(3);
    expect(response.data.items[0]?.activityLabel).toBe("never_active");
  });

  it("parses dormant archive body", () => {
    const body = resourceUsageDormantArchiveBodySchema.parse({
      courseIds: ["11111111-1111-4111-8111-111111111111"],
      reason: "low_engagement",
      deleteAssets: true,
    });
    expect(body.action).toBe("archive");
    expect(body.deleteAssets).toBe(true);
    expect(body.courseIds).toHaveLength(1);
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

  it("parses metric detail path params", () => {
    const parsed = resourceUsageMetricParamsSchema.parse({
      metricKey: "usage.storage_gb",
    });
    expect(parsed.metricKey).toBe("usage.storage_gb");

    expect(() => resourceUsageMetricParamsSchema.parse({ metricKey: "usage.unknown" })).toThrow();
  });

  it("parses dormant course detail params, query, and response", () => {
    const params = resourceUsageDormantCourseParamsSchema.parse({
      courseId: "11111111-1111-4111-8111-111111111111",
    });
    expect(params.courseId).toBe("11111111-1111-4111-8111-111111111111");

    const query = resourceUsageDormantCourseQuerySchema.parse({ dormantDays: "45" });
    expect(query.dormantDays).toBe(45);
    expect(resourceUsageDormantCourseQuerySchema.parse({}).dormantDays).toBe(30);

    const response = resourceUsageDormantCourseDetailResponseSchema.parse({
      data: {
        course: {
          courseId: "11111111-1111-4111-8111-111111111111",
          title: "Advanced React Patterns",
          status: "PUBLISHED",
          shortCode: "C-1111",
          dormantDays: 214,
          neverOpened: false,
          createdAt: "2025-01-01T00:00:00.000Z",
          selectable: true,
          openCourseHref: "/studio/courses/11111111-1111-4111-8111-111111111111",
        },
        summary: {
          storageGb: 18.4,
          storageShareOfTenantPct: 10,
          totalTenantStorageGb: 184,
          lessonCount: 42,
          lessonsWithAssetsCount: 38,
          fileCount: 1204,
          lastLearnerActivityAt: "2025-12-01T00:00:00.000Z",
          enrolmentTotal: 118,
          enrolmentActive: 10,
          enrolmentActiveIn90d: 0,
        },
        composition: [{ key: "video", label: "Video", valueGb: 8.2, sharePct: 45 }],
        topFiles: [
          {
            fileName: "masterclass.mp4",
            contentType: "video/mp4",
            assetTypeKey: "video",
            assetTypeLabel: "Video",
            sizeBytes: 1_200_000_000,
            sizeLabel: "1.2 GB",
            lessonId: "22222222-2222-4222-8222-222222222222",
            lessonTitle: "Module 4",
            uploadedAt: "2023-01-15T00:00:00.000Z",
          },
        ],
        impact: {
          lessonCount: 42,
          enrolmentCount: 118,
          certificatesRemainValid: 3,
          storageGbIfDeleted: 18.4,
        },
        lessons: [
          {
            lessonId: "22222222-2222-4222-8222-222222222222",
            position: 1,
            title: "Intro",
            lessonTypeLabel: "Video",
            durationLabel: "12:45",
            storageGb: 1.2,
            neverOpened: false,
            lastOpenedAt: "2025-12-01T00:00:00.000Z",
          },
        ],
      },
    });
    expect(response.data.course.shortCode).toBe("C-1111");
    expect(response.data.topFiles[0]?.sizeLabel).toBe("1.2 GB");
    expect(response.data.impact.certificatesRemainValid).toBe(3);
  });

  it("parses storage breakdown query and response", () => {
    const query = resourceUsageStorageQuerySchema.parse({
      assetType: "video",
      sort: "files_desc",
      page: "2",
      limit: "10",
    });
    expect(query.assetType).toBe("video");
    expect(query.sort).toBe("files_desc");
    expect(query.page).toBe(2);
    expect(query.limit).toBe(10);

    const fallback = resourceUsageStorageQuerySchema.parse({});
    expect(fallback.sort).toBe("size_desc");
    expect(fallback.page).toBe(1);
    expect(fallback.limit).toBe(12);

    const response = resourceUsageStorageResponseSchema.parse({
      data: {
        summary: {
          totalGb: 12.5,
          delta30dGb: 1.2,
          sparkline: [8, 9, 12.5],
          limitGb: 50,
          limitPct: 25,
          dormantGb: 2,
          dormantPct: 16,
          largestCourse: {
            courseId: "11111111-1111-4111-8111-111111111111",
            title: "Bootcamp",
            storageGb: 4,
          },
          avgPerCourseGb: 2.5,
          fileCount: 120,
          courseCount: 5,
          dominantTypeLabel: "Video",
          dominantTypeSharePct: 60,
        },
        composition: [
          { key: "video", label: "Video", valueGb: 7.5, sharePct: 60 },
          { key: "documents", label: "Documents", valueGb: 5, sharePct: 40 },
        ],
        reclaim: [
          {
            key: "dormant",
            label: "attached to courses with no activity in 30 days",
            storageGb: 2,
            href: "/admin/reports/resource-usage?tab=dormant",
            actionLabel: "Review",
          },
        ],
        holders: [
          {
            courseId: "11111111-1111-4111-8111-111111111111",
            title: "Bootcamp",
            status: "PUBLISHED",
            storageGb: 4,
            sharePct: 32,
            fileCount: 40,
            lastLearnerActivityAt: "2026-08-01T10:00:00.000Z",
            createdAt: "2026-01-01T10:00:00.000Z",
            dormant: false,
          },
        ],
        pageInfo: {
          page: 1,
          pageSize: 12,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        isEmpty: false,
      },
    });
    expect(response.data.summary.totalGb).toBe(12.5);
    expect(response.data.composition).toHaveLength(2);
    expect(response.data.holders[0]?.dormant).toBe(false);
  });
});
