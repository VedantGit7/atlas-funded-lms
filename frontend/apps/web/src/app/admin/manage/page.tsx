import { redirect } from "next/navigation";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { ADMIN_MANAGE_DEFAULT_HREF } from "../../../features/admin/manage/admin-manage-catalog";
import { runTenantStateGate } from "../../../lib/server/tenant-state-gate";

export default async function AdminManageIndexPage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T58"
        state="denied"
        title="Manage"
        deniedMessage="This academy is not available."
      />
    );
  }

  redirect(ADMIN_MANAGE_DEFAULT_HREF);
}
