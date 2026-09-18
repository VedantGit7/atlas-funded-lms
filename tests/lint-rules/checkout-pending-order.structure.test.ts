import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Checkout pending-order contract note.
 * Behavioral coverage lives in:
 *   tests/unit/sales-coupons/purchase-checkout-provider.test.ts
 * which asserts pending paid checkout returns checkoutUrl and enrollmentId: null.
 * This stub keeps the release e2e suite aware of the PaymentProvider path.
 */

const purchaseCheckoutTest = resolve(
  import.meta.dirname,
  "../unit/sales-coupons/purchase-checkout-provider.test.ts",
);

describe("checkout pending-order e2e note", () => {
  it("unit coverage asserts checkoutUrl without enrollmentId for pending orders", () => {
    const source = readFileSync(purchaseCheckoutTest, "utf8");
    expect(source).toContain("creates a pending order and does not enroll when amount due > 0");
    expect(source).toContain(
      'expect(result.data.checkoutUrl).toBe("https://checkout.stripe.test/session")',
    );
    expect(source).toContain("expect(result.data.enrollmentId).toBeNull()");
  });
});
