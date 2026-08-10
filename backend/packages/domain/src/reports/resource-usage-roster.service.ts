import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  resourceUsageDormantArchiveResponseSchema,
  resourceUsageDormantCourseDetailResponseSchema,
  resourceUsageDormantResponseSchema,
  resourceUsageHistoryResponseSchema,
  resourceUsageInactiveDeactivateResponseSchema,
  resourceUsageInactiveResponseSchema,
  resourceUsageMetricDetailResponseSchema,
  resourceUsageOverviewResponseSchema,
  resourceUsageStorageResponseSchema,
  type ResourceUsageDormantArchiveBody,
  type ResourceUsageDormantCourseQuery,
  type ResourceUsageDormantQuery,
  type ResourceUsageHistoryQuery,
  type ResourceUsageInactiveDeactivateBody,
  type ResourceUsageInactiveQuery,
  type ResourceUsageMetricKey,
  type ResourceUsageOverviewQuery,
  type ResourceUsageStorageQuery,
} from "./resource-usage-roster.dto";
import {
  resourceUsageDormantCourseNotFound,
  resourceUsageMetricNotFound,
} from "./resource-usage-roster.errors";
import { resourceUsageRosterRepository } from "./resource-usage-roster.repository";

function pageInfo(totalCount: number, page: number, limit: number) {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  return {
    page,
    pageSize: limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

type MetricCatalogEntry = {
  label: string;
  unit: string;
  category: string;
  definition: string;
  status: "metered" | "live" | "not_metered";
  cadence: "monthly" | "live" | "none";
  historyKey: string | null;
  meterField: keyof Awaited<ReturnType<typeof resourceUsageRosterRepository.getMeters>> | null;
  limitField: "storageGb" | "mau" | null;
};

const METRIC_CATALOG: Record<ResourceUsageMetricKey, MetricCatalogEntry> = {
  "usage.storage_gb": {
    label: "Storage",
    unit: "GB",
    category: "Storage",
    definition:
      "Total object storage held by courses, lessons, and attached assets for this academy.",
    status: "metered",
    cadence: "monthly",
    historyKey: "usage.storage_gb",
    meterField: "storageGb",
    limitField: "storageGb",
  },
  "usage.total_learners": {
    label: "Total learners",
    unit: "count",
    category: "Learners",
    definition: "Count of learner memberships on this academy, including inactive seats.",
    status: "metered",
    cadence: "monthly",
    historyKey: "usage.total_learners",
    meterField: "totalLearners",
    limitField: null,
  },
  "usage.products": {
    label: "Products",
    unit: "count",
    category: "Catalog",
    definition: "Active products published in the catalog for this academy.",
    status: "metered",
    cadence: "monthly",
    historyKey: "usage.products",
    meterField: "products",
    limitField: null,
  },
  "usage.questions": {
    label: "Questions",
    unit: "count",
    category: "Assessments",
    definition: "Question bank entries available for assessments on this academy.",
    status: "metered",
    cadence: "monthly",
    historyKey: "usage.questions",
    meterField: "questions",
    limitField: null,
  },
  "usage.test_submits": {
    label: "Tests taken",
    unit: "count",
    category: "Assessments",
    definition: "Assessment submissions recorded for learners on this academy.",
    status: "metered",
    cadence: "monthly",
    historyKey: "usage.test_submits",
    meterField: "testSubmits",
    limitField: null,
  },
  "usage.message_sends": {
    label: "Message sends",
    unit: "count",
    category: "Messaging",
    definition: "Outbound messages sent to learners from this academy.",
    status: "metered",
    cadence: "monthly",
    historyKey: "usage.message_sends",
    meterField: "messageSends",
    limitField: null,
  },
  "usage.email_validations": {
    label: "Email validations",
    unit: "count",
    category: "Messaging",
    definition: "Email address validation checks performed for this academy.",
    status: "metered",
    cadence: "monthly",
    historyKey: "usage.email_validations",
    meterField: null,
    limitField: null,
  },
  "usage.current_mau": {
    label: "Current MAU",
    unit: "USERS",
    category: "Learners",
    definition:
      "Counts unique learners who have logged in and performed at least one action in the last 30 days.",
    status: "live",
    cadence: "live",
    historyKey: null,
    meterField: "currentMau",
    limitField: "mau",
  },
  "usage.active_users_30d": {
    label: "Active users (30d)",
    unit: "USERS",
    category: "Learners",
    definition: "Learners with recorded activity in the last 30 days.",
    status: "live",
    cadence: "live",
    historyKey: null,
    meterField: "activeUsers30d",
    limitField: null,
  },
  "usage.bandwidth_gb": {
    label: "Bandwidth",
    unit: "GB",
    category: "Network egress",
    definition:
      "Measurement of egress bandwidth for this tenant is currently disabled. Once activated, it will track all data served via CDN and direct storage.",
    status: "not_metered",
    cadence: "none",
    historyKey: null,
    meterField: "bandwidthGb",
    limitField: null,
  },
  "usage.drm_tokens": {
    label: "DRM tokens",
    unit: "TOK",
    category: "Media protection",
    definition:
      "DRM token issuance is not measured on this account yet. When enabled, it counts license grants for protected media.",
    status: "not_metered",
    cadence: "none",
    historyKey: null,
    meterField: "drmTokens",
    limitField: null,
  },
  "usage.video_transcoding_hours": {
    label: "Video transcoding",
    unit: "h",
    category: "Media processing",
    definition:
      "Video transcoding hours are not measured on this account yet. When enabled, it tracks encode time for uploaded media.",
    status: "not_metered",
    cadence: "none",
    historyKey: null,
    meterField: "videoTranscodingHours",
    limitField: null,
  },
};

function formatPeriodLabel(period: string): string {
  const date = new Date(`${period}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function shortCourseCode(courseId: string): string {
  return `C-${courseId.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

function projectLimitReachLabel(
  current: number,
  avgMonthlyGrowth: number,
  limit: number | null,
): string | null {
  if (limit == null || avgMonthlyGrowth <= 0 || current >= limit) return null;
  const monthsNeeded = Math.ceil((limit - current) / avgMonthlyGrowth);
  if (monthsNeeded > 120) return null;
  const reach = new Date();
  reach.setUTCMonth(reach.getUTCMonth() + monthsNeeded);
  return reach.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export async function getResourceUsageOverview(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ResourceUsageOverviewQuery = { period: "this_month" },
) {
  const [meters, optimization, limits] = await Promise.all([
    resourceUsageRosterRepository.getMeters(tx),
    resourceUsageRosterRepository.getOptimizationCounts(tx),
    resourceUsageRosterRepository.getLimits(tx),
  ]);
  const trend = await resourceUsageRosterRepository.getStorageTrend(
    tx,
    meters.storageGb,
    query.period,
  );

  const isEmpty =
    meters.storageGb === 0 &&
    meters.totalLearners === 0 &&
    meters.products === 0 &&
    meters.testSubmits === 0 &&
    meters.messageSends === 0 &&
    optimization.dormantContentCount === 0 &&
    optimization.inactiveLearnerCount === 0;

  return resourceUsageOverviewResponseSchema.parse({
    data: {
      period: query.period,
      meters,
      limits,
      trends: {
        storageSparkline: trend.sparkline,
        storageDeltaGb: trend.deltaGb,
        generatedAt: new Date().toISOString(),
      },
      optimization,
      notes: {
        bandwidthMetered: false,
        drmMetered: false,
        videoHoursMetered: false,
      },
      isEmpty,
    },
  });
}

export async function listResourceUsageHistory(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ResourceUsageHistoryQuery,
) {
  const [totalCount, rows, series, summary] = await Promise.all([
    resourceUsageRosterRepository.countHistory(tx, query),
    resourceUsageRosterRepository.listHistory(tx, query),
    resourceUsageRosterRepository.getHistorySeries(tx, query),
    resourceUsageRosterRepository.getHistorySummary(tx, query),
  ]);

  return resourceUsageHistoryResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        metricKey: row.metric_key,
        metricLabel: row.metric_label,
        period: row.period,
        value: row.value,
        unit: row.unit,
        previousValue: row.previous_value,
        changeAbsolute: row.change_absolute,
        changePercent: row.change_percent,
        calculatedAt: row.calculated_at?.toISOString() ?? null,
      })),
      series: series.map((entry) => {
        const latest = entry.points[entry.points.length - 1];
        return {
          metricKey: entry.metric_key,
          metricLabel: entry.metric_label,
          unit: entry.unit,
          latestValue: latest?.value ?? 0,
          latestChangeAbsolute: latest?.change_absolute ?? null,
          points: entry.points.map((point) => ({
            period: point.period,
            value: point.value,
            changeAbsolute: point.change_absolute,
          })),
        };
      }),
      summary: {
        totalRecords: summary.totalRecords,
        metricsTracked: summary.metricsTracked,
        metersAvailable: summary.metersAvailable,
        periodsRecorded: summary.periodsRecorded,
        earliestPeriod: summary.earliestPeriod,
        latestPeriod: summary.latestPeriod,
        lastCalculatedAt: summary.lastCalculatedAt?.toISOString() ?? null,
        largestMovement: summary.largestMovement,
        smallestMovement: summary.smallestMovement,
      },
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
    },
  });
}

export async function listResourceUsageDormant(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ResourceUsageDormantQuery,
) {
  const [totalCount, rows, summary] = await Promise.all([
    resourceUsageRosterRepository.countDormant(tx, query),
    resourceUsageRosterRepository.listDormant(tx, query),
    resourceUsageRosterRepository.getDormantSummary(tx, query),
  ]);

  const storageHeld = summary.storage_held_gb;
  const totalStorage = summary.total_storage_gb;
  const totalCourses = summary.total_course_count;
  const dormantCount = summary.dormant_course_count;

  return resourceUsageDormantResponseSchema.parse({
    data: {
      summary: {
        dormantCourseCount: dormantCount,
        totalCourseCount: totalCourses,
        dormantCoursePct: totalCourses > 0 ? round2((dormantCount / totalCourses) * 100) : 0,
        storageHeldGb: storageHeld,
        storageHeldPct: totalStorage > 0 ? round2((storageHeld / totalStorage) * 100) : 0,
        totalStorageGb: totalStorage,
        unpublishedDormantCount: summary.unpublished_dormant_count,
        longestDormantDays: summary.longest_dormant_days,
        longestDormantCourseId: summary.longest_dormant_course_id,
        longestDormantTitle: summary.longest_dormant_title,
        longestDormantShortCode: summary.longest_dormant_course_id
          ? shortCourseCode(summary.longest_dormant_course_id)
          : null,
        lessonsAffected: summary.lessons_affected,
        viewCounts: {
          all: summary.view_all,
          unpublished: summary.view_unpublished,
          large: summary.view_large,
          neverOpened: summary.view_never_opened,
        },
        settings: {
          dormantDays: query.dormantDays,
          minLessons: query.minLessons,
          includeUnpublished: query.includeUnpublished,
          includeArchived: query.includeArchived,
        },
      },
      items: rows.map((row) => ({
        courseId: row.course_id,
        title: row.title,
        status: row.status,
        shortCode: shortCourseCode(row.course_id),
        lessonCount: row.lesson_count,
        storageGb: row.storage_gb,
        storageSharePct: storageHeld > 0 ? round2((row.storage_gb / storageHeld) * 100) : 0,
        activeEnrolmentCount: row.active_enrolment_count,
        inactiveEnrolmentCount: row.inactive_enrolment_count,
        totalEnrolmentCount: row.active_enrolment_count + row.inactive_enrolment_count,
        lastLearnerActivityAt: row.last_learner_activity_at?.toISOString() ?? null,
        dormantDays: row.dormant_days,
        createdAt: row.created_at?.toISOString() ?? null,
        selectable: row.status !== "ARCHIVED",
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      isEmpty: dormantCount === 0 && !query.q && query.view === "all" && query.status === "all",
    },
  });
}

export async function archiveResourceUsageDormant(
  tx: TenantTx,
  _ctx: ServiceCtx,
  body: ResourceUsageDormantArchiveBody,
) {
  const result = await resourceUsageRosterRepository.archiveDormantCourses(tx, {
    courseIds: body.courseIds,
    action: body.action,
    deleteAssets: body.deleteAssets,
  });

  return resourceUsageDormantArchiveResponseSchema.parse({
    data: {
      action: body.action,
      processedCount: result.processedIds.length,
      skippedCount: result.skippedIds.length,
      deletedAssetsGb: result.deletedAssetsGb,
      courseIds: result.processedIds,
      skippedCourseIds: result.skippedIds,
    },
  });
}

function formatBytesLabel(bytes: number): string {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(bytes >= 10_000_000_000 ? 0 : 1)} GB`;
  }
  if (bytes >= 1_000_000) {
    return `${Math.round(bytes / 1_000_000)} MB`;
  }
  if (bytes >= 1_000) {
    return `${Math.round(bytes / 1_000)} KB`;
  }
  return `${Math.round(bytes)} B`;
}

function formatDurationLabel(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${String(hours)}h ${String(remMins).padStart(2, "0")}m`;
  }
  return `${String(mins)}:${String(secs).padStart(2, "0")}`;
}

function lessonTypeLabel(lesson: {
  video_provider: string | null;
  video_url: string | null;
  has_scorm: boolean;
  storage_gb: number;
}): string {
  if (lesson.has_scorm) return "SCORM";
  if (lesson.video_provider || lesson.video_url) return "Video";
  if (lesson.storage_gb > 0) return "Document";
  return "Lesson";
}

export async function getResourceUsageDormantCourseDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  courseId: string,
  query: ResourceUsageDormantCourseQuery,
) {
  const detail = await resourceUsageRosterRepository.getDormantCourseDetail(
    tx,
    courseId,
    query.dormantDays,
  );

  if (!detail.course) {
    throw resourceUsageDormantCourseNotFound();
  }

  const totalTenantGb = detail.summary.total_tenant_storage_gb;
  const storageGb = detail.summary.storage_gb;
  const compositionTotal = detail.composition.reduce((sum, row) => sum + row.storage_gb, 0);
  const assetLabels: Record<string, string> = {
    video: "Video",
    documents: "Documents",
    images: "Images",
    audio: "Audio",
    scorm: "SCORM",
    attachments: "Attachments",
    backups: "Backups",
  };

  return resourceUsageDormantCourseDetailResponseSchema.parse({
    data: {
      course: {
        courseId: detail.course.course_id,
        title: detail.course.title,
        status: detail.course.status,
        shortCode: shortCourseCode(detail.course.course_id),
        dormantDays: detail.course.dormant_days,
        neverOpened: detail.course.never_opened,
        createdAt: detail.course.created_at?.toISOString() ?? null,
        selectable: detail.course.status !== "ARCHIVED",
        openCourseHref: `/studio/courses/${detail.course.course_id}`,
      },
      summary: {
        storageGb,
        storageShareOfTenantPct: totalTenantGb > 0 ? round2((storageGb / totalTenantGb) * 100) : 0,
        totalTenantStorageGb: totalTenantGb,
        lessonCount: detail.summary.lesson_count,
        lessonsWithAssetsCount: detail.summary.lessons_with_assets_count,
        fileCount: detail.summary.file_count,
        lastLearnerActivityAt: detail.course.last_learner_activity_at?.toISOString() ?? null,
        enrolmentTotal: detail.summary.enrolment_total,
        enrolmentActive: detail.summary.enrolment_active,
        enrolmentActiveIn90d: detail.summary.enrolment_active_in_90d,
      },
      composition: detail.composition.map((row) => ({
        key: row.key,
        label: row.label,
        valueGb: row.storage_gb,
        sharePct: compositionTotal > 0 ? round2((row.storage_gb / compositionTotal) * 100) : 0,
      })),
      topFiles: detail.top_files.map((row) => ({
        fileName: row.file_name,
        contentType: row.content_type,
        assetTypeKey: row.asset_type_key,
        assetTypeLabel: assetLabels[row.asset_type_key] ?? row.asset_type_key,
        sizeBytes: row.size_bytes,
        sizeLabel: formatBytesLabel(row.size_bytes),
        lessonId: row.lesson_id,
        lessonTitle: row.lesson_title,
        uploadedAt: row.uploaded_at?.toISOString() ?? null,
      })),
      impact: {
        lessonCount: detail.summary.lesson_count,
        enrolmentCount: detail.summary.enrolment_total,
        certificatesRemainValid: detail.certificates_remain_valid,
        storageGbIfDeleted: storageGb,
      },
      lessons: detail.lessons.map((row) => ({
        lessonId: row.lesson_id,
        position: row.position,
        title: row.title,
        lessonTypeLabel: lessonTypeLabel(row),
        durationLabel: formatDurationLabel(row.duration_seconds),
        storageGb: row.storage_gb,
        neverOpened: row.last_opened_at == null,
        lastOpenedAt: row.last_opened_at?.toISOString() ?? null,
      })),
    },
  });
}

export async function listResourceUsageInactive(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ResourceUsageInactiveQuery,
) {
  const [totalCount, rows, summary] = await Promise.all([
    resourceUsageRosterRepository.countInactive(tx, query),
    resourceUsageRosterRepository.listInactive(tx, query),
    resourceUsageRosterRepository.getInactiveSummary(tx, query),
  ]);

  const inactiveCount = summary.inactive_learner_count;
  const totalLearners = summary.total_learner_count;

  return resourceUsageInactiveResponseSchema.parse({
    data: {
      summary: {
        inactiveLearnerCount: inactiveCount,
        totalLearnerCount: totalLearners,
        inactiveLearnerPct: totalLearners > 0 ? round2((inactiveCount / totalLearners) * 100) : 0,
        neverActiveCount: summary.never_active_count,
        inactiveOverYearCount: summary.inactive_over_year_count,
        enrolmentsHeld: summary.enrolments_held,
        paidAmongThem: summary.paid_among_them,
        viewCounts: {
          all: summary.view_all,
          neverActive: summary.view_never_active,
          paidHolding: summary.view_paid_holding,
        },
        settings: {
          inactiveDays: query.inactiveDays,
          includeInvitedNeverSignedIn: query.includeInvitedNeverSignedIn,
          excludeActivePaidEnrolment: query.excludeActivePaidEnrolment,
        },
      },
      items: rows.map((row) => ({
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        status: row.status,
        activityLabel: row.activity_label,
        enrolmentCount: row.enrolment_count,
        lastActiveAt: row.last_active_at?.toISOString() ?? null,
        inactiveDays: row.inactive_days,
        createdAt: row.created_at.toISOString(),
        hasPaid: row.has_paid,
        selectable: row.status === "ACTIVE" || row.status === "INVITED",
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      isEmpty:
        inactiveCount === 0 &&
        !query.q &&
        query.view === "all" &&
        query.activityStatus === "any" &&
        query.enrolmentFilter === "any" &&
        query.paidFilter === "any",
    },
  });
}

export async function deactivateResourceUsageInactive(
  tx: TenantTx,
  _ctx: ServiceCtx,
  body: ResourceUsageInactiveDeactivateBody,
) {
  const result = await resourceUsageRosterRepository.deactivateInactiveLearners(tx, {
    membershipIds: body.membershipIds,
    excludePaid: body.excludePaid,
  });

  return resourceUsageInactiveDeactivateResponseSchema.parse({
    data: {
      processedCount: result.processedIds.length,
      skippedCount: result.skippedIds.length,
      excludedPaidCount: result.excludedPaidIds.length,
      membershipIds: result.processedIds,
      skippedMembershipIds: [...result.skippedIds, ...result.excludedPaidIds],
    },
  });
}

export async function getResourceUsageMetricDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  metricKey: string,
) {
  if (!(metricKey in METRIC_CATALOG)) throw resourceUsageMetricNotFound();
  const catalog = METRIC_CATALOG[metricKey as ResourceUsageMetricKey];

  const [meters, limits] = await Promise.all([
    resourceUsageRosterRepository.getMeters(tx),
    resourceUsageRosterRepository.getLimits(tx),
  ]);

  const liveValue = catalog.meterField != null ? meters[catalog.meterField] : null;
  const limit =
    catalog.limitField === "storageGb"
      ? limits.storageGb
      : catalog.limitField === "mau"
        ? limits.mau
        : null;

  if (catalog.status === "not_metered") {
    return resourceUsageMetricDetailResponseSchema.parse({
      data: {
        metricKey,
        metricLabel: catalog.label,
        unit: catalog.unit,
        category: catalog.category,
        definition: catalog.definition,
        status: catalog.status,
        cadence: catalog.cadence,
        currentValue: null,
        previousValue: null,
        changeAbsolute: null,
        changePercent: null,
        previousPeriodLabel: null,
        calculatedAt: null,
        limit: null,
        limitPct: null,
        change12Month: null,
        avgMonthlyGrowth: null,
        projectedReachLimitLabel: null,
        periods: [],
        series: [],
        breakdown: null,
        related: [
          {
            label: "View all metrics with history",
            href: "/admin/reports/resource-usage/history",
            description: null,
          },
        ],
      },
    });
  }

  if (catalog.status === "live") {
    const currentValue = liveValue ?? 0;
    const limitPct =
      limit != null && limit > 0 ? round2(Math.min(100, (currentValue / limit) * 100)) : null;
    return resourceUsageMetricDetailResponseSchema.parse({
      data: {
        metricKey,
        metricLabel: catalog.label,
        unit: catalog.unit,
        category: catalog.category,
        definition: catalog.definition,
        status: catalog.status,
        cadence: catalog.cadence,
        currentValue,
        previousValue: null,
        changeAbsolute: null,
        changePercent: null,
        previousPeriodLabel: null,
        calculatedAt: new Date().toISOString(),
        limit,
        limitPct,
        change12Month: null,
        avgMonthlyGrowth: null,
        projectedReachLimitLabel: null,
        periods: [],
        series: [],
        breakdown: {
          kind: "none",
          segments: [],
          contributors: [],
          emptyMessage: "This meter is read live and has no recorded history",
        },
        related: [
          {
            label: "View all metrics with history",
            href: "/admin/reports/resource-usage/history",
            description: null,
          },
          {
            label: "Resource usage overview",
            href: "/admin/reports/resource-usage",
            description: null,
          },
        ],
      },
    });
  }

  const historyKey = catalog.historyKey ?? metricKey;
  const periodsRaw = await resourceUsageRosterRepository.listMetricPeriods(tx, historyKey, 24);
  const chronological = [...periodsRaw].reverse();
  const latest = periodsRaw[0] ?? null;
  const currentValue =
    historyKey === "usage.storage_gb" && liveValue != null
      ? liveValue
      : (latest?.value ?? liveValue ?? 0);
  const previousValue = latest?.previous_value ?? null;
  const changeAbsolute = previousValue == null ? null : round2(currentValue - previousValue);
  const changePercent =
    previousValue == null || previousValue === 0
      ? null
      : round2(((currentValue - previousValue) / Math.abs(previousValue)) * 100);

  const oldestInWindow = chronological[0]?.value ?? currentValue;
  const change12Month = round2(currentValue - oldestInWindow);
  const growthSamples = chronological
    .map((row) => row.change_absolute)
    .filter((value): value is number => value != null);
  const avgMonthlyGrowth =
    growthSamples.length > 0
      ? round2(growthSamples.reduce((sum, value) => sum + value, 0) / growthSamples.length)
      : null;

  const limitPct =
    limit != null && limit > 0 ? round2(Math.min(100, (currentValue / limit) * 100)) : null;
  const projectedReachLimitLabel =
    avgMonthlyGrowth == null ? null : projectLimitReachLabel(currentValue, avgMonthlyGrowth, limit);

  let breakdown: {
    kind: "storage_assets" | "none";
    segments: Array<{ key: string; label: string; value: number; sharePct: number }>;
    contributors: Array<{
      id: string;
      title: string;
      value: number;
      unit: string;
      lastUpdatedAt: string | null;
    }>;
    emptyMessage: string | null;
  };

  const related: Array<{ label: string; href: string; description: string | null }> = [
    {
      label: "Usage history",
      href: "/admin/reports/resource-usage/history",
      description: null,
    },
    {
      label: "Export this metric",
      href: "/admin/reports/resource-usage?tab=exports",
      description: null,
    },
  ];

  if (historyKey === "usage.storage_gb") {
    const [segmentsRaw, contributorsRaw] = await Promise.all([
      resourceUsageRosterRepository.getStorageAssetBreakdown(tx),
      resourceUsageRosterRepository.listTopStorageContributors(tx, 10),
    ]);
    const total = segmentsRaw.reduce((sum, row) => sum + row.storage_gb, 0);
    breakdown = {
      kind: "storage_assets",
      segments: segmentsRaw.map((row) => ({
        key: row.key,
        label: row.label,
        value: row.storage_gb,
        sharePct: total > 0 ? round2((row.storage_gb / total) * 100) : 0,
      })),
      contributors: contributorsRaw.map((row) => ({
        id: row.course_id,
        title: row.title,
        value: row.storage_gb,
        unit: "GB",
        lastUpdatedAt: row.updated_at?.toISOString() ?? null,
      })),
      emptyMessage: null,
    };
    related.unshift(
      {
        label: "Dormant content holding this storage",
        href: "/admin/reports/resource-usage/dormant",
        description: null,
      },
      {
        label: "Storage breakdown",
        href: "/admin/reports/resource-usage/storage",
        description: null,
      },
    );
  } else {
    breakdown = {
      kind: "none",
      segments: [],
      contributors: [],
      emptyMessage: "No composition breakdown is available for this metric.",
    };
  }

  const previousPeriod = periodsRaw[1];

  return resourceUsageMetricDetailResponseSchema.parse({
    data: {
      metricKey,
      metricLabel: catalog.label,
      unit: catalog.unit,
      category: catalog.category,
      definition: catalog.definition,
      status: catalog.status,
      cadence: catalog.cadence,
      currentValue,
      previousValue,
      changeAbsolute,
      changePercent,
      previousPeriodLabel:
        previousValue != null && previousPeriod ? formatPeriodLabel(previousPeriod.period) : null,
      calculatedAt: latest?.calculated_at?.toISOString() ?? new Date().toISOString(),
      limit,
      limitPct,
      change12Month,
      avgMonthlyGrowth,
      projectedReachLimitLabel,
      periods: periodsRaw.map((row) => ({
        period: row.period,
        value: row.value,
        changeAbsolute: row.change_absolute,
        calculatedAt: row.calculated_at?.toISOString() ?? null,
      })),
      series: chronological.slice(-12).map((row) => ({
        period: row.period,
        value: row.value,
        changeAbsolute: row.change_absolute,
      })),
      breakdown,
      related,
    },
  });
}

export async function getResourceUsageStorageBreakdown(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ResourceUsageStorageQuery,
) {
  const assetType = query.assetType ?? null;
  const [
    meters,
    limits,
    optimization,
    segmentsRaw,
    fileCount,
    reclaimSignals,
    holdersTotal,
    holders,
    topContributors,
  ] = await Promise.all([
    resourceUsageRosterRepository.getMeters(tx),
    resourceUsageRosterRepository.getLimits(tx),
    resourceUsageRosterRepository.getOptimizationCounts(tx),
    resourceUsageRosterRepository.getStorageAssetBreakdown(tx),
    resourceUsageRosterRepository.getStorageFileCount(tx),
    resourceUsageRosterRepository.getStorageReclaimSignals(tx),
    resourceUsageRosterRepository.countStorageHolders(tx, assetType),
    resourceUsageRosterRepository.listStorageHolders(tx, {
      assetType,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    }),
    resourceUsageRosterRepository.listTopStorageContributors(tx, 1),
  ]);

  const totalGb = meters.storageGb;
  const refreshedTrend = await resourceUsageRosterRepository.getStorageTrend(
    tx,
    totalGb,
    "this_month",
  );

  const compositionTotal = segmentsRaw.reduce((sum, row) => sum + row.storage_gb, 0);
  const composition = segmentsRaw.map((row) => ({
    key: row.key,
    label: row.label,
    valueGb: row.storage_gb,
    sharePct: compositionTotal > 0 ? round2((row.storage_gb / compositionTotal) * 100) : 0,
  }));
  const dominant = composition[0] ?? null;

  const dormantGb = optimization.dormantStorageGb;
  const dormantPct = totalGb > 0 ? round2((dormantGb / totalGb) * 100) : 0;
  const limitGb = limits.storageGb;
  const limitPct =
    limitGb != null && limitGb > 0 ? round2(Math.min(100, (totalGb / limitGb) * 100)) : null;

  const courseCountWithStorage = holdersTotal;
  const avgPerCourseGb = courseCountWithStorage > 0 ? round2(totalGb / courseCountWithStorage) : 0;

  const largest = topContributors[0] ?? null;

  const reclaim = [
    dormantGb > 0
      ? {
          key: "dormant",
          label: "attached to courses with no activity in 30 days",
          storageGb: dormantGb,
          href: "/admin/reports/resource-usage/dormant",
          actionLabel: "Review",
        }
      : null,
    reclaimSignals.orphaned_gb > 0
      ? {
          key: "orphaned",
          label: "orphaned files with no parent resource",
          storageGb: reclaimSignals.orphaned_gb,
          href: "/admin/reports/resource-usage/storage",
          actionLabel: "Review",
        }
      : null,
    reclaimSignals.archived_gb > 0
      ? {
          key: "archived",
          label: "archived courses still holding assets",
          storageGb: reclaimSignals.archived_gb,
          href: "/admin/reports/resource-usage/dormant",
          actionLabel: "Review",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item != null);

  const isEmpty = totalGb === 0 && fileCount === 0;

  return resourceUsageStorageResponseSchema.parse({
    data: {
      summary: {
        totalGb,
        delta30dGb: refreshedTrend.deltaGb,
        sparkline: refreshedTrend.sparkline,
        limitGb,
        limitPct,
        dormantGb,
        dormantPct,
        largestCourse: largest
          ? {
              courseId: largest.course_id,
              title: largest.title,
              storageGb: largest.storage_gb,
            }
          : null,
        avgPerCourseGb,
        fileCount,
        courseCount: courseCountWithStorage,
        dominantTypeLabel: dominant?.label ?? null,
        dominantTypeSharePct: dominant?.sharePct ?? null,
      },
      composition,
      reclaim,
      holders: holders.map((row) => {
        const dormant =
          row.last_learner_activity_at == null ||
          Date.now() - row.last_learner_activity_at.getTime() > 30 * 24 * 60 * 60 * 1000;
        return {
          courseId: row.course_id,
          title: row.title,
          status: row.status,
          storageGb: row.storage_gb,
          sharePct: totalGb > 0 ? round2((row.storage_gb / totalGb) * 100) : 0,
          fileCount: row.file_count,
          lastLearnerActivityAt: row.last_learner_activity_at?.toISOString() ?? null,
          createdAt: row.created_at?.toISOString() ?? null,
          dormant,
        };
      }),
      pageInfo: pageInfo(holdersTotal, query.page, query.limit),
      isEmpty,
    },
  });
}
