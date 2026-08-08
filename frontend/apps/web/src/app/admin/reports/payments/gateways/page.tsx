export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminPaymentsGatewaysPage } from "../../../../../features/admin/reports/AdminPaymentsGatewaysPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminPaymentsGatewaysRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Payment gateways"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Payment gateways">
      <AdminPaymentsGatewaysPage />
    </AdminPageGate>
  );
}
