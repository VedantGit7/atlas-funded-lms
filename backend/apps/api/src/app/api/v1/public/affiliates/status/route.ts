import { NextResponse } from "next/server";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { getPublicAffiliateStatus } from "../../../../../../server/sales-affiliates/sales-affiliates.service";
import { routeMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const tenant = await resolveRequestTenant(req);
  const result = await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => getPublicAffiliateStatus(tx),
  );
  return NextResponse.json(result, {
    status: 200,
    headers: { "cache-control": "public, max-age=30" },
  });
});
