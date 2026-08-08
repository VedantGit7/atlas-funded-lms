import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { NewsfeedCreatePanel } from "../../../../../features/admin/grow/NewsfeedCreatePanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminNewsfeedCreatePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T97"
        state="denied"
        title="Create Newsfeed Post"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T97" state="ready" title="Create Newsfeed Post">
      <NewsfeedCreatePanel />
    </AdminPageGate>
  );
}
