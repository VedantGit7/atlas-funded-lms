export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminBatchContentPage } from "../../../../../../features/admin/reports/AdminBatchContentPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ batchId: string }>;
};

export default async function AdminBatchContentRoutePage({ params }: PageProps) {
  const { batchId } = await params;
  const gate = await runTenantStateGate();
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
        <AdminBatchContentPage batchId={batchId} />
      </Suspense>
    </AdminPageGate>
  );
}
