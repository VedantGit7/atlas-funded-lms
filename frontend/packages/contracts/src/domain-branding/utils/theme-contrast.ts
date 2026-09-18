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

/** sRGB channel (0-255) to its linear-light value, per WCAG 2.x. */
function toLinearChannel(channel: number): number {
  const scaled = channel / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: Rgb): number {
  // Applying the transform per channel keeps each value typed as a number.
  // Mapping into an array lost that: indexing gave `number | undefined`, so the
  // old code needed three non-null assertions to compile.
  return 0.2126 * toLinearChannel(r) + 0.7152 * toLinearChannel(g) + 0.0722 * toLinearChannel(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(
    relativeLuminance(hexToRgb(foreground)),
    relativeLuminance(hexToRgb(background)),
  );
  const darker = Math.min(
    relativeLuminance(hexToRgb(foreground)),
    relativeLuminance(hexToRgb(background)),
  );
  return (lighter + 0.05) / (darker + 0.05);
}

export type ThemeContrastIssue = {
  pair: string;
  ratio: number;
  minimum: number;
};

const MIN_PRIMARY_BUTTON_CONTRAST = 3;

export function validateThemeContrast(
  tokens: UpdateTenantThemeRequest["tokens"],
): ThemeContrastIssue[] {
  const issues: ThemeContrastIssue[] = [];

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
