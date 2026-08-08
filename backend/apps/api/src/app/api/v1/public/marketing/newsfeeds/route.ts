import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { listPublicNewsfeedFeed } from "../../../../../../server/marketing-newsfeed/marketing-newsfeed.service";
import { routeMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const url = new URL(req.url);
  const tag = url.searchParams.get("tag") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;

  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const result = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        listPublicNewsfeedFeed(tx, {
          ...(tag ? { tag } : {}),
          ...(category ? { category } : {}),
        }),
    );
    return NextResponse.json(result, {
      status: 200,
      headers: { "cache-control": "public, max-age=30" },
    });
  });
});
