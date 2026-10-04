import { NextResponse } from "next/server";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { getPublicMarketingForm } from "../../../../../../../server/marketing-forms/marketing-forms.service";
import { routeMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readToken(req: Request): string {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments.at(-1) ?? "");
}

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const token = readToken(req);
  const tenant = await resolveRequestTenant(req);
  const result = await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => getPublicMarketingForm(tx, token),
  );
  return NextResponse.json(result, {
    status: 200,
    headers: { "cache-control": "public, max-age=30" },
  });
});
