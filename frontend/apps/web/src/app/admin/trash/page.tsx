import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminTrashPanel } from "../../../features/admin/trash/AdminTrashPanel";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { ContentTrashListResponse } from "@atlas/contracts/content-trash/content-trash.contract";

export default async function AdminTrashPage() {
  try {
    const trash = await serverApi.get<ContentTrashListResponse>(
      "/api/v1/content-trash?kind=courses",
    );

    return (
      <AdminPageGate screenId="T46" state="ready" title="Trash">
        <AdminTrashPanel initial={trash.data} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T46"
          state="denied"
          title="Trash"
          deniedMessage="You do not have permission to view trash."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T46"
          state="error"
          title="Trash"
          errorMessage={`Failed to load trash. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
