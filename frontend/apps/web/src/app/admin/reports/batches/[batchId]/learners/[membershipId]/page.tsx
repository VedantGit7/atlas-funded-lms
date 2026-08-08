export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../../components/patterns/AdminPageGate";
import { AdminBatchLearnerDetailPage } from "../../../../../../../features/admin/reports/AdminBatchLearnerDetailPage";
import { runTenantStateGate } from "../../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ batchId: string; membershipId: string }>;
};

export default async function AdminBatchLearnerReportRoutePage({ params }: PageProps) {
  const { batchId, membershipId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Learner report"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Learner report">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading learner report…</p>
        }
      >
        <AdminBatchLearnerDetailPage batchId={batchId} membershipId={membershipId} />
      </Suspense>
    </AdminPageGate>
  );
}
