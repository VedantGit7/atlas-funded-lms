import { PageGate } from "../../../components/patterns/PageGate";
import { AccountSettingsPageHeader } from "../../../features/account-settings/account-settings-page-header";
import { PrivacyDataForm } from "../../../features/learner/components/PrivacyDataForm";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type PrivacyState = {
  analyticsConsent: boolean;
  marketingConsent: boolean;
  showLearningActivity: boolean;
};

type MemberProfileResponse = {
  data: { profileVisibility: "PUBLIC" | "PRIVATE" };
};

type PreferencesResponse = {
  data: { privacy: PrivacyState };
};

const DEFAULT_PRIVACY: PrivacyState = {
  analyticsConsent: true,
  marketingConsent: false,
  showLearningActivity: true,
};

export default async function ProfilePrivacyPage() {
  try {
    const me = await serverApi.get<{ data: { membership: { id: string } } }>("/api/v1/me");

    const [profile, preferences] = await Promise.all([
      serverApi
        .get<MemberProfileResponse>(`/api/v1/members/${me.data.membership.id}/profile`)
        .catch(() => ({ data: { profileVisibility: "PUBLIC" as const } })),
      serverApi
        .get<PreferencesResponse>("/api/v1/me/preferences")
        .catch(() => ({ data: { privacy: DEFAULT_PRIVACY } })),
    ]);

    return (
      <PageGate state="ready" title="Privacy & data">
        <AccountSettingsPageHeader
          title="Privacy & data"
          description="Decide what you share, how your data is used, and export or erase it any time."
        />
        <PrivacyDataForm
          membershipId={me.data.membership.id}
          initialVisibility={profile.data.profileVisibility}
          initialPrivacy={{ ...DEFAULT_PRIVACY, ...preferences.data.privacy }}
        />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Privacy & data"
          deniedMessage="You do not have permission to view these settings."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Privacy & data"
          errorMessage={`Failed to load privacy settings. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
