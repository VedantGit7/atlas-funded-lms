import { cache } from "react";
import { serverApi } from "../server-api";
import { ServerApiError } from "../api/errors";

export type PublicBootstrapData = {
  tenantId: string | null;
  tenantSlug: string | null;
  tenantDomainId: string | null;
  tenantState: "ACTIVE" | "PROVISIONING" | "SUSPENDED" | "ARCHIVED" | "DELETED" | null;
  tenantDomainStatus: "PENDING" | "VERIFYING" | "ACTIVE" | "FAILED" | "REMOVED" | "ERROR" | null;
  publicName: string | null;
  issuerName: string | null;
  /** The tenant's own support contact, or null when they have not set one. */
  supportEmail: string | null;
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
 * This is the one place logo URLs enter the app; all shells and layouts read
 * from this bootstrap.
 *
 * It used to overwrite `logoLightUrl`, `logoDarkUrl` and `faviconUrl` with
 * FundedBeyond's mark on every response, discarding whatever the tenant had
 * uploaded. That made the per-tenant logo resolution in the shells unreachable:
 * branding always arrived already carrying tenant #1's asset. The override is
 * gone — tenant assets now flow through, and a tenant without one gets an
 * initials mark from `<TenantBrandMark />` rather than another tenant's logo.
 */
export const loadPublicBootstrap = cache(async (): Promise<PublicBootstrapData> => {
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await serverApi.get<BootstrapResponse>("/api/v1/public/bootstrap");
      return response.data;
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
