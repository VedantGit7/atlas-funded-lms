"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  manageDangerButtonClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { formatRelative, formatTimestamp } from "./attribution-shared";
import {
  previewAttributionRetention,
  purgeAttributionEventsNow,
  saveAttributionRetention,
  type AttributionRetention,
  type SectionResult,
} from "./attribution-settings-api";

/**
 * Retention for the attribution event log.
 *
 * The only control in this console that deletes marketing history, so the whole
 * panel is built around making the consequence visible before it happens:
 * choosing a window shows what it would delete, saving deletes nothing, and the
 * purge that does delete asks first.
 */

const OFF_VALUE = "off";

/**
 * Offered windows.
 *
 * Quarters and years, because that is how campaign reporting is read. The floor
 * comes from the server rather than being assumed here.
 */
const WINDOW_OPTIONS = [
  { value: OFF_VALUE, label: "Keep everything", days: null as number | null },
  { value: "90", label: "90 days", days: 90 },
  { value: "180", label: "180 days", days: 180 },
  { value: "365", label: "1 year", days: 365 },
  { value: "730", label: "2 years", days: 730 },
  { value: "1095", label: "3 years", days: 1095 },
];

const panelClassName =
  "admin-glass overflow-hidden rounded-xl border border-[var(--admin-border)] motion-safe:animate-[admin-fade-in_0.2s_ease-out]";

const panelHeaderClassName =
  "border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-5 py-3.5";

const panelTitleClassName = "text-sm font-bold text-[var(--admin-on-surface)]";

const hintClassName = "mt-0.5 text-xs text-[var(--admin-on-surface-variant)]";

function optionFor(days: number | null): string {
  if (days === null) return OFF_VALUE;
  return WINDOW_OPTIONS.find((option) => option.days === days)?.value ?? String(days);
}

export function AttributionRetentionPanel({
  result,
  onChanged,
}: {
  result: SectionResult<AttributionRetention> | null;
  onChanged: () => void;
}) {
  const loaded = result?.kind === "ok" ? result.data : null;

  const [selected, setSelected] = useState<string>(OFF_VALUE);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const current = loaded?.retentionDays ?? null;

  useEffect(() => {
    setSelected(optionFor(current));
  }, [current]);

  const selectedDays =
    WINDOW_OPTIONS.find((option) => option.value === selected)?.days ??
    (selected === OFF_VALUE ? null : Number(selected));
  const dirty = selectedDays !== current;

  // Asking what a window costs is free and read-only, so it happens as soon as
  // the operator picks one rather than after they commit.
  useEffect(() => {
    if (loaded === null || !dirty || selectedDays === null) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewing(true);
    previewAttributionRetention(selectedDays)
      .then((result_) => {
        if (!cancelled) setPreview(result_.deletable);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, dirty, selectedDays]);

  if (result === null) return null;

  if (result.kind !== "ok" || loaded === null) {
    return (
      <section className={panelClassName}>
        <div className={panelHeaderClassName}>
          <h2 className={panelTitleClassName}>Event retention</h2>
        </div>
        <p className="px-5 py-6 text-sm text-[var(--admin-on-surface-variant)]">
          {result.kind === "forbidden"
            ? "Your role cannot read the retention policy. The rest of this page is unaffected."
            : result.kind === "error"
              ? result.message
              : null}
        </p>
      </section>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveAttributionRetention(selectedDays);
      // Saving is not deleting. Say so, because an operator who just chose
      // "90 days" over three years of history will reasonably assume it was.
      setNotice(
        selectedDays === null
          ? "Retention is off. Nothing will be deleted."
          : "Saved. Nothing has been deleted yet — the nightly sweep will purge events past the window, or you can run it now.",
      );
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "The window could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function purge() {
    setPurging(true);
    setError(null);
    setNotice(null);
    try {
      const outcome = await purgeAttributionEventsNow();
      setNotice(
        outcome.moreRemaining
          ? `Deleted ${outcome.deleted.toLocaleString()} events. More remain past the window — run again, or leave them to the nightly sweep.`
          : `Deleted ${outcome.deleted.toLocaleString()} ${outcome.deleted === 1 ? "event" : "events"}.`,
      );
      setConfirmPurge(false);
      onChanged();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "The purge could not be run.");
    } finally {
      setPurging(false);
    }
  }

  const activeLabel =
    WINDOW_OPTIONS.find((option) => option.value === selected)?.label ??
    `${String(selectedDays ?? 0)} days`;

  return (
    <section className={panelClassName}>
      <div className={panelHeaderClassName}>
        <h2 className={panelTitleClassName}>Event retention</h2>
        <p className={hintClassName}>
          {current === null
            ? "Keeping everything. The log grows without bound."
            : `Keeping ${current} days`}
          {loaded.updatedAt === null
            ? ""
            : ` · set ${formatRelative(loaded.updatedAt)}${
                loaded.updatedByName === null ? "" : ` by ${loaded.updatedByName}`
              }`}
        </p>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <DropdownField
              label={
                <span
                  className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
                  id="retention-window-label"
                >
                  Keep events for
                </span>
              }
              labelId="retention-window"
              open={open}
              panelAriaLabel="Retention window"
              onToggle={() => {
                setOpen((previous) => !previous);
              }}
              triggerContent={activeLabel}
            >
              <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
                {WINDOW_OPTIONS.filter(
                  (option) => option.days === null || option.days >= loaded.minRetentionDays,
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === selected}
                    className={dropdownItemClassName}
                    onClick={() => {
                      setSelected(option.value);
                      setOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </DropdownField>
          </div>

          <button
            type="button"
            className={managePrimaryButtonClassName}
            disabled={!dirty || saving}
            onClick={() => {
              void save();
            }}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
            ) : null}
            Save window
          </button>
        </div>

        {dirty && selectedDays !== null ? (
          <div className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-4 py-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              {/* The number is the point. "Save" over three years of history is
                  a very different decision from "save" over none. */}
              {previewing ? (
                "Working out what this would delete…"
              ) : preview === null ? (
                "This window applies to events older than it, once the purge runs."
              ) : preview === 0 ? (
                "Nothing currently falls outside this window."
              ) : (
                <>
                  <span className="font-semibold text-[var(--admin-on-surface)]">
                    {preview.toLocaleString()}
                  </span>{" "}
                  of {loaded.totalEvents.toLocaleString()} events fall outside this window and will
                  be deleted once the purge runs. Attribution events cannot be recovered.
                </>
              )}
            </p>
          </div>
        ) : null}

        <dl className="space-y-2 border-t border-[var(--admin-border)] pt-4 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[var(--admin-on-surface-variant)]">Events held</dt>
            <dd className="font-data tabular-nums text-[var(--admin-on-surface)]">
              {loaded.totalEvents.toLocaleString()}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[var(--admin-on-surface-variant)]">Oldest event</dt>
            <dd className="font-data text-[var(--admin-on-surface)]">
              {loaded.oldestOccurredAt === null ? "—" : formatTimestamp(loaded.oldestOccurredAt)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[var(--admin-on-surface-variant)]">Past the current window</dt>
            <dd
              className={`font-data tabular-nums ${
                loaded.deletableNow > 0
                  ? "text-[var(--admin-warning)]"
                  : "text-[var(--admin-on-surface)]"
              }`}
            >
              {loaded.deletableNow.toLocaleString()}
            </dd>
          </div>
        </dl>

        {loaded.deletableNow > 0 ? (
          <div className="border-t border-[var(--admin-border)] pt-4">
            {confirmPurge ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--admin-on-surface)]">
                  {/* An irreversible action names its own consequence rather
                      than asking "are you sure". */}
                  Delete {loaded.deletableNow.toLocaleString()} attribution events older than{" "}
                  {current} days? This cannot be undone, and every report over that period will
                  change.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={manageDangerButtonClassName}
                    disabled={purging}
                    onClick={() => {
                      void purge();
                    }}
                  >
                    {purging ? (
                      <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    )}
                    {purging ? "Deleting…" : "Delete them"}
                  </button>
                  <button
                    type="button"
                    className={manageSecondaryButtonClassName}
                    disabled={purging}
                    onClick={() => {
                      setConfirmPurge(false);
                    }}
                  >
                    Keep them
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={manageSecondaryButtonClassName}
                onClick={() => {
                  setConfirmPurge(true);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Purge them now
              </button>
            )}
            <p className={hintClassName}>
              The nightly sweep does this automatically. Running it here only makes it happen
              sooner.
            </p>
          </div>
        ) : null}

        {error !== null ? (
          <p role="alert" className="text-sm font-semibold text-[var(--admin-danger)]">
            {error}
          </p>
        ) : null}
        {notice !== null ? (
          <p role="status" className="text-sm text-[var(--admin-on-surface-variant)]">
            {notice}
          </p>
        ) : null}
      </div>
    </section>
  );
}
