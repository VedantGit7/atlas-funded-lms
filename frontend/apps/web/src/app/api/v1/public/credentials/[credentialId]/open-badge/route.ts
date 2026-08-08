import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { publicCredentialParamsSchema } from "../../../../../../../server/certificates/certificate.params";
import { getPublicOpenBadgeCredential } from "../../../../../../../server/certificates/open-badge.service";
import { resolveRequestOriginFromHeaders } from "../../../../../../../lib/server/resolve-request-origin";
import { routeMetadata } from "./route.metadata";

export const GET = createPublicRouteHandler<unknown>(routeMetadata, async ({ req, requestId }) => {
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    // .../credentials/{credentialId}/open-badge
    const credentialId = segments.at(-2) ?? "";
    publicCredentialParamsSchema.parse({ credentialId });

    const origin = resolveRequestOriginFromHeaders(req.headers);
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
