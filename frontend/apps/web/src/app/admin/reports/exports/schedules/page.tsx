export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminExportSchedulesPage } from "../../../../../features/admin/reports/AdminExportSchedulesPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminExportSchedulesRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Schedules"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Schedules">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading schedules…</p>
        }
      >
        <AdminExportSchedulesPage />
      </Suspense>
    </AdminPageGate>
  );
}
