export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminPollNonRespondentsPage } from "../../../../../../features/admin/reports/AdminPollNonRespondentsPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ pollId: string }>;
};

export default async function AdminPollNonRespondentsRoutePage({ params }: PageProps) {
  const { pollId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Non-respondents"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Non-respondents">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Loading non-respondents…
          </p>
        }
      >
        <AdminPollNonRespondentsPage pollId={pollId} />
      </Suspense>
    </AdminPageGate>
  );
}
