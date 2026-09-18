import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  LegalDocumentSlugSchema,
  PublicLegalDocumentResponseSchema,
} from "@atlas/domain-branding/schemas/public-legal";
import { readTenantLegalDocument } from "../../../../../../server/tenant-settings/tenant-legal.service";
import { routeMetadata } from "./route.metadata";

function readSlugFromRequest(req: Request): "terms" | "privacy" {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  return LegalDocumentSlugSchema.parse(segments.at(-1) ?? "");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const slug = readSlugFromRequest(req);

  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });

    const document = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) => readTenantLegalDocument(tx, slug),
    );

    return NextResponse.json(PublicLegalDocumentResponseSchema.parse({ data: { document } }), {
      status: 200,
      headers: { "cache-control": "public, max-age=60" },
    });
  });
});
