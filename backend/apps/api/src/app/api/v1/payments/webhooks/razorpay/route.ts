import { recordRefundWebhook } from "@atlas/domain/payments/refund-workflow";
import { NextResponse } from "next/server";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { razorpayWebhookResponseSchema } from "@atlas/domain/payments/payments.dto";
import { razorpayWebhookMetadata } from "@atlas/domain/payments/payments.route-metadata";
import { resolvePaymentProvider } from "@atlas/domain/payments/payment-provider.registry";
import { paymentsRepository } from "@atlas/domain/payments/payments.repository";
import { fulfillPaidCourseOrderByExternalId } from "../../../../../../server/sales-coupons/order-fulfillment.service";
import { systemServiceCtx } from "@atlas/core/actor/system-actor";

export const POST = createPublicRouteHandler(
  razorpayWebhookMetadata,
  async ({ req, requestId }) => {
    const tenant = await resolveRequestTenant(req);
    const signature = req.headers.get("x-razorpay-signature") ?? "";
    if (!signature) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Missing x-razorpay-signature header." } },
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
          gatewayKey: "razorpay",
          requireWebhookSecret: true,
        });

        const parsed = await provider.parseWebhook({ rawBody, signature });
        if (parsed.refund)
          return { data: await recordRefundWebhook(tx, "razorpay", gatewayId, parsed.refund) };

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
            source: "payments.razorpay.webhook",
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

    razorpayWebhookResponseSchema.parse(body);
    return NextResponse.json(body);
  },
);
