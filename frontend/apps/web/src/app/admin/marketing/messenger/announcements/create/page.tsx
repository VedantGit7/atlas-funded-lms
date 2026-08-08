import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AnnouncementsCreatePanel } from "../../../../../../features/admin/grow/AnnouncementsCreatePanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

export default async function AdminAnnouncementsCreatePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T79"
        state="denied"
        title="Create Announcements"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T79" state="ready" title="Create Announcements">
      <AnnouncementsCreatePanel />
    </AdminPageGate>
  );
}
