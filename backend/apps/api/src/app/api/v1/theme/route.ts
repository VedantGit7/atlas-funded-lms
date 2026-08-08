import type { z } from "zod";

import { createTenantRoute, noBodySchema } from "@atlas/api";

import {
  ThemeResponseSchema,
  UpdateTenantThemeRequestSchema,
} from "@atlas/domain-branding/schemas/theme";

import { readTenantTheme, updateTenantThemeDraft } from "@atlas/domain-branding";

import { getRouteMetadata, putRouteMetadata } from "./route.metadata";

type ThemeResponse = z.output<typeof ThemeResponseSchema>;

type UpdateTenantThemeRequest = z.output<typeof UpdateTenantThemeRequestSchema>;

export const GET = createTenantRoute<Record<string, never>, ThemeResponse>({
  metadata: getRouteMetadata,
  input: noBodySchema,
  output: ThemeResponseSchema,
  handler: async ({ tx }) => readTenantTheme(tx),
});

export const PUT = createTenantRoute<UpdateTenantThemeRequest, ThemeResponse>({
  metadata: putRouteMetadata,
  body: UpdateTenantThemeRequestSchema,
  output: ThemeResponseSchema,
  handler: async ({ tx, input }) => {
    await updateTenantThemeDraft(tx, input);
    return readTenantTheme(tx);
  },
});
