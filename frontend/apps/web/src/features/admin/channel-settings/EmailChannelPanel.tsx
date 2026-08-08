"use client";

import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";
import { SettingsSaveFooter, SettingTextField } from "../settings/settings-form-controls";
import { ChannelSettingsShell } from "./ChannelSettingsShell";

type Data = { fromName: string; fromEmail: string; replyToEmail: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailChannelPanel({
  title,
  description,
  endpoint,
  idempotencyPrefix,
  initial,
}: {
  title: string;
  description: string;
  endpoint: string;
  idempotencyPrefix: string;
  initial: Data;
}) {
  const [fromName, setFromName] = useState(initial.fromName);
  const [fromEmail, setFromEmail] = useState(initial.fromEmail);
  const [replyTo, setReplyTo] = useState(initial.replyToEmail ?? "");
  const [saved, setSaved] = useState<Data>(initial);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameError = touched && fromName.trim().length === 0 ? "From name is required." : null;
  const fromEmailError =
    touched && !EMAIL_RE.test(fromEmail.trim()) ? "Enter a valid from email address." : null;
  const replyToError =
    touched && replyTo.trim().length > 0 && !EMAIL_RE.test(replyTo.trim())
      ? "Enter a valid reply-to email address."
      : null;

  const valid = fromName.trim().length > 0 && EMAIL_RE.test(fromEmail.trim()) && !replyToError;
  const dirty =
    fromName !== saved.fromName ||
    fromEmail !== saved.fromEmail ||
    (replyTo || null) !== saved.replyToEmail;

  async function onSave() {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const response = await clientApi.put<{ data: Data }>(
        endpoint,
        {
          fromName: fromName.trim(),
          fromEmail: fromEmail.trim(),
          replyToEmail: replyTo.trim() ? replyTo.trim() : null,
        },
        idempotencyPrefix,
      );
      setSaved(response.data);
      setFromName(response.data.fromName);
      setFromEmail(response.data.fromEmail);
      setReplyTo(response.data.replyToEmail ?? "");
      setTouched(false);
      setStatus("Email settings saved.");
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ChannelSettingsShell>
      <header>
        <h1 className={generalSettingsPageTitleClassName}>{title}</h1>
        <p className={generalSettingsPageDescClassName}>{description}</p>
      </header>

      <div className="mt-8 space-y-6">
        <SettingTextField
          label="From Name"
          required
          value={fromName}
          onChange={setFromName}
          placeholder="Enter from name"
          disabled={saving}
          error={nameError}
        />
        <SettingTextField
          label="From Email"
          required
          type="email"
          value={fromEmail}
          onChange={setFromEmail}
          placeholder="Enter from email"
          disabled={saving}
          error={fromEmailError}
        />
        <SettingTextField
          label="Reply To Email"
          type="email"
          value={replyTo}
          onChange={setReplyTo}
          placeholder="Enter reply to email"
          disabled={saving}
          error={replyToError}
        />
      </div>

      <SettingsSaveFooter
        dirty={dirty}
        saving={saving}
        onSave={() => void onSave()}
        onCancel={() => {
          setFromName(saved.fromName);
          setFromEmail(saved.fromEmail);
          setReplyTo(saved.replyToEmail ?? "");
          setTouched(false);
          setStatus(null);
          setError(null);
        }}
        status={status}
        error={error}
      />
    </ChannelSettingsShell>
  );
}
