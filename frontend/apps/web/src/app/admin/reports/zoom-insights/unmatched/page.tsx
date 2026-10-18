export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminZoomInsightsUnmatchedPage } from "../../../../../features/admin/reports/AdminZoomInsightsUnmatchedPage";
import { loadZoomUnmatchedData } from "../../../../../lib/server/report-zoom-insights-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminZoomInsightsUnmatchedRoutePage() {
  const [gate, initial] = await Promise.all([runTenantStateGate(), loadZoomUnmatchedData()]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Zoom unmatched identities"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Zoom unmatched identities">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading unmatched…</p>
        }
      >
        <AdminZoomInsightsUnmatchedPage
          initialUnmatched={initial.unmatched}
          initialRules={initial.rules}
        />
      </Suspense>
    </AdminPageGate>
  );
}
