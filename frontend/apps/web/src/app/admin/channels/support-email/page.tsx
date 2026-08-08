import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { EmailChannelPanel } from "../../../../features/admin/channel-settings/EmailChannelPanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

type Response = { data: { fromName: string; fromEmail: string; replyToEmail: string | null } };

export default async function SupportEmailPageRoute() {
  try {
    const response = await serverApi.get<Response>("/api/v1/tenant-settings/support-email");

    return (
      <AdminPageGate screenId="T45" state="ready" title="Support Email">
        <EmailChannelPanel
          title="Support Email"
          description="Configure support email details to send support responses."
          endpoint="/api/v1/tenant-settings/support-email"
          idempotencyPrefix="support-email-update"
          initial={response.data}
        />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T45"
          state="denied"
          title="Support Email"
          deniedMessage="You do not have permission to manage support email."
        />
      );
    }
    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T45"
          state="error"
          title="Support Email"
          errorMessage={`Failed to load settings. Request ID: ${error.requestId}`}
        />
      );
    }
    throw error;
  }
}
