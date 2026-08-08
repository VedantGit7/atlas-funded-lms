export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminPaymentsInstalmentPlanDetailPage } from "../../../../../../features/admin/reports/AdminPaymentsInstalmentPlanDetailPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type Props = {
  params: Promise<{ planId: string }>;
};

export default async function AdminPaymentsInstalmentPlanDetailRoutePage({ params }: Props) {
  const { planId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Instalment plan"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Instalment plan">
      <AdminPaymentsInstalmentPlanDetailPage planId={planId} />
    </AdminPageGate>
  );
}
