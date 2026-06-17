export type PlatformTenantRow = {
  id: string;
  slug: string;
  display_name: string;
  legal_name: string | null;
  state: string;
  default_locale: string;
  default_timezone: string;
  created_at: Date;
  updated_at: Date;
  primary_domain_id: string | null;
  primary_domain_hostname: string | null;
  primary_domain_status: string | null;
  primary_domain_type: string | null;
  latest_job_id: string | null;
  latest_job_status: string | null;
};

export type ProvisioningJobRow = {
  id: string;
  tenant_id: string;
  status: string;
  step: string;
  error_json: unknown;
  idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
};

export type EntitlementRow = {
  key: string;
  value_json: unknown;
  expires_at: Date | null;
};

export type ProvisioningJobErrorJson = {
  code?: string | null;
  message?: string | null;
};
