import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminFastCheckoutPage } from "../../../features/admin/fast-checkout/AdminFastCheckoutPage";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type FastCheckoutResponse = { data: { enabled: boolean } };

export default async function AdminFastCheckoutPageRoute() {
  try {
    const response = await serverApi.get<FastCheckoutResponse>(
      "/api/v1/tenant-settings/fast-checkout",
    );

    return (
      <AdminPageGate screenId="T39" state="ready" title="Fast Checkout">
        <AdminFastCheckoutPage initialEnabled={response.data.enabled} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T39"
          state="denied"
          title="Fast Checkout"
          deniedMessage="You do not have permission to manage fast checkout."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T39"
          state="error"
          title="Fast Checkout"
          errorMessage={`Failed to load fast checkout settings. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
