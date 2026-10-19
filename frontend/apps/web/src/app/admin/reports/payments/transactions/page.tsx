export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminPaymentsTransactionsLedgerPage } from "../../../../../features/admin/reports/AdminPaymentsTransactionsLedgerPage";
import {
  searchParam,
  type ReportSearchParams,
} from "../../../../../lib/server/report-landing-initial-data";
import { loadPaymentTransactionsData } from "../../../../../lib/server/report-payments-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type Props = {
  searchParams: Promise<ReportSearchParams>;
};

export default async function AdminPaymentsTransactionsRoutePage({ searchParams }: Props) {
  const [gate, initial] = await Promise.all([
    runTenantStateGate(),
    searchParams.then((params) => loadPaymentTransactionsData(searchParam(params, "gateway"))),
  ]);
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
        <AdminPaymentsTransactionsLedgerPage
          initialTransactions={initial.transactions}
          initialGateways={initial.gateways}
        />
      </Suspense>
    </AdminPageGate>
  );
}
