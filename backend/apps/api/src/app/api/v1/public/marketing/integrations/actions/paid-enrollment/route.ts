import { NextResponse } from "next/server";
import { createPublicRouteHandler, toSafeErrorEnvelope } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import {
  requireIntegrationApiKey,
  runIntegrationPaidEnrollmentAction,
} from "../../../../../../../../server/marketing-integrations/marketing-integrations.service";
import { routeMetadata } from "./route.metadata";
import { systemServiceCtx } from "@atlas/core/actor/system-actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readApiKey(req: Request): string | null {
  const headerKey = req.headers.get("x-atlas-integration-key");
  if (headerKey?.trim()) return headerKey.trim();
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  try {
    const body: unknown = await req.json();
    return await withGlobalDb(async (db) => {
      const tenant = await resolveTenantFromRequest({ req, db });
      const result = await withTenantTx(
        {
          tenantId: tenant.tenantId,
          requestId,
          allowAnonymousTenantRead: true,
        },
        async (tx) => {
          await requireIntegrationApiKey(tx, readApiKey(req));
          return runIntegrationPaidEnrollmentAction(
            tx,
            systemServiceCtx({
              tenantId: tenant.tenantId,
              requestId,
              source: "marketing.public_action",
            }),
            body,
          );
        },
      );
      return NextResponse.json(result, { status: 200 });
    });
  } catch (error) {
    const safe = toSafeErrorEnvelope(error, requestId);
    return NextResponse.json(safe.body, { status: safe.status });
  }
});
