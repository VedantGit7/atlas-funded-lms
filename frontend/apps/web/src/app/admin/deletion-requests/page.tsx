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
      <AdminPageGate screenId="T24" state="ready" title="Data deletion">
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
          title="Data deletion"
          deniedMessage="You do not have permission to manage data deletion requests."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T24"
          state="error"
          title="Data deletion"
          errorMessage={`Failed to load data deletion requests. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
