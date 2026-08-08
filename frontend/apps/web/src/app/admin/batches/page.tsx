import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminBatchesPanel } from "../../../features/admin/domain/AdminBatchesPanel";

export default function AdminBatchesPage() {
  return (
    <AdminPageGate screenId="T52" state="ready" title="Batches">
      <AdminBatchesPanel />
    </AdminPageGate>
  );
}
