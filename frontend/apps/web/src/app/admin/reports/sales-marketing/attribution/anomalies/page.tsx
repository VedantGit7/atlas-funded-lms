export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminAttributionAnomaliesPage } from "../../../../../../features/admin/reports/AdminAttributionAnomaliesPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

/**
 * `/admin/reports/sales-marketing/attribution/anomalies`.
 *
 * Scanning the log is the same read as reading it (`reports.run`), enforced by
 * the route, so this gate only handles tenant availability.
 */
export default async function AdminAttributionAnomaliesRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Attribution anomalies"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Attribution anomalies">
      <AdminAttributionAnomaliesPage />
    </AdminPageGate>
  );
}
