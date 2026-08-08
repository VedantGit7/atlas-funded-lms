"use client";

import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";
import {
  SettingCheckbox,
  SettingNumberField,
  SettingsSaveFooter,
  SettingsSectionHeading,
} from "../settings/settings-form-controls";
import { SecuritySettingsShell } from "./SecuritySettingsShell";

type Data = { enabled: boolean; loginLimitPerMonth: number };

export function AdminOtpPanel({ initial }: { initial: Data }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [limit, setLimit] = useState(initial.loginLimitPerMonth);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = enabled !== saved.enabled || limit !== saved.loginLimitPerMonth;

  async function onSave() {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const response = await clientApi.put<{ data: Data }>(
        "/api/v1/tenant-settings/admin-otp",
        { enabled, loginLimitPerMonth: limit },
        "admin-otp-update",
      );
      setSaved(response.data);
      setEnabled(response.data.enabled);
      setLimit(response.data.loginLimitPerMonth);
      setStatus("Admin OTP settings saved.");
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SecuritySettingsShell>
      <header>
        <h1 className={generalSettingsPageTitleClassName}>Admin OTP</h1>
        <p className={generalSettingsPageDescClassName}>Set admin login limit for OTP verification.</p>
      </header>

      <div className="mt-8">
        <SettingCheckbox
          title="Admin OTP Verification"
          description="Enable admin OTP verification to secure admin/sub-admin login."
          checked={enabled}
          onChange={setEnabled}
          disabled={saving}
        />
      </div>

      <div className="mt-8 space-y-3">
        <SettingsSectionHeading
          title="Admin Login Limit For OTP Verification"
          description="OTP verification will be triggered once the specified login limit is reached within a month. Set the limit to '0' if OTP verification is required for every admin login."
        />
        <SettingNumberField
          value={limit}
          onChange={setLimit}
          suffix="/Month(s)"
          min={0}
          max={1000}
          disabled={saving || !enabled}
          ariaLabel="Admin login limit per month"
        />
      </div>

      <SettingsSaveFooter
        dirty={dirty}
        saving={saving}
        onSave={() => void onSave()}
        onCancel={() => {
          setEnabled(saved.enabled);
          setLimit(saved.loginLimitPerMonth);
          setStatus(null);
          setError(null);
        }}
        status={status}
        error={error}
      />
    </SecuritySettingsShell>
  );
}
