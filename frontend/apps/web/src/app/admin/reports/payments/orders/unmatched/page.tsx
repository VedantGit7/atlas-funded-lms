export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminPaymentOrdersUnmatchedPage } from "../../../../../../features/admin/reports/AdminPaymentOrdersUnmatchedPage";
import { loadUnmatchedPaymentOrdersData } from "../../../../../../lib/server/report-payments-initial-data";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

/**
 * `/admin/reports/payments/orders/unmatched`.
 *
 * Reading the worklist is the same read as reading the ledger (`reports.run`),
 * enforced by the route, so this gate only handles tenant availability.
 */
export default async function AdminUnmatchedOrdersRoutePage() {
  const [gate, initialWorklist] = await Promise.all([
    runTenantStateGate(),
    loadUnmatchedPaymentOrdersData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Unmatched orders"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Unmatched orders">
      <AdminPaymentOrdersUnmatchedPage initialWorklist={initialWorklist} />
    </AdminPageGate>
  );
}
