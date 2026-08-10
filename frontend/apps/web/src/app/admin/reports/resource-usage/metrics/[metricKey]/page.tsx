export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminResourceUsageMetricDetailPage } from "../../../../../../features/admin/reports/AdminResourceUsageMetricDetailPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ metricKey: string }>;
};

export default async function AdminResourceUsageMetricRoutePage({ params }: PageProps) {
  const { metricKey } = await params;
  const decodedKey = decodeURIComponent(metricKey);
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Metric detail"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Metric detail">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading metric...</p>
        }
      >
        <AdminResourceUsageMetricDetailPage metricKey={decodedKey} />
      </Suspense>
    </AdminPageGate>
  );
}
