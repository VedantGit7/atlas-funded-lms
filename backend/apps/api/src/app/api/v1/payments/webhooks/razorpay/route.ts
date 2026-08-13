import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { razorpayWebhookResponseSchema } from "@atlas/domain/payments/payments.dto";
import { razorpayWebhookMetadata } from "@atlas/domain/payments/payments.route-metadata";
import { resolvePaymentProvider } from "@atlas/domain/payments/payment-provider.registry";
import { paymentsRepository } from "@atlas/domain/payments/payments.repository";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { fulfillPaidCourseOrderByExternalId } from "../../../../../../server/sales-coupons/sales-coupons.service";

export const POST = createPublicRouteHandler(
  razorpayWebhookMetadata,
  async ({ req, requestId }) => {
    return withGlobalDb(async (db) => {
      const tenant = await resolveTenantFromRequest({ req, db });
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
          const { provider } = await resolvePaymentProvider(tx, {
            gatewayKey: "razorpay",
            requireWebhookSecret: true,
          });

          const parsed = await provider.parseWebhook({ rawBody, signature });

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
            {
              tenantId: tenant.tenantId,
              // Webhooks are system actors; use tenant id as a stable stand-in for audit ctx.
              actorMembershipId: tenant.tenantId,
              requestId,
            },
            {
              externalId: parsed.externalId,
              paymentOrderId: parsed.paymentOrderId,
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
    });
  },
);
