export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminAttributionExportsPage } from "../../../../../../features/admin/reports/AdminAttributionExportsPage";
import type { ReportSearchParams } from "../../../../../../lib/server/report-landing-initial-data";
import { loadAttributionExportSummaryData } from "../../../../../../lib/server/report-exports-initial-data";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

/**
 * `/admin/reports/sales-marketing/attribution/exports`.
 *
 * Exporting the log is the same read as listing it (`reports.run`), enforced by
 * the export route, so this gate only handles tenant availability.
 */
type Props = {
  searchParams: Promise<ReportSearchParams>;
};

export default async function AdminAttributionExportsRoutePage({ searchParams }: Props) {
  const [gate, initialSummary] = await Promise.all([
    runTenantStateGate(),
    searchParams.then(loadAttributionExportSummaryData),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Export attribution events"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Export attribution events">
      <AdminAttributionExportsPage initialSummary={initialSummary} />
    </AdminPageGate>
  );
}
