"use client";

import { useMemo, useState } from "react";
import {
  NOTIFICATION_CATEGORY_GROUPS,
  NOTIFICATION_CATEGORY_LABELS,
  type NotificationChannelPrefs,
  type NotificationPreferenceCategory,
} from "@atlas/contracts/membership/notification-preferences.catalog";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { AccountSettingsToast } from "../../account-settings/account-settings-toast";
import { useAccountTheme } from "../../account-settings/account-theme-context";

type NotificationPreferencesFormProps = {
  initial: Record<string, NotificationChannelPrefs>;
};

function formatClientError(error: unknown): { message: string; requestId: string | null } {
  if (error instanceof ClientApiError) {
    return { message: error.message, requestId: error.requestId };
  }
  return { message: "Unable to update notification preferences.", requestId: null };
}

function ChannelToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const { classes } = useAccountTheme();
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        className={classes.checkbox}
        checked={checked}
        aria-label={label}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? classes.toggleTrackOn : classes.toggleTrackOff}`}
      >
        <span
          className={`${classes.toggleKnob} ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
    </label>
  );
}

function PreferenceRow(props: {
  category: NotificationPreferenceCategory;
  prefs: NotificationChannelPrefs;
  onChange: (prefs: NotificationChannelPrefs) => void;
}) {
  const { classes } = useAccountTheme();
  return (
    <div className={`grid grid-cols-12 items-center p-4 ${classes.panelRow}`}>
      <div className="col-span-6 md:col-span-8">
        <div className="text-sm font-medium text-[var(--acct-on-surface)]">
          {NOTIFICATION_CATEGORY_LABELS[props.category]}
        </div>
      </div>
      <div className="col-span-3 flex justify-center md:col-span-2">
        <ChannelToggle
          checked={props.prefs.email}
          label={`Email for ${NOTIFICATION_CATEGORY_LABELS[props.category]}`}
          onChange={(checked) => {
            props.onChange({ ...props.prefs, email: checked });
          }}
        />
      </div>
      <div className="col-span-3 flex justify-center md:col-span-2">
        <ChannelToggle
          checked={props.prefs.inApp}
          label={`In-app for ${NOTIFICATION_CATEGORY_LABELS[props.category]}`}
          onChange={(checked) => {
            props.onChange({ ...props.prefs, inApp: checked });
          }}
        />
      </div>
    </div>
  );
}

export function NotificationPreferencesForm({ initial }: NotificationPreferencesFormProps) {
  const { classes } = useAccountTheme();
  const baseline = useMemo(() => {
    const next: Record<string, NotificationChannelPrefs> = {};
    for (const group of Object.values(NOTIFICATION_CATEGORY_GROUPS)) {
      for (const key of group.categories) {
        next[key] = initial[key] ?? { email: true, inApp: true };
      }
    }
    return next;
  }, [initial]);

  const [prefs, setPrefs] = useState<Record<string, NotificationChannelPrefs>>(baseline);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(prefs) !== JSON.stringify(baseline),
    [baseline, prefs],
  );

  async function save() {
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.put(
        "/api/v1/me/preferences",
        { notifications: prefs },
        "notification-preferences-update",
      );
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
    setPrefs(baseline);
    setMessage(null);
    setRequestId(null);
  }

  return (
    <>
      <form
        className="space-y-12"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className={`grid grid-cols-12 mb-4 px-4 ${classes.stickyHeader}`}>
          <div className="col-span-6 md:col-span-8">
            <span className={`${classes.helper} uppercase tracking-widest`}>
              Notification event
            </span>
          </div>
          <div className="col-span-3 text-center md:col-span-2">
            <span className={`${classes.helper} uppercase tracking-widest`}>Email</span>
          </div>
          <div className="col-span-3 text-center md:col-span-2">
            <span className={`${classes.helper} uppercase tracking-widest`}>In-app</span>
          </div>
        </div>

        {Object.values(NOTIFICATION_CATEGORY_GROUPS).map((group) => (
          <section key={group.title}>
            <div className="mb-4">
              <h2 className={classes.sectionTitle}>{group.title}</h2>
              <p className={classes.sectionDesc}>{group.description}</p>
            </div>
            <div className={classes.panel}>
              {group.categories.map((key) => (
                <PreferenceRow
                  key={key}
                  category={key}
                  prefs={prefs[key] ?? { email: true, inApp: true }}
                  onChange={(next) => {
                    setPrefs((current) => ({ ...current, [key]: next }));
                  }}
                />
              ))}
            </div>
          </section>
        ))}

        <footer className={`flex justify-end gap-3 border-t pt-8 ${classes.divider}`}>
          <button
            type="button"
            className={classes.outlineButton}
            disabled={!isDirty || busy}
            onClick={discardChanges}
          >
            Discard changes
          </button>
          <button type="submit" className={classes.primaryButton} disabled={!isDirty || busy}>
            {busy ? "Saving…" : "Save preferences"}
          </button>
        </footer>

        {message ? (
          <p role="alert" className={classes.errorBanner}>
            {message}
            {requestId ? ` Request ID: ${requestId}` : ""}
          </p>
        ) : null}
      </form>

      <AccountSettingsToast
        message="Notification preferences saved"
        open={toastOpen}
        onClose={() => {
          setToastOpen(false);
        }}
      />
    </>
  );
}
