"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { z } from "zod";
import type { TenantThemeViewSchema } from "@atlas/domain-branding/schemas/theme";
import type { UpdateTenantThemeRequest } from "@atlas/domain-branding/schemas/theme";
import { THEME_PRESETS } from "@atlas/domain-branding/utils/theme-presets";
import { validateThemeContrast } from "@atlas/domain-branding/utils/theme-contrast";
import {
  BrandingAnimatedCollapsible,
  BrandingSegmentedControl,
  cardClassName,
  labelClassName,
  outlineButtonClassName,
  RADIUS_PX,
  radiusFromPx,
  sectionDescClassName,
  sectionTitleClassName,
  selectClassName,
} from "./branding-admin-shared";

type ThemeView = z.infer<typeof TenantThemeViewSchema>;
type ThemeTokens = UpdateTenantThemeRequest["tokens"];

type ThemeTokenEditorProps = {
  theme: ThemeView;
  tokens: ThemeTokens;
  onTokensChange: (tokens: ThemeTokens) => void;
  onSave: () => Promise<void>;
  busy: boolean;
};

const TOKEN_ROWS: Array<{
  key: keyof ThemeTokens;
  label: string;
  colorKey?: keyof ThemeTokens;
}> = [
  { key: "primary", label: "Primary brand", colorKey: "primary" },
  { key: "accent", label: "Accent", colorKey: "accent" },
  { key: "header", label: "Header / navigation", colorKey: "header" },
  { key: "background", label: "Background", colorKey: "background" },
  { key: "foreground", label: "Foreground text", colorKey: "foreground" },
];

export function ThemeTokenEditor({ theme, tokens, onTokensChange, onSave, busy }: ThemeTokenEditorProps) {
  const contrastIssues = useMemo(() => validateThemeContrast(tokens), [tokens]);
  const activePresetKey =
    THEME_PRESETS.find((preset) => JSON.stringify(preset.tokens) === JSON.stringify(tokens))?.key ??
    "";

  function applyPreset(presetKey: string) {
    const preset = THEME_PRESETS.find((entry) => entry.key === presetKey);
    if (preset) onTokensChange(preset.tokens);
  }

  return (
    <section className={cardClassName} aria-label="Theme token editor">
      <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className={sectionTitleClassName}>Theme tokens</h3>
          <p className={sectionDescClassName}>
            Colors, radius, and default appearance for your academy.
          </p>
        </div>
        <select
          value={activePresetKey}
          onChange={(event) => {
            if (event.target.value) applyPreset(event.target.value);
          }}
          className={`${selectClassName} w-full sm:max-w-[220px]`}
          aria-label="Theme preset"
        >
          <option value="">Custom preset</option>
          {THEME_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-0.5 px-4 py-4 sm:px-6">
        {TOKEN_ROWS.map((row) => {
          const colorKey = row.colorKey ?? row.key;
          const value = (tokens[colorKey] as string | undefined) ?? "#000000";
          return (
            <TokenSwatchRow
              key={row.key}
              label={row.label}
              value={value}
              onChange={(next) => {
                onTokensChange({ ...tokens, [colorKey]: next });
              }}
            />
          );
        })}
      </div>

      <BrandingAnimatedCollapsible open={contrastIssues.length > 0} id="theme-contrast-warning">
        {contrastIssues.length > 0 ? (
          <div className="mx-4 mb-4 flex gap-3 rounded-lg border border-[var(--admin-warning)]/40 bg-[var(--admin-warning)]/10 p-4 sm:mx-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-[var(--admin-warning)]">Accessibility warning</p>
              <ul className="mt-1 space-y-1 text-sm text-[var(--admin-on-surface-variant)]">
                {contrastIssues.map((issue) => (
                  <li key={issue.pair}>
                    {issue.pair}: {issue.ratio.toFixed(1)}:1 (WCAG AA needs {issue.minimum}:1)
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </BrandingAnimatedCollapsible>

      <div className="grid grid-cols-1 gap-6 border-t border-[var(--admin-border)] px-6 py-6 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="theme-radius" className={labelClassName}>
            Corner radius
          </label>
          <input
            id="theme-radius"
            type="range"
            min={0}
            max={16}
            step={1}
            value={RADIUS_PX[tokens.radius]}
            onChange={(event) => {
              onTokensChange({
                ...tokens,
                radius: radiusFromPx(Number(event.target.value)),
              });
            }}
            className="w-full accent-[var(--admin-primary)]"
          />
          <div className="flex justify-between text-xs text-[var(--admin-on-surface-variant)]">
            <span>Sharp</span>
            <span>{RADIUS_PX[tokens.radius]}px</span>
            <span>Pill</span>
          </div>
        </div>

        <div className="space-y-2">
          <p className={labelClassName}>Default appearance</p>
          <BrandingSegmentedControl
            value={tokens.modeDefault}
            ariaLabel="Default appearance"
            options={[
              { id: "light", label: "Light" },
              { id: "dark", label: "Dark" },
              { id: "system", label: "Auto" },
            ]}
            onChange={(modeDefault) => {
              onTokensChange({ ...tokens, modeDefault });
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--admin-border)] px-6 py-4">
        <p className="text-xs text-[var(--admin-on-surface-variant)]">
          Theme draft v{theme.version} · {theme.status.toLowerCase()}
        </p>
        <button
          type="button"
          disabled={busy || contrastIssues.length > 0}
          onClick={() => {
            void onSave();
          }}
          className={outlineButtonClassName}
        >
          {busy ? "Saving…" : "Save theme draft"}
        </button>
      </div>
    </section>
  );
}

function TokenSwatchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="group flex cursor-pointer flex-col gap-3 rounded-lg px-2 py-2.5 motion-safe:transition-colors motion-safe:duration-200 hover:bg-[var(--admin-surface-low)] sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-3">
        <span
          className="h-6 w-6 shrink-0 rounded border border-[var(--admin-border)] motion-safe:transition-[background-color] motion-safe:duration-300"
          style={{ backgroundColor: value }}
        />
        <span className="text-sm font-medium text-[var(--admin-on-surface)]">{label}</span>
      </span>
      <span className="flex items-center gap-2 self-end sm:self-auto">
        <code className="rounded bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-xs text-[var(--admin-on-surface-variant)] motion-safe:transition-colors motion-safe:duration-200 group-hover:bg-[var(--admin-surface)]">
          {value.toUpperCase()}
        </code>
        <input
          type="color"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className="h-8 w-8 cursor-pointer rounded border border-[var(--admin-border)] bg-transparent p-0"
          aria-label={`${label} color`}
        />
      </span>
    </label>
  );
}
