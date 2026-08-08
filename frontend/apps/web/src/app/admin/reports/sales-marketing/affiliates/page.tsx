export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminSalesMarketingRosterPage } from "../../../../../features/admin/reports/AdminSalesMarketingRosterPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminSalesMarketingAffiliatesRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Affiliates"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Affiliates">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>
        }
      >
        <AdminSalesMarketingRosterPage />
      </Suspense>
    </AdminPageGate>
  );
}
