"use client";

import Link from "next/link";

export type SalesMarketingReportTab =
  | "overview"
  | "sales"
  | "coupons"
  | "referral-wallet"
  | "affiliate-products"
  | "affiliates"
  | "attribution"
  | "exports";

/** Single source of truth for tab routing; exhaustive over the tab union. */
export const SALES_MARKETING_TAB_HREFS: Record<SalesMarketingReportTab, string> = {
  overview: "/admin/reports/sales-marketing",
  sales: "/admin/reports/sales-marketing/sales",
  coupons: "/admin/reports/sales-marketing/coupons",
  "referral-wallet": "/admin/reports/sales-marketing/referral-wallet",
  "affiliate-products": "/admin/reports/sales-marketing/affiliate-products",
  affiliates: "/admin/reports/sales-marketing/affiliates",
  attribution: "/admin/reports/sales-marketing/attribution",
  exports: "/admin/reports/sales-marketing/exports",
};

const TABS: Array<{ key: SalesMarketingReportTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "sales", label: "Sales" },
  { key: "coupons", label: "Coupons" },
  { key: "referral-wallet", label: "Referral & wallet" },
  { key: "affiliate-products", label: "Affiliate products" },
  { key: "affiliates", label: "Affiliates" },
  { key: "attribution", label: "Attribution" },
  { key: "exports", label: "Exports" },
];

type Props = {
  active: SalesMarketingReportTab;
  onChange?: (tab: SalesMarketingReportTab) => void;
};

export function SalesMarketingReportTabs({ active, onChange }: Props) {
  return (
    <div className="mb-2 flex gap-6 overflow-x-auto border-b border-[var(--admin-border)]">
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const className = [
          "whitespace-nowrap border-b-2 py-2 text-sm transition-colors",
          isActive
            ? "border-[var(--admin-primary)] font-semibold text-[var(--admin-primary)]"
            : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
        ].join(" ");

        if (onChange) {
          return (
            <button
              key={tab.key}
              type="button"
              className={className}
              onClick={() => {
                onChange(tab.key);
              }}
            >
              {tab.label}
            </button>
          );
        }

        return (
          <Link key={tab.key} href={SALES_MARKETING_TAB_HREFS[tab.key]} className={className}>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
