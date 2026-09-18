import type { UpdateTenantThemeRequest } from "../schemas/theme";

export const RESERVED_SEMANTIC_THEME_TOKEN_KEYS = ["destructive", "warning", "success"] as const;

export type TenantThemeSemanticPayload = {
  color: {
    primary: string;
    accent?: string;
    header?: string;
  };
  radius: "none" | "sm" | "md" | "lg" | "xl";
  modeDefault: "system" | "light" | "dark";
};

export function mapTenantThemeToSemanticPayload(
  tokens: UpdateTenantThemeRequest["tokens"],
): TenantThemeSemanticPayload {
  return {
    color: {
      primary: tokens.primary,
      ...(tokens.accent != null ? { accent: tokens.accent } : {}),
      ...(tokens.header != null ? { header: tokens.header } : {}),
    },
    radius: tokens.radius,
    modeDefault: tokens.modeDefault,
  };
}
