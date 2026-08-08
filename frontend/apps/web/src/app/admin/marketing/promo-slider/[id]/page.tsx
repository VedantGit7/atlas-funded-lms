import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { PromoSliderBuilderPanel } from "../../../../../features/admin/grow/PromoSliderBuilderPanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminPromoSliderBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T94"
        state="denied"
        title="Promo Slider"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T94" state="ready" title="Promo Slider">
      <PromoSliderBuilderPanel sliderId={id} />
    </AdminPageGate>
  );
}
