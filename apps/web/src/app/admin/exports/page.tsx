import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { ExportJobsPanel } from "../../../features/data-rights/components/export-jobs-panel";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { ExportJobItem } from "../../../features/data-rights/api";

export default async function AdminExportsPage() {
  try {
    const exports = await serverApi.get<{
      data: { items: ExportJobItem[] };
    }>("/api/v1/exports");

    return (
      <PageGate state="ready" title="Data Exports">
        <main className="space-y-6">
          <PageHeader
            title="Data Exports"
            description="Run and download tenant-safe export jobs."
          />
          <ExportJobsPanel initialJobs={exports.data.items} canRunExport />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (
      error instanceof ServerApiError &&
      error.status === 403 &&
      error.code === "ENTITLEMENT_REQUIRED"
    ) {
      return (
        <PageGate
          state="denied"
          title="Data Exports"
          deniedMessage="Data export requires the data.export.enable entitlement."
        />
      );
    }

    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Data Exports"
          deniedMessage="You do not have permission to manage exports."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Data Exports"
          errorMessage={`Failed to load exports. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
