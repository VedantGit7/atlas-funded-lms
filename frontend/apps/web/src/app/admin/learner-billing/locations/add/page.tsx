import type { BillingLocationListResponse } from "@atlas/domain-config/schemas/learner-billing";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { LearnerBillingSettingsShell } from "../../../../../features/admin/learner-billing/LearnerBillingSettingsShell";
import { LocationAddPanel } from "../../../../../features/admin/learner-billing/LocationAddPanel";
import { ServerApiError, serverApi } from "../../../../../lib/server-api";

export default async function AddLocationPageRoute() {
  // The regions already taken. Without them the picker happily offers a country
  // that the server will refuse, and "Rest of the World" sits at the top of the
  // list even when the default row already exists.
  let existingLocations: Array<{ locationKey: string; title: string; currency: string }> = [];
  try {
    const locations = await serverApi.get<BillingLocationListResponse>(
      "/api/v1/learner-billing/locations",
    );
    existingLocations = locations.data.map((location) => ({
      locationKey: location.locationKey,
      title: location.title,
      currency: location.currency,
    }));
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
    if (!(error instanceof ServerApiError)) throw error;
    // A failed pre-check is not worth blocking the form for: the server still
    // rejects a duplicate, so the worst case is the old behaviour.
  }

  return (
    <AdminPageGate screenId="T38" state="ready" title="Locations">
      <LearnerBillingSettingsShell>
        <LocationAddPanel existingLocations={existingLocations} />
      </LearnerBillingSettingsShell>
    </AdminPageGate>
  );
}
