"use client";

import { useEffect, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";

export type NewExportFormDefaults<
  TFormat extends string,
  TDelivery extends string,
  TCadence extends string,
> = {
  format: TFormat;
  delivery: TDelivery;
  cadence: TCadence;
  time: string;
  /** A fixed zone, or one read when the dialog opens (such as the browser's). */
  timezone: string | (() => string);
};

/**
 * The state every new-export dialog shares: format, delivery and recipients,
 * the schedule fields, and the create call. It resets each time the dialog
 * opens and closes it on Escape unless a create is in flight. Each dialog
 * keeps its own dataset, scope and column state, and builds its own body.
 */
export function useNewExportForm<
  TFormat extends string,
  TDelivery extends string,
  TCadence extends string,
>({
  open,
  onClose,
  initialScheduleEnabled,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  initialScheduleEnabled: boolean;
  defaults: NewExportFormDefaults<TFormat, TDelivery, TCadence>;
}) {
  const [format, setFormat] = useState<TFormat>(defaults.format);
  const [delivery, setDelivery] = useState<TDelivery>(defaults.delivery);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [recipientsText, setRecipientsText] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(initialScheduleEnabled);
  const [scheduleName, setScheduleName] = useState("");
  const [cadence, setCadence] = useState<TCadence>(defaults.cadence);
  const [time, setTime] = useState(defaults.time);
  const [timezone, setTimezone] = useState("UTC");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    format: defaultFormat,
    delivery: defaultDelivery,
    cadence: defaultCadence,
    time: defaultTime,
    timezone: defaultTimezone,
  } = defaults;

  useEffect(() => {
    if (!open) return;
    setFormat(defaultFormat);
    setDelivery(defaultDelivery);
    setRecipients([]);
    setRecipientInput("");
    setRecipientsText("");
    setWebhookUrl("");
    setScheduleEnabled(initialScheduleEnabled);
    setScheduleName("");
    setCadence(defaultCadence);
    setTime(defaultTime);
    setTimezone(typeof defaultTimezone === "function" ? defaultTimezone() : defaultTimezone);
    setSaving(false);
    setError(null);
    // The defaults are literals fixed per dialog, so only opening resets the form.
  }, [open, initialScheduleEnabled]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, saving]);

  /** Adds the typed address to the recipient chips, if it looks like an email. */
  function addRecipient() {
    const email = recipientInput.trim();
    if (!email || !email.includes("@")) return;
    setRecipients((current) => (current.includes(email) ? current : [...current, email]));
    setRecipientInput("");
  }

  function removeRecipient(email: string) {
    setRecipients((current) => current.filter((item) => item !== email));
  }

  /** The addresses typed into a free-text recipients field. */
  function recipientsFromText(): string[] {
    return recipientsText
      .split(/[,;\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  /** Shows a validation message and stops the submit. */
  function fail(message: string): false {
    setError(message);
    return false;
  }

  /**
   * Runs the create call, hands the result to the page and closes the dialog,
   * or shows the server's message.
   */
  async function submit<TRun, TSchedule>(
    create: () => Promise<{ data: { run: TRun; schedule: TSchedule | null } }>,
    onCreated: (run: TRun, schedule: TSchedule | null) => void,
  ) {
    setSaving(true);
    setError(null);
    try {
      const response = await create();
      onCreated(response.data.run, response.data.schedule);
      onClose();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not create export.");
    } finally {
      setSaving(false);
    }
  }

  return {
    format,
    setFormat,
    delivery,
    setDelivery,
    recipients,
    recipientInput,
    setRecipientInput,
    addRecipient,
    removeRecipient,
    recipientsText,
    setRecipientsText,
    recipientsFromText,
    webhookUrl,
    setWebhookUrl,
    scheduleEnabled,
    setScheduleEnabled,
    scheduleName,
    setScheduleName,
    cadence,
    setCadence,
    time,
    setTime,
    timezone,
    setTimezone,
    saving,
    error,
    setError,
    fail,
    submit,
  };
}

export type NewExportForm<
  TFormat extends string,
  TDelivery extends string,
  TCadence extends string,
> = ReturnType<typeof useNewExportForm<TFormat, TDelivery, TCadence>>;
