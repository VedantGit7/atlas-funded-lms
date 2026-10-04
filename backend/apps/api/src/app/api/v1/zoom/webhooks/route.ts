import { NextResponse } from "next/server";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { zoomWebhookResponseSchema } from "@atlas/domain/zoom/zoom.dto";
import { zoomWebhookMetadata } from "@atlas/domain/zoom/zoom.route-metadata";
import { handleZoomWebhook } from "@atlas/domain/zoom/zoom.service";
import { systemServiceCtx } from "@atlas/core/actor/system-actor";

export const POST = createPublicRouteHandler(zoomWebhookMetadata, async ({ req, requestId }) => {
  const tenant = await resolveRequestTenant(req);
  const rawBody: unknown = await req.json();

  const body = await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) =>
      handleZoomWebhook(
        tx,
        systemServiceCtx({ tenantId: tenant.tenantId, requestId, source: "zoom.webhook" }),
        rawBody,
      ),
  );

  zoomWebhookResponseSchema.parse(body);
  return NextResponse.json(body);
});
