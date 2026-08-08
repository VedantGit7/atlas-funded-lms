import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminPollsPanel } from "../../../features/admin/domain/AdminPollsPanel";

export default function AdminPollsPage() {
  return (
    <AdminPageGate screenId="T53" state="ready" title="Polls">
      <AdminPollsPanel />
    </AdminPageGate>
  );
}
