import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkoutPurchaseMetadata,
  learnerCouponMetadata,
} from "../../../backend/apps/api/src/server/sales-coupons/sales-coupons.route-metadata";

/**
 * Audit M4: creating a payment order is idempotent and audited, and the
 * checkout dialog reuses one key per attempt so a retry replays the order
 * instead of opening a second one.
 */
const root = resolve(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("checkout purchase route (audit M4)", () => {
  it("requires an idempotency key and writes an audit entry", () => {
    expect(checkoutPurchaseMetadata).toMatchObject({
      idempotency: "required",
      audit: "required",
      permission: learnerCouponMetadata.permission,
    });
    const route = read("backend/apps/api/src/app/api/v1/checkout/purchase/route.ts");
    expect(route).toContain("metadata: checkoutPurchaseMetadata");
  });

  it("leaves quote and coupon validation as plain reads", () => {
    for (const path of [
      "backend/apps/api/src/app/api/v1/checkout/quote/route.ts",
      "backend/apps/api/src/app/api/v1/coupons/validate/route.ts",
    ]) {
      expect(read(path)).toContain("metadata: learnerCouponMetadata");
    }
  });

  it("reuses one idempotency key per checkout attempt in the dialog", () => {
    const dialog = read("frontend/apps/web/src/features/courses/enroll-course-dialog.tsx");
    expect(dialog).toMatch(
      /clientApi\.postWithKey<PurchaseResponse>\(\s*"\/api\/v1\/checkout\/purchase"/,
    );
    expect(dialog).toContain("purchaseAttempt.current.key");
  });
});
