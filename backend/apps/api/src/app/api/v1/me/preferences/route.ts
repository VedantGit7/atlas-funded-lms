import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  getMemberPreferences,
  memberPreferencesResponseSchema,
  updateMemberPreferences,
  updateMemberPreferencesBodySchema,
} from "@atlas/membership";
import { getRouteMetadata, putRouteMetadata } from "./route.metadata";

type PreferencesResponse = z.output<typeof memberPreferencesResponseSchema>;
type UpdatePreferencesBody = z.output<typeof updateMemberPreferencesBodySchema>;

export const GET = createTenantRoute<Record<string, never>, PreferencesResponse>({
  metadata: getRouteMetadata,
  output: memberPreferencesResponseSchema,
  handler: async ({ tx, ctx }) => getMemberPreferences(tx, ctx),
});

export const PUT = createTenantRoute<UpdatePreferencesBody, PreferencesResponse>({
  metadata: putRouteMetadata,
  body: updateMemberPreferencesBodySchema,
  output: memberPreferencesResponseSchema,
  handler: async ({ tx, ctx, input }) => updateMemberPreferences(tx, ctx, input),
});
