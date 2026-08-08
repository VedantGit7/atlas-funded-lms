import { z } from "zod";

const HexColorSchema = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);

export const TenantThemeTokensSchema = z
  .object({
    primary: HexColorSchema,
    accent: HexColorSchema.optional(),
    header: HexColorSchema.optional(),
    background: HexColorSchema.optional(),
    foreground: HexColorSchema.optional(),
    radius: z.enum(["none", "sm", "md", "lg", "xl"]).default("md"),
    modeDefault: z.enum(["system", "light", "dark"]).default("system"),
  })
  .strict();

export const TenantThemeViewSchema = z.object({
  tenantId: z.string().uuid(),
  tokens: TenantThemeTokensSchema,
  status: z.enum(["DRAFT", "PUBLISHED"]),
  version: z.number().int().min(0),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
});

export const UpdateTenantThemeRequestSchema = z.object({
  tokens: TenantThemeTokensSchema,
});

export const ThemeResponseSchema = z.object({
  data: TenantThemeViewSchema,
  publishedBaselineTokens: TenantThemeTokensSchema.nullable(),
});

export type UpdateTenantThemeRequest = z.infer<typeof UpdateTenantThemeRequestSchema>;
