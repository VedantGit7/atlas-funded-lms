import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  changedPayoutFields,
  isEncryptedPayoutValue,
  maskBankAccount,
  maskUpi,
  maskedPayoutView,
  openPayoutDetails,
  openPayoutValue,
  sealPayoutPatch,
  sealPayoutValue,
} from "../../../backend/apps/api/src/server/sales-affiliates/affiliate-payout-details";

/** Audit M6: affiliate payout details are encrypted at rest and masked on screen. */
const saved = process.env["LEARNER_BILLING_ENC_KEY"];
const binding = { tenantId: "tenant-a", affiliateId: "affiliate-1" };

beforeAll(() => {
  process.env["LEARNER_BILLING_ENC_KEY"] = Buffer.alloc(32, 7).toString("base64");
});
afterAll(() => {
  if (saved === undefined) Reflect.deleteProperty(process.env, "LEARNER_BILLING_ENC_KEY");
  else process.env["LEARNER_BILLING_ENC_KEY"] = saved;
});

describe("affiliate payout encryption (audit M6)", () => {
  it("round-trips, and never stores the value in readable form", () => {
    const sealed = sealPayoutValue("123456789012", binding, "bankAccount");
    expect(sealed).toMatch(/^enc:v1:/);
    expect(sealed).not.toContain("123456789012");
    expect(isEncryptedPayoutValue(sealed)).toBe(true);
    expect(openPayoutValue(sealed, binding, "bankAccount")).toBe("123456789012");
  });

  it("uses a fresh IV, so equal values do not look equal", () => {
    expect(sealPayoutValue("same@okhdfc", binding, "upi")).not.toBe(
      sealPayoutValue("same@okhdfc", binding, "upi"),
    );
  });

  it("refuses a ciphertext moved to another affiliate, tenant or field", () => {
    const sealed = sealPayoutValue("123456789012", binding, "bankAccount");
    expect(() =>
      openPayoutValue(sealed, { ...binding, affiliateId: "affiliate-2" }, "bankAccount"),
    ).toThrow();
    expect(() =>
      openPayoutValue(sealed, { ...binding, tenantId: "tenant-b" }, "bankAccount"),
    ).toThrow();
    expect(() => openPayoutValue(sealed, binding, "upi")).toThrow();
  });

  it("refuses a tampered ciphertext", () => {
    const sealed = sealPayoutValue("123456789012", binding, "bankAccount") ?? "";
    const tampered = `${sealed.slice(0, -4)}AAAA`;
    expect(() => openPayoutValue(tampered, binding, "bankAccount")).toThrow();
  });

  it("does not use the payment-gateway key directly", () => {
    // Domain separation: the same base key, a derived subkey. A gateway secret
    // ciphertext format ("v1:...") is never accepted as a payout value.
    expect(isEncryptedPayoutValue("v1:abc:def:ghi")).toBe(false);
  });

  it("still reads values written before encryption, until the backfill runs", () => {
    expect(
      openPayoutDetails(
        {
          payout_upi: "legacy@okaxis",
          payout_bank_account: "000011112222",
          payout_ifsc: "HDFC0001234",
          payout_account_name: "Ada L",
        },
        binding,
      ),
    ).toEqual({
      upi: "legacy@okaxis",
      bankAccount: "000011112222",
      ifsc: "HDFC0001234",
      accountName: "Ada L",
    });
  });

  it("treats omitted fields as unchanged and null as clearing", () => {
    const patch = sealPayoutPatch({ payoutBankAccount: "999988887777", payoutUpi: null }, binding);
    expect(Object.keys(patch).sort()).toEqual(["payoutBankAccount", "payoutUpi"]);
    expect(patch.payoutUpi).toBeNull();
    expect(openPayoutValue(patch.payoutBankAccount ?? null, binding, "bankAccount")).toBe(
      "999988887777",
    );
    expect(changedPayoutFields({ payoutUpi: null, payoutIfsc: undefined })).toEqual(["payoutUpi"]);
  });
});

describe("affiliate payout masking (audit M6)", () => {
  it("shows the last four digits of an account and a hint of a UPI id", () => {
    expect(maskBankAccount("1234 5678 9012")).toBe("•••• 9012");
    expect(maskUpi("ada.lovelace@okhdfc")).toBe("ad•••@okhdfc");
    expect(maskUpi("a@ybl")).toBe("•••@ybl");
    expect(maskBankAccount(null)).toBeNull();
  });

  it("never puts a full bank account or UPI id in the default view", () => {
    const view = maskedPayoutView({
      upi: "ada.lovelace@okhdfc",
      bankAccount: "123456789012",
      ifsc: "HDFC0001234",
      accountName: "Ada L",
    });
    expect(JSON.stringify(view)).not.toContain("123456789012");
    expect(JSON.stringify(view)).not.toContain("ada.lovelace");
    expect(view).toMatchObject({ payoutIfsc: "HDFC0001234", payoutDetailsOnFile: true });
  });
});
