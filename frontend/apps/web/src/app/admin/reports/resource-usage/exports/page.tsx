export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminResourceUsageRosterPage } from "../../../../../features/admin/reports/AdminResourceUsageRosterPage";
import type { ResourceUsageExportsPayload } from "../../../../../features/admin/reports/admin-resource-usage-exports-api";
import { loadReportInitialData } from "../../../../../lib/server/report-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminResourceUsageExportsRoutePage() {
  const [gate, initialExports] = await Promise.all([
    runTenantStateGate(),
    loadReportInitialData<ResourceUsageExportsPayload>("/api/v1/reports/resource-usage/exports"),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Resource Usage Exports"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Resource Usage Exports">
      <Suspense
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading...</p>}
      >
        <AdminResourceUsageRosterPage initialExports={initialExports} />
      </Suspense>
    </AdminPageGate>
  );
}
