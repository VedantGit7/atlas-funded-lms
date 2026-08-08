import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { PushMessageListPanel } from "../../../../../features/admin/grow/PushMessageListPanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminPushMessagePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T70"
        state="denied"
        title="Push Message"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T70" state="ready" title="Push Message">
      <PushMessageListPanel />
    </AdminPageGate>
  );
}
