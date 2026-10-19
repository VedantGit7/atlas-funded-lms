export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminPaymentsInvoicePreviewPage } from "../../../../../../features/admin/reports/AdminPaymentsInvoicePreviewPage";
import { loadPaymentInvoiceData } from "../../../../../../lib/server/report-payments-initial-data";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type Props = {
  /** Invoices are keyed by the order they belong to, not by invoice number. */
  params: Promise<{ orderId: string }>;
};

export default async function AdminPaymentsInvoicePreviewRoutePage({ params }: Props) {
  const { orderId } = await params;
  const [gate, initialInvoice] = await Promise.all([
    runTenantStateGate(),
    loadPaymentInvoiceData(orderId),
  ]);
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
      <AdminPaymentsInvoicePreviewPage orderId={orderId} initialInvoice={initialInvoice} />
    </AdminPageGate>
  );
}
