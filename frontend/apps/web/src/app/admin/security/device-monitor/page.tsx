import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { DeviceMonitorPanel } from "../../../../features/admin/security-settings/DeviceMonitorPanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

type Response = {
  data: { restrictionsEnabled: boolean; registrationLimit: number; restrictParallelLogins: boolean };
};

export default async function DeviceMonitorPageRoute() {
  try {
    const response = await serverApi.get<Response>("/api/v1/tenant-settings/device-monitor");

    return (
      <AdminPageGate screenId="T42" state="ready" title="Device Monitor">
        <DeviceMonitorPanel initial={response.data} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T42"
          state="denied"
          title="Device Monitor"
          deniedMessage="You do not have permission to manage device monitor settings."
        />
      );
    }
    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T42"
          state="error"
          title="Device Monitor"
          errorMessage={`Failed to load settings. Request ID: ${error.requestId}`}
        />
      );
    }
    throw error;
  }
}
