import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { TrashActivityLogPanel } from "../../../../features/admin/trash/TrashActivityLogPanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { ContentTrashActivityResponse } from "@atlas/contracts/admin/content-trash-activity.dto";

export default async function AdminTrashActivityPage() {
  try {
    const activity = await serverApi.get<ContentTrashActivityResponse>(
      "/api/v1/content-trash/activity?limit=50",
    );

    return (
      <AdminPageGate screenId="T47" state="ready" title="Activity Log">
        <TrashActivityLogPanel initialItems={activity.data.items} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T47"
          state="denied"
          title="Activity Log"
          deniedMessage="You do not have permission to view trash activity."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T47"
          state="error"
          title="Activity Log"
          errorMessage={`Failed to load activity. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
