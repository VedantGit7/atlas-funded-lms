import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../../components/patterns/AdminPageGate";
import { AdminLearnerProductEnrollmentsPage } from "../../../../../../../features/admin/learner-products/AdminLearnerProductEnrollmentsPage";
import { isProductTypeSlug } from "../../../../../../../features/admin/learner-products/learner-products-api";
import { runTenantStateGate } from "../../../../../../../lib/server/tenant-state-gate";

type AdminLearnerProductEnrollmentsRouteProps = {
  params: Promise<{ type: string; productId: string }>;
};

/** `/admin/manage/learner-products/[type]/[productId]/enrollments`. */
export default async function AdminLearnerProductEnrollmentsRoute({
  params,
}: AdminLearnerProductEnrollmentsRouteProps) {
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
      <AdminLearnerProductEnrollmentsPage type={type} productId={productId} />
    </AdminPageGate>
  );
}
