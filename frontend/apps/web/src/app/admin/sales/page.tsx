import { redirect } from "next/navigation";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { ADMIN_SALES_DEFAULT_HREF } from "../../../features/admin/grow/admin-sales-catalog";
import { runTenantStateGate } from "../../../lib/server/tenant-state-gate";

export default async function AdminSalesIndexPage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T67"
        state="denied"
        title="Sales"
        deniedMessage="This academy is not available."
      />
    );
  }

  redirect(ADMIN_SALES_DEFAULT_HREF);
}
