import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { readDiagnosticSessionCookie } from "@atlas/security";
import {
  DiagnosticAnonParamsSchema,
  publicDiagnosticResultResponseSchema,
} from "../../../../../../../server/diagnostics/diagnostic.schemas";
import {
  diagnosticSessionInvalid,
  getPublicDiagnosticResult,
} from "../../../../../../../server/diagnostics/diagnostic-public-session.service";
import { routeMetadata } from "./route.metadata";

function readAnonIdFromRequest(req: Request): string {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const anonId = segments.at(-2);
  return DiagnosticAnonParamsSchema.parse({ anonId }).anonId;
}

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const anonymousId = readAnonIdFromRequest(req);

    const cookie = readDiagnosticSessionCookie(req);
    if (!cookie || cookie.anonymousId !== anonymousId) {
      throw diagnosticSessionInvalid();
    }

    const body = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        getPublicDiagnosticResult({
          tx,
          ctx: { tenantId: tenant.tenantId, requestId },
          anonymousId,
          secret: cookie.secret,
        }),
    );

    return NextResponse.json(publicDiagnosticResultResponseSchema.parse(body));
  });
});
