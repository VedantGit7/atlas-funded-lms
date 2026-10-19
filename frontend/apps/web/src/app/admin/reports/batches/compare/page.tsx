export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminBatchesComparePage } from "../../../../../features/admin/reports/AdminBatchesComparePage";
import type { ReportSearchParams } from "../../../../../lib/server/report-landing-initial-data";
import { loadBatchesCompareData } from "../../../../../lib/server/report-batches-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminBatchesCompareRoutePage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>;
}) {
  const [gate, initialCompare] = await Promise.all([
    runTenantStateGate(),
    searchParams.then(loadBatchesCompareData),
  ]);
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
        <AdminBatchesComparePage initialCompare={initialCompare} />
      </Suspense>
    </AdminPageGate>
  );
}
