import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { EventsCreatePanel } from "../../../../../features/admin/grow/EventsCreatePanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminEventsCreatePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T95"
        state="denied"
        title="Create Event"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T95" state="ready" title="Create Event">
      <EventsCreatePanel />
    </AdminPageGate>
  );
}
