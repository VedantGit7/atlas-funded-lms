export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminPaymentsTransactionsLedgerPage } from "../../../../../features/admin/reports/AdminPaymentsTransactionsLedgerPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminPaymentsTransactionsRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Transactions"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Transactions">
      <Suspense fallback={null}>
        <AdminPaymentsTransactionsLedgerPage />
      </Suspense>
    </AdminPageGate>
  );
}
