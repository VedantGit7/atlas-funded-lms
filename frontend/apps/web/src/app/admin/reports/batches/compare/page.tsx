export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminBatchesComparePage } from "../../../../../features/admin/reports/AdminBatchesComparePage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminBatchesCompareRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Compare batches"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Compare batches">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading comparison…</p>
        }
      >
        <AdminBatchesComparePage />
      </Suspense>
    </AdminPageGate>
  );
}
