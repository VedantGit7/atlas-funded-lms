import { formatMoney } from "./coupons-shared";

export type WalletDirection = "CREDIT" | "DEBIT";

export type WalletReason =
  | "REFERRAL_SIGNUP"
  | "REFERRAL_PURCHASE"
  | "CHECKOUT_SPEND"
  | "ADMIN_ADJUST"
  | "OTHER";

export type WalletConfig = {
  enabled: boolean;
  creditValueCents: number;
  currency: string;
  maxBalanceCredits: number | null;
  maxCreditsPerOrder: number | null;
  updatedAt: string | null;
};

export type WalletAccount = {
  membershipId: string;
  displayName: string | null;
  email: string | null;
  balanceCredits: number;
  earnedCredits: number;
  usedCredits: number;
  updatedAt: string;
};

export type WalletTransaction = {
  id: string;
  direction: WalletDirection;
  reason: WalletReason;
  credits: number;
  balanceAfter: number;
  moneyCents: number | null;
  currency: string | null;
  paymentOrderId: string | null;
  courseId: string | null;
  note: string | null;
  createdAt: string;
};

export const WALLET_HREF = "/admin/sales/wallet";
export const ADMIN_SALES_HREF = "/admin/sales";

export const DEFAULT_WALLET_CONFIG: WalletConfig = {
  enabled: false,
  creditValueCents: 100,
  currency: "USD",
  maxBalanceCredits: null,
  maxCreditsPerOrder: null,
  updatedAt: null,
};

export function walletReasonLabel(reason: WalletReason): string {
  switch (reason) {
    case "REFERRAL_SIGNUP":
      return "Referral signup";
    case "REFERRAL_PURCHASE":
      return "Referral purchase";
    case "CHECKOUT_SPEND":
      return "Course purchase";
    case "ADMIN_ADJUST":
      return "Manual adjustment";
    default:
      return "Other";
  }
}

export function formatWalletCreditsAsMoney(
  credits: number,
  creditValueCents: number,
  currency: string,
): string {
  return formatMoney(credits * creditValueCents, currency || "USD");
}

export function dollarsToCredits(dollarsRaw: string, creditValueCents: number): number | null {
  const dollars = Number(dollarsRaw);
  if (!Number.isFinite(dollars) || dollars <= 0 || creditValueCents <= 0) return null;
  const cents = Math.round(dollars * 100);
  const credits = Math.round(cents / creditValueCents);
  return credits > 0 ? credits : null;
}

export function creditsToDollarInput(credits: number, creditValueCents: number): string {
  if (creditValueCents <= 0) return "0";
  const dollars = (credits * creditValueCents) / 100;
  return dollars.toFixed(2).replace(/\.00$/, "");
}

export function formatWalletDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function learnerInitials(name: string | null | undefined, email: string | null | undefined) {
  const source = (name?.trim() || email?.trim() || "?").split(/\s+/).filter(Boolean);
  if (source.length === 0) return "?";
  if (source.length === 1) return source[0]!.slice(0, 2).toUpperCase();
  return `${source[0]![0] ?? ""}${source[1]![0] ?? ""}`.toUpperCase();
}

export function learnerLabel(account: Pick<WalletAccount, "displayName" | "email" | "membershipId">) {
  return account.displayName?.trim() || account.email?.trim() || account.membershipId.slice(0, 8);
}
