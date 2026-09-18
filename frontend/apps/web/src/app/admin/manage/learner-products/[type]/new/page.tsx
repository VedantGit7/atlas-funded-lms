import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminLearnerProductNewPage } from "../../../../../../features/admin/learner-products/AdminLearnerProductNewPage";
import { isProductTypeSlug } from "../../../../../../features/admin/learner-products/learner-products-api";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type AdminLearnerProductNewRouteProps = {
  params: Promise<{ type: string }>;
};

/**
 * `/admin/manage/learner-products/[type]/new`.
 *
 * `new` is a static segment, so it takes precedence over the sibling
 * `[productId]` route and a product can never be named "new" its way into this
 * screen.
 */
export default async function AdminLearnerProductNewRoute({
  params,
}: AdminLearnerProductNewRouteProps) {
  const { type } = await params;
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
      <AdminLearnerProductNewPage type={type} />
    </AdminPageGate>
  );
}
