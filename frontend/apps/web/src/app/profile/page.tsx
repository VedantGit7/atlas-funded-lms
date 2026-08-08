import { PageGate } from "../../components/patterns/PageGate";
import { AccountSettingsPageHeader } from "../../features/account-settings/account-settings-page-header";
import { ProfileForm } from "../../features/learner/components/ProfileForm";
import { ServerApiError, serverApi } from "../../lib/server-api";

type MemberProfileResponse = {
  data: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    timezone: string | null;
    profileVisibility: "PUBLIC" | "PRIVATE";
  };
};

type PreferencesResponse = {
  data: {
    locale: string | null;
  };
};

export default async function ProfilePage() {
  try {
    const me = await serverApi.get<{
      data: {
        membership: { id: string };
        identity: { email: string | null };
      };
    }>("/api/v1/me");

    const [profile, preferences] = await Promise.all([
      serverApi.get<MemberProfileResponse>(`/api/v1/members/${me.data.membership.id}/profile`),
      serverApi
        .get<PreferencesResponse>("/api/v1/me/preferences")
        .catch(() => ({ data: { locale: null } })),
    ]);

    return (
      <PageGate state="ready" title="Profile">
        <AccountSettingsPageHeader
          title="Profile settings"
          description="Manage your public identity and account preferences across the academy."
        />
        <ProfileForm
          membershipId={me.data.membership.id}
          initialDisplayName={profile.data.displayName}
          initialBio={profile.data.bio ?? null}
          initialAvatarUrl={profile.data.avatarUrl}
          initialTimezone={profile.data.timezone}
          initialLocale={preferences.data.locale}
          email={me.data.identity.email}
        />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Profile"
          deniedMessage="You do not have permission to view your profile."
        />
      );
    }

    if (error instanceof ServerApiError && error.status === 404) {
      return (
        <PageGate
          state="not_found"
          title="Profile"
          notFoundMessage="Profile not found or access denied."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Profile"
          errorMessage={`Failed to load profile. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
