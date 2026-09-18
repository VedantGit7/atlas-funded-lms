export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../../components/patterns/AdminPageGate";
import { AdminPaymentOrderRefundPage } from "../../../../../../../features/admin/reports/AdminPaymentOrderRefundPage";
import { runTenantStateGate } from "../../../../../../../lib/server/tenant-state-gate";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminPaymentOrderRefundRouteProps = {
  params: Promise<{ orderId: string }>;
};

/**
 * `/admin/reports/payments/orders/[orderId]/refund`.
 *
 * Whether the payment can actually be refunded is decided by the transaction
 * behind it, not by this gate — the page reads that and says so, because the
 * refundable balance is the endpoint's to determine.
 */
export default async function AdminPaymentOrderRefundRoute({
  params,
}: AdminPaymentOrderRefundRouteProps) {
  const { orderId } = await params;
  if (!UUID_PATTERN.test(orderId)) {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Refund payment"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Refund payment">
      <AdminPaymentOrderRefundPage orderId={orderId} />
    </AdminPageGate>
  );
}
