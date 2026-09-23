import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { DeletionRequestsPanel } from "../../../features/data-rights/components/deletion-requests-panel";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { DeletionRequestItem } from "../../../features/data-rights/api";

export default async function AdminDeletionRequestsPage() {
  try {
    const requests = await serverApi.get<{
      data: { items: DeletionRequestItem[] };
    }>("/api/v1/deletion-requests");

    return (
      <AdminPageGate screenId="T24" state="ready" title="School-access removal">
        <main>
          <DeletionRequestsPanel initialRequests={requests.data.items} canManage canFileForOthers />
        </main>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T24"
          state="denied"
          title="School-access removal"
          deniedMessage="You do not have permission to manage school-access removal requests."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T24"
          state="error"
          title="School-access removal"
          errorMessage={`Failed to load school-access removal requests. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
