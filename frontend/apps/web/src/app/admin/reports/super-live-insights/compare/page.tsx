export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminSuperLiveInsightsComparePage } from "../../../../../features/admin/reports/AdminSuperLiveInsightsComparePage";
import type { ReportSearchParams } from "../../../../../lib/server/report-landing-initial-data";
import { loadSuperLiveInsightsCompareData } from "../../../../../lib/server/report-super-live-insights-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminSuperLiveInsightsCompareRoutePage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>;
}) {
  const [gate, initialCompare] = await Promise.all([
    runTenantStateGate(),
    searchParams.then(loadSuperLiveInsightsCompareData),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Compare"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Compare">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading compare…</p>
        }
      >
        <AdminSuperLiveInsightsComparePage initialCompare={initialCompare} />
      </Suspense>
    </AdminPageGate>
  );
}
