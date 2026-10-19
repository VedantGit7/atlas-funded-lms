export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminPaymentTransactionDetailPage } from "../../../../../../features/admin/reports/AdminPaymentTransactionDetailPage";
import { loadPaymentTransactionDetailData } from "../../../../../../lib/server/report-payments-initial-data";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type Props = {
  params: Promise<{ orderId: string }>;
};

export default async function AdminPaymentTransactionDetailRoutePage({ params }: Props) {
  const { orderId } = await params;
  const [gate, initialDetail] = await Promise.all([
    runTenantStateGate(),
    loadPaymentTransactionDetailData(orderId),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Transaction"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Transaction detail">
      <AdminPaymentTransactionDetailPage orderId={orderId} initialDetail={initialDetail} />
    </AdminPageGate>
  );
}
