export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminZoomInsightsConnectionPage } from "../../../../../features/admin/reports/AdminZoomInsightsConnectionPage";
import { loadZoomConnectionData } from "../../../../../lib/server/report-zoom-insights-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminZoomInsightsConnectionRoutePage() {
  const [gate, initialConnection] = await Promise.all([
    runTenantStateGate(),
    loadZoomConnectionData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Zoom connection"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Zoom connection">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading connection…</p>
        }
      >
        <AdminZoomInsightsConnectionPage initialConnection={initialConnection} />
      </Suspense>
    </AdminPageGate>
  );
}
