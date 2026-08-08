import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { stripeWebhookResponseSchema } from "@atlas/domain/payments/payments.dto";
import { stripeWebhookMetadata } from "@atlas/domain/payments/payments.route-metadata";
import { handleStripeWebhook } from "@atlas/domain/payments/payments.service";
import { resolveTenantFromRequest } from "@atlas/tenancy";

export const POST = createPublicRouteHandler(stripeWebhookMetadata, async ({ req, requestId }) => {
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const rawBody: unknown = await req.json();

    const body = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        handleStripeWebhook(
          tx,
          { tenantId: tenant.tenantId, actorMembershipId: tenant.tenantId, requestId },
          rawBody,
        ),
    );

    stripeWebhookResponseSchema.parse(body);
    return NextResponse.json(body);
  });
});
