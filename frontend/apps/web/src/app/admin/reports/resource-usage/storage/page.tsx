export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminResourceUsageRosterPage } from "../../../../../features/admin/reports/AdminResourceUsageRosterPage";
import { loadResourceUsageLandingData } from "../../../../../lib/server/report-landing-initial-data";
import { loadResourceUsageStorageData } from "../../../../../lib/server/report-resource-usage-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminResourceUsageStorageRoutePage() {
  const [gate, initialOverview, initialStorage] = await Promise.all([
    runTenantStateGate(),
    loadResourceUsageLandingData(),
    loadResourceUsageStorageData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Resource Usage Storage"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Resource Usage Storage">
      <Suspense
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>}
      >
        <AdminResourceUsageRosterPage
          initialOverview={initialOverview}
          initialStorage={initialStorage}
        />
      </Suspense>
    </AdminPageGate>
  );
}
