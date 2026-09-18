import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { resolveBrandingAssetUrl } from "@atlas/storage/branding-public-url";
import {
  AboutSchoolResponseSchema,
  UpdateAboutSchoolRequestSchema,
} from "@atlas/domain-branding/schemas/about-school";
import { getAboutSchoolData, updateAboutSchool } from "@atlas/domain-branding";
import { getRouteMetadata, putRouteMetadata } from "./route.metadata";

type AboutSchoolResponse = z.output<typeof AboutSchoolResponseSchema>;
type UpdateAboutSchoolRequest = z.output<typeof UpdateAboutSchoolRequestSchema>;

export const GET = createTenantRoute<Record<string, never>, AboutSchoolResponse>({
  metadata: getRouteMetadata,
  input: noBodySchema,
  output: AboutSchoolResponseSchema,
  handler: async ({ tx, ctx }) => {
    const data = await getAboutSchoolData(tx);
    const schoolImageUrl = await resolveBrandingAssetUrl(
      tx,
      { tenantId: ctx.tenantId },
      data.imageRefId,
    );
    return { data: { ...data, schoolImageUrl } };
  },
});

export const PUT = createTenantRoute<UpdateAboutSchoolRequest, AboutSchoolResponse>({
  metadata: putRouteMetadata,
  body: UpdateAboutSchoolRequestSchema,
  output: AboutSchoolResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    const data = await updateAboutSchool(tx, input);
    const schoolImageUrl = await resolveBrandingAssetUrl(
      tx,
      { tenantId: ctx.tenantId },
      data.imageRefId,
    );
    return { data: { ...data, schoolImageUrl } };
  },
});
