"use client";

import { PlusCircle, Trash2 } from "lucide-react";
import type { PathGateDraft, PathGateType } from "../learning-path-step-utils";
import { createGate, defaultGateConfig } from "../learning-path-step-utils";
import {
  GATE_TYPE_OPTIONS,
  formatGateLabel,
  inputClass,
  labelClass,
  secondaryButtonClassName,
} from "../learning-path-studio-shared";

type PathGateEditorFormProps = {
  gates: PathGateDraft[];
  disabled?: boolean;
  onChange: (gates: PathGateDraft[]) => void;
};

function updateGateConfig(gate: PathGateDraft, patch: Record<string, unknown>): PathGateDraft {
  return {
    ...gate,
    config: { ...gate.config, ...patch },
  };
}

function GateConfigFields({
  gate,
  disabled,
  onPatch,
}: {
  gate: PathGateDraft;
  disabled?: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  if (gate.gateType === "competency_band") {
    const bandKey =
      typeof gate.config["bandKey"] === "string"
        ? gate.config["bandKey"]
        : typeof gate.config["minBandKey"] === "string"
          ? gate.config["minBandKey"]
          : "";

    return (
      <div>
        <label className={labelClass} htmlFor={`gate-band-${gate.id}`}>
          Minimum band key
        </label>
        <input
          id={`gate-band-${gate.id}`}
          value={bandKey}
          disabled={disabled}
          onChange={(event) => {
            onPatch({ bandKey: event.target.value.trim() });
          }}
          className={inputClass}
          placeholder="e.g. ready"
        />
      </div>
    );
  }

  if (gate.gateType === "time_based") {
    const daysRaw = gate.config["daysSinceEnroll"];
    const days = typeof daysRaw === "number" ? String(daysRaw) : "";
    const availableFrom =
      typeof gate.config["availableFrom"] === "string"
        ? gate.config["availableFrom"].slice(0, 10)
        : "";

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`gate-days-${gate.id}`}>
            Days since enroll
          </label>
          <input
            id={`gate-days-${gate.id}`}
            type="number"
            min={0}
            value={days}
            disabled={disabled}
            onChange={(event) => {
              const next = event.target.value.trim();
              onPatch({
                daysSinceEnroll: next.length > 0 ? Number(next) : undefined,
              });
            }}
            className={inputClass}
            placeholder="7"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`gate-date-${gate.id}`}>
            Or unlock date
          </label>
          <input
            id={`gate-date-${gate.id}`}
            type="date"
            value={availableFrom}
            disabled={disabled}
            onChange={(event) => {
              const next = event.target.value;
              onPatch({
                availableFrom: next ? `${next}T00:00:00.000Z` : undefined,
              });
            }}
            className={inputClass}
          />
        </div>
      </div>
    );
  }

  if (gate.gateType === "assessment_passed") {
    const assessmentId =
      typeof gate.config["assessmentId"] === "string" ? gate.config["assessmentId"] : "";

    return (
      <div>
        <label className={labelClass} htmlFor={`gate-assessment-${gate.id}`}>
          Assessment ID override
        </label>
        <input
          id={`gate-assessment-${gate.id}`}
          value={assessmentId}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value.trim();
            onPatch({ assessmentId: next.length > 0 ? next : undefined });
          }}
          className={`${inputClass} font-mono`}
          placeholder="Optional. Defaults to the step resource."
        />
      </div>
    );
  }

  return (
    <p className="text-xs text-[var(--admin-on-surface-variant)]">
      {formatGateLabel(gate.gateType, gate.config)}
    </p>
  );
}

export function PathGateEditorForm({ gates, disabled = false, onChange }: PathGateEditorFormProps) {
  function replaceGate(index: number, nextGate: PathGateDraft) {
    onChange(gates.map((gate, gateIndex) => (gateIndex === index ? nextGate : gate)));
  }

  function removeGate(index: number) {
    onChange(gates.filter((_, gateIndex) => gateIndex !== index));
  }

  function addGate(gateType: PathGateType) {
    onChange([...gates, createGate(gateType)]);
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
          Gates
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="add-gate-type">
            Add gate type
          </label>
          <select
            id="add-gate-type"
            defaultValue=""
            disabled={disabled}
            onChange={(event) => {
              const value = event.target.value as PathGateType | "";
              if (!value) return;
              addGate(value);
              event.currentTarget.value = "";
            }}
            className={`${inputClass} w-auto py-1.5 pl-2 pr-8 text-xs`}
          >
            <option value="">Add gate...</option>
            {GATE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {gates.length === 0 ? (
        <p className="text-xs text-[var(--admin-on-surface-variant)]">
          No gates configured. Add at least one gate to control when this step unlocks.
        </p>
      ) : (
        <div className="space-y-3">
          {gates.map((gate, index) => (
            <div
              key={gate.id}
              className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <select
                  value={gate.gateType}
                  disabled={disabled}
                  onChange={(event) => {
                    const gateType = event.target.value as PathGateType;
                    replaceGate(index, {
                      ...gate,
                      gateType,
                      config: defaultGateConfig(gateType),
                    });
                  }}
                  className={`${inputClass} w-auto py-1.5 pl-2 pr-8 text-xs font-semibold`}
                  aria-label="Gate type"
                >
                  {GATE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label="Remove gate"
                  onClick={() => {
                    removeGate(index);
                  }}
                  className="rounded-lg p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <GateConfigFields
                gate={gate}
                disabled={disabled}
                onPatch={(patch) => {
                  replaceGate(index, updateGateConfig(gate, patch));
                }}
              />
            </div>
          ))}
        </div>
      )}

      {gates.length > 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            addGate("open");
          }}
          className={`${secondaryButtonClassName} text-xs`}
        >
          <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Add another gate
        </button>
      ) : null}
    </div>
  );
}
