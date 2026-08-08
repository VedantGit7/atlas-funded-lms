export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../../components/patterns/AdminPageGate";
import { AdminPollOptionDetailPage } from "../../../../../../../features/admin/reports/AdminPollOptionDetailPage";
import { runTenantStateGate } from "../../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ pollId: string; optionId: string }>;
};

export default async function AdminPollOptionReportRoutePage({ params }: PageProps) {
  const { pollId, optionId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Option report"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Option report">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Loading option report…
          </p>
        }
      >
        <AdminPollOptionDetailPage pollId={pollId} optionId={optionId} />
      </Suspense>
    </AdminPageGate>
  );
}
