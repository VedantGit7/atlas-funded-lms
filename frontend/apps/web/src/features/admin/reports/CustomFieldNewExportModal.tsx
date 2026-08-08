"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, Info, Loader2, Search, X } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  createCustomFieldExport,
  type CreateCustomFieldExportBody,
  type CustomFieldExportCadence,
  type CustomFieldExportColumn,
  type CustomFieldExportDataset,
  type CustomFieldExportDelivery,
  type CustomFieldExportEmptyValue,
  type CustomFieldExportFormat,
  type CustomFieldExportHistoryItem,
  type CustomFieldExportScheduleItem,
  type CustomFieldExportsPayload,
} from "./admin-custom-field-exports-api";
import {
  fetchCustomFieldSegments,
  type CustomFieldSegmentItem,
} from "./admin-custom-field-segments-api";

const fieldClassName =
  "w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]";

const labelClassName =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

const DATASET_OPTIONS: Array<{ value: CustomFieldExportDataset; label: string }> = [
  { value: "learner_roster", label: "Learners" },
  { value: "field_coverage", label: "Field coverage" },
  { value: "segment_members", label: "Segment members" },
];

function PolicyToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:opacity-50 ${
        checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-[var(--admin-surface)] shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function typeBadgeClass(badge: string | null) {
  if (badge === "bol") {
    return "border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] text-[var(--admin-success)]";
  }
  if (badge === "num") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] text-[var(--admin-warning)]";
  }
  return "border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] text-[var(--admin-primary)]";
}

export function CustomFieldNewExportModal({
  open,
  learnerColumns,
  customFieldColumns,
  capabilities,
  initialScheduleEnabled,
  onClose,
  onCreated,
}: {
  open: boolean;
  learnerColumns: CustomFieldExportColumn[];
  customFieldColumns: CustomFieldExportColumn[];
  capabilities: CustomFieldExportsPayload["capabilities"];
  initialScheduleEnabled: boolean;
  onClose: () => void;
  onCreated: (
    run: CustomFieldExportHistoryItem,
    schedule: CustomFieldExportScheduleItem | null,
  ) => void;
}) {
  const titleId = useId();
  const [dataset, setDataset] = useState<CustomFieldExportDataset>("learner_roster");
  const [columnQuery, setColumnQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<CustomFieldExportFormat>("csv");
  const [emptyValueMode, setEmptyValueMode] =
    useState<CustomFieldExportEmptyValue>("blank");
  const [delivery, setDelivery] = useState<CustomFieldExportDelivery>("download");
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [cadence, setCadence] = useState<CustomFieldExportCadence>("weekly");
  const [time, setTime] = useState("07:00");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [segments, setSegments] = useState<CustomFieldSegmentItem[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredLearner = useMemo(() => {
    const q = columnQuery.trim().toLowerCase();
    if (!q) return learnerColumns;
    return learnerColumns.filter(
      (c) => c.key.toLowerCase().includes(q) || c.label.toLowerCase().includes(q),
    );
  }, [learnerColumns, columnQuery]);

  const filteredCustom = useMemo(() => {
    const q = columnQuery.trim().toLowerCase();
    if (!q) return customFieldColumns;
    return customFieldColumns.filter(
      (c) => c.key.toLowerCase().includes(q) || c.label.toLowerCase().includes(q),
    );
  }, [customFieldColumns, columnQuery]);

  const selectedSegment = segments.find((s) => s.id === segmentId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setDataset("learner_roster");
    setColumnQuery("");
    setSelected(
      new Set(learnerColumns.filter((c) => c.defaultSelected).map((c) => c.key)),
    );
    setFormat("csv");
    setEmptyValueMode("blank");
    setDelivery("download");
    setRecipients([]);
    setRecipientInput("");
    setWebhookUrl("");
    setScheduleEnabled(initialScheduleEnabled);
    setCadence("weekly");
    setTime("07:00");
    setTimezone("Asia/Kolkata");
    setError(null);
    setSaving(false);
    void fetchCustomFieldSegments()
      .then((res) => {
        setSegments(res.data.items);
        if (res.data.items[0]) setSegmentId(res.data.items[0].id);
      })
      .catch(() => setSegments([]));
  }, [open, learnerColumns, initialScheduleEnabled]);

  function toggleColumn(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(columns: CustomFieldExportColumn[], allOn: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const col of columns) {
        if (allOn) next.add(col.key);
        else next.delete(col.key);
      }
      return next;
    });
  }

  function addRecipient() {
    const email = recipientInput.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    setRecipients((prev) => (prev.includes(email) ? prev : [...prev, email]));
    setRecipientInput("");
  }

  async function handleSubmit() {
    if (selected.size === 0) {
      setError("Select at least one column.");
      return;
    }
    if (dataset === "segment_members" && !segmentId) {
      setError("Select a segment for segment member exports.");
      return;
    }
    if (delivery === "recipients" && recipients.length === 0) {
      setError("Add at least one recipient email.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: CreateCustomFieldExportBody = {
        dataset,
        columns: [...selected],
        format,
        emptyValueMode,
        useCurrentFilters: true,
        delivery,
        scheduleEnabled,
        ...(dataset === "segment_members" && segmentId
          ? {
              segmentId,
              segmentName: selectedSegment?.name,
            }
          : {}),
        ...(delivery === "recipients" ? { recipients } : {}),
        ...(webhookUrl.trim() ? { webhookUrl: webhookUrl.trim() } : {}),
        ...(scheduleEnabled
          ? {
              cadence,
              time,
              timezone,
              scheduleName: `${DATASET_OPTIONS.find((d) => d.value === dataset)?.label ?? "Custom field"} export`,
            }
          : {}),
      };
      const result = await createCustomFieldExport(body);
      onCreated(result.data.run, result.data.schedule);
      onClose();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to start export.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const learnerAllOn =
    filteredLearner.length > 0 && filteredLearner.every((c) => selected.has(c.key));
  const customAllOn =
    filteredCustom.length > 0 && filteredCustom.every((c) => selected.has(c.key));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_45%,transparent)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-[960px] flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-6 py-4">
          <div>
            <h2 id={titleId} className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
              New export
            </h2>
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              Configure dataset, columns, and delivery method.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface)] hover:text-[var(--admin-on-surface)]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto border-b border-[var(--admin-border)] p-6 lg:border-r lg:border-b-0">
            <div className="flex flex-col gap-2">
              <span className={labelClassName}>Dataset context</span>
              <div className="flex rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-1">
                {DATASET_OPTIONS.filter((o) => capabilities.datasets.includes(o.value)).map(
                  (option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={[
                        "flex-1 rounded px-3 py-1.5 text-center text-sm transition-colors",
                        dataset === option.value
                          ? "bg-[var(--admin-surface)] font-semibold text-[var(--admin-on-surface)] shadow-sm"
                          : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                      ].join(" ")}
                      onClick={() => setDataset(option.value)}
                    >
                      {option.label}
                    </button>
                  ),
                )}
              </div>
            </div>

            {dataset === "segment_members" ? (
              <div className="flex flex-col gap-1.5">
                <label className={labelClassName} htmlFor="cf-export-segment">
                  Segment
                </label>
                <select
                  id="cf-export-segment"
                  className={fieldClassName}
                  value={segmentId}
                  onChange={(e) => setSegmentId(e.target.value)}
                >
                  {segments.length === 0 ? (
                    <option value="">No segments yet</option>
                  ) : (
                    segments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.matchedCount.toLocaleString()})
                      </option>
                    ))
                  )}
                </select>
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className={labelClassName}>Included columns</span>
                <span className="font-mono text-[13px] text-[var(--admin-primary)]">
                  {selected.size} selected
                </span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[var(--admin-on-surface-variant)]" />
                <input
                  className={`${fieldClassName} bg-[var(--admin-surface-high)] pl-10`}
                  placeholder="Search columns…"
                  value={columnQuery}
                  onChange={(e) => setColumnQuery(e.target.value)}
                />
              </div>
              <div className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded border border-[var(--admin-border)]">
                <div className="border-b border-[var(--admin-border)]">
                  <div className="flex items-center justify-between bg-[var(--admin-surface-high)] px-3 py-2">
                    <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      Learner core data
                    </span>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
                      <input
                        type="checkbox"
                        checked={learnerAllOn}
                        onChange={(e) => toggleGroup(filteredLearner, e.target.checked)}
                      />
                      All
                    </label>
                  </div>
                  <div className="max-h-40 overflow-y-auto py-1">
                    {filteredLearner.map((col) => (
                      <label
                        key={col.key}
                        className="flex cursor-pointer items-start gap-3 px-4 py-2 hover:bg-[var(--admin-surface-high)]"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected.has(col.key)}
                          onChange={() => toggleColumn(col.key)}
                        />
                        <span className="flex flex-col">
                          <span className="flex items-center gap-2 font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {col.key}
                            {col.sensitive ? (
                              <AlertTriangle
                                className="h-3.5 w-3.5 text-[var(--admin-warning)]"
                                aria-label="Contains personal data"
                              />
                            ) : null}
                          </span>
                          {col.sensitive ? (
                            <span className="font-mono text-[10px] text-[var(--admin-warning)]">
                              Contains learner personal data (PII)
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-3 py-2">
                    <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      Custom fields
                    </span>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
                      <input
                        type="checkbox"
                        checked={customAllOn}
                        onChange={(e) => toggleGroup(filteredCustom, e.target.checked)}
                      />
                      All
                    </label>
                  </div>
                  {filteredCustom.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-[var(--admin-on-surface-variant)]">
                      No custom fields defined yet.
                    </p>
                  ) : (
                    filteredCustom.map((col) => (
                      <label
                        key={col.key}
                        className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-[var(--admin-surface-high)]"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(col.key)}
                          onChange={() => toggleColumn(col.key)}
                        />
                        <span className="flex items-center gap-2">
                          {col.typeBadge ? (
                            <span
                              className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase ${typeBadgeClass(col.typeBadge)}`}
                            >
                              {col.typeBadge}
                            </span>
                          ) : null}
                          <span
                            className={`font-mono text-[13px] ${
                              selected.has(col.key)
                                ? "text-[var(--admin-on-surface)]"
                                : "text-[var(--admin-on-surface-variant)]"
                            }`}
                          >
                            {col.key.replace(/^cf:/, "")}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-6 overflow-y-auto bg-[var(--admin-surface-low)] p-6 lg:w-[380px]">
            <div className="flex flex-col gap-2">
              <span className={labelClassName}>Applied filters context</span>
              <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-3 font-mono text-[13px]">
                {dataset === "segment_members" && selectedSegment ? (
                  <div className="flex gap-2">
                    <span className="text-[var(--admin-primary)]">WHERE</span>
                    <span>segment = &quot;{selectedSegment.name}&quot;</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <span className="text-[var(--admin-primary)]">WHERE</span>
                    <span>all matched learners</span>
                  </div>
                )}
                <div className="mt-2 border-t border-[var(--admin-border)] pt-2 text-xs text-[var(--admin-on-surface-variant)]">
                  Est. output rows:{" "}
                  {dataset === "segment_members" && selectedSegment
                    ? `~${selectedSegment.matchedCount.toLocaleString()}`
                    : "depends on filters"}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className={labelClassName}>Empty value handling</span>
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  checked={emptyValueMode === "blank"}
                  onChange={() => setEmptyValueMode("blank")}
                />
                <span className="text-sm">Leave blank (null)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  checked={emptyValueMode === "emdash"}
                  onChange={() => setEmptyValueMode("emdash")}
                />
                <span className="text-sm">Use literal string &quot;—&quot;</span>
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className={labelClassName}>Export format</span>
              <div className="flex gap-3">
                {capabilities.formats.map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={[
                      "flex flex-1 flex-col items-center rounded border p-3 font-mono text-[13px] font-bold uppercase transition-colors",
                      format === fmt
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] text-[var(--admin-primary)]"
                        : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                    ].join(" ")}
                  >
                    .{fmt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className={labelClassName}>Delivery method</span>
              <select
                className={fieldClassName}
                value={delivery}
                onChange={(e) => setDelivery(e.target.value as CustomFieldExportDelivery)}
              >
                <option value="download">Download now</option>
                {capabilities.canEmailDelivery ? (
                  <option value="email_me">Email me when ready</option>
                ) : null}
                {capabilities.canEmailDelivery ? (
                  <option value="recipients">Send to recipients…</option>
                ) : null}
              </select>
              {delivery === "recipients" ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      className={fieldClassName}
                      placeholder="ops@company.com"
                      value={recipientInput}
                      onChange={(e) => setRecipientInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addRecipient();
                        }
                      }}
                    />
                    <button type="button" className={ghostButtonClassName} onClick={addRecipient}>
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {recipients.map((email) => (
                      <button
                        key={email}
                        type="button"
                        className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-0.5 font-mono text-[10px]"
                        onClick={() =>
                          setRecipients((prev) => prev.filter((item) => item !== email))
                        }
                      >
                        {email} ×
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {capabilities.canWebhookDelivery ? (
                <input
                  className={fieldClassName}
                  placeholder="Optional webhook URL"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              ) : null}
            </div>

            <div className="mt-auto flex flex-col gap-3 border-t border-[var(--admin-border)] pt-4">
              <label className="flex items-center justify-between gap-3">
                <span className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Schedule this export
                </span>
                <PolicyToggle
                  checked={scheduleEnabled}
                  onChange={setScheduleEnabled}
                  disabled={!capabilities.canSchedule}
                  label="Schedule this export"
                />
              </label>
              {scheduleEnabled ? (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className={fieldClassName}
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value as CustomFieldExportCadence)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <input
                    type="time"
                    className={fieldClassName}
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                  <input
                    className={`${fieldClassName} col-span-2`}
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="Timezone"
                  />
                </div>
              ) : (
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  Automate this export cadence with a background schedule.
                </p>
              )}
            </div>
          </div>
        </div>

        {error ? (
          <div className="border-t border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] px-6 py-3 text-sm text-[var(--admin-danger)]">
            {error}
          </div>
        ) : null}

        <footer className="flex items-center justify-between border-t border-[var(--admin-border)] px-6 py-4">
          <button type="button" className={ghostButtonClassName} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className={`${primaryButtonClassName} inline-flex items-center gap-2`}
            disabled={saving || selected.size === 0}
            onClick={() => void handleSubmit()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Generate export
          </button>
        </footer>

        <div className="flex items-start gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-6 py-3 text-xs text-[var(--admin-on-surface-variant)]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--admin-primary)]" />
          <span>{capabilities.note}</span>
        </div>
      </div>
    </div>
  );
}
