import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { recordPublicMarketingCtaView } from "../../../../../../../server/marketing-cta/marketing-cta.service";
import { routeMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readId(req: Request): string {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  // .../public/marketing/ctas/:id/view
  return decodeURIComponent(segments.at(-2) ?? "");
}

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const id = readId(req);
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const result = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) => recordPublicMarketingCtaView(tx, id),
    );
    return NextResponse.json(result, { status: 200 });
  });
});
