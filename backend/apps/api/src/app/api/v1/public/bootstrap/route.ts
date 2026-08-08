import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { lookupTenantFromHost, resolveRequestHostFromHeaders } from "@atlas/tenancy";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { readRuntimeBrandingProjection } from "@atlas/domain-branding";
import { buildThemeCssVars, mapTenantThemeToSemanticPayload } from "@atlas/domain-branding";
import { resolveBrandingAssetUrl } from "@atlas/storage";
import { getLearnerBillingConfigRow } from "@atlas/domain-config/repositories/learner-billing.repository";
import { getCachedFxRates } from "@atlas/domain-config/services/fx.service";
import { TenantThemeTokensSchema } from "@atlas/domain-branding/schemas/theme";
import { z } from "zod";
import { routeMetadata } from "./route.metadata";

const bootstrapResponseSchema = z.object({
  data: z.object({
    tenantId: z.string().uuid().nullable(),
    tenantSlug: z.string().nullable(),
    tenantDomainId: z.string().uuid().nullable(),
    tenantState: z
      .enum(["ACTIVE", "PROVISIONING", "SUSPENDED", "ARCHIVED", "DELETED"])
      .nullable(),
    tenantDomainStatus: z
      .enum(["PENDING", "VERIFYING", "ACTIVE", "FAILED", "REMOVED", "ERROR"])
      .nullable(),
    publicName: z.string().nullable(),
    issuerName: z.string().nullable(),
    logoLightUrl: z.string().url().nullable(),
    logoDarkUrl: z.string().url().nullable(),
    faviconUrl: z.string().url().nullable(),
    themeTokens: TenantThemeTokensSchema.nullable(),
    modeDefault: z.enum(["system", "light", "dark"]).nullable(),
    themeCssVars: z.record(z.string()).nullable(),
    homeCurrency: z.string().nullable(),
    fxBase: z.string().nullable(),
    fxRates: z.record(z.number()).nullable(),
  }),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const host = resolveRequestHostFromHeaders(req.headers);

  const tenant = await withGlobalDb(async (db) =>
    lookupTenantFromHost({ host, requestId, db }),
  );

  if (!tenant || tenant.tenantState === "DELETED") {
    return NextResponse.json(
      bootstrapResponseSchema.parse({
        data: {
          tenantId: null,
          tenantSlug: null,
          tenantDomainId: null,
          tenantState: null,
          tenantDomainStatus: null,
          publicName: null,
          issuerName: null,
          logoLightUrl: null,
          logoDarkUrl: null,
          faviconUrl: null,
          themeTokens: null,
          modeDefault: null,
          themeCssVars: null,
          homeCurrency: null,
          fxBase: null,
          fxRates: null,
        },
      }),
      { status: 200, headers: { "cache-control": "public, max-age=60" } },
    );
  }

  const { branding, logoLightUrl, logoDarkUrl, faviconUrl, homeCurrency, fxBase, fxRates } =
    await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      const projection = await readRuntimeBrandingProjection(tx);
      const [lightUrl, darkUrl, iconUrl, billingConfig, fx] = await Promise.all([
        resolveBrandingAssetUrl(tx, { tenantId: tenant.tenantId }, projection.logoLightRefId),
        resolveBrandingAssetUrl(tx, { tenantId: tenant.tenantId }, projection.logoDarkRefId),
        resolveBrandingAssetUrl(tx, { tenantId: tenant.tenantId }, projection.faviconRefId),
        getLearnerBillingConfigRow(tx),
        getCachedFxRates(tx),
      ]);

      return {
        branding: projection,
        logoLightUrl: lightUrl,
        logoDarkUrl: darkUrl,
        faviconUrl: iconUrl,
        homeCurrency: billingConfig?.home_currency ?? null,
        fxBase: fx.data.base,
        fxRates: Object.keys(fx.data.rates).length > 0 ? fx.data.rates : null,
      };
    },
  );

  const parsedTheme = TenantThemeTokensSchema.safeParse(branding.themeTokens);
  const semantic = parsedTheme.success
    ? mapTenantThemeToSemanticPayload(parsedTheme.data)
    : null;

  const themeCssVars = semantic ? buildThemeCssVars(semantic) : null;

  const body = bootstrapResponseSchema.parse({
    data: {
      tenantId: tenant.tenantId,
      tenantSlug: tenant.tenantSlug,
      tenantDomainId: tenant.tenantDomainId,
      tenantState: tenant.tenantState,
      tenantDomainStatus: tenant.tenantDomainStatus,
      publicName: branding.publicName,
      issuerName: branding.issuerName,
      logoLightUrl,
      logoDarkUrl,
      faviconUrl,
      themeTokens: parsedTheme.success ? parsedTheme.data : null,
      modeDefault: semantic?.modeDefault ?? null,
      themeCssVars,
      homeCurrency,
      fxBase,
      fxRates,
    },
  });

  return NextResponse.json(body, {
    status: 200,
    headers: { "cache-control": "public, max-age=60" },
  });
});
