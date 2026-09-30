import { recordRefundWebhook } from "@atlas/domain/payments/refund-workflow";
import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { stripeWebhookResponseSchema } from "@atlas/domain/payments/payments.dto";
import { stripeWebhookMetadata } from "@atlas/domain/payments/payments.route-metadata";
import { resolvePaymentProvider } from "@atlas/domain/payments/payment-provider.registry";
import { paymentsRepository } from "@atlas/domain/payments/payments.repository";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { fulfillPaidCourseOrderByExternalId } from "../../../../../../server/sales-coupons/sales-coupons.service";
import { systemServiceCtx } from "@atlas/core/actor/system-actor";

export const POST = createPublicRouteHandler(stripeWebhookMetadata, async ({ req, requestId }) => {
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const signature = req.headers.get("stripe-signature") ?? "";
    if (!signature) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Missing stripe-signature header." } },
        { status: 400 },
      );
    }

    const rawBody = await req.text();

    const body = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) => {
        const { provider, gatewayId } = await resolvePaymentProvider(tx, {
          gatewayKey: "stripe",
          requireWebhookSecret: true,
        });

        const parsed = await provider.parseWebhook({ rawBody, signature });
        if (parsed.refund)
          return { data: await recordRefundWebhook(tx, "stripe", gatewayId, parsed.refund) };

        if (parsed.status === "failed") {
          const current = await paymentsRepository.findByExternalId(tx, parsed.externalId);
          if (current && current.status === "pending") {
            await paymentsRepository.updateOrderByExternalId(tx, {
              externalId: parsed.externalId,
              status: "failed",
              paidAt: null,
              invoiceNumber: null,
            });
          }

          return {
            data: {
              updated: Boolean(current),
              orderId: current?.id ?? parsed.paymentOrderId,
            },
          };
        }

        if (parsed.status !== "paid") {
          return {
            data: {
              updated: false,
              orderId: parsed.paymentOrderId,
            },
          };
        }

        const fulfilled = await fulfillPaidCourseOrderByExternalId(
          tx,
          systemServiceCtx({
            tenantId: tenant.tenantId,
            requestId,
            source: "payments.stripe.webhook",
          }),
          {
            externalId: parsed.externalId,
            amountCents: parsed.amountCents,
            currency: parsed.currency,
          },
        );

        return {
          data: {
            updated: Boolean(fulfilled),
            orderId: fulfilled?.paymentOrderId ?? parsed.paymentOrderId,
          },
        };
      },
    );

    stripeWebhookResponseSchema.parse(body);
    return NextResponse.json(body);
  });
});
