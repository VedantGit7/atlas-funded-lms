import { PageGate } from "../../../components/patterns/PageGate";
import { AccountSettingsPageHeader } from "../../../features/account-settings/account-settings-page-header";
import { SubscriptionPanel } from "../../../features/learner/components/SubscriptionPanel";
import { loadPublicBootstrap } from "../../../lib/server/bootstrap";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type Entitlement = {
  key: string;
  value: unknown;
  enabled: boolean;
  expiresAt: string | null;
};

type EntitlementListResponse = {
  data: Entitlement[];
};

export default async function ProfileSubscriptionPage() {
  try {
    const [entitlements, bootstrap] = await Promise.all([
      serverApi.get<EntitlementListResponse>("/api/v1/entitlements"),
      loadPublicBootstrap().catch(() => null),
    ]);

    return (
      <PageGate state="ready" title="Subscription">
        <AccountSettingsPageHeader
          title="Subscription"
          description="See what is included with your academy membership."
        />
        <SubscriptionPanel
          entitlements={entitlements.data}
          issuerName={bootstrap?.issuerName ?? bootstrap?.publicName ?? null}
        />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Subscription"
          deniedMessage="You do not have permission to view subscription details."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Subscription"
          errorMessage={`Failed to load subscription details. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
