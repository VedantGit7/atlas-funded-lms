import type { IapVerifyInput, IapVerifyResult, IapVerifier } from "../iap-provider";
import { iapNotConfiguredError, iapVerificationFailedError } from "../iap.errors";

const PRODUCTION_VERIFY_URL = "https://buy.itunes.apple.com/verifyReceipt";
const SANDBOX_VERIFY_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

type AppleVerifyReceiptResponse = {
  status?: number;
  environment?: string;
  receipt?: {
    bundle_id?: string;
    in_app?: Array<{
      product_id?: string;
      transaction_id?: string;
      original_transaction_id?: string;
    }>;
  };
  latest_receipt_info?: Array<{
    product_id?: string;
    transaction_id?: string;
    original_transaction_id?: string;
  }>;
};

function looksLikeJwt(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  const payload = parts[1];
  if (!payload) {
    throw iapVerificationFailedError("Invalid StoreKit transaction token.");
  }

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const json = Buffer.from(padded, "base64").toString("utf8");
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw iapVerificationFailedError("Invalid StoreKit transaction payload.");
  }
  return parsed as Record<string, unknown>;
}

function environmentFromApple(value: unknown): "sandbox" | "production" {
  return value === "Sandbox" || value === "sandbox" ? "sandbox" : "production";
}

async function postVerifyReceipt(args: {
  url: string;
  receiptData: string;
  sharedSecret: string;
}): Promise<AppleVerifyReceiptResponse> {
  const response = await fetch(args.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "receipt-data": args.receiptData,
      password: args.sharedSecret,
      "exclude-old-transactions": true,
    }),
  });

  if (!response.ok) {
    throw iapVerificationFailedError("Apple verifyReceipt request failed.");
  }

  return (await response.json()) as AppleVerifyReceiptResponse;
}

function pickInAppMatch(
  payload: AppleVerifyReceiptResponse,
  productId: string,
): { transactionId: string; productId: string } | null {
  const candidates = [...(payload.latest_receipt_info ?? []), ...(payload.receipt?.in_app ?? [])];

  for (const entry of candidates) {
    if (entry.product_id !== productId) continue;
    const transactionId = entry.transaction_id ?? entry.original_transaction_id;
    if (!transactionId) continue;
    return { transactionId, productId: entry.product_id };
  }

  return null;
}

export type AppleIapAdapterOptions = {
  sharedSecret?: string | null;
  bundleId?: string | null;
  /** Injected for tests. */
  fetchVerifyReceipt?: typeof postVerifyReceipt;
};

export function createAppleIapAdapter(options: AppleIapAdapterOptions = {}): IapVerifier {
  const sharedSecret =
    options.sharedSecret !== undefined
      ? options.sharedSecret
      : (process.env["APPLE_IAP_SHARED_SECRET"] ?? null);
  const bundleId =
    options.bundleId !== undefined
      ? options.bundleId
      : (process.env["APPLE_IAP_BUNDLE_ID"] ?? null);
  const fetchVerifyReceipt = options.fetchVerifyReceipt ?? postVerifyReceipt;

  return {
    platform: "ios",
    async verify(input: IapVerifyInput): Promise<IapVerifyResult> {
      const signedTransaction = input.signedTransaction?.trim() || null;
      const receiptData = input.receiptData?.trim() || null;
      const proof = signedTransaction ?? receiptData;

      if (!proof) {
        throw iapVerificationFailedError("Missing iOS receipt or signed transaction.");
      }

      // Sandbox fixture for local/dev when Apple credentials are absent.
      if (proof.startsWith("sandbox:") && !sharedSecret) {
        const fixtureId = proof.slice("sandbox:".length) || `ios_${input.productId}`;
        return {
          ok: true,
          environment: "sandbox",
          externalTransactionId: `apple_${fixtureId}`,
          productId: input.productId,
          raw: { fixture: true, proof },
        };
      }

      if (looksLikeJwt(proof)) {
        const payload = decodeJwtPayload(proof);
        const tokenProductId =
          typeof payload["productId"] === "string"
            ? payload["productId"]
            : typeof payload["product_id"] === "string"
              ? payload["product_id"]
              : null;
        const transactionId =
          typeof payload["transactionId"] === "string"
            ? payload["transactionId"]
            : typeof payload["transaction_id"] === "string"
              ? payload["transaction_id"]
              : null;
        const tokenBundleId =
          typeof payload["bundleId"] === "string"
            ? payload["bundleId"]
            : typeof payload["bid"] === "string"
              ? payload["bid"]
              : null;

        if (!tokenProductId || tokenProductId !== input.productId) {
          throw iapVerificationFailedError("StoreKit product ID mismatch.");
        }
        if (!transactionId) {
          throw iapVerificationFailedError("StoreKit transaction ID missing.");
        }
        if (bundleId && tokenBundleId && tokenBundleId !== bundleId) {
          throw iapVerificationFailedError("StoreKit bundle ID mismatch.");
        }

        const environment =
          payload["environment"] === "Sandbox" || payload["environment"] === "sandbox"
            ? "sandbox"
            : "production";

        return {
          ok: true,
          environment,
          externalTransactionId: `apple_${transactionId}`,
          productId: tokenProductId,
          raw: payload,
        };
      }

      if (!sharedSecret) {
        throw iapNotConfiguredError(
          "Apple IAP is not configured. Set APPLE_IAP_SHARED_SECRET or use a sandbox: fixture receipt.",
        );
      }

      let payload = await fetchVerifyReceipt({
        url: PRODUCTION_VERIFY_URL,
        receiptData: proof,
        sharedSecret,
      });

      // 21007 = sandbox receipt sent to production
      if (payload.status === 21007) {
        payload = await fetchVerifyReceipt({
          url: SANDBOX_VERIFY_URL,
          receiptData: proof,
          sharedSecret,
        });
      }

      if (payload.status !== 0) {
        throw iapVerificationFailedError(
          `Apple verifyReceipt failed with status ${payload.status ?? "unknown"}.`,
        );
      }

      if (bundleId && payload.receipt?.bundle_id && payload.receipt.bundle_id !== bundleId) {
        throw iapVerificationFailedError("Apple receipt bundle ID mismatch.");
      }

      const match = pickInAppMatch(payload, input.productId);
      if (!match) {
        throw iapVerificationFailedError("Apple receipt does not include the expected product.");
      }

      return {
        ok: true,
        environment: environmentFromApple(payload.environment),
        externalTransactionId: `apple_${match.transactionId}`,
        productId: match.productId,
        raw: payload,
      };
    },
  };
}

export const appleIapAdapter = createAppleIapAdapter();
