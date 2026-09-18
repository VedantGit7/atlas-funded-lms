// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

export type LocaleReviewStatus = "pending" | "approved" | "rejected";

export type LocaleQaIssueSeverity = "error" | "warning" | "info";

export type LocaleQaIssueType =
  | "missing_key"
  | "empty_translation"
  | "placeholder_mismatch"
  | "length_warning";

export type LocaleResourceRow = {
  id: string;
  tenant_id: string;
  locale: string;
  key: string;
  value: string;
  review_status: LocaleReviewStatus;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  updated_at: Date;
};

export type LocaleMetadataRow = {
  id: string;
  tenant_id: string;
  locale: string;
  native_name: string | null;
  is_rtl: boolean;
  is_default: boolean;
  is_fallback: boolean;
  created_at: Date;
  updated_at: Date;
};

export type LocaleCanonicalKeyRow = {
  id: string;
  tenant_id: string;
  key: string;
  source_locale: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
};

export type LocaleQaCheckRunRow = {
  id: string;
  tenant_id: string;
  issue_count: number;
  started_at: Date;
  completed_at: Date;
  started_by: string;
};

export type LocaleQaIssueRow = {
  id: string;
  tenant_id: string;
  run_id: string;
  locale: string;
  key: string;
  severity: LocaleQaIssueSeverity;
  issue_type: LocaleQaIssueType;
  message: string;
  created_at: Date;
};

export type LocaleResourceDto = {
  locale: string;
  key: string;
  value: string;
  updatedAt: string;
  reviewStatus: LocaleReviewStatus;
};

export type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};
