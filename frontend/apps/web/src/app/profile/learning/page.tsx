import { PageGate } from "../../../components/patterns/PageGate";
import { AccountSettingsPageHeader } from "../../../features/account-settings/account-settings-page-header";
import { LearningPreferencesForm } from "../../../features/learner/components/LearningPreferencesForm";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type PlaybackSpeed = "0.75" | "1" | "1.25" | "1.5" | "1.75" | "2";

type LearningState = {
  autoplayVideos: boolean;
  autoplayNextLesson: boolean;
  playbackSpeed: PlaybackSpeed;
  captionsDefault: boolean;
  pauseOnBlur: boolean;
};

type PreferencesResponse = {
  data: { learning: LearningState };
};

const DEFAULT_LEARNING: LearningState = {
  autoplayVideos: true,
  autoplayNextLesson: true,
  playbackSpeed: "1",
  captionsDefault: false,
  pauseOnBlur: false,
};

export default async function ProfileLearningPage() {
  try {
    const preferences = await serverApi
      .get<PreferencesResponse>("/api/v1/me/preferences")
      .catch(() => ({ data: { learning: DEFAULT_LEARNING } }));

    return (
      <PageGate state="ready" title="Learning preferences">
        <AccountSettingsPageHeader
          title="Learning preferences"
          description="Tune how lessons play so every course fits the way you learn."
        />
        <LearningPreferencesForm initial={{ ...DEFAULT_LEARNING, ...preferences.data.learning }} />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Learning preferences"
          deniedMessage="You do not have permission to view these settings."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Learning preferences"
          errorMessage={`Failed to load learning preferences. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
