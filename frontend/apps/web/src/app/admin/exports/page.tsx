import Link from "next/link";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { ExportJobsPanel } from "../../../features/data-rights/components/export-jobs-panel";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { ExportJobItem } from "../../../features/data-rights/api";
import { notOnPlanMessage } from "@/lib/plan-messages";

export default async function AdminExportsPage() {
  try {
    const exports = await serverApi.get<{
      data: { items: ExportJobItem[] };
    }>("/api/v1/exports");

    return (
      <AdminPageGate screenId="T23" state="ready" title="Academy data snapshot">
        <main>
          <ExportJobsPanel initialJobs={exports.data.items} canRunExport />
        </main>
      </AdminPageGate>
    );
  } catch (error) {
    if (
      error instanceof ServerApiError &&
      error.status === 403 &&
      error.code === "ENTITLEMENT_REQUIRED"
    ) {
      // Only the academy data snapshot is off. Members, enrollments,
      // payments and the other reports export from the export centre, so say
      // where to go instead of "export is off" (QA review 1 M15).
      return (
        <AdminPageGate screenId="T23" state="ready" title="Academy data snapshot">
          <main className="mx-auto max-w-2xl space-y-4 py-6">
            <h1 className="text-2xl font-bold text-[var(--admin-on-surface)]">
              Academy data snapshot
            </h1>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              {notOnPlanMessage("Academy data snapshots", { plural: true })}
            </p>
            <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Download members, enrollments and other reports
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Every report exports to CSV or Excel from the export centre, with a history of what
                was downloaded and when.
              </p>
              <Link
                href="/admin/reports/exports"
                prefetch={false}
                className="mt-4 inline-flex items-center rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] hover:opacity-90"
              >
                Open the export centre
              </Link>
            </div>
          </main>
        </AdminPageGate>
      );
    }

    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T23"
          state="denied"
          title="Academy data snapshot"
          deniedMessage="You do not have permission to manage exports."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T23"
          state="error"
          title="Academy data snapshot"
          errorMessage={`Failed to load exports. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
