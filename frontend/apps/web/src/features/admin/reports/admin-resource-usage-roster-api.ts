"use client";

import { clientApi } from "../../../lib/client-api";

export type ResourceUsagePeriod = "this_month" | "last_month" | "ytd";

export type ResourceUsageMeters = {
  storageGb: number;
  activeUsers30d: number;
  currentMau: number;
  totalLearners: number;
  testSubmits: number;
  products: number;
  questions: number;
  messageSends: number;
  bandwidthGb: number;
  drmTokens: number;
  videoTranscodingHours: number;
};

export type ResourceUsageLimits = {
  storageGb: number | null;
  mau: number | null;
};

export type ResourceUsageTrends = {
  storageSparkline: number[];
  storageDeltaGb: number;
  generatedAt: string;
};

export type ResourceUsageOptimization = {
  dormantContentCount: number;
  inactiveLearnerCount: number;
  dormantStorageGb: number;
};

export type ResourceUsageOverview = {
  period: ResourceUsagePeriod;
  meters: ResourceUsageMeters;
  limits: ResourceUsageLimits;
  trends: ResourceUsageTrends;
  optimization: ResourceUsageOptimization;
  notes: {
    bandwidthMetered: boolean;
    drmMetered: boolean;
    videoHoursMetered: boolean;
  };
  isEmpty: boolean;
};

export type ResourceUsageHistoryItem = {
  metricKey: string;
  metricLabel: string;
  period: string;
  value: number;
  unit: string;
  previousValue: number | null;
  changeAbsolute: number | null;
  changePercent: number | null;
  calculatedAt: string | null;
};

export type ResourceUsageHistorySeries = {
  metricKey: string;
  metricLabel: string;
  unit: string;
  latestValue: number;
  latestChangeAbsolute: number | null;
  points: Array<{
    period: string;
    value: number;
    changeAbsolute: number | null;
  }>;
};

export type ResourceUsageHistorySummary = {
  totalRecords: number;
  metricsTracked: number;
  metersAvailable: number;
  periodsRecorded: number;
  earliestPeriod: string | null;
  latestPeriod: string | null;
  lastCalculatedAt: string | null;
  largestMovement: {
    metricKey: string;
    metricLabel: string;
    unit: string;
    changeAbsolute: number;
    period: string;
  } | null;
  smallestMovement: {
    metricKey: string;
    metricLabel: string;
    unit: string;
    changeAbsolute: number;
    period: string;
  } | null;
};

export type ResourceUsageHistorySort = "newest" | "oldest" | "highest_delta";

export type ResourceUsageHistoryResponse = {
  items: ResourceUsageHistoryItem[];
  series: ResourceUsageHistorySeries[];
  summary: ResourceUsageHistorySummary;
  pageInfo: PageInfo;
  columns: string[];
};

export type ResourceUsageDormantItem = {
  courseId: string;
  title: string;
  status: string;
  shortCode: string;
  lessonCount: number;
  storageGb: number;
  storageSharePct: number;
  activeEnrolmentCount: number;
  inactiveEnrolmentCount: number;
  totalEnrolmentCount: number;
  lastLearnerActivityAt: string | null;
  dormantDays: number;
  createdAt: string | null;
  selectable: boolean;
};

export type ResourceUsageDormantView = "all" | "unpublished" | "large" | "never_opened";
export type ResourceUsageDormantStatusFilter = "all" | "published" | "unpublished" | "archived";
export type ResourceUsageDormantSort =
  | "storage_desc"
  | "dormant_desc"
  | "title_asc"
  | "activity_asc"
  | "lessons_desc";
export type ResourceUsageDormantEnrolmentFilter = "any" | "zero_active" | "has_active";

export type ResourceUsageDormantSummary = {
  dormantCourseCount: number;
  totalCourseCount: number;
  dormantCoursePct: number;
  storageHeldGb: number;
  storageHeldPct: number;
  totalStorageGb: number;
  unpublishedDormantCount: number;
  longestDormantDays: number | null;
  longestDormantCourseId: string | null;
  longestDormantTitle: string | null;
  longestDormantShortCode: string | null;
  lessonsAffected: number;
  viewCounts: {
    all: number;
    unpublished: number;
    large: number;
    neverOpened: number;
  };
  settings: {
    dormantDays: number;
    minLessons: number;
    includeUnpublished: boolean;
    includeArchived: boolean;
  };
};

export type ResourceUsageDormantResponse = {
  summary: ResourceUsageDormantSummary;
  items: ResourceUsageDormantItem[];
  pageInfo: PageInfo;
  isEmpty: boolean;
};

export type ResourceUsageDormantCourseDetail = {
  course: {
    courseId: string;
    title: string;
    status: string;
    shortCode: string;
    dormantDays: number;
    neverOpened: boolean;
    createdAt: string | null;
    selectable: boolean;
    openCourseHref: string;
  };
  summary: {
    storageGb: number;
    storageShareOfTenantPct: number;
    totalTenantStorageGb: number;
    lessonCount: number;
    lessonsWithAssetsCount: number;
    fileCount: number;
    lastLearnerActivityAt: string | null;
    enrolmentTotal: number;
    enrolmentActive: number;
    enrolmentActiveIn90d: number;
  };
  composition: Array<{
    key: string;
    label: string;
    valueGb: number;
    sharePct: number;
  }>;
  topFiles: Array<{
    fileName: string;
    contentType: string | null;
    assetTypeKey: string;
    assetTypeLabel: string;
    sizeBytes: number;
    sizeLabel: string;
    lessonId: string | null;
    lessonTitle: string | null;
    uploadedAt: string | null;
  }>;
  impact: {
    lessonCount: number;
    enrolmentCount: number;
    certificatesRemainValid: number;
    storageGbIfDeleted: number;
  };
  lessons: Array<{
    lessonId: string;
    position: number;
    title: string;
    lessonTypeLabel: string;
    durationLabel: string | null;
    storageGb: number;
    neverOpened: boolean;
    lastOpenedAt: string | null;
  }>;
};

export type ResourceUsageInactiveItem = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  status: string;
  activityLabel: "inactive" | "dormant" | "never_active";
  enrolmentCount: number;
  lastActiveAt: string | null;
  inactiveDays: number;
  createdAt: string;
  hasPaid: boolean;
  selectable: boolean;
};

export type ResourceUsageInactiveView = "all" | "never_active" | "paid_holding";
export type ResourceUsageInactiveActivityStatus = "any" | "inactive" | "dormant" | "never_active";
export type ResourceUsageInactiveEnrolmentFilter = "any" | "has_enrolments" | "zero_enrolments";
export type ResourceUsageInactivePaidFilter = "any" | "has_paid" | "never_paid";
export type ResourceUsageInactiveSort =
  | "inactive_desc"
  | "inactive_asc"
  | "activity_asc"
  | "name_asc"
  | "enrolments_desc"
  | "signed_up_asc";

export type ResourceUsageInactiveSummary = {
  inactiveLearnerCount: number;
  totalLearnerCount: number;
  inactiveLearnerPct: number;
  neverActiveCount: number;
  inactiveOverYearCount: number;
  enrolmentsHeld: number;
  paidAmongThem: number;
  viewCounts: {
    all: number;
    neverActive: number;
    paidHolding: number;
  };
  settings: {
    inactiveDays: number;
    includeInvitedNeverSignedIn: boolean;
    excludeActivePaidEnrolment: boolean;
  };
};

export type ResourceUsageInactiveResponse = {
  summary: ResourceUsageInactiveSummary;
  items: ResourceUsageInactiveItem[];
  pageInfo: PageInfo;
  isEmpty: boolean;
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export const RESOURCE_USAGE_PERIOD_OPTIONS: Array<{
  value: ResourceUsagePeriod;
  label: string;
}> = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "ytd", label: "YTD" },
];

export const RESOURCE_USAGE_METRIC_OPTIONS = [
  { value: "", label: "All metrics" },
  { value: "usage.storage_gb", label: "Storage" },
  { value: "usage.total_learners", label: "Total learners" },
  { value: "usage.products", label: "Products" },
  { value: "usage.questions", label: "Questions" },
  { value: "usage.test_submits", label: "Tests taken" },
  { value: "usage.message_sends", label: "Message sends" },
  { value: "usage.email_validations", label: "Email validations" },
] as const;

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchResourceUsageOverview(period?: ResourceUsagePeriod) {
  return clientApi.get<{ data: ResourceUsageOverview }>(
    `/api/v1/reports/resource-usage${buildQuery({ period: period ?? "this_month" })}`,
  );
}

export async function fetchResourceUsageHistory(filters?: {
  metricKey?: string | undefined;
  page?: number | undefined;
  rangeMonths?: number | undefined;
  sort?: ResourceUsageHistorySort | undefined;
}) {
  return clientApi.get<{
    data: ResourceUsageHistoryResponse;
  }>(
    `/api/v1/reports/resource-usage/history${buildQuery({
      metricKey: filters?.metricKey,
      page: filters?.page ?? 1,
      limit: 50,
      rangeMonths: filters?.rangeMonths ?? 24,
      sort: filters?.sort ?? "newest",
    })}`,
  );
}

export async function fetchResourceUsageDormant(filters?: {
  q?: string | undefined;
  page?: number | undefined;
  view?: ResourceUsageDormantView | undefined;
  status?: ResourceUsageDormantStatusFilter | undefined;
  dormantDays?: number | undefined;
  minLessons?: number | undefined;
  includeUnpublished?: boolean | undefined;
  includeArchived?: boolean | undefined;
  dormantForMin?: number | undefined;
  storageMinGb?: number | undefined;
  enrolmentFilter?: ResourceUsageDormantEnrolmentFilter | undefined;
  sort?: ResourceUsageDormantSort | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{ data: ResourceUsageDormantResponse }>(
    `/api/v1/reports/resource-usage/dormant${buildQuery({
      q: filters?.q,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
      view: filters?.view ?? "all",
      status: filters?.status ?? "all",
      dormantDays: filters?.dormantDays ?? 30,
      minLessons: filters?.minLessons ?? 1,
      includeUnpublished: filters?.includeUnpublished ?? true,
      includeArchived: filters?.includeArchived ?? false,
      dormantForMin: filters?.dormantForMin,
      storageMinGb: filters?.storageMinGb,
      enrolmentFilter: filters?.enrolmentFilter ?? "any",
      sort: filters?.sort ?? "storage_desc",
    })}`,
  );
}

export async function fetchResourceUsageDormantCourse(
  courseId: string,
  filters?: { dormantDays?: number | undefined },
) {
  return clientApi.get<{ data: ResourceUsageDormantCourseDetail }>(
    `/api/v1/reports/resource-usage/dormant/${encodeURIComponent(courseId)}${buildQuery({
      dormantDays: filters?.dormantDays ?? 30,
    })}`,
  );
}

export async function archiveResourceUsageDormant(body: {
  courseIds: string[];
  action?: "archive" | "unpublish";
  reason: "outdated" | "consolidated" | "low_engagement" | "other";
  deleteAssets?: boolean;
}) {
  return clientApi.post<{
    data: {
      action: "archive" | "unpublish";
      processedCount: number;
      skippedCount: number;
      deletedAssetsGb: number;
      courseIds: string[];
      skippedCourseIds: string[];
    };
  }>(
    "/api/v1/reports/resource-usage/dormant",
    {
      courseIds: body.courseIds,
      action: body.action ?? "archive",
      reason: body.reason,
      deleteAssets: body.deleteAssets ?? false,
    },
    "resource-usage-dormant-archive",
    {
      successMessage:
        body.action === "unpublish"
          ? "Selected courses unpublished."
          : "Selected courses archived.",
    },
  );
}

export async function fetchResourceUsageInactive(filters?: {
  q?: string | undefined;
  page?: number | undefined;
  view?: ResourceUsageInactiveView | undefined;
  activityStatus?: ResourceUsageInactiveActivityStatus | undefined;
  inactiveDays?: number | undefined;
  inactiveForMin?: number | undefined;
  enrolmentFilter?: ResourceUsageInactiveEnrolmentFilter | undefined;
  paidFilter?: ResourceUsageInactivePaidFilter | undefined;
  includeInvitedNeverSignedIn?: boolean | undefined;
  excludeActivePaidEnrolment?: boolean | undefined;
  sort?: ResourceUsageInactiveSort | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{ data: ResourceUsageInactiveResponse }>(
    `/api/v1/reports/resource-usage/inactive-learners${buildQuery({
      q: filters?.q,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
      view: filters?.view ?? "all",
      activityStatus: filters?.activityStatus ?? "any",
      inactiveDays: filters?.inactiveDays ?? 90,
      inactiveForMin: filters?.inactiveForMin,
      enrolmentFilter: filters?.enrolmentFilter ?? "any",
      paidFilter: filters?.paidFilter ?? "any",
      includeInvitedNeverSignedIn: filters?.includeInvitedNeverSignedIn ?? true,
      excludeActivePaidEnrolment: filters?.excludeActivePaidEnrolment ?? false,
      sort: filters?.sort ?? "inactive_desc",
    })}`,
  );
}

export async function deactivateResourceUsageInactive(body: {
  membershipIds: string[];
  reason: "subscription_ended" | "course_completed" | "inactivity" | "violation" | "other";
  excludePaid?: boolean;
}) {
  return clientApi.post<{
    data: {
      processedCount: number;
      skippedCount: number;
      excludedPaidCount: number;
      membershipIds: string[];
      skippedMembershipIds: string[];
    };
  }>(
    "/api/v1/reports/resource-usage/inactive-learners",
    {
      membershipIds: body.membershipIds,
      reason: body.reason,
      excludePaid: body.excludePaid ?? true,
    },
    "resource-usage-inactive-deactivate",
    { successMessage: "Selected learners deactivated." },
  );
}

export async function messageResourceUsageInactive(body: {
  membershipIds: string[];
  subject: string;
  message: string;
  channels?: Array<"email" | "in_app">;
  excludeMessagedWithinDays?: number;
  sendTestToSelf?: boolean;
}) {
  return clientApi.post<{
    data: {
      deliveredCount: number;
      skippedCount: number;
      recipientCount: number;
      excludedRecentCount: number;
    };
  }>(
    "/api/v1/reports/resource-usage/inactive-learners/messages",
    {
      membershipIds: body.membershipIds,
      subject: body.subject,
      message: body.message,
      channels: body.channels ?? ["email", "in_app"],
      excludeMessagedWithinDays: body.excludeMessagedWithinDays ?? 30,
      sendTestToSelf: body.sendTestToSelf ?? false,
    },
    "resource-usage-inactive-message",
    { successMessage: "Message queued for inactive learners." },
  );
}

export type ResourceUsageMetricKey =
  | "usage.storage_gb"
  | "usage.total_learners"
  | "usage.products"
  | "usage.questions"
  | "usage.test_submits"
  | "usage.message_sends"
  | "usage.email_validations"
  | "usage.current_mau"
  | "usage.active_users_30d"
  | "usage.bandwidth_gb"
  | "usage.drm_tokens"
  | "usage.video_transcoding_hours";

export type ResourceUsageMetricDetail = {
  metricKey: ResourceUsageMetricKey;
  metricLabel: string;
  unit: string;
  category: string;
  definition: string;
  status: "metered" | "live" | "not_metered";
  cadence: "monthly" | "live" | "none";
  currentValue: number | null;
  previousValue: number | null;
  changeAbsolute: number | null;
  changePercent: number | null;
  previousPeriodLabel: string | null;
  calculatedAt: string | null;
  limit: number | null;
  limitPct: number | null;
  change12Month: number | null;
  avgMonthlyGrowth: number | null;
  projectedReachLimitLabel: string | null;
  periods: Array<{
    period: string;
    value: number;
    changeAbsolute: number | null;
    calculatedAt: string | null;
  }>;
  series: Array<{
    period: string;
    value: number;
    changeAbsolute: number | null;
  }>;
  breakdown: {
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
  } | null;
  related: Array<{ label: string; href: string; description: string | null }>;
};

export async function fetchResourceUsageMetricDetail(metricKey: string) {
  return clientApi.get<{ data: ResourceUsageMetricDetail }>(
    `/api/v1/reports/resource-usage/metrics/${encodeURIComponent(metricKey)}`,
  );
}

export type ResourceUsageStorageAssetType =
  | "video"
  | "documents"
  | "images"
  | "audio"
  | "scorm"
  | "attachments"
  | "backups";

export type ResourceUsageStorageSort = "size_desc" | "files_desc" | "activity_asc" | "title_asc";

export type ResourceUsageStorageSegment = {
  key: string;
  label: string;
  valueGb: number;
  sharePct: number;
};

export type ResourceUsageStorageHolder = {
  courseId: string;
  title: string;
  status: string;
  storageGb: number;
  sharePct: number;
  fileCount: number;
  lastLearnerActivityAt: string | null;
  createdAt: string | null;
  dormant: boolean;
};

export type ResourceUsageStorageReclaim = {
  key: string;
  label: string;
  storageGb: number;
  href: string;
  actionLabel: string;
};

export type ResourceUsageStorageResponse = {
  summary: {
    totalGb: number;
    delta30dGb: number;
    sparkline: number[];
    limitGb: number | null;
    limitPct: number | null;
    dormantGb: number;
    dormantPct: number;
    largestCourse: {
      courseId: string;
      title: string;
      storageGb: number;
    } | null;
    avgPerCourseGb: number;
    fileCount: number;
    courseCount: number;
    dominantTypeLabel: string | null;
    dominantTypeSharePct: number | null;
  };
  composition: ResourceUsageStorageSegment[];
  reclaim: ResourceUsageStorageReclaim[];
  holders: ResourceUsageStorageHolder[];
  pageInfo: PageInfo;
  isEmpty: boolean;
};

export async function fetchResourceUsageStorage(filters?: {
  assetType?: ResourceUsageStorageAssetType | undefined;
  sort?: ResourceUsageStorageSort | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{ data: ResourceUsageStorageResponse }>(
    `/api/v1/reports/resource-usage/storage${buildQuery({
      assetType: filters?.assetType,
      sort: filters?.sort ?? "size_desc",
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 12,
    })}`,
  );
}

export async function exportResourceUsageReport(body: {
  reportTab: "history" | "dormant" | "inactive";
  metricKey?: string | undefined;
  q?: string | undefined;
  emailDownloadLink?: boolean | undefined;
}) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/resource-usage/export",
    body,
    "resource-usage-roster-export",
    { successMessage: "Resource Usage export queued." },
  );
}
