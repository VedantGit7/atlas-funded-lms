export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminAttributionHealthPage } from "../../../../../../features/admin/reports/AdminAttributionHealthPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

/**
 * `/admin/reports/sales-marketing/attribution/health`.
 *
 * Reading the health series is the same read as reading the log
 * (`reports.run`), enforced by the route, so this gate only handles tenant
 * availability.
 */
export default async function AdminAttributionHealthRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Tracking health"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Tracking health">
      <AdminAttributionHealthPage />
    </AdminPageGate>
  );
}
