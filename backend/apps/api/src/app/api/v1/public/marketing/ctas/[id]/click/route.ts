import { NextResponse } from "next/server";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { recordPublicMarketingCtaClick } from "@atlas/api-server/marketing-cta/marketing-cta.service";
import { routeMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readId(req: Request): string {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments.at(-2) ?? "");
}

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const id = readId(req);
  const tenant = await resolveRequestTenant(req);
  const result = await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => recordPublicMarketingCtaClick(tx, id),
  );
  return NextResponse.json(result, { status: 200 });
});
