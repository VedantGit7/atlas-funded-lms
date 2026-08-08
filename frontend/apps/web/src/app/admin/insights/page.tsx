import { redirect } from "next/navigation";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { ADMIN_INSIGHTS_DEFAULT_HREF } from "../../../features/admin/insights/admin-insights-catalog";
import { runTenantStateGate } from "../../../lib/server/tenant-state-gate";

export default async function AdminInsightsIndexPage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T49"
        state="denied"
        title="Insights"
        deniedMessage="This academy is not available."
      />
    );
  }

  redirect(ADMIN_INSIGHTS_DEFAULT_HREF);
}
