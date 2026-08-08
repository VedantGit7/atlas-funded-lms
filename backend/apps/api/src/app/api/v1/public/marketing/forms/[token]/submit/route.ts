import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { submitPublicMarketingForm } from "../../../../../../../../server/marketing-forms/marketing-forms.service";
import { routeMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readToken(req: Request): string {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  // .../public/marketing/forms/:token/submit
  const submitIdx = segments.lastIndexOf("submit");
  return decodeURIComponent(segments[submitIdx - 1] ?? "");
}

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const token = readToken(req);
  const body: unknown = await req.json();
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const result = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        submitPublicMarketingForm(
          tx,
          { tenantId: tenant.tenantId, requestId },
          token,
          body,
        ),
    );
    return NextResponse.json(result, { status: 200 });
  });
});
