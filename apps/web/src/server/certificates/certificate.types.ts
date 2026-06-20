export type CertificateTemplateStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

export type CertificateStatus = "issued" | "revoked" | "expired";

export type CertificateIssueSourceType = "course" | "learning_path" | "assessment";

export type CertificateTemplateRow = {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  template_json: unknown;
  status: CertificateTemplateStatus;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type CertificateRow = {
  id: string;
  tenant_id: string;
  template_id: string;
  membership_id: string;
  credential_id: string;
  status: CertificateStatus;
  issued_at: Date;
  revoked_at: Date | null;
  r2_object_key: string | null;
  metadata_json: unknown;
};

export type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
  idempotencyKey?: string;
};
