import { cache } from "react";
import { loadPublicBootstrap } from "./bootstrap";

export type PublicTenantBranding = {
  publicName: string | null;
  issuerName: string | null;
  themeTokens: unknown;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
};

export const loadPublicTenantBranding = cache(
  async (_context: { tenantId: string; requestId: string }): Promise<PublicTenantBranding> => {
    const bootstrap = await loadPublicBootstrap();

    return {
      publicName: bootstrap.publicName,
      issuerName: bootstrap.issuerName,
      themeTokens: bootstrap.themeTokens,
      logoLightUrl: bootstrap.logoLightUrl,
      logoDarkUrl: bootstrap.logoDarkUrl,
    };
  },
);
