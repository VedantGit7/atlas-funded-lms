import { NextResponse } from "next/server";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { listPublicNewsfeedFeed } from "../../../../../../server/marketing-newsfeed/marketing-newsfeed.service";
import { routeMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const url = new URL(req.url);
  const tag = url.searchParams.get("tag") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;

  const tenant = await resolveRequestTenant(req);
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
