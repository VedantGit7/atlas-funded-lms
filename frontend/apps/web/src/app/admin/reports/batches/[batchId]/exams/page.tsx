export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminBatchExamsPage } from "../../../../../../features/admin/reports/AdminBatchExamsPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ batchId: string }>;
};

export default async function AdminBatchExamsRoutePage({ params }: PageProps) {
  const { batchId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Exams"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Exams">
      <Suspense
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading exams…</p>}
      >
        <AdminBatchExamsPage batchId={batchId} />
      </Suspense>
    </AdminPageGate>
  );
}
