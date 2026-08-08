export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminPaymentsRefundsLedgerPage } from "../../../../../features/admin/reports/AdminPaymentsRefundsLedgerPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminPaymentsRefundsRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Refunds"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Refunds">
      <AdminPaymentsRefundsLedgerPage />
    </AdminPageGate>
  );
}
