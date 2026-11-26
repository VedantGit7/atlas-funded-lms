/**
 * Certificate Studio — Design Read & Visual System
 *
 * Design read: Dense professional credential design studio for academy admins.
 * Tenant brand. Cockpit-dense Canva/Polotno-class editor chrome; shell-free.
 * Dark tooling frames a light certificate paper stage. Matches Studio Home +
 * Canvas Editor mock: coral primary CTA, teal tertiary for selection/guides.
 *
 * Density dial: 8 (cockpit) | Motion: 4 (restrained tool) | Variance: 5
 *
 * Fonts: UI = Plus Jakarta Sans; labels = monospace; display = Cormorant Garamond.
 * Logo: /brand/avatar-gradient.svg (FUNDED_BEYOND_LOGO_URL)
 */

export const STUDIO_DESIGN_READ = {
  intent:
    "Dense professional credential design studio for academy admins; tenant brand; cockpit-dense Canva/Polotno-class; shell-free; coral primary + teal tertiary",
  density: 8,
  motion: 4,
  variance: 5,
} as const;

export const STUDIO_COLORS = {
  chromeBg: "#070b10",
  surface: "#131317",
  surfaceLowest: "#0e0e12",
  surfaceLow: "#1b1b1f",
  panelBg: "#0f1419",
  panelElevated: "#2a292e",
  panelHighest: "#353439",
  hairline: "rgba(255, 255, 255, 0.05)",
  /** Coral primary — Publish CTA / active tab underline */
  primary: "#ffb4a3",
  primaryContainer: "#ff6b4a",
  onPrimaryContainer: "#661000",
  /** Teal tertiary — selection, guides, bindings */
  accentTeal: "#10D9A3",
  accentBlue: "#2E6BFF",
  onSurface: "#e4e1e7",
  onSecondary: "#b9b8b4",
  muted: "#474744",
  outlineVariant: "#59413c",
  paper: "#f7f4ef",
  ink: "#1a1f26",
  danger: "#ffb4ab",
  dangerContainer: "#93000a",
} as const;

export const STUDIO_LOGO_URL = "/brand/avatar-gradient.svg";

export const STUDIO_FONTS = {
  ui: 'var(--font-jakarta), "Plus Jakarta Sans", system-ui, sans-serif',
  display: 'var(--font-cormorant), "Cormorant Garamond", "Times New Roman", serif',
  mono: 'ui-monospace, "Cascadia Code", "Segoe UI Mono", Menlo, monospace',
} as const;

/** Fallback brand swatches when no brand kit is loaded. */
export const STUDIO_DEFAULT_SWATCHES: { color: string; label: string }[] = [
  { color: STUDIO_COLORS.accentTeal, label: "Teal" },
  { color: STUDIO_COLORS.panelBg, label: "Ink dark" },
  { color: "#E5E1DA", label: "Warm gray" },
  { color: "#B69F7D", label: "Gold" },
  { color: "#F2EDE4", label: "Paper" },
];

/** CSS custom-property map for `.cert-studio` chrome. */
/**
 * Inline variables for the editor root. Colours are not set here: they come
 * from studio-chrome.css, which maps them to the app theme so the editor
 * follows light and dark mode (QA review 2 7.7). STUDIO_COLORS stays for
 * what is drawn on the canvas, which can't read CSS variables.
 */
export function studioChromeStyleVars(): Record<string, string> {
  return {
    "--studio-paper": STUDIO_COLORS.paper,
    "--studio-ink": STUDIO_COLORS.ink,
    "--studio-font-ui": STUDIO_FONTS.ui,
    "--studio-font-display": STUDIO_FONTS.display,
    "--studio-font-mono": STUDIO_FONTS.mono,
    "--studio-panel-width": "280px",
  };
}
