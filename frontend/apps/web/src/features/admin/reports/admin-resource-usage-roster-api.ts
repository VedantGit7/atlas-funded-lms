"use client";

import { clientApi } from "../../../lib/client-api";

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

export type ResourceUsageOptimization = {
  dormantContentCount: number;
  inactiveLearnerCount: number;
  dormantStorageGb: number;
};

export type ResourceUsageOverview = {
  meters: ResourceUsageMeters;
  optimization: ResourceUsageOptimization;
  notes: {
    bandwidthMetered: boolean;
    drmMetered: boolean;
    videoHoursMetered: boolean;
  };
};

export type ResourceUsageHistoryItem = {
  metricKey: string;
  metricLabel: string;
  period: string;
  value: number;
  unit: string;
  calculatedAt: string | null;
};

export type ResourceUsageDormantItem = {
  courseId: string;
  title: string;
  status: string;
  lessonCount: number;
  storageGb: number;
  lastLearnerActivityAt: string | null;
  createdAt: string | null;
};

export type ResourceUsageInactiveItem = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  status: string;
  lastActiveAt: string | null;
  createdAt: string;
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

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

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchResourceUsageOverview() {
  return clientApi.get<{ data: ResourceUsageOverview }>("/api/v1/reports/resource-usage");
}

export async function fetchResourceUsageHistory(filters?: {
  metricKey?: string | undefined;
  page?: number | undefined;
}) {
  return clientApi.get<{
    data: {
      items: ResourceUsageHistoryItem[];
      pageInfo: PageInfo;
      columns: string[];
    };
  }>(
    `/api/v1/reports/resource-usage/history${buildQuery({
      metricKey: filters?.metricKey,
      page: filters?.page ?? 1,
      limit: 50,
    })}`,
  );
}

export async function fetchResourceUsageDormant(filters?: {
  q?: string | undefined;
  page?: number | undefined;
}) {
  return clientApi.get<{
    data: {
      items: ResourceUsageDormantItem[];
      pageInfo: PageInfo;
    };
  }>(
    `/api/v1/reports/resource-usage/dormant${buildQuery({
      q: filters?.q,
      page: filters?.page ?? 1,
      limit: 25,
    })}`,
  );
}

export async function fetchResourceUsageInactive(filters?: {
  q?: string | undefined;
  page?: number | undefined;
}) {
  return clientApi.get<{
    data: {
      items: ResourceUsageInactiveItem[];
      pageInfo: PageInfo;
    };
  }>(
    `/api/v1/reports/resource-usage/inactive-learners${buildQuery({
      q: filters?.q,
      page: filters?.page ?? 1,
      limit: 25,
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
