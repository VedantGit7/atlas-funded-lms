import type { ReactNode } from "react";

export type AffiliateAccessMode = "PUBLIC" | "PRIVATE";
export type AffiliateTier = "STANDARD" | "PREMIUM";
export type AffiliatePartnerStatus = "ACTIVE" | "INACTIVE";
export type AffiliateRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type AffiliateCommissionStatus = "UNPAID" | "PAID";
export type AdminAffiliateTab = "settings" | "products" | "partners" | "requests" | "payouts";

export type AffiliateConfig = {
  enabled: boolean;
  accessMode: AffiliateAccessMode;
  askAdmin: boolean;
  standardDiscountPct: number;
  standardCommissionPct: number;
  premiumDiscountPct: number;
  premiumCommissionPct: number;
  updatedAt: string | null;
};

export type AffiliateProduct = {
  courseId: string;
  courseTitle: string | null;
  enabled: boolean;
  standardDiscountPct: number | null;
  standardCommissionPct: number | null;
  premiumDiscountPct: number | null;
  premiumCommissionPct: number | null;
  updatedAt: string;
};

export type AffiliatePartner = {
  id: string;
  membershipId: string;
  displayName: string | null;
  email: string | null;
  tier: AffiliateTier;
  status: AffiliatePartnerStatus;
  couponCode: string;
  payoutUpi: string | null;
  payoutBankAccount: string | null;
  payoutIfsc: string | null;
  payoutAccountName: string | null;
  unpaidCents: number;
  paidCents: number;
  createdAt: string;
  updatedAt: string;
};

export type AffiliateRequest = {
  id: string;
  membershipId: string;
  displayName: string | null;
  email: string | null;
  status: AffiliateRequestStatus;
  note: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type AffiliatePayout = {
  id: string;
  affiliateId: string;
  affiliateMembershipId: string;
  displayName: string | null;
  email: string | null;
  amountCents: number;
  currency: string;
  status: string;
  note: string | null;
  paidAt: string;
  createdAt: string;
};

export type AffiliateSummary = {
  activePartners: number;
  totalPartners: number;
  pendingRequests: number;
  unpaidCents: number;
  paidCents: number;
  partnersWithUnpaid: number;
  enabledProducts: number;
};

export type AffiliateCommission = {
  id: string;
  affiliateId: string;
  courseId: string;
  commissionCents: number;
  currency: string;
  status: AffiliateCommissionStatus;
  createdAt: string;
};

export type StudioCourseOption = {
  id: string;
  title: string;
};

export type MemberSearchOption = {
  id: string;
  label: string;
  email: string | null;
};

export const AFFILIATES_HREF = "/admin/sales/affiliates";
export const ADMIN_SALES_HREF = "/admin/sales";
const DASHBOARD_HREF = "/admin";

export { DASHBOARD_HREF };

export const TABS: ReadonlyArray<{ id: AdminAffiliateTab; label: string }> = [
  { id: "settings", label: "Settings" },
  { id: "products", label: "Products" },
  { id: "partners", label: "Partners" },
  { id: "requests", label: "Requests" },
  { id: "payouts", label: "Payouts" },
];

export const DEFAULT_CONFIG: AffiliateConfig = {
  enabled: false,
  accessMode: "PRIVATE",
  askAdmin: true,
  standardDiscountPct: 0,
  standardCommissionPct: 10,
  premiumDiscountPct: 0,
  premiumCommissionPct: 20,
  updatedAt: null,
};

export const TIER_OPTIONS: ReadonlyArray<{ value: AffiliateTier; label: string }> = [
  { value: "STANDARD", label: "Standard" },
  { value: "PREMIUM", label: "Premium" },
];

export function parseOptionalPct(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export function formatAffiliateDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatAffiliateDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function partnerInitials(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const source = (name?.trim() || email?.trim() || "?").split(/\s+/).filter(Boolean);
  if (source.length === 0) return "?";
  if (source.length === 1) return (source[0] ?? "").slice(0, 2).toUpperCase();
  return `${source[0]?.[0] ?? ""}${source[1]?.[0] ?? ""}`.toUpperCase();
}

export function partnerLabel(
  row: Pick<AffiliatePartner, "displayName" | "email" | "membershipId">,
): string {
  return row.displayName?.trim() || row.email?.trim() || row.membershipId.slice(0, 8);
}

export function requestApplicantLabel(
  row: Pick<AffiliateRequest, "displayName" | "email" | "membershipId">,
): string {
  return row.displayName?.trim() || row.email?.trim() || row.membershipId.slice(0, 8);
}

export function configFieldsEqual(a: AffiliateConfig, b: AffiliateConfig): boolean {
  return (
    a.enabled === b.enabled &&
    a.accessMode === b.accessMode &&
    a.askAdmin === b.askAdmin &&
    a.standardDiscountPct === b.standardDiscountPct &&
    a.standardCommissionPct === b.standardCommissionPct &&
    a.premiumDiscountPct === b.premiumDiscountPct &&
    a.premiumCommissionPct === b.premiumCommissionPct
  );
}

export function tierBadgeClass(tier: AffiliateTier): string {
  return tier === "PREMIUM"
    ? "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]"
    : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

export function partnerStatusBadgeClass(status: AffiliatePartnerStatus): string {
  return status === "ACTIVE"
    ? "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]"
    : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

export function commissionStatusBadgeClass(status: AffiliateCommissionStatus): string {
  return status === "UNPAID"
    ? "bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]"
    : "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]";
}

export function tierLabel(tier: AffiliateTier): string {
  return tier === "PREMIUM" ? "Premium" : "Standard";
}

export function partnerStatusLabel(status: AffiliatePartnerStatus): string {
  return status === "ACTIVE" ? "Active" : "Inactive";
}

export function maskBankAccount(value: string | null | undefined): string {
  if (!value?.trim()) return "Not set";
  const digits = value.replace(/\s/g, "");
  if (digits.length <= 4) return "****";
  return `****${digits.slice(-4)}`;
}

export function formatPctOverride(value: number | null | undefined, globalDefault: number): string {
  if (value == null) return `Default (${globalDefault}%)`;
  return `${value}%`;
}

export function pctInputValue(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

export type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
};

export function statCardSurfaceClassName(): string {
  return "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm";
}
