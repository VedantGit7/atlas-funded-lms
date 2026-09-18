import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  createAttributionEventBodySchema,
  createAttributionEventResponseSchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import { createAttributionEventPublicMetadata } from "@atlas/domain/sales-marketing/sales-marketing.route-metadata";
import { createAttributionEvent } from "@atlas/domain/sales-marketing/sales-marketing.service";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { systemServiceCtx } from "@atlas/core/actor/system-actor";

export const POST = createPublicRouteHandler(
  createAttributionEventPublicMetadata,
  async ({ req, requestId }) => {
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
            systemServiceCtx({
              tenantId: tenant.tenantId,
              requestId,
              source: "sales.public_attribution",
            }),
            rawBody,
          ),
      );

      createAttributionEventResponseSchema.parse(body);
      return NextResponse.json(body);
    });
  },
);
