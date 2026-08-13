export type IapPlatform = "ios" | "android";
export type IapEnvironment = "sandbox" | "production";

export type IapVerifyInput = {
  productId: string;
  /** StoreKit 2 signed transaction JWS (preferred for iOS). */
  signedTransaction?: string | null;
  /** Legacy App Store base64 receipt payload. */
  receiptData?: string | null;
  /** Google Play purchase token. */
  purchaseToken?: string | null;
  /** Google Play package name override; falls back to env. */
  packageName?: string | null;
};

export type IapVerifyResult = {
  ok: boolean;
  environment: IapEnvironment;
  externalTransactionId: string;
  productId: string;
  raw: unknown;
};

export interface IapVerifier {
  platform: IapPlatform;
  verify(input: IapVerifyInput): Promise<IapVerifyResult>;
}
