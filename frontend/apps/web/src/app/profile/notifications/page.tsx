import { PageGate } from "../../../components/patterns/PageGate";
import { AccountSettingsPageHeader } from "../../../features/account-settings/account-settings-page-header";
import { NotificationPreferencesForm } from "../../../features/learner/components/NotificationPreferencesForm";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { NotificationChannelPrefs } from "@atlas/contracts/membership/notification-preferences.catalog";

type PreferencesResponse = {
  data: {
    notifications: Record<string, NotificationChannelPrefs>;
  };
};

export default async function ProfileNotificationsPage() {
  try {
    const preferences = await serverApi
      .get<PreferencesResponse>("/api/v1/me/preferences")
      .catch(() => ({ data: { notifications: {} } }));

    return (
      <PageGate state="ready" title="Notifications">
        <AccountSettingsPageHeader
          title="Notification preferences"
          description="Control how and when you receive updates across different channels."
        />
        <NotificationPreferencesForm initial={preferences.data.notifications} />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Notifications"
          deniedMessage="You do not have permission to view notification preferences."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Notifications"
          errorMessage={`Failed to load notification preferences. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
