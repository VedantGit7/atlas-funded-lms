export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminPaymentOrderNewPage } from "../../../../../../features/admin/reports/AdminPaymentOrderNewPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

/**
 * `/admin/reports/payments/orders/new`.
 *
 * The permission that actually gates recording (`config.update`) is checked by
 * the create route and mirrored into the page's capability read, so this gate
 * only handles tenant availability.
 */
export default async function AdminPaymentOrderNewRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Record a manual order"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Record a manual order">
      <AdminPaymentOrderNewPage />
    </AdminPageGate>
  );
}
