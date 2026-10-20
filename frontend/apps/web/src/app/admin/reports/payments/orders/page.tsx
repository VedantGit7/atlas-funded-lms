export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminPaymentOrdersPage } from "../../../../../features/admin/reports/AdminPaymentOrdersPage";
import { loadPaymentOrdersData } from "../../../../../lib/server/report-payments-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminPaymentOrdersRoutePage() {
  const [gate, initialLedger] = await Promise.all([runTenantStateGate(), loadPaymentOrdersData()]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Payment orders"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Payment orders">
      <Suspense
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>}
      >
        <AdminPaymentOrdersPage initialLedger={initialLedger} />
      </Suspense>
    </AdminPageGate>
  );
}
