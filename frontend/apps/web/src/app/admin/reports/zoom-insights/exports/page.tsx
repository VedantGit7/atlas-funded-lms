export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminZoomInsightsExportsPage } from "../../../../../features/admin/reports/AdminZoomInsightsExportsPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminZoomInsightsExportsRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Zoom exports"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Zoom exports">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading exports…</p>
        }
      >
        <AdminZoomInsightsExportsPage />
      </Suspense>
    </AdminPageGate>
  );
}
