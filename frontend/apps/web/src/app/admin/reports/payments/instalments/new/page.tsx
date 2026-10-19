export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminPaymentsInstalmentPlanCreatePage } from "../../../../../../features/admin/reports/AdminPaymentsInstalmentPlanCreatePage";
import { loadPaymentInstalmentCoursesData } from "../../../../../../lib/server/report-payments-initial-data";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

export default async function AdminPaymentsInstalmentPlanCreateRoutePage() {
  const [gate, initialCourses] = await Promise.all([
    runTenantStateGate(),
    loadPaymentInstalmentCoursesData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Create instalment plan"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Create instalment plan">
      <AdminPaymentsInstalmentPlanCreatePage initialCourses={initialCourses} />
    </AdminPageGate>
  );
}
