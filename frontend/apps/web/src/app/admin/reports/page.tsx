import { redirect } from "next/navigation";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { ADMIN_REPORTS_DEFAULT_HREF } from "../../../features/admin/reports/admin-reports-catalog";
import { runTenantStateGate } from "../../../lib/server/tenant-state-gate";

export default async function AdminReportsIndexPage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T48"
        state="denied"
        title="Reports"
        deniedMessage="This academy is not available."
      />
    );
  }

  redirect(ADMIN_REPORTS_DEFAULT_HREF);
}
