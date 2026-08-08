import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { EmailChannelPanel } from "../../../../features/admin/channel-settings/EmailChannelPanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

type Response = { data: { fromName: string; fromEmail: string; replyToEmail: string | null } };

export default async function MarketingEmailPageRoute() {
  try {
    const response = await serverApi.get<Response>("/api/v1/tenant-settings/marketing-email");

    return (
      <AdminPageGate screenId="T44" state="ready" title="Marketing Email">
        <EmailChannelPanel
          title="Marketing Email"
          description="Configure details for sending marketing emails."
          endpoint="/api/v1/tenant-settings/marketing-email"
          idempotencyPrefix="marketing-email-update"
          initial={response.data}
        />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T44"
          state="denied"
          title="Marketing Email"
          deniedMessage="You do not have permission to manage marketing email."
        />
      );
    }
    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T44"
          state="error"
          title="Marketing Email"
          errorMessage={`Failed to load settings. Request ID: ${error.requestId}`}
        />
      );
    }
    throw error;
  }
}
