import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { publicCredentialParamsSchema } from "../../../../../../../server/certificates/certificate.params";
import { getPublicOpenBadgeCredential } from "../../../../../../../server/certificates/open-badge.service";
import { routeMetadata } from "./route.metadata";

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
    // .../credentials/{credentialId}/open-badge
    const credentialId = segments.at(-2) ?? "";
    publicCredentialParamsSchema.parse({ credentialId });

    const origin = resolveOrigin(req.headers);
    const verificationUrl = `${origin}/verify/${encodeURIComponent(credentialId)}`;

    const credential = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        getPublicOpenBadgeCredential({
          tx,
          tenantId: tenant.tenantId,
          requestId,
          credentialId,
          verificationUrl,
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
