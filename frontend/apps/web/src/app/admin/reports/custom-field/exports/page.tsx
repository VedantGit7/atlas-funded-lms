export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminCustomFieldExportsPage } from "../../../../../features/admin/reports/AdminCustomFieldExportsPage";
import type { CustomFieldExportsPayload } from "../../../../../features/admin/reports/admin-custom-field-exports-api";
import { loadReportInitialData } from "../../../../../lib/server/report-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminCustomFieldExportsRoutePage() {
  const [gate, initialExports] = await Promise.all([
    runTenantStateGate(),
    loadReportInitialData<CustomFieldExportsPayload>("/api/v1/reports/custom-field/exports"),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T52"
        state="denied"
        title="Exports"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T52" state="ready" title="Exports">
      <AdminCustomFieldExportsPage initialExports={initialExports} />
    </AdminPageGate>
  );
}
