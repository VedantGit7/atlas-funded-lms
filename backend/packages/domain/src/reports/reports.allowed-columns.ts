import { DATASET_BUILDERS } from "./reports.datasets";
import type { ReportDatasetResult } from "./reports.types";

export const APPROVED_DATASET_KEYS = Object.keys(DATASET_BUILDERS) as ApprovedDatasetKey[];

export type ApprovedDatasetKey = keyof typeof DATASET_BUILDERS;

export const ALLOWED_COLUMNS: Record<ApprovedDatasetKey, readonly string[]> = {
  enrollments: [
    "id",
    "course_id",
    "course_title",
    "product_title",
    "membership_id",
    "learner_name",
    "email",
    "status",
    "enrolled_type",
    "enrolled_at",
    "expires_at",
  ],
  "progress-score": [
    "enrollment_id",
    "membership_id",
    "course_id",
    "course_title",
    "product_id",
    "product_title",
    "learner_name",
    "email",
    "enrolled_type",
    "status",
    "enrolled_at",
    "expires_at",
    "completed_lessons",
    "total_lessons",
    "lesson_id",
    "lesson_status",
    "completed_at",
    "attempt_id",
    "assessment_id",
    "assessment_title",
    "attempt_status",
    "score",
    "submitted_at",
    "started_at",
  ],
  "resource-usage": [
    "metric_key",
    "metric_label",
    "period",
    "value",
    "unit",
    "calculated_at",
    "course_id",
    "title",
    "status",
    "lesson_count",
    "storage_gb",
    "last_learner_activity_at",
    "created_at",
    "membership_id",
    "learner_name",
    "email",
    "last_active_at",
    "rollup_key",
    "subject_type",
    "subject_id",
    "metrics_json",
  ],
  exports: [
    "source_type",
    "id",
    "definition_key",
    "definition_title",
    "status",
    "format",
    "row_count",
    "requested_by_name",
    "created_at",
    "completed_at",
    "expires_at",
    "has_file",
  ],
  "active-devices": [
    "id",
    "membership_id",
    "learner_name",
    "email",
    "device_count",
    "platform",
    "device_fingerprint",
    "user_agent",
    "ip_address",
    "last_seen_at",
    "created_at",
    "status",
    "flags",
  ],
  payments: [
    "id",
    "membership_id",
    "learner_name",
    "email",
    "product_title",
    "product_type",
    "gateway_key",
    "coupon_amount_cents",
    "amount_cents",
    "tax_amount_cents",
    "currency",
    "status",
    "invoice_number",
    "external_id",
    "paid_at",
    "created_at",
    "plan_id",
    "pricing_plan_label",
    "total_amount_cents",
    "remaining_amount_cents",
  ],
  batches: [
    "batch_id",
    "batch_key",
    "batch_name",
    "batch_status",
    "course_id",
    "course_title",
    "membership_id",
    "learner_name",
    "email",
    "activity_at",
    "joined_at",
    "starts_at",
    "ends_at",
  ],
  polls: [
    "poll_id",
    "poll_title",
    "poll_type",
    "poll_status",
    "quiz_mode",
    "anonymous_vote",
    "live_session_id",
    "option_id",
    "option_label",
    "is_correct",
    "membership_id",
    "learner_name",
    "email",
    "responded_at",
  ],
  "sales-marketing": [
    "course_id",
    "product_title",
    "membership_id",
    "learner_name",
    "email",
    "amount_cents",
    "currency",
    "enrolled_type",
    "purchased_at",
    "coupon_id",
    "code",
    "name",
    "status",
    "discount_type",
    "discount_value",
    "redemption_count",
    "total_discount_cents",
    "total_revenue_cents",
    "referral_code",
    "successful_referrals",
    "credit_earned",
    "wallet_balance",
    "affiliate_id",
    "tier",
    "coupon_code",
    "revenue_contribution_cents",
    "commission_earned_cents",
    "signed_up_at",
    "enabled",
    "order_count",
    "revenue_cents",
    "commission_cents",
    "published_at",
  ],
  "custom-field": [
    "membership_id",
    "learner_name",
    "email",
    "membership_status",
    "signed_up_at",
    "last_active_at",
    "enrollment_count",
    "total_spent_cents",
    "field_key",
    "field_label",
    "value_json",
  ],
  "zoom-insights": [
    "meeting_id",
    "external_meeting_id",
    "topic",
    "started_at",
    "ended_at",
    "membership_id",
    "display_name",
    "email",
    "join_time",
    "leave_time",
    "duration_seconds",
  ],
  "live-class-attendance": [
    "session_id",
    "session_title",
    "session_status",
    "course_id",
    "course_title",
    "batch_id",
    "batch_name",
    "membership_id",
    "learner_name",
    "email",
    "status",
    "joined_at",
    "left_at",
    "duration_seconds",
  ],
  "super-live-insights": [
    "session_id",
    "title",
    "status",
    "course_id",
    "course_title",
    "batch_id",
    "batch_name",
    "scheduled_at",
    "started_at",
    "ended_at",
    "duration_seconds",
    "attended_count",
    "registered_count",
    "absent_count",
    "total_count",
    "avg_duration_seconds",
    "attendance_rate",
  ],
  "assessment-items": [
    "item_id",
    "window_key",
    "attempts_count",
    "correct_count",
    "avg_latency_ms",
    "calculated_at",
  ],
  certificates: [
    "certificate_id",
    "membership_id",
    "status",
    "issued_at",
    "expires_at",
    "revoked_at",
  ],
  "at-risk-roster": [
    "alert_id",
    "rule_key",
    "rule_name",
    "membership_id",
    "status",
    "triggered_at",
    "acknowledged_at",
  ],
};

export const SELECTED_COLUMNS_SCHEMA_KEY = "x-selectedColumns" as const;

export function isApprovedDatasetKey(value: string): value is ApprovedDatasetKey {
  return Object.prototype.hasOwnProperty.call(ALLOWED_COLUMNS, value);
}

export function getAllowedColumnsForDataset(datasetKey: string): readonly string[] {
  if (!isApprovedDatasetKey(datasetKey)) {
    return [];
  }
  return ALLOWED_COLUMNS[datasetKey] ?? [];
}

export function validateSelectedColumns(args: {
  datasetKey: string;
  columns: string[];
}): { ok: true; columns: string[] } | { ok: false; message: string } {
  if (!isApprovedDatasetKey(args.datasetKey)) {
    return { ok: false, message: "Dataset is not approved for custom reports." };
  }

  if (args.columns.length === 0) {
    return { ok: false, message: "At least one column is required." };
  }

  const allowed = new Set(ALLOWED_COLUMNS[args.datasetKey]);
  const invalid = args.columns.filter((column) => !allowed.has(column));
  if (invalid.length > 0) {
    return {
      ok: false,
      message: `Invalid columns for dataset: ${invalid.join(", ")}`,
    };
  }

  const unique = [...new Set(args.columns)];
  return { ok: true, columns: unique };
}

export function extractSelectedColumns(paramSchemaJson: unknown): string[] {
  if (!paramSchemaJson || typeof paramSchemaJson !== "object" || Array.isArray(paramSchemaJson)) {
    return [];
  }

  const selected = (paramSchemaJson as Record<string, unknown>)[SELECTED_COLUMNS_SCHEMA_KEY];
  if (!Array.isArray(selected)) {
    return [];
  }

  return selected.filter((value): value is string => typeof value === "string" && value.length > 0);
}

export function withSelectedColumns(
  paramSchemaJson: Record<string, unknown>,
  columns: string[],
): Record<string, unknown> {
  return {
    ...paramSchemaJson,
    [SELECTED_COLUMNS_SCHEMA_KEY]: columns,
  };
}

export function filterDatasetByColumns(
  dataset: ReportDatasetResult,
  columns: string[],
): ReportDatasetResult {
  if (columns.length === 0) {
    return dataset;
  }

  const selected = columns.filter((column) => dataset.columns.includes(column));
  const effectiveColumns = selected.length > 0 ? selected : dataset.columns;

  return {
    columns: effectiveColumns,
    rows: dataset.rows.map((row) => {
      const mapped: Record<string, unknown> = {};
      for (const column of effectiveColumns) {
        mapped[column] = row[column] ?? null;
      }
      return mapped;
    }),
  };
}
