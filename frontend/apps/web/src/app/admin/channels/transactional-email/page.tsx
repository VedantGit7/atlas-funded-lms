import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { EmailChannelPanel } from "../../../../features/admin/channel-settings/EmailChannelPanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

type Response = { data: { fromName: string; fromEmail: string; replyToEmail: string | null } };

export default async function TransactionalEmailPageRoute() {
  try {
    const response = await serverApi.get<Response>("/api/v1/tenant-settings/transactional-email");

    return (
      <AdminPageGate screenId="T43" state="ready" title="Transactional Email">
        <EmailChannelPanel
          title="Transactional Email"
          description="Configure details for sending transactional emails."
          endpoint="/api/v1/tenant-settings/transactional-email"
          idempotencyPrefix="transactional-email-update"
          initial={response.data}
        />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T43"
          state="denied"
          title="Transactional Email"
          deniedMessage="You do not have permission to manage transactional email."
        />
      );
    }
    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T43"
          state="error"
          title="Transactional Email"
          errorMessage={`Failed to load settings. Request ID: ${error.requestId}`}
        />
      );
    }
    throw error;
  }
}
