import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { getPublicLandingPage } from "@atlas/domain-branding/services/public-landing.service";
import {
  PublicLandingResponseSchema,
  PublicLandingSlugParamsSchema,
} from "@atlas/domain-branding/schemas/public-landing";
import { routeMetadata } from "./route.metadata";

function readSlugFromRequest(req: Request): string {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const slug = segments.at(-1) ?? "";
  return PublicLandingSlugParamsSchema.parse({ slug }).slug;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const slug = readSlugFromRequest(req);

  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });

    const page = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) => getPublicLandingPage(tx, slug),
    );

    return NextResponse.json(PublicLandingResponseSchema.parse({ data: page }), {
      status: 200,
      headers: { "cache-control": "public, max-age=60" },
    });
  });
});
