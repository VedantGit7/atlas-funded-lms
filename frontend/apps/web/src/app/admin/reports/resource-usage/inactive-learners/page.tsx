export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminResourceUsageRosterPage } from "../../../../../features/admin/reports/AdminResourceUsageRosterPage";
import { loadResourceUsageLandingData } from "../../../../../lib/server/report-landing-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminResourceUsageInactiveRoutePage() {
  const [gate, initialOverview] = await Promise.all([
    runTenantStateGate(),
    loadResourceUsageLandingData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Resource Usage Inactive Learners"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Resource Usage Inactive Learners">
      <Suspense
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading...</p>}
      >
        <AdminResourceUsageRosterPage initialOverview={initialOverview} />
      </Suspense>
    </AdminPageGate>
  );
}
