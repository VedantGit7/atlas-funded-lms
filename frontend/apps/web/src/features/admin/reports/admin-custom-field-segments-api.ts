"use client";

import { clientApi } from "../../../lib/client-api";
import { fetchCustomFieldCatalogue, type CustomFieldCatalogueItem } from "./admin-custom-field-roster-api";

export type SegmentConditionOperator =
  | "is"
  | "is_not"
  | "contains"
  | "starts_with"
  | "is_empty"
  | "is_not_empty"
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "between"
  | "is_true"
  | "is_false"
  | "is_any_of"
  | "is_none_of"
  | "before"
  | "after"
  | "in_last_n_days";

export type SegmentCondition = {
  id: string;
  fieldSource: "learner" | "custom";
  fieldKey: string;
  operator: SegmentConditionOperator;
  value?: unknown;
};

export type SegmentConditionGroup = {
  id: string;
  combinator: "and" | "or";
  conditions: SegmentCondition[];
};

export type SegmentConditionsTree = {
  rootCombinator: "and" | "or";
  groups: SegmentConditionGroup[];
};

export type CustomFieldSegmentItem = {
  id: string;
  name: string;
  description: string | null;
  visibility: "shared" | "private";
  refreshMode: "live" | "snapshot";
  conditions: SegmentConditionsTree;
  conditionSummary: string;
  conditionCount: number;
  groupCount: number;
  matchedCount: number | null;
  previousMatchedCount: number | null;
  matchedDelta: number | null;
  matchedCountAt: string | null;
  isStale: boolean;
  createdByMembershipId: string;
  createdByName: string | null;
  dependencyCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CustomFieldSegmentSummary = {
  segmentCount: number;
  sharedCount: number;
  privateCount: number;
  learnersCovered: number;
  largestSegmentName: string | null;
  largestSegmentCount: number | null;
  staleCount: number;
  usedInMessages: number;
};

export type SegmentPreviewLearner = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
};

export type SegmentFieldOption = {
  source: "learner" | "custom";
  key: string;
  label: string;
  fieldType: string;
  options: string[];
};

export const LEARNER_SEGMENT_FIELDS: SegmentFieldOption[] = [
  { source: "learner", key: "learner_name", label: "Learner", fieldType: "text", options: [] },
  { source: "learner", key: "email", label: "Email", fieldType: "text", options: [] },
  {
    source: "learner",
    key: "enrollment_count",
    label: "Enrolments",
    fieldType: "number",
    options: [],
  },
  {
    source: "learner",
    key: "total_spent_cents",
    label: "Total spent (cents)",
    fieldType: "number",
    options: [],
  },
  {
    source: "learner",
    key: "last_active_at",
    label: "Last active",
    fieldType: "date",
    options: [],
  },
  {
    source: "learner",
    key: "signed_up_at",
    label: "Signed up",
    fieldType: "date",
    options: [],
  },
  {
    source: "learner",
    key: "status",
    label: "Status",
    fieldType: "select",
    options: ["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"],
  },
];

export function operatorsForFieldType(fieldType: string): Array<{ value: SegmentConditionOperator; label: string }> {
  switch (fieldType) {
    case "number":
      return [
        { value: "eq", label: "=" },
        { value: "neq", label: "≠" },
        { value: "gt", label: ">" },
        { value: "lt", label: "<" },
        { value: "between", label: "between" },
        { value: "is_empty", label: "is empty" },
      ];
    case "boolean":
      return [
        { value: "is_true", label: "is true" },
        { value: "is_false", label: "is false" },
        { value: "is_empty", label: "is empty" },
      ];
    case "select":
      return [
        { value: "is", label: "is" },
        { value: "is_not", label: "is not" },
        { value: "is_any_of", label: "is any of" },
        { value: "is_none_of", label: "is none of" },
        { value: "is_empty", label: "is empty" },
      ];
    case "date":
      return [
        { value: "before", label: "before" },
        { value: "after", label: "after" },
        { value: "between", label: "between" },
        { value: "in_last_n_days", label: "in the last N days" },
        { value: "is_empty", label: "is empty" },
      ];
    default:
      return [
        { value: "is", label: "is" },
        { value: "is_not", label: "is not" },
        { value: "contains", label: "contains" },
        { value: "starts_with", label: "starts with" },
        { value: "is_empty", label: "is empty" },
        { value: "is_not_empty", label: "is not empty" },
      ];
  }
}

export function isSegmentConditionComplete(
  condition: SegmentCondition,
  fieldType: string,
): boolean {
  const ops = operatorsForFieldType(fieldType).map((item) => item.value);
  if (!ops.includes(condition.operator)) return false;
  const op = condition.operator;
  if (op === "is_empty" || op === "is_not_empty" || op === "is_true" || op === "is_false") {
    return true;
  }
  if (op === "between") {
    return Array.isArray(condition.value) && condition.value.length === 2;
  }
  if (op === "is_any_of" || op === "is_none_of") {
    return Array.isArray(condition.value) && condition.value.length > 0;
  }
  if (op === "in_last_n_days") {
    if (condition.value && typeof condition.value === "object" && "days" in condition.value) {
      return Number((condition.value as { days: unknown }).days) > 0;
    }
    return typeof condition.value === "number" && condition.value > 0;
  }
  if (typeof condition.value === "number") return Number.isFinite(condition.value);
  if (typeof condition.value === "boolean") return true;
  return typeof condition.value === "string" && condition.value.trim().length > 0;
}

export function newConditionId(): string {
  return `c_${Math.random().toString(36).slice(2, 10)}`;
}

export function newGroupId(): string {
  return `g_${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyConditionsTree(): SegmentConditionsTree {
  return {
    rootCombinator: "and",
    groups: [
      {
        id: newGroupId(),
        combinator: "and",
        conditions: [
          {
            id: newConditionId(),
            fieldSource: "learner",
            fieldKey: "status",
            operator: "is",
            value: "ACTIVE",
          },
        ],
      },
    ],
  };
}

export async function fetchCustomFieldSegments() {
  return clientApi.get<{
    data: {
      items: CustomFieldSegmentItem[];
      summary: CustomFieldSegmentSummary;
    };
  }>("/api/v1/reports/custom-field/segments");
}

export async function fetchCustomFieldSegment(segmentId: string) {
  return clientApi.get<{ data: CustomFieldSegmentItem }>(
    `/api/v1/reports/custom-field/segments/${segmentId}`,
  );
}

export type SegmentFieldDivergence = {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  caption: string;
  maxDivergencePct: number;
  buckets: Array<{ value: string; segmentPct: number; tenantPct: number }>;
};

export type SegmentAnalytics = {
  matchedCount: number;
  previousMatchedCount: number | null;
  matchedDelta: number | null;
  matchedCountAt: string | null;
  totalLearnerCount: number;
  shareOfLearnersPct: number | null;
  averageTotalSpentCents: number | null;
  currency: string;
  averageEnrollmentCount: number | null;
  activeLast30DaysCount: number;
  activeLast30DaysPct: number | null;
  spendHistogram: Array<{ label: string; count: number; heightPct: number }>;
  tenantMedianSpentCents: number | null;
  tenantMedianBucketIndex: number | null;
  signupCohorts: Array<{ label: string; count: number; pct: number }>;
  fieldDivergences: SegmentFieldDivergence[];
  similarFieldCount: number;
  overlaps: Array<{
    segmentId: string;
    name: string;
    overlapCount: number;
    overlapPct: number;
  }>;
};

export type SegmentLearnerRow = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  status: string;
  enrollmentCount: number;
  totalSpentCents: number;
  currency: string;
  lastActiveAt: string | null;
  signedUpAt: string | null;
  customFields: Record<string, string | null>;
};

export async function fetchCustomFieldSegmentView(segmentId: string) {
  return clientApi.get<{
    data: {
      segment: CustomFieldSegmentItem;
      analytics: SegmentAnalytics;
      zeroMatch: boolean;
    };
  }>(`/api/v1/reports/custom-field/segments/${segmentId}/view`);
}

export async function fetchCustomFieldSegmentLearners(
  segmentId: string,
  filters: { q?: string; page?: number; limit?: number },
) {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.page) search.set("page", String(filters.page));
  if (filters.limit) search.set("limit", String(filters.limit));
  const query = search.toString();
  return clientApi.get<{
    data: {
      items: SegmentLearnerRow[];
      pageInfo: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
      fieldDefinitions: Array<{
        id: string;
        key: string;
        label: string;
        fieldType: string;
      }>;
    };
  }>(
    `/api/v1/reports/custom-field/segments/${segmentId}/learners${query ? `?${query}` : ""}`,
  );
}

export async function exportCustomFieldSegmentLearnersCsv(segmentId: string) {
  return clientApi.post<{
    data: { csv: string; filename: string; rowCount: number };
  }>(
    `/api/v1/reports/custom-field/segments/${segmentId}/learners/export`,
    {},
    "custom-field-segment-learners-export",
    { successMessage: "Learner CSV ready." },
  );
}

export async function createCustomFieldSegment(body: {
  name: string;
  description?: string | null;
  visibility: "shared" | "private";
  refreshMode: "live" | "snapshot";
  conditions: SegmentConditionsTree;
}) {
  return clientApi.post<{ data: CustomFieldSegmentItem }>(
    "/api/v1/reports/custom-field/segments",
    body,
    "custom-field-segment-create",
    { successMessage: "Segment saved." },
  );
}

export async function updateCustomFieldSegment(
  segmentId: string,
  body: {
    name?: string;
    description?: string | null;
    visibility?: "shared" | "private";
    refreshMode?: "live" | "snapshot";
    conditions?: SegmentConditionsTree;
  },
) {
  return clientApi.patch<{ data: CustomFieldSegmentItem }>(
    `/api/v1/reports/custom-field/segments/${segmentId}`,
    body,
    "custom-field-segment-update",
    { successMessage: "Segment updated." },
  );
}

export async function deleteCustomFieldSegment(segmentId: string) {
  return clientApi.delete<{ data: { id: string; deleted: true } }>(
    `/api/v1/reports/custom-field/segments/${segmentId}`,
    "custom-field-segment-delete",
    undefined,
    { successMessage: "Segment deleted." },
  );
}

export async function duplicateCustomFieldSegment(segmentId: string) {
  return clientApi.post<{ data: CustomFieldSegmentItem }>(
    `/api/v1/reports/custom-field/segments/${segmentId}/duplicate`,
    {},
    "custom-field-segment-duplicate",
    { successMessage: "Segment duplicated." },
  );
}

export async function previewCustomFieldSegment(body: {
  conditions: SegmentConditionsTree;
  limit?: number;
}) {
  return clientApi.post<{
    data: {
      matchedCount: number;
      incomplete: boolean;
      incompleteMessage: string | null;
      learners: SegmentPreviewLearner[];
    };
  }>("/api/v1/reports/custom-field/segments/preview", body, "custom-field-segment-preview", {
    silent: true,
  });
}

export async function exportCustomFieldSegmentsCsv() {
  return clientApi.post<{
    data: { csv: string; filename: string; rowCount: number };
  }>("/api/v1/reports/custom-field/segments/export", {}, "custom-field-segment-export", {
    successMessage: "Segments CSV ready.",
  });
}

export async function createGroupFromSegment(
  segmentId: string,
  body?: { title?: string; description?: string },
) {
  return clientApi.post<{
    data: { batchId: string; key: string; name: string; memberCount: number };
  }>(
    `/api/v1/reports/custom-field/segments/${segmentId}/group`,
    body ?? {},
    "custom-field-segment-group",
    { successMessage: "Group created from segment." },
  );
}

export async function fetchSegmentFieldOptions(): Promise<SegmentFieldOption[]> {
  const catalogue = await fetchCustomFieldCatalogue({
    status: "ACTIVE",
    sortBy: "label_asc",
  });
  const custom: SegmentFieldOption[] = catalogue.data.items.map(
    (item: CustomFieldCatalogueItem) => ({
      source: "custom" as const,
      key: item.key,
      label: item.label,
      fieldType: item.fieldType,
      options: item.options ?? [],
    }),
  );
  return [...LEARNER_SEGMENT_FIELDS, ...custom];
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
