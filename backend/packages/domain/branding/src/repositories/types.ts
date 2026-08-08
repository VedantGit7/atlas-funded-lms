import type { UpdateTenantThemeRequest } from "../schemas/theme";

export type TenantBrandingRow = {
  tenant_id: string;
  display_name: string;
  public_name: string | null;
  logo_light_ref_id: string | null;
  logo_dark_ref_id: string | null;
  favicon_ref_id: string | null;
  issuer_name: string | null;
  public_landing_copy_json: Record<string, unknown> | null;
  status: "DRAFT" | "PUBLISHED";
  version: number | null;
  updated_at: Date;
  published_at: Date | null;
};

export type TenantThemeRow = {
  tenant_id: string;
  tokens_json: UpdateTenantThemeRequest["tokens"];
  status: "DRAFT" | "PUBLISHED";
  version: number | null;
  updated_at: Date;
  published_at: Date | null;
};

export type TenantBrandingVersionRow = {
  id: string;
  version: number;
  snapshot_json: unknown;
  published_by_membership_id: string | null;
  published_at: Date;
};

export type TenantDomainRow = {
  id: string;
  hostname: string;
  type: string;
  status: "PENDING" | "VERIFYING" | "ACTIVE" | "FAILED" | "DISABLED";
  is_primary: boolean;
  verification_txt_name: string | null;
  verification_txt_value: string | null;
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

export type RuntimeBrandingRow = {
  public_name: string | null;
  logo_light_ref_id: string | null;
  logo_dark_ref_id: string | null;
  favicon_ref_id: string | null;
  issuer_name: string | null;
  public_landing_copy_json: Record<string, unknown> | null;
  tokens_json: UpdateTenantThemeRequest["tokens"] | null;
  branding_version: number;
  theme_version: number;
};

export type DisabledTenantDomainRow = {
  id: string;
  status: "DISABLED";
};
