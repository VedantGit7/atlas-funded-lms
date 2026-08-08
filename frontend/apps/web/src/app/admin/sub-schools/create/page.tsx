import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { CreateSubSchoolPanel } from "../../../../features/admin/sub-schools/CreateSubSchoolPanel";

export default function AdminSubSchoolsCreatePage() {
  return (
    <AdminPageGate screenId="T59" state="ready" title="Create Sub-School">
      <CreateSubSchoolPanel />
    </AdminPageGate>
  );
}
