import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminInsightsHomeRedirect } from "../../../features/admin/insights/AdminInsightsHomeRedirect";
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

  return (
    <AdminPageGate screenId="T49" state="ready" title="Insights">
      <AdminInsightsHomeRedirect />
    </AdminPageGate>
  );
}
