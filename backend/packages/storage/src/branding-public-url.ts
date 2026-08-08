import type { TenantTx } from "@atlas/db";
import { createSignedAssetDownload } from "./asset-reference.service";
import { findAssetReferenceById } from "./asset-reference.repository";
import { assertTenantKeyPrefix } from "./key-builder";
import { getStorageProvider } from "./providers/storage-provider-factory";
import { parseStorageEnv } from "./schemas/storage-env";

type ReadyAssetRow = {
  bucket: string;
  object_key: string;
  visibility: string;
  status: string;
};

export function buildPublicSafeAssetUrl(asset: Pick<ReadyAssetRow, "bucket" | "object_key">): string | null {
  const env = parseStorageEnv(process.env);
  if (!env.R2_PUBLIC_ENDPOINT) {
    return null;
  }

  const base = env.R2_PUBLIC_ENDPOINT.replace(/\/$/, "");
  return `${base}/${asset.bucket}/${asset.object_key}`;
}

/**
 * Resolve a branding asset for public bootstrap / shell chrome.
 * Public-safe assets use the CDN endpoint when configured; otherwise a short-lived signed URL.
 */
export async function resolveBrandingAssetUrl(
  tx: TenantTx,
  ctx: { tenantId: string },
  assetReferenceId: string | null,
): Promise<string | null> {
  if (!assetReferenceId) {
    return null;
  }

  const asset = await findAssetReferenceById(tx, assetReferenceId);
  if (!asset || asset.status !== "READY") {
    return null;
  }

  assertTenantKeyPrefix({
    tenantId: ctx.tenantId,
    key: asset.object_key,
  });

  if (asset.visibility === "public-safe") {
    const publicUrl = buildPublicSafeAssetUrl(asset);
    if (publicUrl) {
      return publicUrl;
    }
  }

  const signed = await createSignedAssetDownload(tx, getStorageProvider(), ctx, {
    assetReferenceId,
  });

  return signed.data.url;
}
