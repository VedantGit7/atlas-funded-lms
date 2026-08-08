import { cache } from "react";
import { serverApi } from "../server-api";
import { ServerApiError } from "../api/errors";
import { FUNDED_BEYOND_LOGO_URL } from "../brand";

export type PublicBootstrapData = {
  tenantId: string | null;
  tenantSlug: string | null;
  tenantDomainId: string | null;
  tenantState: "ACTIVE" | "PROVISIONING" | "SUSPENDED" | "ARCHIVED" | "DELETED" | null;
  tenantDomainStatus:
    | "PENDING"
    | "VERIFYING"
    | "ACTIVE"
    | "FAILED"
    | "REMOVED"
    | "ERROR"
    | null;
  publicName: string | null;
  issuerName: string | null;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  themeTokens: unknown;
  modeDefault: "system" | "light" | "dark" | null;
  themeCssVars: Record<string, string> | null;
  homeCurrency: string | null;
  fxBase: string | null;
  fxRates: Record<string, number> | null;
};

type BootstrapResponse = { data: PublicBootstrapData };

/**
 * FundedBeyond uses a single brand mark everywhere (avatar-gradient), so the
 * tenant-uploaded light/dark logos and favicon from the API are overridden here.
 * This is the one place logo URLs enter the app; all shells and layouts read
 * from this bootstrap.
 */
function withFundedBeyondBranding(data: PublicBootstrapData): PublicBootstrapData {
  return {
    ...data,
    logoLightUrl: FUNDED_BEYOND_LOGO_URL,
    logoDarkUrl: FUNDED_BEYOND_LOGO_URL,
    faviconUrl: FUNDED_BEYOND_LOGO_URL,
  };
}

export const loadPublicBootstrap = cache(async (): Promise<PublicBootstrapData> => {
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await serverApi.get<BootstrapResponse>("/api/v1/public/bootstrap");
      return withFundedBeyondBranding(response.data);
    } catch (error) {
      const isTransient =
        error instanceof ServerApiError &&
        (error.code === "TENANT_NOT_FOUND" || error.code === "INTERNAL_ERROR");

      if (isTransient && attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }

      throw error;
    }
  }

  throw new Error("Failed to load public bootstrap");
});
