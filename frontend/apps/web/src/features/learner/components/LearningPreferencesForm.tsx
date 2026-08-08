"use client";

import { useMemo, useState } from "react";
import { Captions, MonitorPause, PlayCircle, SkipForward } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  SettingsSelectField,
  SettingsToggleRow,
  type SettingsSelectOption,
} from "../../account-settings/account-settings-fields";
import { AccountSettingsToast } from "../../account-settings/account-settings-toast";
import { useAccountTheme } from "../../account-settings/account-theme-context";

type PlaybackSpeed = "0.75" | "1" | "1.25" | "1.5" | "1.75" | "2";

type LearningState = {
  autoplayVideos: boolean;
  autoplayNextLesson: boolean;
  playbackSpeed: PlaybackSpeed;
  captionsDefault: boolean;
  pauseOnBlur: boolean;
};

type LearningPreferencesFormProps = {
  initial: LearningState;
};

const PLAYBACK_OPTIONS: SettingsSelectOption[] = [
  { value: "0.75", label: "0.75x" },
  { value: "1", label: "Normal (1x)" },
  { value: "1.25", label: "1.25x" },
  { value: "1.5", label: "1.5x" },
  { value: "1.75", label: "1.75x" },
  { value: "2", label: "2x" },
];

const PLAYBACK_VALUES: readonly PlaybackSpeed[] = ["0.75", "1", "1.25", "1.5", "1.75", "2"];

function toPlaybackSpeed(value: string): PlaybackSpeed {
  return (PLAYBACK_VALUES as readonly string[]).includes(value) ? (value as PlaybackSpeed) : "1";
}

function formatClientError(error: unknown): { message: string; requestId: string | null } {
  if (error instanceof ClientApiError) {
    return { message: error.message, requestId: error.requestId };
  }
  return { message: "Unable to update learning preferences.", requestId: null };
}

export function LearningPreferencesForm({ initial }: LearningPreferencesFormProps) {
  const { classes } = useAccountTheme();
  const [state, setState] = useState<LearningState>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(initial),
    [initial, state],
  );

  async function save() {
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.put("/api/v1/me/preferences", { learning: state }, "learning-preferences-update", {
        silent: true,
      });
      setToastOpen(true);
    } catch (error) {
      const formatted = formatClientError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setBusy(false);
    }
  }

  function discardChanges() {
    setState(initial);
    setMessage(null);
    setRequestId(null);
  }

  return (
    <>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <section className={`${classes.card} space-y-6`}>
          <div>
            <h2 className={classes.sectionTitle}>Video & playback</h2>
            <p className={classes.sectionDesc}>
              These preferences follow you into every course player.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:max-w-xs">
            <span className={classes.label}>Default playback speed</span>
            <SettingsSelectField
              ariaLabel="Default playback speed"
              value={state.playbackSpeed}
              onChange={(value) => {
                setState((current) => ({ ...current, playbackSpeed: toPlaybackSpeed(value) }));
              }}
              options={PLAYBACK_OPTIONS}
            />
          </div>

          <div className={classes.panel}>
            <SettingsToggleRow
              icon={PlayCircle}
              title="Autoplay videos"
              description="Start the lesson video automatically when you open it."
              checked={state.autoplayVideos}
              onChange={(checked) => {
                setState((current) => ({ ...current, autoplayVideos: checked }));
              }}
            />
            <SettingsToggleRow
              icon={SkipForward}
              title="Autoplay next lesson"
              description="Continue to the next lesson automatically when one finishes."
              checked={state.autoplayNextLesson}
              onChange={(checked) => {
                setState((current) => ({ ...current, autoplayNextLesson: checked }));
              }}
            />
            <SettingsToggleRow
              icon={Captions}
              title="Captions on by default"
              description="Turn on subtitles automatically where available."
              checked={state.captionsDefault}
              onChange={(checked) => {
                setState((current) => ({ ...current, captionsDefault: checked }));
              }}
            />
            <SettingsToggleRow
              icon={MonitorPause}
              title="Pause when I switch tabs"
              description="Automatically pause playback when this tab loses focus."
              checked={state.pauseOnBlur}
              onChange={(checked) => {
                setState((current) => ({ ...current, pauseOnBlur: checked }));
              }}
            />
          </div>

          <div className={`flex items-center justify-end gap-4 border-t pt-6 ${classes.divider}`}>
            <button
              type="button"
              className="text-xs font-medium text-[var(--acct-on-surface-variant)] transition-colors hover:text-[var(--acct-on-surface)] disabled:opacity-40"
              disabled={!isDirty || busy}
              onClick={discardChanges}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={isDirty && !busy ? classes.primaryButton : classes.primaryButtonMuted}
              disabled={!isDirty || busy}
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>

          {message ? (
            <p role="alert" className={`${classes.errorBanner} mt-2`}>
              {message}
              {requestId ? ` Request ID: ${requestId}` : ""}
            </p>
          ) : null}
        </section>
      </form>

      <AccountSettingsToast
        message="Learning preferences saved"
        open={toastOpen}
        onClose={() => {
          setToastOpen(false);
        }}
      />
    </>
  );
}
