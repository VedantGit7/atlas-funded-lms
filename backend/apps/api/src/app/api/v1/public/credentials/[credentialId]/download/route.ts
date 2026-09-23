import { NextResponse, type NextRequest } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { publicCredentialParamsSchema } from "../../../../../../../server/certificates/certificate.params";
import { getPublicCredentialDownload } from "../../../../../../../server/certificates/certificate.service";
import { routeMetadata } from "./route.metadata";

const download = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const credentialId = new URL(req.url).pathname.split("/").at(-2) ?? "";
  publicCredentialParamsSchema.parse({ credentialId });

  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const result = await withTenantTx(
      { tenantId: tenant.tenantId, requestId, allowAnonymousTenantRead: true },
      async (tx) =>
        getPublicCredentialDownload({
          tx,
          tenantId: tenant.tenantId,
          requestId,
          credentialId,
        }),
    );

    const responseBody: BodyInit =
      typeof result.body === "string" ? result.body : new Uint8Array(result.body);

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "content-type": result.contentType,
        // The canonical service generates filenames from sanitized credential IDs.
        "content-disposition": `attachment; filename="${result.filename}"`,
      },
    });
  });
});

export async function GET(req: NextRequest) {
  const response = await download(req);
  // Neither artifacts nor status-sensitive failures belong in a shared cache.
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
