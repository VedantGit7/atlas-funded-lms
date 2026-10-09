import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withTenantTx } from "@atlas/db";

const gateway = vi.hoisted(() => ({
  createCheckout: vi.fn(),
}));

// The payment gateway is the only external system: stand in for Stripe.
vi.mock("@atlas/domain/payments/payment-provider.registry", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolvePaymentProvider: vi.fn(async () => ({
    gatewayKey: "stripe",
    gatewayId: "gw-test",
    provider: { createCheckout: gateway.createCheckout, parseWebhook: vi.fn(), refund: vi.fn() },
  })),
}));

import {
  authoringTenantTx,
  createCourseAuthoringFixture,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";
import {
  completeCheckoutPurchase,
  planCheckoutPurchase,
} from "../../../backend/apps/api/src/server/sales-coupons/checkout-purchase.service";
import { validateCouponForLearner } from "../../../backend/apps/api/src/server/sales-coupons/checkout-pricing";
import { fulfillPaidCourseOrderByExternalId } from "../../../backend/apps/api/src/server/sales-coupons/order-fulfillment.service";

/**
 * Audit M1 against Postgres: an open checkout holds one use of its coupon, so
 * a coupon with no free uses is refused before payment; and a paid order is
 * always honoured, even when it takes the coupon over its limit.
 */
const suite =
  process.env.DATABASE_URL && process.env.PLATFORM_DATABASE_URL ? describe : describe.skip;

suite("coupon reservation (audit M1)", () => {
  let fixture: CourseAuthoringFixture;
  let host: string;
  const ctxFor = (membershipId: string) => ({
    tenantId: fixture.tenantId,
    actorMembershipId: membershipId,
    requestId: randomUUID(),
  });
  const asMember = <T>(membershipId: string, fn: Parameters<typeof withTenantTx<T>>[1]) =>
    withTenantTx(authoringTenantTx(fixture, membershipId), fn);
  const asAdmin = <T>(fn: Parameters<typeof withTenantTx<T>>[1]) =>
    asMember(fixture.adminMembershipId, fn);

  const purchase = (membershipId: string, couponCode: string) =>
    asMember(membershipId, (tx) =>
      planCheckoutPurchase(tx, ctxFor(membershipId), {
        courseId: fixture.draftCourseId,
        deviceType: "WEB" as const,
        couponCode,
        successUrl: `https://${host}/courses/x?checkout=success`,
        cancelUrl: `https://${host}/courses/x?checkout=cancelled`,
      }),
    );

  const createCoupon = async (limits: { total: number | null; perLearner: number }) => {
    const code = `M1${randomUUID().slice(0, 8).toUpperCase()}`;
    const id = randomUUID();
    await asAdmin(
      (tx) => tx.$executeRaw`
        insert into sales_coupons (
          id, tenant_id, code, name, status, discount_type, discount_value, currency,
          total_usage_limit, per_learner_limit, created_by_membership_id, updated_at
        ) values (
          ${id}::uuid, ${fixture.tenantId}::uuid, ${code}, 'M1 coupon', 'ACTIVE', 'PERCENT', 20,
          'USD', ${limits.total}, ${limits.perLearner}, ${fixture.adminMembershipId}::uuid, now()
        )
      `,
    );
    return { id, code };
  };

  const ordersOf = (membershipId: string) =>
    asAdmin(
      (tx) =>
        tx.$queryRaw<Array<{ id: string; status: string }>>`
        select id::text, status
          from payment_orders
         where membership_id = ${membershipId}::uuid
           and metadata_json->>'courseId' = ${fixture.draftCourseId}
         order by created_at
      `,
    );

  const setOrder = (orderId: string, change: "failed" | "lapsed") =>
    asAdmin((tx) =>
      change === "failed"
        ? tx.$executeRaw`update payment_orders set status = 'failed' where id = ${orderId}::uuid`
        : tx.$executeRaw`
            update payment_orders set created_at = now() - interval '25 hours'
             where id = ${orderId}::uuid
          `,
    );

  const gatewayPlan = (plan: Awaited<ReturnType<typeof purchase>>) => {
    if (plan.kind !== "gateway") throw new Error("expected a paid checkout");
    return plan;
  };

  beforeAll(async () => {
    fixture = await createCourseAuthoringFixture();
    host = `academy-${fixture.slug}.example`;
    await asAdmin(async (tx) => {
      await tx.$executeRaw`
        insert into tenant_domains (id, tenant_id, hostname, type, status, updated_at)
        values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${host}, 'CUSTOM', 'ACTIVE', now())
      `;
      await tx.$executeRaw`
        update courses
           set status = 'PUBLISHED',
               metadata_json = ${JSON.stringify({ accessTier: "PAID", priceCents: 5000, currency: "USD" })}::jsonb
         where id = ${fixture.draftCourseId}::uuid
      `;
    });
  });

  beforeEach(async () => {
    gateway.createCheckout.mockReset();
    gateway.createCheckout.mockImplementation(async (input: { paymentOrderId: string }) => ({
      externalId: `cs_${input.paymentOrderId}`,
      checkoutUrl: `https://checkout.stripe.test/${input.paymentOrderId}`,
    }));
    // Each case starts with no open order for the course.
    await asAdmin(
      (tx) => tx.$executeRaw`
        update payment_orders set status = 'failed'
         where status = 'pending' and metadata_json->>'courseId' = ${fixture.draftCourseId}
      `,
    );
  });

  it("holds the coupon's last use for an open checkout, and releases it when that ends", async () => {
    const coupon = await createCoupon({ total: 1, perLearner: 1 });
    const learner = fixture.learnerMembershipId;
    const other = fixture.instructorMembershipId;
    const third = fixture.otherInstructorMembershipId;

    const held = gatewayPlan(await purchase(learner, coupon.code));
    expect(held.amountCents).toBe(4000);

    // Taken: refused before payment, with no order left behind, and the
    // quote says so too.
    const before = (await ordersOf(other)).length;
    await expect(purchase(other, coupon.code)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "This coupon has reached its usage limit.",
    });
    expect((await ordersOf(other)).length).toBe(before);
    await expect(
      asMember(other, (tx) =>
        validateCouponForLearner(tx, ctxFor(other), {
          code: coupon.code,
          courseId: fixture.draftCourseId,
          deviceType: "WEB",
        }),
      ),
    ).rejects.toMatchObject({ message: "This coupon has reached its usage limit." });

    // The holder coming back to checkout is not blocked by their own order.
    const again = gatewayPlan(await purchase(learner, coupon.code));
    expect(again.paymentOrderId).toBe(held.paymentOrderId);

    // A failed payment releases the use.
    await setOrder(held.paymentOrderId, "failed");
    const second = gatewayPlan(await purchase(other, coupon.code));

    // So does an order left open past the reservation window.
    await expect(purchase(third, coupon.code)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await setOrder(second.paymentOrderId, "lapsed");
    gatewayPlan(await purchase(third, coupon.code));
  });

  it("lets exactly one of two concurrent checkouts take the last use", async () => {
    const coupon = await createCoupon({ total: 1, perLearner: 1 });
    const results = await Promise.allSettled([
      purchase(fixture.learnerMembershipId, coupon.code),
      purchase(fixture.adminMembershipId, coupon.code),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("honours a paid order that takes the coupon over its limit, and records it", async () => {
    const coupon = await createCoupon({ total: 1, perLearner: 1 });
    const first = fixture.instructorMembershipId;
    const second = fixture.otherInstructorMembershipId;

    // The first checkout's reservation lapses, a second one takes the use,
    // and then both are paid.
    const lapsed = gatewayPlan(await purchase(first, coupon.code));
    await setOrder(lapsed.paymentOrderId, "lapsed");
    const current = gatewayPlan(await purchase(second, coupon.code));

    const pay = async (plan: ReturnType<typeof gatewayPlan>, buyer: string) => {
      await completeCheckoutPurchase(plan, ctxFor(buyer));
      return asMember(buyer, (tx) =>
        fulfillPaidCourseOrderByExternalId(tx, ctxFor(buyer), {
          externalId: `cs_${plan.paymentOrderId}`,
          amountCents: plan.amountCents,
          currency: plan.currency,
        }),
      );
    };

    expect(await pay(current, second)).toMatchObject({ created: true });
    expect(await pay(lapsed, first)).toMatchObject({ created: true });

    const redemptions = await asAdmin(
      (tx) =>
        tx.$queryRaw<Array<{ payment_order_id: string; discount_cents: number }>>`
        select payment_order_id::text, discount_cents
          from sales_coupon_redemptions
         where coupon_id = ${coupon.id}::uuid
      `,
    );
    expect(redemptions.map((row) => row.payment_order_id).sort()).toEqual(
      [current.paymentOrderId, lapsed.paymentOrderId].sort(),
    );
    expect(redemptions.every((row) => row.discount_cents === 1000)).toBe(true);

    const audits = await asAdmin(
      (tx) =>
        tx.$queryRaw<Array<{ action: string; metadata: string }>>`
        select action, coalesce(metadata_json::text, '') as metadata
          from audit_entries
         where target_id = ${coupon.id}
      `,
    );
    expect(audits.map((entry) => entry.action)).toEqual(["coupon.redeemed_over_limit"]);
    expect(audits[0]?.metadata).toContain(lapsed.paymentOrderId);
  });
});
