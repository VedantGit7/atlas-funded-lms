import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../../components/patterns/AdminPageGate";
import { AdminLearnerProductContentsPage } from "../../../../../../../features/admin/learner-products/AdminLearnerProductContentsPage";
import { isProductTypeSlug } from "../../../../../../../features/admin/learner-products/learner-products-api";
import { runTenantStateGate } from "../../../../../../../lib/server/tenant-state-gate";

type AdminLearnerProductContentsRouteProps = {
  params: Promise<{ type: string; productId: string }>;
};

/** `/admin/manage/learner-products/[type]/[productId]/contents`. */
export default async function AdminLearnerProductContentsRoute({
  params,
}: AdminLearnerProductContentsRouteProps) {
  const { type, productId } = await params;
  if (!isProductTypeSlug(type)) {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T60"
        state="denied"
        title="Learner Products"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T60" state="ready" title="Learner Products">
      <AdminLearnerProductContentsPage type={type} productId={productId} />
    </AdminPageGate>
  );
}
