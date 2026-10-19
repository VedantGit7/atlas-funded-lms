export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminPaymentsGatewayDetailPage } from "../../../../../../features/admin/reports/AdminPaymentsGatewayDetailPage";
import { loadPaymentGatewayData } from "../../../../../../lib/server/report-payments-initial-data";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type Props = {
  params: Promise<{ gatewayKey: string }>;
};

export default async function AdminPaymentsGatewayDetailRoutePage({ params }: Props) {
  const { gatewayKey } = await params;
  const decoded = decodeURIComponent(gatewayKey);
  const [gate, initial] = await Promise.all([
    runTenantStateGate(),
    loadPaymentGatewayData(decoded),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Gateway details"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Gateway details">
      <AdminPaymentsGatewayDetailPage
        gatewayKey={decoded}
        initialDetail={initial.detail}
        initialTransactions={initial.transactions}
      />
    </AdminPageGate>
  );
}
