import type { UpdateTenantThemeRequest } from "../schemas/theme";

export type ThemeTokenDiffEntry = {
  key: keyof UpdateTenantThemeRequest["tokens"];
  before: string | undefined;
  after: string | undefined;
};

const TOKEN_LABELS: Record<keyof UpdateTenantThemeRequest["tokens"], string> = {
  primary: "Primary",
  accent: "Accent",
  header: "Header",
  background: "Background",
  foreground: "Foreground",
  radius: "Corner radius",
  modeDefault: "Default appearance",
};

export function diffThemeTokens(
  baseline: UpdateTenantThemeRequest["tokens"] | null | undefined,
  draft: UpdateTenantThemeRequest["tokens"],
): ThemeTokenDiffEntry[] {
  if (!baseline) {
    return [];
  }

  const keys = Object.keys(TOKEN_LABELS) as Array<keyof UpdateTenantThemeRequest["tokens"]>;
  return keys
    .filter((key) => baseline[key] !== draft[key])
    .map((key) => ({
      key,
      before: baseline[key] != null ? String(baseline[key]) : undefined,
      after: draft[key] != null ? String(draft[key]) : undefined,
    }));
}

export function formatThemeTokenLabel(key: keyof UpdateTenantThemeRequest["tokens"]): string {
  return TOKEN_LABELS[key];
}
