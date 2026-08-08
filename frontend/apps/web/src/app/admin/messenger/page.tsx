import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { ManageLearnerSupportPanel } from "../../../features/admin/manage/ManageLearnerSupportPanel";

export default function AdminMessengerPage() {
  return (
    <AdminPageGate screenId="T56" state="ready" title="Messenger">
      <ManageLearnerSupportPanel />
    </AdminPageGate>
  );
}
