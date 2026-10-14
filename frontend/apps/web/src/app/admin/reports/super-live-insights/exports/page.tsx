export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminSuperLiveInsightsExportsPage } from "../../../../../features/admin/reports/AdminSuperLiveInsightsExportsPage";
import type { SuperLiveInsightsExportsPayload } from "../../../../../features/admin/reports/admin-super-live-insights-exports-api";
import { loadReportInitialData } from "../../../../../lib/server/report-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminSuperLiveInsightsExportsRoutePage() {
  const [gate, initialExports] = await Promise.all([
    runTenantStateGate(),
    loadReportInitialData<SuperLiveInsightsExportsPayload>(
      "/api/v1/reports/super-live-insights/exports",
    ),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Exports"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Exports">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading exports…</p>
        }
      >
        <AdminSuperLiveInsightsExportsPage initialExports={initialExports} />
      </Suspense>
    </AdminPageGate>
  );
}
