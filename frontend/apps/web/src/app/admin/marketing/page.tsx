import { redirect } from "next/navigation";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { ADMIN_MARKETING_DEFAULT_HREF } from "../../../features/admin/grow/admin-marketing-catalog";
import { runTenantStateGate } from "../../../lib/server/tenant-state-gate";

export default async function AdminMarketingIndexPage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T66"
        state="denied"
        title="Marketing"
        deniedMessage="This academy is not available."
      />
    );
  }

  redirect(ADMIN_MARKETING_DEFAULT_HREF);
}
