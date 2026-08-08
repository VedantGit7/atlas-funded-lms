import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { getEncodedStatusListCredential } from "../../../../../../../server/certificates/certificate-status-list.service";
import { resolveRequestOriginFromHeaders } from "../../../../../../../lib/server/resolve-request-origin";
import { routeMetadata } from "./route.metadata";

const statusListIdSchema = z.string().uuid();

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    const id = segments.at(-1) ?? "";
    statusListIdSchema.parse(id);

    const origin = resolveRequestOriginFromHeaders(req.headers);
    const publicUrl = `${origin}/api/v1/public/credentials/status-list/${id}`;

    const credential = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        getEncodedStatusListCredential({
          tx,
          tenantId: tenant.tenantId,
          id,
          publicUrl,
        }),
    );

    if (!credential) {
      return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    return NextResponse.json(credential, {
      headers: { "content-type": "application/ld+json" },
    });
  });
});
