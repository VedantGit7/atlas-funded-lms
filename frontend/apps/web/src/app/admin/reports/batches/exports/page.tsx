export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminBatchesExportsPage } from "../../../../../features/admin/reports/AdminBatchesExportsPage";
import type { BatchesExportsPayload } from "../../../../../features/admin/reports/admin-batches-exports-api";
import { loadReportInitialData } from "../../../../../lib/server/report-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminBatchesExportsRoutePage() {
  const [gate, initialExports] = await Promise.all([
    runTenantStateGate(),
    loadReportInitialData<BatchesExportsPayload>("/api/v1/reports/batches/exports"),
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
        <AdminBatchesExportsPage initialExports={initialExports} />
      </Suspense>
    </AdminPageGate>
  );
}
