export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../../components/patterns/AdminPageGate";
import { AdminPaymentsInvoicePreviewPage } from "../../../../../../../features/admin/reports/AdminPaymentsInvoicePreviewPage";
import { runTenantStateGate } from "../../../../../../../lib/server/tenant-state-gate";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminOrderInvoiceRouteProps = {
  params: Promise<{ orderId: string }>;
};

/**
 * `/admin/reports/payments/orders/[orderId]/invoice`.
 *
 * The invoice for an order, reached from the Orders side. It renders the same
 * component as `/reports/payments/invoices/[orderId]` rather than a second
 * implementation: invoices are keyed by order id, so these are two entry points
 * to one document, and a copy would drift on the parts that matter — void
 * status, the download gate, the totals.
 */
export default async function AdminOrderInvoiceRoute({ params }: AdminOrderInvoiceRouteProps) {
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
        title="Invoice"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Invoice">
      <AdminPaymentsInvoicePreviewPage orderId={orderId} />
    </AdminPageGate>
  );
}
