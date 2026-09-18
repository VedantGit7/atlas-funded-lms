export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminAttributionEventDetailPage } from "../../../../../../features/admin/reports/AdminAttributionEventDetailPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminAttributionEventRouteProps = {
  params: Promise<{ eventId: string }>;
};

/**
 * `/admin/reports/sales-marketing/attribution/[eventId]`.
 *
 * Reading one event is the same read as reading the log (`reports.run`),
 * enforced by the route, so this gate only handles tenant availability. A
 * malformed id is rejected here rather than sent to the API, which would answer
 * with a validation error instead of the not-found the operator expects.
 */
export default async function AdminAttributionEventRoute({
  params,
}: AdminAttributionEventRouteProps) {
  const { eventId } = await params;
  if (!UUID_PATTERN.test(eventId)) {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Attribution event"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Attribution event">
      <AdminAttributionEventDetailPage eventId={eventId} />
    </AdminPageGate>
  );
}
