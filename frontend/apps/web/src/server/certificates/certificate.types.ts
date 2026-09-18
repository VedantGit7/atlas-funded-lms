// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

export type CertificateTemplateStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

export type CertificateStatus = "issued" | "revoked" | "expired" | "suspended";

export type CertificateIssueSourceType = "course" | "learning_path" | "assessment";

export type CertificateWalletPassPlatform = "apple" | "google";

export type {
  CertificateDesignBackground,
  CertificateDesignDocument,
  CertificateDesignElement,
  CertificateDesignPage,
  CertificateDesignRule,
  CertificateDesignVariable,
  CertificateImageElement,
  CertificateQrElement,
  CertificateShapeElement,
  CertificateSignatureElement,
  CertificateTextElement,
} from "./certificate-design-document";

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
  expires_at: Date | null;
  suspended_at: Date | null;
  serial_number: string | null;
  design_snapshot_json: unknown;
  design_snapshot_hash: string | null;
  recipient_name: string | null;
  course_title: string | null;
  status_list_index: number | null;
  vc_json: unknown;
  vc_object_key: string | null;
  blockchain_anchor: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CertificateBrandKitRow = {
  id: string;
  tenant_id: string;
  name: string;
  logo_url: string | null;
  colors_json: unknown;
  fonts_json: unknown;
  assets_json: unknown;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type CertificateStatusListRow = {
  id: string;
  tenant_id: string;
  purpose: string;
  encoded_list: string;
  bit_length: number;
  version: number;
  created_at: Date;
  updated_at: Date;
};

export type CertificateRenderJobRow = {
  id: string;
  tenant_id: string;
  certificate_id: string | null;
  template_id: string | null;
  status: string;
  error_message: string | null;
  r2_object_key: string | null;
  format: string;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};

export type CertificateWalletPassRow = {
  id: string;
  tenant_id: string;
  certificate_id: string;
  platform: CertificateWalletPassPlatform;
  pass_object_key: string | null;
  external_id: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  revoked_at: Date | null;
};

export type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
  idempotencyKey?: string;
};
