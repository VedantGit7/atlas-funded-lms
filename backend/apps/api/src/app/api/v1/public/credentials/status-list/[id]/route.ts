import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { getEncodedStatusListCredential } from "../../../../../../../server/certificates/certificate-status-list.service";
import { routeMetadata } from "./route.metadata";

const statusListIdSchema = z.uuid();

function resolveOrigin(headers: Headers): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto =
    headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    const id = segments.at(-1) ?? "";
    statusListIdSchema.parse(id);

    const origin = resolveOrigin(req.headers);
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
