export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminResourceUsageRosterPage } from "../../../../../features/admin/reports/AdminResourceUsageRosterPage";
import { loadResourceUsageLandingData } from "../../../../../lib/server/report-landing-initial-data";
import { loadResourceUsageHistoryData } from "../../../../../lib/server/report-resource-usage-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminResourceUsageHistoryRoutePage() {
  const [gate, initialOverview, initialHistory] = await Promise.all([
    runTenantStateGate(),
    loadResourceUsageLandingData(),
    loadResourceUsageHistoryData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Resource Usage History"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Resource Usage History">
      <Suspense
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>}
      >
        <AdminResourceUsageRosterPage
          initialOverview={initialOverview}
          initialHistory={initialHistory}
        />
      </Suspense>
    </AdminPageGate>
  );
}
