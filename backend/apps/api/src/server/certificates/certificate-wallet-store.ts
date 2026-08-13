/**
 * Upload / load Apple Wallet .pkpass artifacts in object storage (R2 / local).
 */

import {
  buildTenantStorageKey,
  getStorageProvider,
  parseStorageEnv,
  type AssetPurpose,
} from "@atlas/storage";

const CERTIFICATE_WALLET_PURPOSE = "certificate.wallet" as AssetPurpose;
export const APPLE_PKPASS_CONTENT_TYPE = "application/vnd.apple.pkpass";

export async function storeCertificateWalletPass(args: {
  tenantId: string;
  certificateId: string;
  content: Buffer;
}): Promise<{ objectKey: string }> {
  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();
  const objectKey = buildTenantStorageKey({
    tenantId: args.tenantId,
    purpose: CERTIFICATE_WALLET_PURPOSE,
    resourceId: args.certificateId,
    fileName: "apple.pkpass",
  });

  const contentType = APPLE_PKPASS_CONTENT_TYPE;
  const body = new Uint8Array(args.content);

  if (env.STORAGE_PROVIDER === "r2") {
    const upload = await provider.createSignedUploadUrl({
      bucket: env.R2_BUCKET_NAME,
      key: objectKey,
      contentType,
      sizeBytes: body.byteLength,
      expiresInSeconds: env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS,
    });

    const response = await fetch(upload.url, {
      method: "PUT",
      body,
      headers: upload.requiredHeaders,
    });

    if (!response.ok) {
      throw new Error("CERTIFICATE_WALLET_UPLOAD_FAILED");
    }
  } else {
    await provider.putObject({
      bucket: env.R2_BUCKET_NAME,
      key: objectKey,
      body: Buffer.from(body),
      contentType,
    });
  }

  return { objectKey };
}

export async function loadCertificateWalletPass(objectKey: string): Promise<Buffer | null> {
  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();
  return provider.getObjectBody({
    bucket: env.R2_BUCKET_NAME,
    key: objectKey,
  });
}
