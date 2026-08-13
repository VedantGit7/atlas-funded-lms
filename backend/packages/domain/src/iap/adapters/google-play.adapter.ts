import type { IapVerifyInput, IapVerifyResult, IapVerifier } from "../iap-provider";
import { iapNotConfiguredError, iapVerificationFailedError } from "../iap.errors";

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type GooglePurchaseResponse = {
  purchaseState?: number;
  orderId?: string;
  productId?: string;
  purchaseToken?: string;
  purchaseType?: number;
};

function parseServiceAccountJson(raw: string | null | undefined): GoogleServiceAccount | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record["client_email"] !== "string" || typeof record["private_key"] !== "string") {
      return null;
    }
    return {
      client_email: record["client_email"],
      private_key: record["private_key"],
      ...(typeof record["token_uri"] === "string" ? { token_uri: record["token_uri"] } : {}),
    };
  } catch {
    return null;
  }
}

function base64Url(input: Buffer | string): string {
  const buffer = typeof input === "string" ? Buffer.from(input) : input;
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createGoogleAccessToken(account: GoogleServiceAccount): Promise<string> {
  const { createSign } = await import("node:crypto");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: account.token_uri ?? "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claimSet}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64Url(signer.sign(account.private_key));
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch(account.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw iapVerificationFailedError("Failed to obtain Google Play API access token.");
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw iapVerificationFailedError("Google Play API access token missing.");
  }
  return json.access_token;
}

async function fetchGooglePurchase(args: {
  accessToken: string;
  packageName: string;
  productId: string;
  purchaseToken: string;
}): Promise<GooglePurchaseResponse> {
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(args.packageName)}/purchases/products/` +
    `${encodeURIComponent(args.productId)}/tokens/${encodeURIComponent(args.purchaseToken)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });

  if (!response.ok) {
    throw iapVerificationFailedError("Google Play purchase verification failed.");
  }

  return (await response.json()) as GooglePurchaseResponse;
}

export type GooglePlayAdapterOptions = {
  serviceAccountJson?: string | null;
  packageName?: string | null;
  fetchPurchase?: typeof fetchGooglePurchase;
  createAccessToken?: typeof createGoogleAccessToken;
};

export function createGooglePlayAdapter(options: GooglePlayAdapterOptions = {}): IapVerifier {
  const serviceAccountJson =
    options.serviceAccountJson !== undefined
      ? options.serviceAccountJson
      : (process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"] ?? null);
  const defaultPackageName =
    options.packageName !== undefined
      ? options.packageName
      : (process.env["GOOGLE_PLAY_PACKAGE_NAME"] ?? null);
  const fetchPurchase = options.fetchPurchase ?? fetchGooglePurchase;
  const createAccessToken = options.createAccessToken ?? createGoogleAccessToken;

  return {
    platform: "android",
    async verify(input: IapVerifyInput): Promise<IapVerifyResult> {
      const purchaseToken = input.purchaseToken?.trim() || null;
      if (!purchaseToken) {
        throw iapVerificationFailedError("Missing Google Play purchase token.");
      }

      const serviceAccount = parseServiceAccountJson(serviceAccountJson);
      const packageName = input.packageName?.trim() || defaultPackageName;

      if (!serviceAccount || !packageName) {
        if (purchaseToken.startsWith("sandbox:")) {
          const fixtureId = purchaseToken.slice("sandbox:".length) || `android_${input.productId}`;
          return {
            ok: true,
            environment: "sandbox",
            externalTransactionId: `google_${fixtureId}`,
            productId: input.productId,
            raw: { fixture: true, purchaseToken },
          };
        }

        throw iapNotConfiguredError(
          "Google Play IAP is not configured. Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON and GOOGLE_PLAY_PACKAGE_NAME, or use a sandbox: fixture purchase token.",
        );
      }

      const accessToken = await createAccessToken(serviceAccount);
      const purchase = await fetchPurchase({
        accessToken,
        packageName,
        productId: input.productId,
        purchaseToken,
      });

      // purchaseState 0 = purchased
      if (purchase.purchaseState !== 0) {
        throw iapVerificationFailedError("Google Play purchase is not in a purchased state.");
      }

      const orderId = purchase.orderId?.trim();
      if (!orderId) {
        throw iapVerificationFailedError("Google Play order ID missing.");
      }

      return {
        ok: true,
        environment: purchase.purchaseType === 0 ? "sandbox" : "production",
        externalTransactionId: `google_${orderId}`,
        productId: input.productId,
        raw: purchase,
      };
    },
  };
}

export const googlePlayAdapter = createGooglePlayAdapter();
