export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminSuperLiveInsightsOutliersPage } from "../../../../../features/admin/reports/AdminSuperLiveInsightsOutliersPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminSuperLiveInsightsOutliersRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Outliers"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Outliers">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading outliers…</p>
        }
      >
        <AdminSuperLiveInsightsOutliersPage />
      </Suspense>
    </AdminPageGate>
  );
}
