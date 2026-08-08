import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminLiveSessionsPanel } from "../../../features/admin/domain/AdminLiveSessionsPanel";

export default function AdminLiveSessionsPage() {
  return (
    <AdminPageGate screenId="T54" state="ready" title="Live Sessions">
      <AdminLiveSessionsPanel />
    </AdminPageGate>
  );
}
