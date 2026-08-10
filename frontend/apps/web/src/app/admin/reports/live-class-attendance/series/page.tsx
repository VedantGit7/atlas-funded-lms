export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminLiveClassAttendanceSeriesPage } from "../../../../../features/admin/reports/AdminLiveClassAttendanceSeriesPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminLiveClassAttendanceSeriesRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Series"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Series">
      <Suspense
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading series…</p>}
      >
        <AdminLiveClassAttendanceSeriesPage />
      </Suspense>
    </AdminPageGate>
  );
}
