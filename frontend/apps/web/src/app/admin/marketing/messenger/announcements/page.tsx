import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AnnouncementsListPanel } from "../../../../../features/admin/grow/AnnouncementsListPanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminAnnouncementsPage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T78"
        state="denied"
        title="Announcements"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T78" state="ready" title="Announcements">
      <AnnouncementsListPanel />
    </AdminPageGate>
  );
}
