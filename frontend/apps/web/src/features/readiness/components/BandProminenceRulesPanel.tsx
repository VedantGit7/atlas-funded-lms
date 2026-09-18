"use client";

import { Plus, Trash2 } from "lucide-react";
import { AdminSelectDropdown } from "./AdminSelectDropdown";
import {
  monoClassName,
  panelAddButtonClassName,
  panelBodyClassName,
  panelClassName,
  panelHeaderClassName,
  prominenceLabel,
  prominenceOptions,
  ruleRowClassName,
} from "../readiness-admin-shared";

type BandProminenceRulesPanelProps = {
  rules: Array<{ bandKey: string; prominence: string }>;
  onChange: (rules: Array<{ bandKey: string; prominence: string }>) => void;
  disabled?: boolean;
};

export function BandProminenceRulesPanel({
  rules,
  onChange,
  disabled,
}: BandProminenceRulesPanelProps) {
  const updateRule = (index: number, patch: Partial<{ bandKey: string; prominence: string }>) => {
    onChange(rules.map((rule, idx) => (idx === index ? { ...rule, ...patch } : rule)));
  };

  const addRule = () => {
    onChange([...rules, { bandKey: "", prominence: "hidden" }]);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, idx) => idx !== index));
  };

  const prominenceSelectOptions = prominenceOptions.map((option) => ({
    value: option,
    label: prominenceLabel(option),
  }));

  return (
    <section className={panelClassName} aria-labelledby="band-prominence-heading">
      <div className={`${panelHeaderClassName} items-start`}>
        <div className="min-w-0 flex-1 pr-2">
          <h2
            id="band-prominence-heading"
            className="text-base font-semibold text-[var(--admin-on-surface)]"
          >
            Band Prominence Rules
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--admin-on-surface-variant)]">
            Configure how score bands are visually prioritized on the learner readiness view.
          </p>
        </div>
        <button
          type="button"
          className={panelAddButtonClassName}
          onClick={addRule}
          disabled={disabled}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Add rule
        </button>
      </div>

      <div className={`${panelBodyClassName} space-y-2`}>
        {rules.length === 0 ? (
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            No prominence rules yet. Add a rule to map competency bands to CTA visibility.
          </p>
        ) : (
          rules.map((rule, index) => (
            <div key={`rule-${String(index)}`} className={ruleRowClassName}>
              <div className="sm:col-span-4">
                <label className="sr-only" htmlFor={`band-key-${String(index)}`}>
                  Band key
                </label>
                <input
                  id={`band-key-${String(index)}`}
                  className={`${monoClassName} w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2.5 uppercase text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/25 disabled:opacity-60`}
                  value={rule.bandKey}
                  placeholder="band_key"
                  disabled={disabled}
                  onChange={(event) => {
                    updateRule(index, { bandKey: event.target.value });
                  }}
                />
              </div>
              <div className="sm:col-span-6">
                <AdminSelectDropdown
                  id={`prominence-${String(index)}`}
                  value={rule.prominence}
                  options={prominenceSelectOptions}
                  disabled={disabled ?? false}
                  label={null}
                  ariaLabel={`Prominence for ${rule.bandKey || "band"}`}
                  onChange={(value) => {
                    updateRule(index, { prominence: value });
                  }}
                />
              </div>
              <div className="flex justify-end sm:col-span-2">
                <button
                  type="button"
                  className="rounded-lg p-2 text-[var(--admin-danger)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] disabled:opacity-40"
                  onClick={() => {
                    removeRule(index);
                  }}
                  disabled={disabled || rules.length <= 1}
                  aria-label={`Remove rule for ${rule.bandKey || "band"}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
