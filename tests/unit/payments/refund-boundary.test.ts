import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("F07 refund request transaction boundary", () => {
  const service = readFileSync(
    "backend/packages/domain/src/reports/payments-roster.service.ts",
    "utf8",
  );
  const action = service.slice(service.indexOf("export async function refundPaymentTransaction("));
  it("does not move money inside the request transaction", () => {
    expect(action).not.toContain("provider.refund(");
  });
  it("does not revoke course access before the gateway confirms success", () => {
    expect(action).not.toContain("paymentsRosterRepository.revokeCourseEnrollment(");
  });
});
