import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { CouponBuilderPanel } from "../../../../../../features/admin/grow/CouponBuilderPanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type AdminCouponEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminCouponEditPage({ params }: AdminCouponEditPageProps) {
  const { id } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T100"
        state="denied"
        title="Edit Coupon"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T100" state="ready" title="Edit Coupon">
      <CouponBuilderPanel couponId={id} />
    </AdminPageGate>
  );
}
