import type { SystemReportDefinition } from "./reports.types";

const defaultDateRangeParams = {
  type: "object",
  additionalProperties: false,
  properties: {
    startDate: { type: "string", format: "date-time" },
    endDate: { type: "string", format: "date-time" },
    courseId: { type: "string", format: "uuid" },
    status: { type: "string" },
  },
} as const;

function def(
  input: Omit<SystemReportDefinition, "scope" | "paramSchemaJson"> & {
    paramSchemaJson?: Record<string, unknown>;
  },
): SystemReportDefinition {
  return {
    scope: "system",
    paramSchemaJson: defaultDateRangeParams,
    ...input,
  };
}

export const SYSTEM_REPORT_DEFINITIONS: SystemReportDefinition[] = [
  def({
    key: "enrollments",
    category: "enrollments",
    title: "Enrollments",
    description: "Enrollment roster by learner, product, enrolled type, and period.",
    datasetKey: "enrollments",
    defaultFormat: "csv",
    paramSchemaJson: {
      type: "object",
      additionalProperties: false,
      properties: {
        startDate: { type: "string", format: "date-time" },
        endDate: { type: "string", format: "date-time" },
        courseId: { type: "string", format: "uuid" },
        status: { type: "string" },
        email: { type: "string" },
        enrolledType: { type: "string" },
        sortBy: { type: "string", enum: ["enrolled_at", "expires_at"] },
        sortDir: { type: "string", enum: ["asc", "desc"] },
      },
    },
  }),
  def({
    key: "progress-score",
    category: "progress-score",
    title: "Progress & Score",
    description: "Lesson progress and assessment scores.",
    datasetKey: "progress-score",
    defaultFormat: "csv",
  }),
  def({
    key: "resource-usage",
    category: "resource-usage",
    title: "Resource Usage",
    description:
      "Plan usage meters, monthly history, dormant content, and inactive learners.",
    datasetKey: "resource-usage",
    defaultFormat: "csv",
  }),
  def({
    key: "exports",
    category: "exports",
    title: "Exports",
    description: "Export history for report runs and data-rights packages, with re-download.",
    datasetKey: "exports",
    defaultFormat: "csv",
    paramSchemaJson: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string" },
        sourceType: { type: "string" },
        definitionKey: { type: "string" },
        createdFrom: { type: "string", format: "date-time" },
        createdTo: { type: "string", format: "date-time" },
        q: { type: "string" },
      },
    },
  }),
  def({
    key: "active-devices",
    category: "active-devices",
    title: "Active Devices",
    description: "Learner device sessions for security monitoring and revocation.",
    datasetKey: "active-devices",
    defaultFormat: "csv",
    paramSchemaJson: {
      type: "object",
      additionalProperties: false,
      properties: {
        membershipId: { type: "string", format: "uuid" },
        platform: { type: "string" },
        email: { type: "string" },
        window: { type: "string", enum: ["24h", "7d", "30d", "all"] },
        overLimitOnly: { type: "boolean" },
        columns: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  }),
  def({
    key: "payments",
    category: "payments",
    title: "Payments",
    description: "Payment orders and status.",
    datasetKey: "payments",
    defaultFormat: "csv",
  }),
  def({
    key: "batches",
    category: "batches",
    title: "Batches",
    description: "Batch membership and progress context.",
    datasetKey: "batches",
    defaultFormat: "csv",
  }),
  def({
    key: "polls",
    category: "polls",
    title: "Polls",
    description: "Poll responses and option breakdown.",
    datasetKey: "polls",
    defaultFormat: "csv",
  }),
  def({
    key: "sales-marketing",
    category: "sales-marketing",
    title: "Sales & Marketing",
    description: "Product sales, coupons, referral & wallet, and affiliate performance.",
    datasetKey: "sales-marketing",
    defaultFormat: "csv",
  }),
  def({
    key: "custom-field",
    category: "custom-field",
    title: "Custom Field",
    description: "Learners report with contact info, activity, spend, and custom field values.",
    datasetKey: "custom-field",
    defaultFormat: "csv",
  }),
  def({
    key: "zoom-insights",
    category: "zoom-insights",
    title: "Zoom Insights",
    description: "Zoom meetings and participant metrics.",
    datasetKey: "zoom-insights",
    defaultFormat: "csv",
  }),
  def({
    key: "live-class-attendance",
    category: "live-class-attendance",
    title: "Live Class Attendance",
    description: "Live session attendance roster.",
    datasetKey: "live-class-attendance",
    defaultFormat: "csv",
  }),
  def({
    key: "super-live-insights",
    category: "super-live-insights",
    title: "Super Live Insights",
    description: "Live session engagement metrics.",
    datasetKey: "super-live-insights",
    defaultFormat: "csv",
  }),
  def({
    key: "assessment-items",
    category: "assessment-items",
    title: "Assessment Items",
    description: "Item statistics and attempt summaries.",
    datasetKey: "assessment-items",
    defaultFormat: "csv",
  }),
  def({
    key: "certificates",
    category: "certificates",
    title: "Certificates",
    description: "Issued certificates and verification status.",
    datasetKey: "certificates",
    defaultFormat: "csv",
  }),
  def({
    key: "at-risk-roster",
    category: "at-risk-roster",
    title: "At-Risk Roster",
    description: "Open at-risk alerts by learner.",
    datasetKey: "at-risk-roster",
    defaultFormat: "csv",
    paramSchemaJson: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["open", "acknowledged", "resolved"] },
      },
    },
  }),
];

export const SYSTEM_REPORT_DEFINITION_KEYS = SYSTEM_REPORT_DEFINITIONS.map((item) => item.key);

export function getSystemReportDefinition(key: string): SystemReportDefinition | null {
  return SYSTEM_REPORT_DEFINITIONS.find((item) => item.key === key) ?? null;
}

export function getSystemReportDefinitionByDatasetKey(
  datasetKey: string,
): SystemReportDefinition | null {
  return SYSTEM_REPORT_DEFINITIONS.find((item) => item.datasetKey === datasetKey) ?? null;
}
