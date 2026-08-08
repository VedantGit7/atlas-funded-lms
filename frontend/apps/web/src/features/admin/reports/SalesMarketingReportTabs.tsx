"use client";

import Link from "next/link";

export type SalesMarketingReportTab =
  | "overview"
  | "sales"
  | "coupons"
  | "referral-wallet"
  | "affiliate-products"
  | "affiliates"
  | "exports";

const TABS: Array<{ key: SalesMarketingReportTab; label: string; href: string }> = [
  { key: "overview", label: "Overview", href: "/admin/reports/sales-marketing" },
  {
    key: "sales",
    label: "Sales",
    href: "/admin/reports/sales-marketing/sales",
  },
  {
    key: "coupons",
    label: "Coupons",
    href: "/admin/reports/sales-marketing/coupons",
  },
  {
    key: "referral-wallet",
    label: "Referral & wallet",
    href: "/admin/reports/sales-marketing/referral-wallet",
  },
  {
    key: "affiliate-products",
    label: "Affiliate products",
    href: "/admin/reports/sales-marketing/affiliate-products",
  },
  {
    key: "affiliates",
    label: "Affiliates",
    href: "/admin/reports/sales-marketing/affiliates",
  },
  {
    key: "exports",
    label: "Exports",
    href: "/admin/reports/sales-marketing/exports",
  },
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
              onClick={() => onChange(tab.key)}
            >
              {tab.label}
            </button>
          );
        }

        return (
          <Link key={tab.key} href={tab.href} className={className}>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
