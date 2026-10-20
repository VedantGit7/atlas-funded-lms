export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminAttributionSourcesPage } from "../../../../../../features/admin/reports/AdminAttributionSourcesPage";
import type { ReportSearchParams } from "../../../../../../lib/server/report-landing-initial-data";
import { loadAttributionBreakdownData } from "../../../../../../lib/server/report-attribution-initial-data";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

/**
 * `/admin/reports/sales-marketing/attribution/sources`.
 *
 * Grouping the log is the same read as listing it (`reports.run`), enforced by
 * the breakdown route, so this gate only handles tenant availability.
 */
type Props = {
  searchParams: Promise<ReportSearchParams>;
};

export default async function AdminAttributionSourcesRoutePage({ searchParams }: Props) {
  const [gate, initialBreakdown] = await Promise.all([
    runTenantStateGate(),
    searchParams.then(loadAttributionBreakdownData),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Source breakdown"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Source breakdown">
      <AdminAttributionSourcesPage initialBreakdown={initialBreakdown} />
    </AdminPageGate>
  );
}
