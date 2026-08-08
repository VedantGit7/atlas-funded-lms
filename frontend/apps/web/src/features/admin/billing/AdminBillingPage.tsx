"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { BillingPlanSummary } from "./build-billing-summary";
import {
  billingActionButtonClassName,
  billingBackLinkClassName,
  billingCardClassName,
  billingExpiryBannerClassName,
  billingPageClassName,
  billingRowClassName,
  billingRowDescClassName,
  billingRowTitleClassName,
  billingSectionClassName,
  billingSectionDescClassName,
  billingSectionTitleClassName,
} from "./billing-admin-shared";

type BillingRow = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  href?: string;
  disabled?: boolean;
};

type BillingSection = {
  id: string;
  title: string;
  description: string;
  rows: BillingRow[];
};

type AdminBillingPageProps = {
  summary: BillingPlanSummary;
};

function BillingAction({ row }: { row: BillingRow }) {
  if (row.disabled || !row.href) {
    return (
      <button type="button" className={billingActionButtonClassName} disabled>
        {row.actionLabel}
      </button>
    );
  }

  return (
    <Link href={row.href} prefetch={false} className={billingActionButtonClassName}>
      {row.actionLabel}
    </Link>
  );
}

function BillingSectionBlock({ section }: { section: BillingSection }) {
  return (
    <section aria-labelledby={`billing-section-${section.id}`} className={billingSectionClassName}>
      <div>
        <h2 id={`billing-section-${section.id}`} className={billingSectionTitleClassName}>
          {section.title}
        </h2>
        <p className={billingSectionDescClassName}>{section.description}</p>
      </div>
      <div className={billingCardClassName}>
        {section.rows.map((row) => (
          <div key={row.id} className={billingRowClassName}>
            <div className="min-w-0">
              <p className={billingRowTitleClassName}>{row.title}</p>
              <p className={billingRowDescClassName}>{row.description}</p>
            </div>
            <BillingAction row={row} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminBillingPage({ summary }: AdminBillingPageProps) {
  const sections: BillingSection[] = [
    {
      id: "subscription",
      title: "Subscription Plan",
      description: "Overview of the subscribed plan and addons",
      rows: [
        {
          id: "plan",
          title: summary.planTitle,
          description: summary.planDescription,
          actionLabel: "Change plan",
          href: "/admin/entitlements",
        },
        {
          id: "features",
          title: "Features",
          description: "Explore every feature your academy can use",
          actionLabel: "View",
          href: "/admin/billing/features",
        },
        {
          id: "subscriptions",
          title: "Subscriptions",
          description: "View all your subscriptions here",
          actionLabel: "View",
          href: "/admin/billing/subscriptions",
        },
      ],
    },
    {
      id: "usage",
      title: "Usage And Limits",
      description:
        "Monitor how your academy is consuming plan resources such as active learners, storage, bandwidth, and more.",
      rows: [
        {
          id: "usage-dashboard",
          title: "Usage Dashboard",
          description:
            "Get a complete view of your usage across active learners, storage, bandwidth, tests, and more.",
          actionLabel: "View",
          href: "/admin/usagedashboard",
        },
      ],
    },
    {
      id: "payment",
      title: "Payment Method",
      description: "Configure your payment and billing address",
      rows: [
        {
          id: "billing-address",
          title: "Billing Address",
          description: "Find your billing address information here",
          actionLabel: "View",
          disabled: true,
        },
      ],
    },
    {
      id: "charges",
      title: "Statement Of Charges",
      description: "View all invoices history you have been charged for.",
      rows: [
        {
          id: "invoice-history",
          title: "Invoice History",
          description: "View all your bills generated and paid till date.",
          actionLabel: "View",
          disabled: true,
        },
      ],
    },
  ];

  return (
    <div className={billingPageClassName}>
      <Link href="/admin/settings" prefetch={false} className={billingBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Settings
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">Billing</h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Check your current billing cycle, manage your plan.
        </p>
      </header>

      {summary.expiryWarning ? (
        <div role="status" className={billingExpiryBannerClassName}>
          {summary.expiryWarning}
        </div>
      ) : null}

      <div className="space-y-10">
        {sections.map((section) => (
          <BillingSectionBlock key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
