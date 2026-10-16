import { NextResponse } from "next/server";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  createAttributionEventResponseSchema,
  createPublicAttributionEventBodySchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import { createAttributionEventPublicMetadata } from "@atlas/domain/sales-marketing/sales-marketing.route-metadata";
import { createAttributionEvent } from "@atlas/domain/sales-marketing/sales-marketing.service";
import { systemServiceCtx } from "@atlas/core/actor/system-actor";

export const POST = createPublicRouteHandler(
  createAttributionEventPublicMetadata,
  async ({ req, requestId }) => {
    const tenant = await resolveRequestTenant(req);
    const input = createPublicAttributionEventBodySchema.parse(await req.json());

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
          input,
        ),
    );

    createAttributionEventResponseSchema.parse(body);
    return NextResponse.json(body);
  },
);
