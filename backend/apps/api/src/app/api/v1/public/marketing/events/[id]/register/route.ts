import { NextResponse } from "next/server";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { registerPublicMarketingEvent } from "../../../../../../../../server/marketing-events/marketing-events.service";
import { routeMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readId(req: Request): string {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  // .../public/marketing/events/:id/register
  const registerIdx = segments.lastIndexOf("register");
  return decodeURIComponent(segments[registerIdx - 1] ?? "");
}

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const id = readId(req);
  const body: unknown = await req.json();
  const tenant = await resolveRequestTenant(req);
  const result = await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => registerPublicMarketingEvent(tx, id, body),
  );
  return NextResponse.json(result, { status: 200 });
});
