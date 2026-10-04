import { NextResponse } from "next/server";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
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

  const tenant = await resolveRequestTenant(req);

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
