export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminBatchContentPage } from "../../../../../../features/admin/reports/AdminBatchContentPage";
import type { ReportSearchParams } from "../../../../../../lib/server/report-landing-initial-data";
import { loadBatchContentData } from "../../../../../../lib/server/report-batches-initial-data";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<ReportSearchParams>;
};

export default async function AdminBatchContentRoutePage({ params, searchParams }: PageProps) {
  const { batchId } = await params;
  const [gate, initial] = await Promise.all([
    runTenantStateGate(),
    searchParams.then((search) => loadBatchContentData(batchId, search)),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Content completion"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Content completion">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Loading content completion…
          </p>
        }
      >
        <AdminBatchContentPage
          batchId={batchId}
          initialReport={initial.report}
          initialLearners={initial.learners}
        />
      </Suspense>
    </AdminPageGate>
  );
}
