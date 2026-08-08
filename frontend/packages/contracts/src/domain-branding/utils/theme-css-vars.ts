import type { TenantThemeSemanticPayload } from "./theme-semantic-tokens";

const RADIUS_REM: Record<"none" | "sm" | "md" | "lg" | "xl", string> = {
  none: "0rem",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
};

export function buildThemeCssVars(semantic: TenantThemeSemanticPayload): Record<string, string> {
  return {
    "--brand-primary": semantic.color.primary,
    ...(semantic.color.accent ? { "--brand-accent": semantic.color.accent } : {}),
    ...(semantic.color.header ? { "--brand-header": semantic.color.header } : {}),
    ...(semantic.color.background ? { "--tenant-background": semantic.color.background } : {}),
    ...(semantic.color.foreground ? { "--tenant-foreground": semantic.color.foreground } : {}),
    "--radius": RADIUS_REM[semantic.radius],
  };
}
