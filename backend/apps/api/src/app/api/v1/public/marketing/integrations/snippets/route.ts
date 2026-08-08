import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { getPublicMarketingIntegrationSnippets } from "../../../../../../../server/marketing-integrations/marketing-integrations.service";
import { routeMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Marketing integrations public snippets (Learnyst-style Code Snippets runtime).

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const result = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) => getPublicMarketingIntegrationSnippets(tx),
    );
    return NextResponse.json(result, {
      status: 200,
      headers: { "cache-control": "public, max-age=30" },
    });
  });
});
