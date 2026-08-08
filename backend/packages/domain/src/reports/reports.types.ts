import type { JobStatus, ReportFormat, ReportScope } from "./reports.contract";

export type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
  idempotencyKey?: string;
};

export type ReportDefinitionRow = {
  id: string;
  tenant_id: string;
  key: string;
  category: string;
  title: string;
  description: string | null;
  param_schema_json: unknown;
  dataset_key: string;
  default_format: string;
  scope: ReportScope;
  created_at: Date;
  updated_at: Date;
};

export type ReportScheduleRow = {
  id: string;
  tenant_id: string;
  report_definition_id: string;
  created_by_membership_id: string;
  name: string | null;
  cron_expression: string;
  timezone: string;
  params_json: unknown;
  formats_json: unknown;
  delivery_json: unknown;
  next_run_at: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type ReportRunRow = {
  id: string;
  tenant_id: string;
  report_definition_id: string;
  report_schedule_id: string | null;
  requested_by_membership_id: string;
  status: JobStatus;
  params_json: unknown;
  format: ReportFormat;
  row_count: number | null;
  r2_object_key: string | null;
  error_json: unknown;
  progress_percent: number | null;
  started_at: Date | null;
  completed_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type ReportDatasetResult = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export type SystemReportDefinition = {
  key: string;
  category: string;
  title: string;
  description: string;
  datasetKey: string;
  defaultFormat: ReportFormat;
  scope: ReportScope;
  paramSchemaJson: Record<string, unknown>;
};
