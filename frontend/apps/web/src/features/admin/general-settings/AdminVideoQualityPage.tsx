"use client";

import { useState } from "react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { GeneralSettingsShell } from "./GeneralSettingsShell";
import { GeneralSettingsSelectDropdown } from "./GeneralSettingsSelectDropdown";
import {
  generalSettingsFooterClassName,
  generalSettingsFormCardClassName,
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "./general-settings-shared";
import {
  isVideoQualityValue,
  VIDEO_QUALITY_OPTIONS,
  type VideoQualityValue,
} from "./video-quality-options";

type AdminVideoQualityPageProps = {
  initialQuality: VideoQualityValue;
};

type TenantVideoQualityResponse = {
  data: { quality: VideoQualityValue };
};

export function AdminVideoQualityPage({ initialQuality }: AdminVideoQualityPageProps) {
  const [quality, setQuality] = useState<VideoQualityValue>(initialQuality);
  const [savedQuality, setSavedQuality] = useState<VideoQualityValue>(initialQuality);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);

  const isDirty = quality !== savedQuality;

  async function handleSave() {
    if (busy || !isDirty) return;
    setBusy(true);
    setMessage(null);
    setErrorRequestId(null);

    try {
      const response = await clientApi.put<TenantVideoQualityResponse>(
        "/api/v1/tenant-settings/video-quality",
        { quality },
        "tenant-video-quality-update",
      );
      setSavedQuality(response.data.quality);
      setQuality(response.data.quality);
      setMessage("Video quality saved.");
    } catch (error) {
      if (error instanceof ClientApiError) {
        setMessage(error.message);
        setErrorRequestId(error.requestId);
      } else {
        setMessage("Unable to save video quality.");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    setQuality(savedQuality);
    setMessage(null);
    setErrorRequestId(null);
  }

  return (
    <GeneralSettingsShell>
      <header>
        <h1 className={generalSettingsPageTitleClassName}>Video Quality</h1>
        <p className={generalSettingsPageDescClassName}>
          Select a default video quality for your learners.
        </p>
      </header>

      <div className={generalSettingsFormCardClassName}>
        <GeneralSettingsSelectDropdown
          label="Default video quality"
          labelId="academy-video-quality"
          value={quality}
          onChange={(nextValue) => {
            if (isVideoQualityValue(nextValue)) {
              setQuality(nextValue);
            }
          }}
          options={VIDEO_QUALITY_OPTIONS}
          disabled={busy}
          panelAriaLabel="Video quality options"
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
