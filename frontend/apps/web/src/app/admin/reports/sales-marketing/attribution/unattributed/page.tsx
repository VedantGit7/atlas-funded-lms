export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminAttributionUnattributedPage } from "../../../../../../features/admin/reports/AdminAttributionUnattributedPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

/**
 * `/admin/reports/sales-marketing/attribution/unattributed`.
 *
 * Scanning the log is the same read as reading it (`reports.run`), enforced by
 * the route, so this gate only handles tenant availability.
 */
export default async function AdminAttributionUnattributedRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Unattributed and incomplete"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Unattributed and incomplete">
      <AdminAttributionUnattributedPage />
    </AdminPageGate>
  );
}
