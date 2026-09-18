"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  fieldClassName,
  labelClassName,
  monoClassName,
  panelAddButtonClassName,
  panelBodyClassName,
  panelClassName,
  panelSubheaderClassName,
} from "../readiness-admin-shared";

type LegalDisclaimersPanelProps = {
  disclaimer: string;
  bandNotes: Record<string, string>;
  disabled?: boolean;
  onDisclaimerChange: (value: string) => void;
  onBandNotesChange: (value: Record<string, string>) => void;
};

export function LegalDisclaimersPanel({
  disclaimer,
  bandNotes,
  disabled,
  onDisclaimerChange,
  onBandNotesChange,
}: LegalDisclaimersPanelProps) {
  const bandEntries = Object.entries(bandNotes);

  return (
    <section className={panelClassName} aria-labelledby="legal-disclaimers-heading">
      <div className="border-b border-[var(--admin-border)] px-4 py-3 sm:px-5">
        <h2
          id="legal-disclaimers-heading"
          className="text-base font-semibold text-[var(--admin-on-surface)]"
        >
          Legal &amp; Disclaimers
        </h2>
      </div>

      <div className={`${panelBodyClassName} space-y-0 p-0`}>
        <div className="space-y-2 px-4 py-5 sm:px-5">
          <label className={labelClassName} htmlFor="global-disclaimer">
            Global readiness disclaimer
          </label>
          <textarea
            id="global-disclaimer"
            className={`${fieldClassName} mt-1.5 min-h-[120px] resize-y text-[13px] leading-relaxed`}
            rows={4}
            value={disclaimer}
            disabled={disabled}
            onChange={(event) => {
              onDisclaimerChange(event.target.value);
            }}
          />
        </div>

        <div className={panelSubheaderClassName}>
          <p className={labelClassName}>Band-specific notes (override)</p>
          <button
            type="button"
            className={panelAddButtonClassName}
            disabled={disabled}
            onClick={() => {
              const nextKey = `band_${String(Object.keys(bandNotes).length + 1)}`;
              onBandNotesChange({ ...bandNotes, [nextKey]: "" });
            }}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Add note
          </button>
        </div>

        <div className="px-4 py-4 sm:px-5">
          {bandEntries.length === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              No band-specific legal notes configured.
            </p>
          ) : (
            <ul className="space-y-2">
              {bandEntries.map(([key, value]) => (
                <li
                  key={key}
                  className="flex items-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3"
                >
                  <span className={`${monoClassName} w-24 shrink-0 uppercase`}>{key}</span>
                  <input
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/25 disabled:opacity-60"
                    value={value}
                    disabled={disabled}
                    placeholder="Band-specific disclosure text"
                    onChange={(event) => {
                      onBandNotesChange({ ...bandNotes, [key]: event.target.value });
                    }}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-lg p-2 text-[var(--admin-danger)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] disabled:opacity-40"
                    disabled={disabled}
                    aria-label={`Remove note for ${key}`}
                    onClick={() => {
                      const next = Object.fromEntries(
                        Object.entries(bandNotes).filter(([entryKey]) => entryKey !== key),
                      );
                      onBandNotesChange(next);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
