export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminZoomInsightsParticipantsPage } from "../../../../../features/admin/reports/AdminZoomInsightsParticipantsPage";
import type { ReportSearchParams } from "../../../../../lib/server/report-landing-initial-data";
import { loadZoomPeopleData } from "../../../../../lib/server/report-zoom-insights-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminZoomInsightsParticipantsRoutePage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>;
}) {
  const [gate, initialPeople] = await Promise.all([
    runTenantStateGate(),
    searchParams.then(loadZoomPeopleData),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Zoom participants"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Zoom participants">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading participants…</p>
        }
      >
        <AdminZoomInsightsParticipantsPage initialPeople={initialPeople} />
      </Suspense>
    </AdminPageGate>
  );
}
