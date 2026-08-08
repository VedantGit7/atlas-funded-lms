import type { AuditListResponse } from "@atlas/contracts/audit/audit";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AuditLogViewer } from "../../../features/admin/audit/AuditLogViewer";
import { ServerApiError, serverApi } from "../../../lib/server-api";

export default async function AdminAuditPage() {
  try {
    const audit = await serverApi.get<AuditListResponse>("/api/v1/audit?limit=50");
    const actionOptions = [...new Set(audit.data.map((entry) => entry.action))].sort();

    return (
      <AdminPageGate screenId="T22" state="ready" title="Audit Log">
        <div className="mx-auto max-w-7xl">
          <AuditLogViewer
            initialEntries={audit.data}
            initialNextCursor={audit.page.nextCursor}
            initialHasMore={audit.page.hasMore}
            actionOptions={actionOptions}
          />
        </div>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T22"
          state="denied"
          title="Audit Log"
          deniedMessage="You do not have permission to view the tenant audit log."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T22"
          state="error"
          title="Audit Log"
          errorMessage={`Failed to load audit log. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
