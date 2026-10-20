export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminAttributionEventsPage } from "../../../../../features/admin/reports/AdminAttributionEventsPage";
import type { ReportSearchParams } from "../../../../../lib/server/report-landing-initial-data";
import { loadAttributionLogData } from "../../../../../lib/server/report-attribution-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type Props = {
  searchParams: Promise<ReportSearchParams>;
};

export default async function AdminSalesMarketingAttributionRoutePage({ searchParams }: Props) {
  const [gate, initialLog] = await Promise.all([
    runTenantStateGate(),
    searchParams.then(loadAttributionLogData),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Attribution"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Attribution">
      <Suspense
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>}
      >
        <AdminAttributionEventsPage initialLog={initialLog} />
      </Suspense>
    </AdminPageGate>
  );
}
