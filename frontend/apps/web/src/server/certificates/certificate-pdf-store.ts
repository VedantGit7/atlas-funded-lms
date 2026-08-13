/**
 * Upload a rendered certificate PDF to object storage (R2 / local).
 * Mirrors storeReportArtifact: signed PUT for R2, putObject otherwise.
 */

import {
  buildTenantStorageKey,
  getStorageProvider,
  parseStorageEnv,
  type AssetPurpose,
} from "@atlas/storage";

const CERTIFICATE_RENDER_PURPOSE = "certificate.render" as AssetPurpose;

export async function storeCertificatePdfArtifact(args: {
  tenantId: string;
  certificateId: string;
  content: Buffer;
}): Promise<{ objectKey: string }> {
  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();
  const objectKey = buildTenantStorageKey({
    tenantId: args.tenantId,
    purpose: CERTIFICATE_RENDER_PURPOSE,
    resourceId: args.certificateId,
    fileName: "certificate.pdf",
  });

  const contentType = "application/pdf";
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
      throw new Error("CERTIFICATE_PDF_UPLOAD_FAILED");
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

export async function loadCertificatePdfArtifact(objectKey: string): Promise<Buffer | null> {
  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();
  return provider.getObjectBody({
    bucket: env.R2_BUCKET_NAME,
    key: objectKey,
  });
}
