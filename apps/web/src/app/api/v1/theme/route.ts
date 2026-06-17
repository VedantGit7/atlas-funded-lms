import type { z } from "zod";

import { createTenantRoute } from "@atlas/api/create-tenant-route";

import {
  ThemeResponseSchema,
  UpdateTenantThemeRequestSchema,
} from "@atlas/domain-branding/schemas/theme";

import { updateTenantThemeDraft } from "@atlas/domain-branding";

import { routeMetadata } from "./route.metadata";

type ThemeResponse = z.output<typeof ThemeResponseSchema>;

type UpdateTenantThemeRequest = z.output<typeof UpdateTenantThemeRequestSchema>;

export const PUT = createTenantRoute<UpdateTenantThemeRequest, ThemeResponse>({
  metadata: routeMetadata,

  body: UpdateTenantThemeRequestSchema,

  output: ThemeResponseSchema,

  handler: async ({ tx, input }) => updateTenantThemeDraft(tx, input),
});
