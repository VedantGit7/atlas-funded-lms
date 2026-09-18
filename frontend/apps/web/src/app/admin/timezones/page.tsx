import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminTimezonesPage } from "../../../features/admin/general-settings/AdminTimezonesPage";
import { isValidTimezone } from "../../../features/admin/general-settings/timezone-options";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type TenantTimezoneResponse = {
  data: { timezone: string };
};

export default async function AdminTimezonesPageRoute() {
  try {
    const response = await serverApi.get<TenantTimezoneResponse>(
      "/api/v1/tenant-settings/timezone",
    );
    const initialTimezone = isValidTimezone(response.data.timezone)
      ? response.data.timezone
      : "UTC";

    return (
      <AdminPageGate screenId="T29" state="ready" title="Time Zones">
        <AdminTimezonesPage initialTimezone={initialTimezone} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T29"
          state="denied"
          title="Time Zones"
          deniedMessage="You do not have permission to manage academy time zones."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T29"
          state="error"
          title="Time Zones"
          errorMessage={`Failed to load time zone settings. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
