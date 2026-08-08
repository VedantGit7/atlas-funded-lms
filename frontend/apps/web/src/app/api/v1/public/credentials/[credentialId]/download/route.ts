import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { publicCredentialParamsSchema } from "../../../../../../../server/certificates/certificate.params";
import { getPublicCredentialDownload } from "../../../../../../../server/certificates/certificate.service";
import { routeMetadata } from "./route.metadata";

/**
 * GET /api/v1/public/credentials/[credentialId]/download
 *
 * Public, unauthenticated download of an issued credential's rendered
 * certificate (HTML). This is the target of the `downloadUrl` surfaced by the
 * public verify response.
 */
export const GET = createPublicRouteHandler<unknown>(routeMetadata, async ({ req, requestId }) => {
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    // .../credentials/{credentialId}/download
    const credentialId = segments.at(-2) ?? "";
    publicCredentialParamsSchema.parse({ credentialId });

    const result = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        getPublicCredentialDownload({
          tx,
          tenantId: tenant.tenantId,
          requestId,
          credentialId,
        }),
    );

    return new NextResponse(result.body, {
      status: 200,
      headers: {
        "content-type": result.contentType,
        "content-disposition": `attachment; filename="${result.filename}"`,
        "cache-control": "public, max-age=300",
      },
    });
  });
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
