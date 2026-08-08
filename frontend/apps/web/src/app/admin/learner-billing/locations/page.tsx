import type { BillingLocationListResponse } from "@atlas/domain-config/schemas/learner-billing";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { LearnerBillingSettingsShell } from "../../../../features/admin/learner-billing/LearnerBillingSettingsShell";
import { LocationsListPanel } from "../../../../features/admin/learner-billing/LocationsListPanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

export default async function LocationsPageRoute() {
  try {
    const locations = await serverApi.get<BillingLocationListResponse>(
      "/api/v1/learner-billing/locations",
    );

    return (
      <AdminPageGate screenId="T38" state="ready" title="Locations">
        <LearnerBillingSettingsShell>
          <LocationsListPanel initialLocations={locations.data} />
        </LearnerBillingSettingsShell>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T38"
          state="denied"
          title="Locations"
          deniedMessage="You do not have permission to manage billing locations."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T38"
          state="error"
          title="Locations"
          errorMessage={`Failed to load billing locations. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
