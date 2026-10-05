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
} from "../../../backend/apps/api/src/server/sales-coupons/sales-coupons.service";

/**
 * Audit M4 against Postgres: one open checkout per learner, course and price,
 * serialised by an advisory lock; the gateway session is created after the
 * purchase transaction and recorded once; return URLs stay on the tenant.
 */
const suite =
  process.env.DATABASE_URL && process.env.PLATFORM_DATABASE_URL ? describe : describe.skip;

suite("checkout purchase (audit M4)", () => {
  let fixture: CourseAuthoringFixture;
  let host: string;
  const learnerCtx = () => ({
    tenantId: fixture.tenantId,
    actorMembershipId: fixture.learnerMembershipId,
    requestId: randomUUID(),
  });
  const asLearner = <T>(fn: Parameters<typeof withTenantTx<T>>[1]) =>
    withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), fn);
  const asAdmin = <T>(fn: Parameters<typeof withTenantTx<T>>[1]) =>
    withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), fn);
  const body = () => ({
    courseId: fixture.draftCourseId,
    deviceType: "WEB" as const,
    successUrl: `https://${host}/courses/x?checkout=success`,
    cancelUrl: `https://${host}/courses/x?checkout=cancelled`,
  });
  const setPrice = (priceCents: number) =>
    asAdmin(
      (tx) => tx.$executeRaw`
        update courses
           set status = 'PUBLISHED',
               metadata_json = ${JSON.stringify({ accessTier: "PAID", priceCents, currency: "USD" })}::jsonb
         where id = ${fixture.draftCourseId}::uuid
      `,
    );
  const ordersForCourse = () =>
    asLearner(
      (tx) =>
        tx.$queryRaw<
          Array<{ id: string; external_id: string; metadata_json: Record<string, unknown> }>
        >`
        select id::text, external_id, metadata_json
          from payment_orders
         where membership_id = ${fixture.learnerMembershipId}::uuid
           and metadata_json->>'courseId' = ${fixture.draftCourseId}
         order by created_at
      `,
    );

  beforeAll(async () => {
    fixture = await createCourseAuthoringFixture();
    host = `academy-${fixture.slug}.example`;
    await asAdmin(
      (tx) => tx.$executeRaw`
        insert into tenant_domains (id, tenant_id, hostname, type, status, updated_at)
        values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${host}, 'CUSTOM', 'ACTIVE', now())
      `,
    );
    await setPrice(5000);
  });

  beforeEach(async () => {
    gateway.createCheckout.mockReset();
    let session = 0;
    gateway.createCheckout.mockImplementation(async (input: { paymentOrderId: string }) => {
      session += 1;
      return {
        externalId: `cs_${input.paymentOrderId}_${String(session)}`,
        checkoutUrl: `https://checkout.stripe.test/${input.paymentOrderId}/${String(session)}`,
      };
    });
    // Each case starts with no open order for the course.
    await asAdmin(
      (tx) => tx.$executeRaw`
        update payment_orders set status = 'failed'
         where membership_id = ${fixture.learnerMembershipId}::uuid and status = 'pending'
      `,
    );
    await setPrice(5000);
  });

  it("records the order in the transaction and the gateway session after it, once", async () => {
    const plan = await asLearner((tx) => planCheckoutPurchase(tx, learnerCtx(), body()));
    expect(plan.kind).toBe("gateway");
    expect(gateway.createCheckout).not.toHaveBeenCalled();

    const first = await completeCheckoutPurchase(plan, learnerCtx());
    const replay = await completeCheckoutPurchase(plan, learnerCtx());

    expect(gateway.createCheckout).toHaveBeenCalledOnce();
    expect(gateway.createCheckout.mock.calls[0]?.[0]).toMatchObject({
      idempotencyKey: `atlas-checkout-${first.data.paymentOrderId}`,
    });
    expect(replay.data.checkoutUrl).toBe(first.data.checkoutUrl);

    const order = (await ordersForCourse()).find((row) => row.id === first.data.paymentOrderId);
    expect(order?.external_id).toBe(`cs_${first.data.paymentOrderId}_1`);
    expect(order?.metadata_json["checkoutSession"]).toMatchObject({
      checkoutUrl: first.data.checkoutUrl,
    });
  });

  it("reuses the open order for the same price, even with a new idempotency key", async () => {
    const before = (await ordersForCourse()).length;
    const first = await asLearner((tx) => planCheckoutPurchase(tx, learnerCtx(), body()));
    const second = await asLearner((tx) => planCheckoutPurchase(tx, learnerCtx(), body()));

    expect(first.kind === "gateway" && second.kind === "gateway").toBe(true);
    if (first.kind !== "gateway" || second.kind !== "gateway") return;
    expect(second.paymentOrderId).toBe(first.paymentOrderId);
    expect((await ordersForCourse()).length).toBe(before + 1);
  });

  it("serialises concurrent purchases so two tabs get one order", async () => {
    const before = (await ordersForCourse()).length;
    const [a, b] = await Promise.all([
      asLearner((tx) => planCheckoutPurchase(tx, learnerCtx(), body())),
      asLearner((tx) => planCheckoutPurchase(tx, learnerCtx(), body())),
    ]);
    if (a.kind !== "gateway" || b.kind !== "gateway") throw new Error("expected paid plans");
    expect(a.paymentOrderId).toBe(b.paymentOrderId);
    expect((await ordersForCourse()).length).toBe(before + 1);
  });

  it("opens a new order when the price changes", async () => {
    const first = await asLearner((tx) => planCheckoutPurchase(tx, learnerCtx(), body()));
    await setPrice(4500);
    const second = await asLearner((tx) => planCheckoutPurchase(tx, learnerCtx(), body()));
    if (first.kind !== "gateway" || second.kind !== "gateway")
      throw new Error("expected paid plans");
    expect(second.paymentOrderId).not.toBe(first.paymentOrderId);
    expect(second.amountCents).toBe(4500);
  });

  it("refuses a return URL off the tenant's domains and records no order", async () => {
    const before = (await ordersForCourse()).length;
    await expect(
      asLearner((tx) =>
        planCheckoutPurchase(tx, learnerCtx(), {
          ...body(),
          successUrl: "https://evil.example/phish",
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect((await ordersForCourse()).length).toBe(before);
  });
});
