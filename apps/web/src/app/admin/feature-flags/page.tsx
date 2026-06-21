import type { FeatureFlagListResponse } from "@atlas/domain-config/schemas/feature-flags";
import { AdminPageGate, PageHeader } from "../../../components/patterns/AdminPageGate";
import { FeatureFlagsAdmin } from "../../../features/admin/feature-flags/FeatureFlagsAdmin";
import { ServerApiError, serverApi } from "../../../lib/server-api";

export default async function AdminFeatureFlagsPage() {
  try {
    const flags = await serverApi.get<FeatureFlagListResponse>("/api/v1/feature-flags");

    return (
      <AdminPageGate screenId="T9" state="ready" title="Feature Flags">
        <main className="space-y-6">
          <PageHeader
            title="Feature Flags"
            description="Review effective flag values and override tenant flags where permitted."
          />
          <FeatureFlagsAdmin flags={flags.data} />
        </main>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T9"
          state="denied"
          title="Feature Flags"
          deniedMessage="You do not have permission to view feature flags."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T9"
          state="error"
          title="Feature Flags"
          errorMessage={`Failed to load feature flags. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
