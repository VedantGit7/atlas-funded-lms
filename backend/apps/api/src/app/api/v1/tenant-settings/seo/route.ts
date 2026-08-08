import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { resolveBrandingAssetUrl } from "@atlas/storage/branding-public-url";
import {
  tenantSeoResponseSchema,
  updateTenantSeoBodySchema,
} from "../../../../../server/tenant-settings/tenant-settings.contract";
import {
  readTenantSeoSettings,
  updateTenantSeoSettings,
} from "../../../../../server/tenant-settings/tenant-settings.service";
import { routeMetadata } from "./route.metadata";

type TenantSeoResponse = z.output<typeof tenantSeoResponseSchema>;
type UpdateTenantSeoBody = z.output<typeof updateTenantSeoBodySchema>;

export const GET = createTenantRoute<Record<string, never>, TenantSeoResponse>({
  metadata: routeMetadata.GET,
  input: noBodySchema,
  output: tenantSeoResponseSchema,
  handler: async ({ tx, ctx }) => {
    const seo = await readTenantSeoSettings(tx);
    const metaImageUrl = await resolveBrandingAssetUrl(tx, { tenantId: ctx.tenantId }, seo.metaImageRefId);
    return {
      data: {
        ...seo,
        metaImageUrl,
      },
    };
  },
});

export const PUT = createTenantRoute<UpdateTenantSeoBody, TenantSeoResponse>({
  metadata: routeMetadata.PUT,
  body: updateTenantSeoBodySchema,
  output: tenantSeoResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    const seo = await updateTenantSeoSettings(tx, input);
    const metaImageUrl = await resolveBrandingAssetUrl(tx, { tenantId: ctx.tenantId }, seo.metaImageRefId);
    return {
      data: {
        ...seo,
        metaImageUrl,
      },
    };
  },
});
