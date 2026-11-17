import type { UpdateTenantThemeRequest } from "../schemas/theme";

export type ThemePreset = {
  key: string;
  label: string;
  tokens: UpdateTenantThemeRequest["tokens"];
};

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    key: "atlas-navy",
    label: "Atlas navy (default)",
    tokens: {
      primary: "#224466",
      accent: "#8899aa",
      header: "#112233",
      radius: "md",
      modeDefault: "system",
      skin: "classic",
    },
  },
  {
    // The `key` is preserved because tenants may already have this preset
    // selected; only the customer-visible label changes. A preset catalogue
    // offered to every academy must not advertise one of them by name.
    key: "funded-beyond",
    label: "Deep Blue",
    tokens: {
      primary: "#3D7BF0",
      accent: "#1B2A4A",
      header: "#1B2A4A",
      radius: "md",
      modeDefault: "system",
      skin: "classic",
    },
  },
  {
    // A complete look rather than a tint: ice and white surfaces, ink text,
    // one bright blue, cyan glows, frosted cards and Manrope with IBM Plex
    // Mono. Built from an academy's brand kit (November 2026), named for the
    // look so the catalogue advertises no academy. Light by default; its dark
    // variant is a night sky in the same blues.
    key: "sky-glass",
    label: "Sky Glass",
    tokens: {
      primary: "#1E6BFF",
      accent: "#5FD4FF",
      header: "#0A1F3D",
      radius: "lg",
      modeDefault: "light",
      skin: "sky-glass",
    },
  },
  {
    key: "neutral-slate",
    label: "Neutral slate",
    tokens: {
      primary: "#334155",
      accent: "#64748b",
      header: "#1e293b",
      radius: "sm",
      modeDefault: "light",
      skin: "classic",
    },
  },
  {
    key: "emerald",
    label: "Emerald",
    tokens: {
      primary: "#047857",
      accent: "#10b981",
      header: "#064e3b",
      radius: "lg",
      modeDefault: "system",
      skin: "classic",
    },
  },
] as const;
