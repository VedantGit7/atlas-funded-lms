import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminCustomFieldsPanel } from "../../../features/admin/domain/AdminCustomFieldsPanel";

export default function AdminCustomFieldsPage() {
  return (
    <AdminPageGate screenId="T55" state="ready" title="Custom Fields">
      <AdminCustomFieldsPanel />
    </AdminPageGate>
  );
}
