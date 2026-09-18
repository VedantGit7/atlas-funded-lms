export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminAttributionSettingsPage } from "../../../../../../features/admin/reports/AdminAttributionSettingsPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

/**
 * `/admin/reports/sales-marketing/attribution/settings`.
 *
 * Read-only. Each section is gated by the permission of the endpoint behind it
 * and degrades on its own, so this gate only handles tenant availability.
 */
export default async function AdminAttributionSettingsRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Attribution settings"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Attribution settings">
      <AdminAttributionSettingsPage />
    </AdminPageGate>
  );
}
