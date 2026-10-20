export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminExportRunDetailPage } from "../../../../../features/admin/reports/AdminExportRunDetailPage";
import type { ReportSearchParams } from "../../../../../lib/server/report-landing-initial-data";
import { loadExportRunData } from "../../../../../lib/server/report-exports-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ runId: string }>;
  searchParams: Promise<ReportSearchParams>;
};

export default async function AdminExportRunDetailRoutePage({ params, searchParams }: PageProps) {
  const { runId } = await params;
  const decoded = decodeURIComponent(runId);
  const [gate, initialDetail] = await Promise.all([
    runTenantStateGate(),
    searchParams.then((query) => loadExportRunData(decoded, query)),
  ]);
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
        <AdminExportRunDetailPage runId={decoded} initialDetail={initialDetail} />
      </Suspense>
    </AdminPageGate>
  );
}
