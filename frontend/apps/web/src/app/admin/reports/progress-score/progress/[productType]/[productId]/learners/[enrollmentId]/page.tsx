export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../../../../components/patterns/AdminPageGate";
import { AdminProgressLearnerDetailPage } from "../../../../../../../../../features/admin/reports/AdminProgressLearnerDetailPage";
import { runTenantStateGate } from "../../../../../../../../../lib/server/tenant-state-gate";

const PRODUCT_TYPES = new Set(["course", "test_series", "bundle", "subscription", "mock_test"]);

export default async function AdminProgressLearnerDetailRoutePage({
  params,
}: {
  params: Promise<{ productType: string; productId: string; enrollmentId: string }>;
}) {
  const { productType, productId, enrollmentId } = await params;
  const uuid = /^[0-9a-fA-F-]{36}$/;
  if (!PRODUCT_TYPES.has(productType) || !uuid.test(productId) || !uuid.test(enrollmentId)) {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T51"
        state="denied"
        title="Learner progress"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T51" state="ready" title="Learner progress">
      <AdminProgressLearnerDetailPage
        productType={
          productType as "course" | "test_series" | "bundle" | "subscription" | "mock_test"
        }
        productId={productId}
        enrollmentId={enrollmentId}
      />
    </AdminPageGate>
  );
}
