export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminExportSettingsPage } from "../../../../../features/admin/reports/AdminExportSettingsPage";
import { loadExportSettingsData } from "../../../../../lib/server/report-exports-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminExportSettingsRoutePage() {
  const [gate, initialSettings] = await Promise.all([
    runTenantStateGate(),
    loadExportSettingsData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T51"
        state="denied"
        title="Settings"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T51" state="ready" title="Settings">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading settings...</p>
        }
      >
        <AdminExportSettingsPage initialSettings={initialSettings} />
      </Suspense>
    </AdminPageGate>
  );
}
