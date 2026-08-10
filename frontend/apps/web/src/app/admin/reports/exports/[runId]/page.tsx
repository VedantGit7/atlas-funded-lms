export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminExportRunDetailPage } from "../../../../../features/admin/reports/AdminExportRunDetailPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ runId: string }>;
};

export default async function AdminExportRunDetailRoutePage({ params }: PageProps) {
  const { runId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Export run"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title={`Export ${runId}`}>
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading export run…</p>
        }
      >
        <AdminExportRunDetailPage />
      </Suspense>
    </AdminPageGate>
  );
}
