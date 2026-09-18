"use client";

import { useEffect, useMemo, useState } from "react";
import { Contrast, Monitor, Moon, Sun, Type, Zap } from "lucide-react";
import {
  ATLAS_UI_ACCENT_COOKIE,
  ATLAS_UI_FONT_SCALE_COOKIE,
  ATLAS_UI_HIGH_CONTRAST_COOKIE,
  ATLAS_UI_MODE_COOKIE,
  ATLAS_UI_REDUCED_MOTION_COOKIE,
} from "../../../lib/auth-cookies";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { SettingsToggleRow } from "../../account-settings/account-settings-fields";
import { AccountSettingsToast } from "../../account-settings/account-settings-toast";
import { useAccountTheme } from "../../account-settings/account-theme-context";

type UiMode = "system" | "light" | "dark";
type FontSize = "normal" | "large";

type AppearanceState = {
  mode: UiMode;
  accentColor: string | null;
  fontSize: FontSize;
  reducedMotion: boolean;
  highContrast: boolean;
};

type AppearanceFormProps = {
  initial: AppearanceState;
};

const ACCENT_PRESETS = ["#224466", "#7c3aed", "#0ea5e9", "#16a34a", "#dc2626", "#d97706"];
const MODE_OPTIONS: Array<{ value: UiMode; label: string; icon: typeof Sun }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const COOKIE_MAX_AGE = 31536000;

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${String(COOKIE_MAX_AGE)}; samesite=lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

function applyModeToDocument(mode: UiMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
  writeCookie(ATLAS_UI_MODE_COOKIE, mode);
}

function applyAccentToDocument(accentColor: string | null) {
  if (accentColor) {
    document.documentElement.style.setProperty("--user-accent", accentColor);
    writeCookie(ATLAS_UI_ACCENT_COOKIE, accentColor);
  } else {
    document.documentElement.style.removeProperty("--user-accent");
    clearCookie(ATLAS_UI_ACCENT_COOKIE);
  }
}

function applyFontSizeToDocument(fontSize: FontSize) {
  const scale = fontSize === "large" ? "1.125" : "1";
  document.documentElement.style.setProperty("--user-font-scale", scale);
  writeCookie(ATLAS_UI_FONT_SCALE_COOKIE, scale);
}

function applyReducedMotionToDocument(reducedMotion: boolean) {
  document.documentElement.classList.toggle("reduce-motion", reducedMotion);
  writeCookie(ATLAS_UI_REDUCED_MOTION_COOKIE, reducedMotion ? "1" : "0");
}

function applyHighContrastToDocument(highContrast: boolean) {
  document.documentElement.classList.toggle("high-contrast", highContrast);
  writeCookie(ATLAS_UI_HIGH_CONTRAST_COOKIE, highContrast ? "1" : "0");
}

function formatClientError(error: unknown): { message: string; requestId: string | null } {
  if (error instanceof ClientApiError) {
    return { message: error.message, requestId: error.requestId };
  }
  return { message: "Unable to update appearance preferences.", requestId: null };
}

export function AppearanceForm({ initial }: AppearanceFormProps) {
  const { classes } = useAccountTheme();
  const [mode, setMode] = useState<UiMode>(initial.mode);
  const [accentColor, setAccentColor] = useState<string | null>(initial.accentColor);
  const [fontSize, setFontSize] = useState<FontSize>(initial.fontSize);
  const [reducedMotion, setReducedMotion] = useState(initial.reducedMotion);
  const [highContrast, setHighContrast] = useState(initial.highContrast);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const isDirty = useMemo(
    () =>
      mode !== initial.mode ||
      accentColor !== initial.accentColor ||
      fontSize !== initial.fontSize ||
      reducedMotion !== initial.reducedMotion ||
      highContrast !== initial.highContrast,
    [accentColor, fontSize, highContrast, initial, mode, reducedMotion],
  );

  // Backend (`metadata_json`) is the source of truth. Seed the client-readable
  // cookies + document from it on mount so a full reload restores these
  // settings before first paint (see ThemeInitScript) without a DB round-trip.
  useEffect(() => {
    applyModeToDocument(initial.mode);
    applyAccentToDocument(initial.accentColor);
    applyFontSizeToDocument(initial.fontSize);
    applyReducedMotionToDocument(initial.reducedMotion);
    applyHighContrastToDocument(initial.highContrast);
  }, [initial]);

  async function save() {
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.put(
        "/api/v1/me/preferences",
        { appearance: { mode, accentColor, fontSize, reducedMotion, highContrast } },
        "appearance-update",
        { silent: true },
      );
      setToastOpen(true);
    } catch (error) {
      const formatted = formatClientError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <section className={`${classes.card} space-y-6`}>
          <div>
            <h2 className={classes.sectionTitle}>Appearance</h2>
            <p className={classes.sectionDesc}>
              Personal to your account only. This never changes the academy branding for other
              members.
            </p>
          </div>

          <div className="space-y-2">
            <span className={classes.label}>Theme</span>
            <div className="grid grid-cols-3 gap-3">
              {MODE_OPTIONS.map((option) => {
                const active = mode === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setMode(option.value);
                      applyModeToDocument(option.value);
                    }}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-xs font-medium transition-all motion-safe:active:scale-[0.98] ${
                      active
                        ? "border-[var(--acct-primary)] bg-[color-mix(in_srgb,var(--acct-primary-container)_10%,transparent)] text-[var(--acct-on-surface)]"
                        : "border-[var(--acct-border)] text-[var(--acct-on-surface-variant)] hover:border-[var(--acct-outline)] hover:text-[var(--acct-on-surface)]"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${active ? "text-[var(--acct-primary)]" : ""}`}
                      aria-hidden="true"
                    />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className={classes.label}>Accent color</span>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`Use accent ${preset}`}
                  aria-pressed={accentColor === preset}
                  onClick={() => {
                    setAccentColor(preset);
                    applyAccentToDocument(preset);
                  }}
                  className="h-7 w-7 rounded-full border border-[var(--acct-border)] transition-transform motion-safe:active:scale-90"
                  style={{
                    backgroundColor: preset,
                    outline: accentColor === preset ? "2px solid var(--acct-on-surface)" : "none",
                    outlineOffset: 2,
                  }}
                />
              ))}
              <input
                type="color"
                value={accentColor ?? "#224466"}
                onChange={(event) => {
                  setAccentColor(event.target.value);
                  applyAccentToDocument(event.target.value);
                }}
                aria-label="Custom accent color"
                className="h-7 w-7 cursor-pointer rounded-full border border-[var(--acct-border)] bg-transparent p-0"
              />
              <button
                type="button"
                className={`${classes.ghostButton} ml-1`}
                onClick={() => {
                  setAccentColor(null);
                  applyAccentToDocument(null);
                }}
              >
                Reset to default
              </button>
            </div>
          </div>
        </section>

        <section className={classes.card}>
          <div className="mb-4">
            <h2 className={classes.sectionTitle}>Accessibility</h2>
            <p className={classes.sectionDesc}>
              Make the academy easier to read and navigate. These changes apply instantly.
            </p>
          </div>
          <div className={classes.panel}>
            <SettingsToggleRow
              icon={Type}
              title="Larger text"
              description="Increase the base font size across the app."
              checked={fontSize === "large"}
              onChange={(checked) => {
                const next: FontSize = checked ? "large" : "normal";
                setFontSize(next);
                applyFontSizeToDocument(next);
              }}
            />
            <SettingsToggleRow
              icon={Zap}
              title="Reduce motion"
              description="Minimize animations and transitions."
              checked={reducedMotion}
              onChange={(checked) => {
                setReducedMotion(checked);
                applyReducedMotionToDocument(checked);
              }}
            />
            <SettingsToggleRow
              icon={Contrast}
              title="High contrast"
              description="Strengthen borders and text contrast for better legibility."
              checked={highContrast}
              onChange={(checked) => {
                setHighContrast(checked);
                applyHighContrastToDocument(checked);
              }}
            />
          </div>

          <div
            className={`mt-6 flex items-center justify-end gap-4 border-t pt-6 ${classes.divider}`}
          >
            <button
              type="submit"
              className={isDirty && !busy ? classes.primaryButton : classes.primaryButtonMuted}
              disabled={!isDirty || busy}
            >
              {busy ? "Saving…" : "Save preferences"}
            </button>
          </div>

          {message ? (
            <p role="alert" className={`${classes.errorBanner} mt-6`}>
              {message}
              {requestId ? ` Request ID: ${requestId}` : ""}
            </p>
          ) : null}
        </section>
      </form>

      <AccountSettingsToast
        message="Appearance preferences saved"
        open={toastOpen}
        onClose={() => {
          setToastOpen(false);
        }}
      />
    </>
  );
}
