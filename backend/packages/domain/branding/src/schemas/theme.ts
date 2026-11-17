import { z } from "zod";

const HexColorSchema = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);

export const TenantThemeTokensSchema = z
  .object({
    primary: HexColorSchema,
    accent: HexColorSchema.optional(),
    header: HexColorSchema.optional(),
    radius: z.enum(["none", "sm", "md", "lg", "xl"]).default("md"),
    modeDefault: z.enum(["system", "light", "dark"]).default("system"),
    /**
     * The look beyond the colours. "classic" is the standard palette, which
     * only the colours above tint. "sky-glass" restyles every surface: ice
     * backgrounds, ink text, one bright blue, frosted cards, and Manrope with
     * IBM Plex Mono (src/styles/skins/sky-glass.css in the web app). Themes
     * saved before skins existed read as "classic".
     */
    skin: z.enum(["classic", "sky-glass"]).default("classic"),
  })
  .strict();

export type TenantThemeSkin = z.infer<typeof TenantThemeTokensSchema>["skin"];

export const TenantThemeViewSchema = z.object({
  tenantId: z.uuid(),
  tokens: TenantThemeTokensSchema,
  status: z.enum(["DRAFT", "PUBLISHED"]),
  version: z.number().int().min(0),
  updatedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
});

export const UpdateTenantThemeRequestSchema = z.object({
  tokens: TenantThemeTokensSchema,
});

export const ThemeResponseSchema = z.object({
  data: TenantThemeViewSchema,
  publishedBaselineTokens: TenantThemeTokensSchema.nullable(),
});

export type UpdateTenantThemeRequest = z.infer<typeof UpdateTenantThemeRequestSchema>;
