"use client";

import Link from "next/link";

export type PaymentsReportTab =
  | "overview"
  | "transactions"
  | "instalment"
  | "gateways"
  | "invoices"
  | "refunds"
  | "exports";

const TABS: Array<{ key: PaymentsReportTab; label: string; href: string }> = [
  { key: "overview", label: "Overview", href: "/admin/reports/payments" },
  {
    key: "transactions",
    label: "Transactions",
    href: "/admin/reports/payments/transactions",
  },
  {
    key: "instalment",
    label: "Instalments",
    href: "/admin/reports/payments/instalments",
  },
  {
    key: "gateways",
    label: "Gateways",
    href: "/admin/reports/payments/gateways",
  },
  {
    key: "invoices",
    label: "Invoices",
    href: "/admin/reports/payments/invoices",
  },
  {
    key: "refunds",
    label: "Refunds",
    href: "/admin/reports/payments/refunds",
  },
  {
    key: "exports",
    label: "Exports",
    href: "/admin/reports/payments/exports",
  },
];

export function PaymentsReportTabs({ active }: { active: PaymentsReportTab }) {
  const tabClass = (key: PaymentsReportTab) =>
    `whitespace-nowrap pb-3 text-sm font-semibold transition-colors ${
      active === key
        ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
        : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
    }`;

  return (
    <div className="flex items-center gap-8 overflow-x-auto border-b border-[var(--admin-border)]">
      {TABS.map((tab) => (
        <Link key={tab.key} href={tab.href} className={tabClass(tab.key)}>
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
