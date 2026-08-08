import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { PromoSliderCreatePanel } from "../../../../../features/admin/grow/PromoSliderCreatePanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminPromoSliderCreatePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T93"
        state="denied"
        title="Create Promo Slider"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T93" state="ready" title="Create Promo Slider">
      <PromoSliderCreatePanel />
    </AdminPageGate>
  );
}
