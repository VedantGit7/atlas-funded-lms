export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminSuperLiveInsightsTrendsPage } from "../../../../../features/admin/reports/AdminSuperLiveInsightsTrendsPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminSuperLiveInsightsTrendsRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Trends"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Trends">
      <Suspense
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading trends…</p>}
      >
        <AdminSuperLiveInsightsTrendsPage />
      </Suspense>
    </AdminPageGate>
  );
}
