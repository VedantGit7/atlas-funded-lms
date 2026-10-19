export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminPaymentsInstalmentsLedgerPage } from "../../../../../features/admin/reports/AdminPaymentsInstalmentsLedgerPage";
import { loadPaymentInstalmentsData } from "../../../../../lib/server/report-payments-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminPaymentsInstalmentsRoutePage() {
  const [gate, initialPlans] = await Promise.all([
    runTenantStateGate(),
    loadPaymentInstalmentsData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Instalments"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Instalments">
      <AdminPaymentsInstalmentsLedgerPage initialPlans={initialPlans} />
    </AdminPageGate>
  );
}
