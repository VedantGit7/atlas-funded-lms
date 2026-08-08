export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminProgressLearnerRosterPage } from "../../../../../../features/admin/reports/AdminProgressLearnerRosterPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

const PRODUCT_TYPES = new Set(["course", "test_series", "bundle", "subscription"]);

export default async function AdminProgressLearnerRosterRoutePage({
  params,
}: {
  params: Promise<{ productType: string; productId: string }>;
}) {
  const { productType, productId } = await params;
  if (!PRODUCT_TYPES.has(productType) || !/^[0-9a-fA-F-]{36}$/.test(productId)) {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Learner progress"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Learner progress">
      <AdminProgressLearnerRosterPage
        productType={productType as "course" | "test_series" | "bundle" | "subscription"}
        productId={productId}
      />
    </AdminPageGate>
  );
}
