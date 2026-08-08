import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { getPublicMarketingEvent } from "../../../../../../../server/marketing-events/marketing-events.service";
import { routeMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readId(req: Request): string {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  // .../public/marketing/events/:id
  return decodeURIComponent(segments[segments.length - 1] ?? "");
}

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const id = readId(req);
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const result = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) => getPublicMarketingEvent(tx, id),
    );
    return NextResponse.json(result, {
      status: 200,
      headers: { "cache-control": "public, max-age=30" },
    });
  });
});
