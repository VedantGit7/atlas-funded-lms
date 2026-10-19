export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminBatchDetailPage } from "../../../../../features/admin/reports/AdminBatchDetailPage";
import type { ReportSearchParams } from "../../../../../lib/server/report-landing-initial-data";
import { loadBatchDetailData } from "../../../../../lib/server/report-batches-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<ReportSearchParams>;
};

export default async function AdminBatchReportRoutePage({ params, searchParams }: PageProps) {
  const { batchId } = await params;
  const [gate, initial] = await Promise.all([
    runTenantStateGate(),
    searchParams.then((search) => loadBatchDetailData(batchId, search)),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Batch report"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Batch report">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading batch report…</p>
        }
      >
        <AdminBatchDetailPage
          batchId={batchId}
          initialDetail={initial.detail}
          initialLearners={initial.learners}
        />
      </Suspense>
    </AdminPageGate>
  );
}
