"use client";

import { useMemo, useState } from "react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { GeneralSettingsShell } from "./GeneralSettingsShell";
import { TimezoneSearchableDropdown } from "./TimezoneSearchableDropdown";
import {
  generalSettingsFooterClassName,
  generalSettingsFormCardClassName,
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "./general-settings-shared";
import { listTimezoneOptions } from "./timezone-options";

type AdminTimezonesPageProps = {
  initialTimezone: string;
};

type TenantTimezoneResponse = {
  data: { timezone: string };
};

export function AdminTimezonesPage({ initialTimezone }: AdminTimezonesPageProps) {
  const timezoneOptions = useMemo(() => listTimezoneOptions(), []);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [savedTimezone, setSavedTimezone] = useState(initialTimezone);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);

  const isDirty = timezone !== savedTimezone;

  async function handleSave() {
    if (busy || !isDirty) return;
    setBusy(true);
    setMessage(null);
    setErrorRequestId(null);

    try {
      const response = await clientApi.put<TenantTimezoneResponse>(
        "/api/v1/tenant-settings/timezone",
        { timezone },
        "tenant-timezone-update",
      );
      setSavedTimezone(response.data.timezone);
      setTimezone(response.data.timezone);
      setMessage("Time zone saved.");
    } catch (error) {
      if (error instanceof ClientApiError) {
        setMessage(error.message);
        setErrorRequestId(error.requestId);
      } else {
        setMessage("Unable to save time zone.");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    setTimezone(savedTimezone);
    setMessage(null);
    setErrorRequestId(null);
  }

  return (
    <GeneralSettingsShell>
      <header>
        <h1 className={generalSettingsPageTitleClassName}>Time Zones</h1>
        <p className={generalSettingsPageDescClassName}>Set a time zone for your academy.</p>
      </header>

      <div className={generalSettingsFormCardClassName}>
        <TimezoneSearchableDropdown
          labelId="academy-timezone"
          label="Academy time zone"
          value={timezone}
          onChange={setTimezone}
          options={timezoneOptions}
          disabled={busy}
        />
      </div>

      {message ? (
        <p
          role="status"
          className={[
            "mt-4 text-sm",
            errorRequestId ? "text-[var(--admin-danger)]" : "text-[var(--admin-success)]",
          ].join(" ")}
        >
          {message}
          {errorRequestId ? ` Request ID: ${errorRequestId}` : null}
        </p>
      ) : null}

      <div className={generalSettingsFooterClassName}>
        <button
          type="button"
          className={primaryButtonClassName}
          disabled={busy || !isDirty}
          onClick={() => {
            void handleSave();
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className={ghostButtonClassName}
          disabled={busy || !isDirty}
          onClick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </GeneralSettingsShell>
  );
}
