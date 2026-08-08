"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";
import {
  SettingCheckbox,
  SettingNumberField,
  SettingsNote,
  SettingsSaveFooter,
  SettingToggleCard,
} from "../settings/settings-form-controls";
import { SecuritySettingsShell } from "./SecuritySettingsShell";

type Data = {
  restrictionsEnabled: boolean;
  registrationLimit: number;
  restrictParallelLogins: boolean;
};

export function DeviceMonitorPanel({ initial }: { initial: Data }) {
  const [restrictionsEnabled, setRestrictionsEnabled] = useState(initial.restrictionsEnabled);
  const [registrationLimit, setRegistrationLimit] = useState(initial.registrationLimit);
  const [restrictParallel, setRestrictParallel] = useState(initial.restrictParallelLogins);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    restrictionsEnabled !== saved.restrictionsEnabled ||
    registrationLimit !== saved.registrationLimit ||
    restrictParallel !== saved.restrictParallelLogins;

  async function onSave() {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const response = await clientApi.put<{ data: Data }>(
        "/api/v1/tenant-settings/device-monitor",
        {
          restrictionsEnabled,
          registrationLimit,
          restrictParallelLogins: restrictParallel,
        },
        "device-monitor-update",
      );
      setSaved(response.data);
      setRestrictionsEnabled(response.data.restrictionsEnabled);
      setRegistrationLimit(response.data.registrationLimit);
      setRestrictParallel(response.data.restrictParallelLogins);
      setStatus("Device monitor settings saved.");
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SecuritySettingsShell>
      <header>
        <h1 className={generalSettingsPageTitleClassName}>Device Monitor</h1>
        <p className={generalSettingsPageDescClassName}>
          Manage device restrictions and parallel login settings. For full Active Devices policy
          controls including overrides and blocked fingerprints, open{" "}
          <a
            href="/admin/reports/active-devices/policies"
            className="font-semibold text-[var(--admin-primary)] hover:underline"
          >
            Device policies
          </a>
          .
        </p>
      </header>

      <div className="mt-8 space-y-6">
        <SettingToggleCard
          title="Enable Device Restrictions"
          description="Enable to limit the number of registered devices used by a learner. (Applicable only for Android and iOS Devices)"
          checked={restrictionsEnabled}
          onChange={setRestrictionsEnabled}
          disabled={saving}
        />

        <div className="space-y-3">
          <h2 className="text-base font-bold text-[var(--admin-on-surface)]">Device Registration Limit</h2>
          <SettingNumberField
            value={registrationLimit}
            onChange={setRegistrationLimit}
            suffix="Device(s)"
            min={1}
            max={10}
            disabled={saving || !restrictionsEnabled}
            ariaLabel="Device registration limit"
          />
          <SettingsNote>
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Allows learners to register on a device. Maximum limit can be up to 10 devices.</span>
          </SettingsNote>
        </div>

        <SettingCheckbox
          variant="bare"
          title="Restrict Parallel Logins"
          description="Enable to restrict parallel logins on the registered devices. (Applicable only for Android and iOS Devices)"
          checked={restrictParallel}
          onChange={setRestrictParallel}
          disabled={saving || !restrictionsEnabled}
        />
      </div>

      <SettingsSaveFooter
        dirty={dirty}
        saving={saving}
        onSave={() => void onSave()}
        onCancel={() => {
          setRestrictionsEnabled(saved.restrictionsEnabled);
          setRegistrationLimit(saved.registrationLimit);
          setRestrictParallel(saved.restrictParallelLogins);
          setStatus(null);
          setError(null);
        }}
        status={status}
        error={error}
      />
    </SecuritySettingsShell>
  );
}
