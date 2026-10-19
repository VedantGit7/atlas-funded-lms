export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminCustomFieldSegmentsPage } from "../../../../../features/admin/reports/AdminCustomFieldSegmentsPage";
import { loadCustomFieldSegmentsData } from "../../../../../lib/server/report-custom-field-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminCustomFieldSegmentsRoutePage() {
  const [gate, initialSegments] = await Promise.all([
    runTenantStateGate(),
    loadCustomFieldSegmentsData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Segments"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Segments">
      <AdminCustomFieldSegmentsPage initialSegments={initialSegments} />
    </AdminPageGate>
  );
}
