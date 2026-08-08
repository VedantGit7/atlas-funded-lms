"use client";

import { clientApi } from "../../../lib/client-api";

export const ENROLLMENT_ROSTER_COLUMN_OPTIONS = [
  { key: "learner_name", label: "Learner" },
  { key: "email", label: "Email" },
  { key: "product_title", label: "Product title" },
  { key: "enrolled_type", label: "Enrolled type" },
  { key: "status", label: "Status" },
  { key: "enrolled_at", label: "Enrolled on" },
  { key: "expires_at", label: "Expiry date" },
] as const;

export type EnrollmentRosterColumnKey = (typeof ENROLLMENT_ROSTER_COLUMN_OPTIONS)[number]["key"];

export type EnrollmentRosterItem = {
  id: string;
  courseId: string;
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  productTitle: string;
  enrolledType: string;
  status: string;
  enrolledAt: string;
  expiresAt: string | null;
};

export type EnrollmentRosterFilters = {
  enrolledFrom?: string | undefined;
  enrolledTo?: string | undefined;
  email?: string | undefined;
  enrolledType?: string | undefined;
  status?: string | undefined;
  courseId?: string | undefined;
  sortBy?: "enrolled_at" | "expires_at" | undefined;
  sortDir?: "asc" | "desc" | undefined;
  columns?: EnrollmentRosterColumnKey[] | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};

export type EnrollmentRosterResponse = {
  data: {
    items: EnrollmentRosterItem[];
    pageInfo: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    columns: string[];
  };
};

export type EnrollmentOverviewFilters = {
  enrolledFrom?: string | undefined;
  enrolledTo?: string | undefined;
  email?: string | undefined;
  enrolledType?: string | undefined;
  status?: string | undefined;
  courseId?: string | undefined;
};

export type EnrollmentOverview = {
  summary: {
    totalCount: number;
    activeCount: number;
    expiringSoonCount: number;
    previousPeriodCount: number;
    changePercent: number | null;
    windowLabel: string;
    windowFrom: string;
    windowTo: string;
  };
  byType: Array<{
    type: string;
    label: string;
    count: number;
    percent: number;
  }>;
  trend: Array<{
    date: string;
    total: number;
    paid: number;
    free: number;
    trial: number;
    offline: number;
  }>;
};

export type EnrollmentOverviewResponse = {
  data: EnrollmentOverview;
};

function buildRosterQuery(filters: EnrollmentRosterFilters): string {
  const params = new URLSearchParams();
  if (filters.enrolledFrom) params.set("enrolledFrom", filters.enrolledFrom);
  if (filters.enrolledTo) params.set("enrolledTo", filters.enrolledTo);
  if (filters.email) params.set("email", filters.email);
  if (filters.enrolledType) params.set("enrolledType", filters.enrolledType);
  if (filters.status) params.set("status", filters.status);
  if (filters.courseId) params.set("courseId", filters.courseId);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);
  if (filters.columns?.length) params.set("columns", filters.columns.join(","));
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  return query ? `?${query}` : "";
}

function buildOverviewQuery(filters: EnrollmentOverviewFilters): string {
  const params = new URLSearchParams();
  if (filters.enrolledFrom) params.set("enrolledFrom", filters.enrolledFrom);
  if (filters.enrolledTo) params.set("enrolledTo", filters.enrolledTo);
  if (filters.email) params.set("email", filters.email);
  if (filters.enrolledType) params.set("enrolledType", filters.enrolledType);
  if (filters.status) params.set("status", filters.status);
  if (filters.courseId) params.set("courseId", filters.courseId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function dateInputToStartIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return `${trimmed}T00:00:00.000Z`;
}

export function dateInputToEndIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return `${trimmed}T23:59:59.999Z`;
}

export async function fetchEnrollmentRoster(filters: EnrollmentRosterFilters) {
  return clientApi.get<EnrollmentRosterResponse>(
    `/api/v1/reports/enrollments/roster${buildRosterQuery(filters)}`,
  );
}

export async function fetchEnrollmentOverview(filters: EnrollmentOverviewFilters = {}) {
  return clientApi.get<EnrollmentOverviewResponse>(
    `/api/v1/reports/enrollments/overview${buildOverviewQuery(filters)}`,
  );
}

export async function createEnrollmentReportGroup(body: {
  title: string;
  description?: string | undefined;
  membershipIds?: string[] | undefined;
  enrolledFrom?: string | undefined;
  enrolledTo?: string | undefined;
  email?: string | undefined;
  enrolledType?: string | undefined;
  status?: string | undefined;
  courseId?: string | undefined;
}) {
  return clientApi.post<{
    data: { batchId: string; key: string; name: string; memberCount: number };
  }>("/api/v1/reports/enrollments/groups", body, "enrollments-group", {
    successMessage: "Group created from enrollment report.",
  });
}

export async function sendEnrollmentReportMessage(body: {
  subject: string;
  message: string;
  membershipIds?: string[] | undefined;
  enrolledFrom?: string | undefined;
  enrolledTo?: string | undefined;
  email?: string | undefined;
  enrolledType?: string | undefined;
  status?: string | undefined;
  courseId?: string | undefined;
}) {
  return clientApi.post<{
    data: { deliveredCount: number; skippedCount: number; recipientCount: number };
  }>("/api/v1/reports/enrollments/messages", body, "enrollments-message", {
    successMessage: "Message sent to filtered learners.",
  });
}

export async function exportEnrollmentReport(body: {
  enrolledFrom?: string | undefined;
  enrolledTo?: string | undefined;
  email?: string | undefined;
  enrolledType?: string | undefined;
  status?: string | undefined;
  courseId?: string | undefined;
  sortBy?: "enrolled_at" | "expires_at" | undefined;
  sortDir?: "asc" | "desc" | undefined;
  emailDownloadLink?: boolean | undefined;
}) {
  return clientApi.post<{
    data: { runId: string; status: string; emailed: boolean };
  }>("/api/v1/reports/enrollments/export", body, "enrollments-export", {
    successMessage: "Enrollment export started.",
  });
}
