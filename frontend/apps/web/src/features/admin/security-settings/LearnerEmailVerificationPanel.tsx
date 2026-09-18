"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";
import {
  SettingNumberField,
  SettingsNote,
  SettingsSaveFooter,
  SettingsSectionHeading,
} from "../settings/settings-form-controls";
import { SecuritySettingsShell } from "./SecuritySettingsShell";

type Data = { verificationDays: number };

export function LearnerEmailVerificationPanel({ initial }: { initial: Data }) {
  const [days, setDays] = useState(initial.verificationDays);
  const [saved, setSaved] = useState(initial.verificationDays);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = days !== saved;

  async function onSave() {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const response = await clientApi.put<{ data: Data }>(
        "/api/v1/tenant-settings/learner-email-verification",
        { verificationDays: days },
        "learner-email-verification-update",
      );
      setSaved(response.data.verificationDays);
      setDays(response.data.verificationDays);
      setStatus("Learner email verification settings saved.");
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not save. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SecuritySettingsShell>
      <header>
        <h1 className={generalSettingsPageTitleClassName}>Learner Email Verification</h1>
        <p className={generalSettingsPageDescClassName}>
          Verify your learner email and allow access based on verification.
        </p>
      </header>

      <div className="mt-8 space-y-3">
        <SettingsSectionHeading
          title="Learner Email Verification Configuration"
          description="After signing up, the verification link will remain valid for the duration of the specified number of days."
        />
        <SettingNumberField
          value={days}
          onChange={setDays}
          suffix="Day(s)"
          min={0}
          max={365}
          disabled={saving}
          ariaLabel="Verification link validity in days"
        />
        <SettingsNote>
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Note: To enable access to the dashboard for learners only after email verification, set
            the verification duration to &lsquo;0&rsquo; days.
          </span>
        </SettingsNote>
      </div>

      <SettingsSaveFooter
        dirty={dirty}
        saving={saving}
        onSave={() => void onSave()}
        onCancel={() => {
          setDays(saved);
          setStatus(null);
          setError(null);
        }}
        status={status}
        error={error}
      />
    </SecuritySettingsShell>
  );
}
