import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { CouponCreatePanel } from "../../../../../features/admin/grow/CouponCreatePanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminCouponCreatePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T99"
        state="denied"
        title="Create Coupon"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T99" state="ready" title="Create Coupon">
      <CouponCreatePanel />
    </AdminPageGate>
  );
}
