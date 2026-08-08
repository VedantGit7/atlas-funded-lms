import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { AdminOtpPanel } from "../../../../features/admin/security-settings/AdminOtpPanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

type Response = { data: { enabled: boolean; loginLimitPerMonth: number } };

export default async function AdminOtpPageRoute() {
  try {
    const response = await serverApi.get<Response>("/api/v1/tenant-settings/admin-otp");

    return (
      <AdminPageGate screenId="T41" state="ready" title="Admin OTP">
        <AdminOtpPanel initial={response.data} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T41"
          state="denied"
          title="Admin OTP"
          deniedMessage="You do not have permission to manage admin OTP."
        />
      );
    }
    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T41"
          state="error"
          title="Admin OTP"
          errorMessage={`Failed to load settings. Request ID: ${error.requestId}`}
        />
      );
    }
    throw error;
  }
}
