export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminPaymentsExportsPage } from "../../../../../features/admin/reports/AdminPaymentsExportsPage";
import type { PaymentExportsPayload } from "../../../../../features/admin/reports/admin-payments-exports-api";
import { loadReportInitialData } from "../../../../../lib/server/report-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminPaymentsExportsRoutePage() {
  const [gate, initialExports] = await Promise.all([
    runTenantStateGate(),
    loadReportInitialData<PaymentExportsPayload>("/api/v1/reports/payments/exports"),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Exports"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Exports">
      <AdminPaymentsExportsPage initialExports={initialExports} />
    </AdminPageGate>
  );
}
