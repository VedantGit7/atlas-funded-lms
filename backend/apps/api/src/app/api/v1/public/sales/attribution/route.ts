import { NextResponse } from "next/server";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  createAttributionEventBodySchema,
  createAttributionEventResponseSchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import { createAttributionEventPublicMetadata } from "@atlas/domain/sales-marketing/sales-marketing.route-metadata";
import { createAttributionEvent } from "@atlas/domain/sales-marketing/sales-marketing.service";
import { systemServiceCtx } from "@atlas/core/actor/system-actor";

export const POST = createPublicRouteHandler(
  createAttributionEventPublicMetadata,
  async ({ req, requestId }) => {
    const tenant = await resolveRequestTenant(req);
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
  },
);
