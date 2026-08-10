export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminNewExportPage } from "../../../../../features/admin/reports/AdminNewExportPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminNewExportRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="New export"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="New export">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading export builder…</p>
        }
      >
        <AdminNewExportPage />
      </Suspense>
    </AdminPageGate>
  );
}
