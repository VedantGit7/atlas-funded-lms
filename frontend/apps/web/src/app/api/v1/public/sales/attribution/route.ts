import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  createAttributionEventBodySchema,
  createAttributionEventResponseSchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import { createAttributionEvent } from "@atlas/domain/sales-marketing/sales-marketing.service";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { routeMetadata } from "./route.metadata";

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const rawBody: unknown = await req.json();
    createAttributionEventBodySchema.parse(rawBody);

    const body = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        createAttributionEvent(
          tx,
          { tenantId: tenant.tenantId, actorMembershipId: tenant.tenantId, requestId },
          rawBody,
        ),
    );

    createAttributionEventResponseSchema.parse(body);
    return NextResponse.json(body);
  });
});
