export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminSalesMarketingRosterPage } from "../../../../../features/admin/reports/AdminSalesMarketingRosterPage";
import type { SalesMarketingExportsPayload } from "../../../../../features/admin/reports/admin-sales-marketing-exports-api";
import { loadReportInitialData } from "../../../../../lib/server/report-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminSalesMarketingExportsRoutePage() {
  const [gate, initialExports] = await Promise.all([
    runTenantStateGate(),
    loadReportInitialData<SalesMarketingExportsPayload>("/api/v1/reports/sales-marketing/exports"),
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
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>}
      >
        <AdminSalesMarketingRosterPage initialExports={initialExports} />
      </Suspense>
    </AdminPageGate>
  );
}
