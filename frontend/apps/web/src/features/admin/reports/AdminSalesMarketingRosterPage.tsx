"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminAffiliateProductsPanel } from "./AdminAffiliateProductsPanel";
import { AdminAffiliatesPanel } from "./AdminAffiliatesPanel";
import { AdminCouponsPanel } from "./AdminCouponsPanel";
import { AdminReferralWalletPanel } from "./AdminReferralWalletPanel";
import { AdminSalesMarketingExportsPanel } from "./AdminSalesMarketingExportsPanel";
import { AdminSalesMarketingOverviewPanel } from "./AdminSalesMarketingOverviewPanel";
import { AdminSalesByProductPanel } from "./AdminSalesByProductPanel";
import {
  SalesMarketingReportTabs,
  SALES_MARKETING_TAB_HREFS,
  type SalesMarketingReportTab,
} from "./SalesMarketingReportTabs";

function parseTab(value: string | null): SalesMarketingReportTab {
  if (
    value === "overview" ||
    value === "sales" ||
    value === "coupons" ||
    value === "referral-wallet" ||
    value === "affiliate-products" ||
    value === "affiliates" ||
    value === "exports"
  ) {
    return value;
  }
  return "overview";
}

function tabFromPathname(pathname: string | null): SalesMarketingReportTab | null {
  if (pathname?.endsWith("/sales-marketing/sales")) return "sales";
  if (pathname?.endsWith("/sales-marketing/coupons")) return "coupons";
  if (pathname?.endsWith("/sales-marketing/referral-wallet")) return "referral-wallet";
  if (pathname?.endsWith("/sales-marketing/affiliate-products")) return "affiliate-products";
  if (pathname?.endsWith("/sales-marketing/affiliates")) return "affiliates";
  if (pathname?.endsWith("/sales-marketing/exports")) return "exports";
  return null;
}

export function AdminSalesMarketingRosterPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<SalesMarketingReportTab>(() => {
    return tabFromPathname(pathname) ?? parseTab(searchParams.get("tab"));
  });

  useEffect(() => {
    const fromPath = tabFromPathname(pathname);
    if (fromPath) {
      setTab(fromPath);
      return;
    }
    setTab(parseTab(searchParams.get("tab")));
  }, [pathname, searchParams]);

  function navigateTab(next: SalesMarketingReportTab) {
    setTab(next);
    router.replace(SALES_MARKETING_TAB_HREFS[next], { scroll: false });
  }

  const showSalesPanel = tab === "sales";
  const showCouponsPanel = tab === "coupons";
  const showReferralWalletPanel = tab === "referral-wallet";
  const showAffiliateProductsPanel = tab === "affiliate-products";
  const showAffiliatesPanel = tab === "affiliates";
  const showExportsPanel = tab === "exports";

  return (
    <div className="space-y-6">
      <SalesMarketingReportTabs active={tab} onChange={navigateTab} />

      {tab === "overview" ? (
        <AdminSalesMarketingOverviewPanel
          onNavigateTab={(next) => {
            navigateTab(next);
          }}
        />
      ) : null}

      {showSalesPanel ? <AdminSalesByProductPanel /> : null}

      {showCouponsPanel ? <AdminCouponsPanel /> : null}

      {showReferralWalletPanel ? <AdminReferralWalletPanel /> : null}

      {showAffiliateProductsPanel ? <AdminAffiliateProductsPanel /> : null}

      {showAffiliatesPanel ? <AdminAffiliatesPanel /> : null}

      {showExportsPanel ? <AdminSalesMarketingExportsPanel /> : null}
    </div>
  );
}
