"use client";

import type { ReactNode } from "react";
import { checkboxClassName } from "../roles/role-editor-shared";
import {
  fieldClassName,
  labelClassName,
  selectClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";
import { isPlainObject } from "./config-json-utils";

type ConfigSectionFormProps = {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  depth?: number;
};

export function ConfigSectionForm({ value, onChange, depth = 0 }: ConfigSectionFormProps) {
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)]/50 px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
        No settings in this section yet. Switch to JSON mode to add keys, or use Advanced to edit
        the full document.
      </p>
    );
  }

  return (
    <div
      className={depth > 0 ? "space-y-4 border-l-2 border-[var(--admin-border)] pl-4" : "space-y-4"}
    >
      {entries.map(([key, fieldValue]) => (
        <ConfigField
          key={key}
          fieldKey={key}
          value={fieldValue}
          depth={depth}
          onChange={(next) => {
            onChange({ ...value, [key]: next });
          }}
        />
      ))}
    </div>
  );
}

function ConfigField({
  fieldKey,
  value,
  onChange,
  depth,
}: {
  fieldKey: string;
  value: unknown;
  onChange: (value: unknown) => void;
  depth: number;
}) {
  const label = formatFieldLabel(fieldKey);

  if (typeof value === "boolean") {
    return (
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)]/40 px-4 py-3 motion-safe:transition-colors hover:bg-[var(--admin-surface-low)]">
        <input
          type="checkbox"
          checked={value}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          className={`${checkboxClassName} mt-0.5`}
        />
        <span>
          <span className="block text-sm font-medium text-[var(--admin-on-surface)]">{label}</span>
          <span className="mt-0.5 block font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {fieldKey}
          </span>
        </span>
      </label>
    );
  }

  if (typeof value === "number") {
    return (
      <FieldShell label={label} fieldKey={fieldKey}>
        <input
          type="number"
          value={value}
          onChange={(event) => {
            onChange(Number(event.target.value));
          }}
          className={fieldClassName}
        />
      </FieldShell>
    );
  }

  if (typeof value === "string") {
    const multiline = value.length > 80 || value.includes("\n");
    return (
      <FieldShell label={label} fieldKey={fieldKey}>
        {multiline ? (
          <textarea
            rows={3}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            className={`${fieldClassName} resize-none`}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            className={fieldClassName}
          />
        )}
      </FieldShell>
    );
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return (
      <FieldShell label={label} fieldKey={fieldKey}>
        <textarea
          rows={Math.min(8, Math.max(3, value.length + 1))}
          value={value.join("\n")}
          onChange={(event) => {
            const lines = event.target.value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
            onChange(lines);
          }}
          placeholder="One value per line"
          className={`${fieldClassName} resize-none font-mono text-xs`}
        />
        <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">One entry per line</p>
      </FieldShell>
    );
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return (
      <FieldShell label={label} fieldKey={fieldKey}>
        <input
          type="text"
          value={value.join(", ")}
          onChange={(event) => {
            const numbers = event.target.value
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean)
              .map(Number)
              .filter((num) => !Number.isNaN(num));
            onChange(numbers);
          }}
          className={`${fieldClassName} font-mono text-xs`}
        />
        <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
          Comma-separated numbers
        </p>
      </FieldShell>
    );
  }

  if (isPlainObject(value) && depth < 1) {
    return (
      <fieldset className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)]/30 p-4">
        <legend className="px-1 text-sm font-semibold text-[var(--admin-on-surface)]">
          {label}
        </legend>
        <ConfigSectionForm
          value={value}
          depth={depth + 1}
          onChange={(next) => {
            onChange(next);
          }}
        />
      </fieldset>
    );
  }

  if (value === null) {
    return (
      <FieldShell label={label} fieldKey={fieldKey}>
        <select
          value="null"
          onChange={(event) => {
            if (event.target.value === "string") onChange("");
            if (event.target.value === "boolean") onChange(false);
            if (event.target.value === "number") onChange(0);
          }}
          className={selectClassName}
        >
          <option value="null">Empty (null)</option>
          <option value="string">Set text value</option>
          <option value="boolean">Set toggle</option>
          <option value="number">Set number</option>
        </select>
      </FieldShell>
    );
  }

  return (
    <FieldShell label={label} fieldKey={fieldKey}>
      <textarea
        rows={4}
        value={JSON.stringify(value, null, 2)}
        onChange={(event) => {
          try {
            onChange(JSON.parse(event.target.value));
          } catch {
            // Keep typing; parent validates on save.
          }
        }}
        className={`${fieldClassName} resize-none font-mono text-xs`}
      />
    </FieldShell>
  );
}

function FieldShell({
  label,
  fieldKey,
  children,
}: {
  label: string;
  fieldKey: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className={labelClassName}>{label}</label>
        <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">{fieldKey}</p>
      </div>
      {children}
    </div>
  );
}

function formatFieldLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
