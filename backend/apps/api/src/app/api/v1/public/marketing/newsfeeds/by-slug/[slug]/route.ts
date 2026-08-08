import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { getPublicNewsfeedPostBySlug } from "../../../../../../../../server/marketing-newsfeed/marketing-newsfeed.service";
import { routeMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readSlug(req: Request): string {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  // .../public/marketing/newsfeeds/by-slug/:slug
  return decodeURIComponent(segments[segments.length - 1] ?? "");
}

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const slug = readSlug(req);
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const result = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) => getPublicNewsfeedPostBySlug(tx, slug),
    );
    return NextResponse.json(result, {
      status: 200,
      headers: { "cache-control": "public, max-age=30" },
    });
  });
});
