export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminLiveClassAttendanceLearnersPage } from "../../../../../features/admin/reports/AdminLiveClassAttendanceLearnersPage";
import { loadLiveLearnersData } from "../../../../../lib/server/report-live-class-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminLiveClassAttendanceLearnersRoutePage() {
  const [gate, initialLearners] = await Promise.all([runTenantStateGate(), loadLiveLearnersData()]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Learners"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Learners">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading learners…</p>
        }
      >
        <AdminLiveClassAttendanceLearnersPage initialLearners={initialLearners} />
      </Suspense>
    </AdminPageGate>
  );
}
