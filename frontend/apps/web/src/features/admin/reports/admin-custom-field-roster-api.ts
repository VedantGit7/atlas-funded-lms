import { clientApi } from "../../../lib/client-api";

export const CUSTOM_FIELD_BASE_COLUMN_OPTIONS = [
  { key: "learner_name", label: "Learner", pinned: true },
  { key: "email", label: "Email", pinned: false },
  { key: "enrollment_count", label: "Enrolments", pinned: false },
  { key: "total_spent_cents", label: "Total spent", pinned: false },
  { key: "last_active_at", label: "Last active on", pinned: false },
  { key: "signed_up_at", label: "Signed up on", pinned: false },
  { key: "status", label: "Status", pinned: false },
] as const;

export type CustomFieldBaseColumnKey = (typeof CUSTOM_FIELD_BASE_COLUMN_OPTIONS)[number]["key"];

export type CustomFieldDefinitionColumn = {
  id: string;
  key: string;
  label: string;
  fieldType: string;
};

export type CustomFieldRosterSummary = {
  learnerCount: number;
  activeLearnerCount: number;
  inactiveLearnerCount: number;
  customFieldCount: number;
  averageCoveragePct: number | null;
  learnersWithAllFieldsFilled: number;
  fieldsBelow40Coverage: number;
};

export type CustomFieldRosterItem = {
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

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

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

/** `locale` defaults to the viewer's; server-rendered pages pass a fixed one until hydration ends. */
export function formatMoney(cents: number, currency = "INR", locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export type CustomFieldRosterFilters = {
  q?: string | undefined;
  email?: string | undefined;
  status?: string | undefined;
  signedUpFrom?: string | undefined;
  signedUpTo?: string | undefined;
  minTotalSpentCents?: number | undefined;
  maxTotalSpentCents?: number | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  columns?: string[] | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};

/** What the roster opens on; the server loads the first page with it too. */
export const CUSTOM_FIELD_ROSTER_DEFAULTS = {
  sortBy: "signed_up_at",
  sortDir: "desc",
  columns: CUSTOM_FIELD_BASE_COLUMN_OPTIONS.map((column) => column.key),
  page: 1,
  limit: 25,
} as const satisfies CustomFieldRosterFilters;

export function customFieldRosterPath(filters: CustomFieldRosterFilters): string {
  return `/api/v1/reports/custom-field/roster${buildQuery({
    q: filters.q,
    email: filters.email,
    status: filters.status,
    signedUpFrom: filters.signedUpFrom,
    signedUpTo: filters.signedUpTo,
    minTotalSpentCents: filters.minTotalSpentCents,
    maxTotalSpentCents: filters.maxTotalSpentCents,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    columns: filters.columns?.join(","),
    page: filters.page ?? 1,
    limit: filters.limit ?? 25,
  })}`;
}

export type CustomFieldRosterPayload = {
  items: CustomFieldRosterItem[];
  pageInfo: PageInfo;
  columns: string[];
  fieldDefinitions: CustomFieldDefinitionColumn[];
  summary: CustomFieldRosterSummary;
};

export async function fetchCustomFieldRoster(filters: CustomFieldRosterFilters) {
  return clientApi.get<{ data: CustomFieldRosterPayload }>(customFieldRosterPath(filters));
}

/**
 * Every custom-field definition available to the report, independent of the
 * roster query.
 *
 * The column picker used to be populated from whatever `fieldDefinitions` the
 * roster response happened to carry, which makes the list of *available*
 * columns depend on the current filter and page — a field with no matching rows
 * on this page simply could not be chosen. This endpoint exists precisely to
 * decouple the two and had no caller.
 */
export const CUSTOM_FIELD_DEFINITIONS_PATH = "/api/v1/reports/custom-field/definitions";

export type CustomFieldDefinitionsPayload = { items: CustomFieldDefinitionColumn[] };

export async function fetchCustomFieldReportDefinitions() {
  return clientApi.get<{ data: CustomFieldDefinitionsPayload }>(CUSTOM_FIELD_DEFINITIONS_PATH);
}

export async function exportCustomFieldReport(body: Record<string, unknown>) {
  return clientApi.post<{ data: { runId: string; status: string; emailed: boolean } }>(
    "/api/v1/reports/custom-field/export",
    body,
    "custom-field-roster-export",
    { successMessage: "Custom Field export queued." },
  );
}

export async function sendCustomFieldReportMessage(body: Record<string, unknown>) {
  return clientApi.post<{
    data: {
      campaignId: string;
      deliveredCount: number;
      skippedCount: number;
      failedCount: number;
      recipientCount: number;
    };
  }>("/api/v1/reports/custom-field/messages", body, "custom-field-roster-message", {
    successMessage: "Message queued for matched learners.",
  });
}

export async function createCustomFieldReportGroup(body: Record<string, unknown>) {
  return clientApi.post<{
    data: { batchId: string; key: string; name: string; memberCount: number };
  }>("/api/v1/reports/custom-field/groups", body, "custom-field-roster-group", {
    successMessage: "Group created from learners.",
  });
}

export type CustomFieldCohortGroupItem = {
  batchId: string;
  key: string;
  name: string;
  description: string | null;
  sourceKind: "segment" | "ad_hoc" | "segment_snapshot";
  sourceLabel: string;
  segmentId: string | null;
  segmentName: string | null;
  criteriaSummary: string | null;
  memberCount: number;
  syncType: "static" | "live";
  createdAt: string;
  createdByLabel: string | null;
};

export type CustomFieldCohortMessageItem = {
  campaignId: string;
  subject: string;
  audienceCaption: string | null;
  sourceKind: "segment" | "ad_hoc";
  sourceLabel: string;
  segmentId: string | null;
  segmentName: string | null;
  deliveredCount: number;
  skippedCount: number;
  failedCount: number;
  openedCount: number | null;
  clickedCount: number | null;
  recipientCount: number;
  status: "sent" | "partially_failed" | "failed";
  sentByLabel: string | null;
  sentAt: string;
  reportHref: string | null;
};

function buildCohortQuery(filters: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

type CohortPageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type CustomFieldCohortGroupsPayload = {
  items: CustomFieldCohortGroupItem[];
  pageInfo: CohortPageInfo;
};

export type CustomFieldCohortMessagesPayload = {
  items: CustomFieldCohortMessageItem[];
  pageInfo: CohortPageInfo;
};

/** The cohorts page shows ten groups and ten messages a page. */
export const CUSTOM_FIELD_COHORTS_PAGE_SIZE = 10;

/** The cohorts page's first data: its groups and its messages. */
export type CustomFieldCohortsInitial = {
  groups: CustomFieldCohortGroupsPayload;
  messages: CustomFieldCohortMessagesPayload;
};

export function customFieldCohortGroupsPath(filters?: {
  q?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}): string {
  return `/api/v1/reports/custom-field/cohorts/groups${buildCohortQuery({
    q: filters?.q,
    page: filters?.page ?? 1,
    limit: filters?.limit ?? 25,
  })}`;
}

export async function fetchCustomFieldCohortGroups(filters?: {
  q?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{ data: CustomFieldCohortGroupsPayload }>(
    customFieldCohortGroupsPath(filters),
  );
}

export function customFieldCohortMessagesPath(filters?: {
  page?: number | undefined;
  limit?: number | undefined;
}): string {
  return `/api/v1/reports/custom-field/cohorts/messages${buildCohortQuery({
    page: filters?.page ?? 1,
    limit: filters?.limit ?? 25,
  })}`;
}

export async function fetchCustomFieldCohortMessages(filters?: {
  page?: number | undefined;
  limit?: number | undefined;
}) {
  return clientApi.get<{ data: CustomFieldCohortMessagesPayload }>(
    customFieldCohortMessagesPath(filters),
  );
}

export async function retryCustomFieldCohortMessage(campaignId: string) {
  return clientApi.post<{
    data: {
      campaignId: string;
      deliveredCount: number;
      skippedCount: number;
      failedCount: number;
      recipientCount: number;
    };
  }>(
    `/api/v1/reports/custom-field/cohorts/messages/${campaignId}/retry`,
    {},
    "custom-field-cohort-retry",
    { successMessage: "Retry queued for failed deliveries." },
  );
}

export type CustomFieldCatalogueItem = {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  status: string;
  options: string[];
  learnerCount: number;
  filledCount: number;
  coveragePct: number | null;
  distinctValueCount: number;
  optionsUsedCount: number | null;
  unusedOptions: string[];
  mostCommonValue: string | null;
  mostCommonSharePct: number | null;
  lastUpdatedAt: string | null;
  createdAt: string;
};

export type CustomFieldCatalogueSummary = {
  fieldsDefined: number;
  activeFieldCount: number;
  archivedFieldCount: number;
  averageCoveragePct: number | null;
  fullyCoveredFieldCount: number;
  fieldsBelow40Coverage: number;
  neverUsedFieldCount: number;
  learnerCount: number;
};

export type CustomFieldCatalogueFilters = {
  q?: string | undefined;
  fieldType?: string | undefined;
  status?: string | undefined;
  coverage?: string | undefined;
  sortBy?: string | undefined;
};

export type CustomFieldCataloguePayload = {
  items: CustomFieldCatalogueItem[];
  summary: CustomFieldCatalogueSummary;
};

/** What the field catalogue opens on: every status, any coverage, lowest coverage first. */
export const CUSTOM_FIELD_CATALOGUE_DEFAULTS = {
  status: "ALL",
  coverage: "any",
  sortBy: "coverage_asc",
} as const;

export function customFieldCataloguePath(filters: CustomFieldCatalogueFilters): string {
  return `/api/v1/reports/custom-field/catalogue${buildQuery({
    q: filters.q,
    fieldType: filters.fieldType,
    status: filters.status,
    coverage: filters.coverage,
    sortBy: filters.sortBy,
  })}`;
}

export async function fetchCustomFieldCatalogue(filters: CustomFieldCatalogueFilters) {
  return clientApi.get<{ data: CustomFieldCataloguePayload }>(customFieldCataloguePath(filters));
}

export type CustomFieldDetailField = {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  status: string;
  options: string[];
  createdAt: string;
};

export type CustomFieldDetailSummary = {
  learnerCount: number;
  filledCount: number;
  missingCount: number;
  coveragePct: number | null;
  distinctValueCount: number;
  mostCommonValue: string | null;
  mostCommonSharePct: number | null;
  lastUpdatedAt: string | null;
};

export type CustomFieldDetailSelectOption = {
  value: string;
  count: number;
  sharePct: number | null;
  unused: boolean;
};

export type CustomFieldDetailOrphan = {
  value: string;
  count: number;
};

export type CustomFieldDetailSelect = {
  options: CustomFieldDetailSelectOption[];
  orphaned: CustomFieldDetailOrphan[];
  unusedDefinedCount: number;
};

export type CustomFieldDetailNumberBucket = {
  label: string;
  min: number;
  max: number;
  count: number;
};

export type CustomFieldDetailNumberOutlier = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  value: number;
  zScore: number | null;
};

export type CustomFieldDetailNumber = {
  buckets: CustomFieldDetailNumberBucket[];
  stats: {
    min: number | null;
    max: number | null;
    mean: number | null;
    median: number | null;
    stdDev: number | null;
    sum: number | null;
  };
  outliersHigh: CustomFieldDetailNumberOutlier[];
  outliersLow: CustomFieldDetailNumberOutlier[];
};

export type CustomFieldDetailBooleanTrendPoint = {
  weekStart: string;
  yesCount: number;
  noCount: number;
  yesSharePct: number | null;
};

export type CustomFieldDetailBoolean = {
  yesCount: number;
  noCount: number;
  missingCount: number;
  yesSharePct: number | null;
  noSharePct: number | null;
  missingSharePct: number | null;
  trend: CustomFieldDetailBooleanTrendPoint[];
  trendCaption: string | null;
};

export type CustomFieldDetailTopValue = {
  value: string;
  count: number;
  sharePct: number | null;
};

export type CustomFieldDetailText = {
  topValues: CustomFieldDetailTopValue[];
};

export type CustomFieldDetailCrossTab = {
  otherField: {
    key: string;
    label: string;
    options: string[];
  };
  rowValues: string[];
  columnValues: string[];
  cells: number[][];
  rowTotals: number[];
  columnTotals: number[];
  grandTotal: number;
  strongestAssociation: string | null;
};

export type CustomFieldDetailCompareField = {
  key: string;
  label: string;
  fieldType: string;
};

export type CustomFieldDetailLearner = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  status: string;
  enrollmentCount: number;
  totalSpentCents: number;
  currency: string;
  lastActiveAt: string | null;
  signedUpAt: string | null;
  fieldValue: string | null;
};

export type CustomFieldDetailData = {
  field: CustomFieldDetailField;
  summary: CustomFieldDetailSummary;
  neverUsed: boolean;
  select: CustomFieldDetailSelect | null;
  number: CustomFieldDetailNumber | null;
  boolean: CustomFieldDetailBoolean | null;
  text: CustomFieldDetailText | null;
  crossTab: CustomFieldDetailCrossTab | null;
  compareFields: CustomFieldDetailCompareField[];
  learners: {
    items: CustomFieldDetailLearner[];
    pageInfo: PageInfo;
  };
};

export async function fetchCustomFieldDetail(
  fieldKey: string,
  filters: {
    q?: string | undefined;
    valueFilter?: string | undefined;
    minValue?: number | undefined;
    maxValue?: number | undefined;
    compareWith?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  },
) {
  return clientApi.get<{ data: CustomFieldDetailData }>(customFieldDetailPath(fieldKey, filters));
}

/** A field's learner list shows ten a page. */
export const CUSTOM_FIELD_DETAIL_PAGE_SIZE = 10;

export function customFieldDetailPath(
  fieldKey: string,
  filters: {
    q?: string | undefined;
    valueFilter?: string | undefined;
    minValue?: number | undefined;
    maxValue?: number | undefined;
    compareWith?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  },
): string {
  return `/api/v1/reports/custom-field/catalogue/${encodeURIComponent(fieldKey)}${buildQuery({
    q: filters.q,
    valueFilter: filters.valueFilter,
    minValue: filters.minValue,
    maxValue: filters.maxValue,
    compareWith: filters.compareWith,
    page: filters.page ?? 1,
    limit: filters.limit ?? 10,
  })}`;
}

export type CustomFieldLearnerSummary = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  status: string;
  avatarUrl: string | null;
  enrollmentCount: number;
  totalSpentCents: number;
  currency: string;
  lastActiveAt: string | null;
  signedUpAt: string | null;
};

export type CustomFieldLearnerFieldSummary = {
  fieldCount: number;
  filledCount: number;
  missingCount: number;
  completenessPct: number | null;
};

export type CustomFieldLearnerField = {
  definitionId: string;
  key: string;
  label: string;
  fieldType: string;
  status: string;
  options: string[];
  value: string | null;
  valueJson: unknown;
  filled: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
  auditCaption: string;
};

export type CustomFieldLearnerHistoryItem = {
  id: string;
  definitionId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  changedByName: string | null;
};

export type CustomFieldLearnerDetailData = {
  learner: CustomFieldLearnerSummary;
  summary: CustomFieldLearnerFieldSummary;
  fields: CustomFieldLearnerField[];
  history: CustomFieldLearnerHistoryItem[];
  zeroFieldsDefined: boolean;
  noValuesSet: boolean;
};

export type UpdateCustomFieldLearnerValuesBody = {
  values: Array<{
    definitionId: string;
    valueJson: unknown;
  }>;
};

export function customFieldLearnerDetailPath(membershipId: string): string {
  return `/api/v1/reports/custom-field/learners/${encodeURIComponent(membershipId)}`;
}

export async function fetchCustomFieldLearnerDetail(membershipId: string) {
  return clientApi.get<{ data: CustomFieldLearnerDetailData }>(
    customFieldLearnerDetailPath(membershipId),
  );
}

export async function updateCustomFieldLearnerValues(
  membershipId: string,
  body: UpdateCustomFieldLearnerValuesBody,
) {
  return clientApi.patch<{ data: { updatedCount: number; clearedCount: number } }>(
    `/api/v1/reports/custom-field/learners/${encodeURIComponent(membershipId)}`,
    body,
    "custom-field-learner-values",
    { successMessage: "Learner field values updated." },
  );
}
