import { NextResponse } from "next/server";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { getPublicMarketingIntegrationSnippets } from "../../../../../../../server/marketing-integrations/marketing-integrations.service";
import { routeMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Marketing integrations public snippets (Learnyst-style Code Snippets runtime).

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const tenant = await resolveRequestTenant(req);
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
