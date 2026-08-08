import type { UpdateTenantThemeRequest } from "../schemas/theme";

type Rgb = readonly [number, number, number];

function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((channel) => channel + channel)
          .join("")
      : normalized;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channels = [r, g, b].map((channel) => {
    const scaled = channel / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(hexToRgb(foreground)), relativeLuminance(hexToRgb(background)));
  const darker = Math.min(relativeLuminance(hexToRgb(foreground)), relativeLuminance(hexToRgb(background)));
  return (lighter + 0.05) / (darker + 0.05);
}

export type ThemeContrastIssue = {
  pair: string;
  ratio: number;
  minimum: number;
};

const MIN_BODY_CONTRAST = 4.5;
const MIN_PRIMARY_BUTTON_CONTRAST = 3;

export function validateThemeContrast(tokens: UpdateTenantThemeRequest["tokens"]): ThemeContrastIssue[] {
  const background = tokens.background ?? "#ffffff";
  const foreground = tokens.foreground ?? "#101010";
  const issues: ThemeContrastIssue[] = [];

  const bodyRatio = contrastRatio(foreground, background);
  if (bodyRatio < MIN_BODY_CONTRAST) {
    issues.push({
      pair: "foreground on background",
      ratio: bodyRatio,
      minimum: MIN_BODY_CONTRAST,
    });
  }

  const buttonRatio = contrastRatio("#ffffff", tokens.primary);
  if (buttonRatio < MIN_PRIMARY_BUTTON_CONTRAST) {
    issues.push({
      pair: "white on primary",
      ratio: buttonRatio,
      minimum: MIN_PRIMARY_BUTTON_CONTRAST,
    });
  }

  return issues;
}
