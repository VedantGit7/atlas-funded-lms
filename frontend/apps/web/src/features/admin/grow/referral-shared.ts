export type ReferralConfig = {
  enabled: boolean;
  referrerSignupCredits: number;
  refereeSignupCredits: number;
  referrerPurchaseCredits: number;
  maxReferrals: number | null;
  walletEnabled: boolean;
  updatedAt: string | null;
};

export type ReferralStatsItem = {
  membershipId: string;
  displayName: string | null;
  email: string | null;
  code: string;
  successfulReferrals: number;
  signupCreditsEarned: number;
  purchaseCreditsEarned: number;
  createdAt: string;
};

export type ReferralStatsSort = "successfulReferrals" | "creditsEarned" | "createdAt";

export const REFERRAL_HREF = "/admin/sales/referral-code";
export const WALLET_HREF = "/admin/sales/wallet";
export const ADMIN_SALES_HREF = "/admin/sales";

export const REFERRAL_SORT_OPTIONS: ReadonlyArray<{
  value: ReferralStatsSort;
  label: string;
}> = [
  { value: "successfulReferrals", label: "Top referrals" },
  { value: "creditsEarned", label: "Most earned" },
  { value: "createdAt", label: "Recently joined" },
];

export function totalCreditsEarned(row: ReferralStatsItem): number {
  return row.signupCreditsEarned + row.purchaseCreditsEarned;
}

export function formatReferralDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatCredits(value: number): string {
  return value.toLocaleString();
}

export function learnerInitials(name: string | null | undefined, email: string | null | undefined) {
  const source = (name?.trim() || email?.trim() || "?").split(/\s+/).filter(Boolean);
  if (source.length === 0) return "?";
  if (source.length === 1) return (source[0] ?? "").slice(0, 2).toUpperCase();
  return `${source[0]?.[0] ?? ""}${source[1]?.[0] ?? ""}`.toUpperCase();
}

export function learnerLabel(
  row: Pick<ReferralStatsItem, "displayName" | "email" | "membershipId">,
) {
  return row.displayName?.trim() || row.email?.trim() || row.membershipId.slice(0, 8);
}
