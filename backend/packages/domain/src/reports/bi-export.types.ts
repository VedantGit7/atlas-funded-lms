import type { JobStatus } from "./reports.contract";

export type BiExportJobRow = {
  id: string;
  tenant_id: string;
  requested_by_membership_id: string;
  status: JobStatus;
  dataset_key: string;
  params_json: unknown;
  r2_object_key: string | null;
  error_json: unknown;
  completed_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
};
