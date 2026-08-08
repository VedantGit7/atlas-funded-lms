import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { EventsBuilderPanel } from "../../../../../features/admin/grow/EventsBuilderPanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminEventsBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T96"
        state="denied"
        title="Event"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T96" state="ready" title="Event">
      <EventsBuilderPanel eventId={id} />
    </AdminPageGate>
  );
}
