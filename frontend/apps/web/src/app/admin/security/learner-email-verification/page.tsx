import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { LearnerEmailVerificationPanel } from "../../../../features/admin/security-settings/LearnerEmailVerificationPanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

type Response = { data: { verificationDays: number } };

export default async function LearnerEmailVerificationPageRoute() {
  try {
    const response = await serverApi.get<Response>(
      "/api/v1/tenant-settings/learner-email-verification",
    );

    return (
      <AdminPageGate screenId="T40" state="ready" title="Learner Email Verification">
        <LearnerEmailVerificationPanel initial={response.data} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T40"
          state="denied"
          title="Learner Email Verification"
          deniedMessage="You do not have permission to manage learner email verification."
        />
      );
    }
    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T40"
          state="error"
          title="Learner Email Verification"
          errorMessage={`Failed to load settings. Request ID: ${error.requestId}`}
        />
      );
    }
    throw error;
  }
}
