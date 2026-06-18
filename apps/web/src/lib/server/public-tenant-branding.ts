import { readRuntimeBrandingProjection } from "@atlas/domain-branding";
import { withTenantTx } from "@atlas/db/with-tenant-tx";

export type PublicTenantBranding = {
  publicName: string | null;
  issuerName: string | null;
  themeTokens: unknown;
};

export async function loadPublicTenantBranding(args: {
  tenantId: string;
  requestId: string;
}): Promise<PublicTenantBranding> {
  return withTenantTx(
    {
      tenantId: args.tenantId,
      requestId: args.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      const projection = await readRuntimeBrandingProjection(tx);

      return {
        publicName: projection.publicName,
        issuerName: projection.issuerName,
        themeTokens: projection.themeTokens,
      };
    },
  );
}
