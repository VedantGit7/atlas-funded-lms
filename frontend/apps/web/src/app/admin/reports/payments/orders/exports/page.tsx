export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminPaymentOrderExportsPage } from "../../../../../../features/admin/reports/AdminPaymentOrderExportsPage";
import type { ReportSearchParams } from "../../../../../../lib/server/report-landing-initial-data";
import { loadPaymentOrderExportSummaryData } from "../../../../../../lib/server/report-payments-initial-data";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

/**
 * `/admin/reports/payments/orders/exports`.
 *
 * Exporting the ledger is the same read as listing it (`reports.run`), enforced
 * by the export route, so this gate only handles tenant availability.
 */
type Props = {
  searchParams: Promise<ReportSearchParams>;
};

export default async function AdminPaymentOrderExportsRoutePage({ searchParams }: Props) {
  const [gate, initialSummary] = await Promise.all([
    runTenantStateGate(),
    searchParams.then(loadPaymentOrderExportSummaryData),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Export payment orders"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Export payment orders">
      <AdminPaymentOrderExportsPage initialSummary={initialSummary} />
    </AdminPageGate>
  );
}
