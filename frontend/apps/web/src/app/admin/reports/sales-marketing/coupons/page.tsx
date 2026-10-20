export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminSalesMarketingRosterPage } from "../../../../../features/admin/reports/AdminSalesMarketingRosterPage";
import { loadSalesCouponsData } from "../../../../../lib/server/report-sales-marketing-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminSalesMarketingCouponsRoutePage() {
  const [gate, initialCoupons] = await Promise.all([runTenantStateGate(), loadSalesCouponsData()]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Coupons"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Coupons">
      <Suspense
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>}
      >
        <AdminSalesMarketingRosterPage initialCoupons={initialCoupons} />
      </Suspense>
    </AdminPageGate>
  );
}
