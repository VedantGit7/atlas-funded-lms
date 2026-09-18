import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminLearnerProductDetailPage } from "../../../../../../features/admin/learner-products/AdminLearnerProductDetailPage";
import { isProductTypeSlug } from "../../../../../../features/admin/learner-products/learner-products-api";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type AdminLearnerProductDetailRouteProps = {
  params: Promise<{ type: string; productId: string }>;
};

/**
 * `/admin/manage/learner-products/[type]/[productId]`.
 *
 * The type segment is validated here rather than inside the client component so
 * a hand-typed URL with an unknown product kind is a 404 from the server, not a
 * screen that renders chrome and then fails to fetch.
 */
export default async function AdminLearnerProductDetailRoute({
  params,
}: AdminLearnerProductDetailRouteProps) {
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
      <AdminLearnerProductDetailPage type={type} productId={productId} />
    </AdminPageGate>
  );
}
