export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminPaymentOrderDetailPage } from "../../../../../../features/admin/reports/AdminPaymentOrderDetailPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminPaymentOrderDetailRouteProps = {
  params: Promise<{ orderId: string }>;
};

/**
 * `/admin/reports/payments/orders/[orderId]`.
 *
 * Sibling to the static `new` segment, which Next resolves first. The id is
 * shape-checked here rather than left to the API: a non-uuid path is a bad
 * link, and a 404 is a truer answer than a validation error from an endpoint.
 */
export default async function AdminPaymentOrderDetailRoute({
  params,
}: AdminPaymentOrderDetailRouteProps) {
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
        title="Payment order"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Payment order">
      <AdminPaymentOrderDetailPage orderId={orderId} />
    </AdminPageGate>
  );
}
