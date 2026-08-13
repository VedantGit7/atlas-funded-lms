import { afterEach, describe, expect, it } from "vitest";
import { createAppleIapAdapter } from "@atlas/domain/iap/adapters/apple-iap.adapter";
import { createGooglePlayAdapter } from "@atlas/domain/iap/adapters/google-play.adapter";
import { AtlasHttpError } from "@atlas/core/http/errors";

describe("IAP sandbox fixture verifiers", () => {
  const originalAppleSecret = process.env["APPLE_IAP_SHARED_SECRET"];
  const originalGoogleJson = process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"];
  const originalGooglePackage = process.env["GOOGLE_PLAY_PACKAGE_NAME"];

  afterEach(() => {
    if (originalAppleSecret === undefined) delete process.env["APPLE_IAP_SHARED_SECRET"];
    else process.env["APPLE_IAP_SHARED_SECRET"] = originalAppleSecret;

    if (originalGoogleJson === undefined) delete process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"];
    else process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"] = originalGoogleJson;

    if (originalGooglePackage === undefined) delete process.env["GOOGLE_PLAY_PACKAGE_NAME"];
    else process.env["GOOGLE_PLAY_PACKAGE_NAME"] = originalGooglePackage;
  });

  it("accepts Apple sandbox fixture receipts without shared secret", async () => {
    delete process.env["APPLE_IAP_SHARED_SECRET"];
    const adapter = createAppleIapAdapter({ sharedSecret: null, bundleId: null });

    const result = await adapter.verify({
      productId: "com.school.course",
      receiptData: "sandbox:txn_ios_1",
    });

    expect(result).toMatchObject({
      ok: true,
      environment: "sandbox",
      externalTransactionId: "apple_txn_ios_1",
      productId: "com.school.course",
    });
  });

  it("decodes StoreKit 2 style JWT payloads with basic validation", async () => {
    const payload = Buffer.from(
      JSON.stringify({
        productId: "com.school.course",
        transactionId: "2000000123456789",
        bundleId: "com.school.app",
        environment: "Sandbox",
      }),
    ).toString("base64url");
    const token = `hdr.${payload}.sig`;

    const adapter = createAppleIapAdapter({
      sharedSecret: null,
      bundleId: "com.school.app",
    });

    const result = await adapter.verify({
      productId: "com.school.course",
      signedTransaction: token,
    });

    expect(result.ok).toBe(true);
    expect(result.environment).toBe("sandbox");
    expect(result.externalTransactionId).toBe("apple_2000000123456789");
  });

  it("accepts Google sandbox fixture tokens when Play credentials are missing", async () => {
    delete process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"];
    delete process.env["GOOGLE_PLAY_PACKAGE_NAME"];
    const adapter = createGooglePlayAdapter({
      serviceAccountJson: null,
      packageName: null,
    });

    const result = await adapter.verify({
      productId: "course_premium",
      purchaseToken: "sandbox:txn_android_1",
    });

    expect(result).toMatchObject({
      ok: true,
      environment: "sandbox",
      externalTransactionId: "google_txn_android_1",
      productId: "course_premium",
    });
  });

  it("returns not_configured for non-fixture Google tokens without credentials", async () => {
    const adapter = createGooglePlayAdapter({
      serviceAccountJson: null,
      packageName: null,
    });

    await expect(
      adapter.verify({
        productId: "course_premium",
        purchaseToken: "real-token-without-creds",
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(AtlasHttpError);
      expect((error as AtlasHttpError).message).toContain("not configured");
      return true;
    });
  });
});
