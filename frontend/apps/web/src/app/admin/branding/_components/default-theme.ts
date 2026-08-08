import type { z } from "zod";
import type { TenantThemeViewSchema } from "@atlas/domain-branding/schemas/theme";

type ThemeView = z.infer<typeof TenantThemeViewSchema>;

export function createDefaultAdminTheme(tenantId: string, updatedAt: string): ThemeView {
  return {
    tenantId,
    tokens: {
      primary: "#224466",
      accent: "#8899aa",
      header: "#112233",
      background: "#ffffff",
      foreground: "#101010",
      radius: "md",
      modeDefault: "system",
    },
    status: "DRAFT",
    version: 0,
    updatedAt,
    publishedAt: null,
  };
}
