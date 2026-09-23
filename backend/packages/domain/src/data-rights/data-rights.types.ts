import type { JobStatus } from "./data-rights.contract";

export type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
  idempotencyKey?: string;
};

export type ExportJobRow = {
  artifact_json?: unknown;
  id: string;
  tenant_id: string;
  requested_by_membership_id: string;
  status: JobStatus;
  scope_json: unknown;
  r2_object_key: string | null;
  error_json: unknown;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type DeletionRequestRow = {
  outcome_json?: unknown;
  id: string;
  tenant_id: string;
  requested_by_membership_id: string | null;
  target_type: string;
  target_id: string;
  status: JobStatus;
  reason: string | null;
  scheduled_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type TenantExportSnapshot = {
  exportedAt: string;
  tenantId: string;
  memberships: Array<{ id: string; status: string; joinedAt: string }>;
  memberProfiles: Array<{ membershipId: string; displayName: string | null }>;
  courses: Array<{ id: string; slug: string; title: string; status: string }>;
  enrollments: Array<{ id: string; courseId: string; membershipId: string; status: string }>;
};
