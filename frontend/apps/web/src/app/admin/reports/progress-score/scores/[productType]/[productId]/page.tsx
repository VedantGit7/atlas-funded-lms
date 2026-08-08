export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminScoresAssessmentListPage } from "../../../../../../features/admin/reports/AdminScoresAssessmentListPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

const PRODUCT_TYPES = new Set(["course", "test_series", "bundle", "mock_test"]);

export default async function AdminScoresAssessmentListRoutePage({
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
        title="Assessment scores"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Assessment scores">
      <AdminScoresAssessmentListPage
        productType={productType as "course" | "test_series" | "bundle" | "mock_test"}
        productId={productId}
      />
    </AdminPageGate>
  );
}
