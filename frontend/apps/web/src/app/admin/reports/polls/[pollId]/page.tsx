export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminPollDetailPage } from "../../../../../features/admin/reports/AdminPollDetailPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ pollId: string }>;
};

export default async function AdminPollReportRoutePage({ params }: PageProps) {
  const { pollId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Poll report"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Poll report">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading poll report…</p>
        }
      >
        <AdminPollDetailPage pollId={pollId} />
      </Suspense>
    </AdminPageGate>
  );
}
