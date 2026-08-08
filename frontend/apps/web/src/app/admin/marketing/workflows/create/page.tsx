import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { WorkflowsCreatePanel } from "../../../../../features/admin/grow/WorkflowsCreatePanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminWorkflowsCreatePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T85"
        state="denied"
        title="Create Workflow"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T85" state="ready" title="Create Workflow">
      <WorkflowsCreatePanel />
    </AdminPageGate>
  );
}
