import { PageGate } from "../../../components/patterns/PageGate";
import { AccountSettingsPageHeader } from "../../../features/account-settings/account-settings-page-header";
import { AppearanceForm } from "../../../features/learner/components/AppearanceForm";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type AppearanceState = {
  mode: "system" | "light" | "dark";
  accentColor: string | null;
  fontSize: "normal" | "large";
  reducedMotion: boolean;
  highContrast: boolean;
};

type PreferencesResponse = {
  data: { appearance: AppearanceState };
};

const DEFAULT_APPEARANCE: AppearanceState = {
  mode: "system",
  accentColor: null,
  fontSize: "normal",
  reducedMotion: false,
  highContrast: false,
};

export default async function ProfileAppearancePage() {
  try {
    const preferences = await serverApi
      .get<PreferencesResponse>("/api/v1/me/preferences")
      .catch(() => ({ data: { appearance: DEFAULT_APPEARANCE } }));

    return (
      <PageGate state="ready" title="Appearance & accessibility">
        <AccountSettingsPageHeader
          title="Appearance & accessibility"
          description="Personalize how the academy looks and make it easier to read and navigate."
        />
        <AppearanceForm initial={{ ...DEFAULT_APPEARANCE, ...preferences.data.appearance }} />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Appearance & accessibility"
          deniedMessage="You do not have permission to view these settings."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Appearance & accessibility"
          errorMessage={`Failed to load appearance settings. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
