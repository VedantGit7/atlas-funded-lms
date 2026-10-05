import type { TenantTx } from "@atlas/db";
import { createSignedAssetDownload } from "./asset-reference.service";
import { findAssetReferenceById } from "./asset-reference.repository";
import { assertTenantKeyPrefix } from "./key-builder";
import { getStorageProvider } from "./providers/storage-provider-factory";
import { parseStorageEnv } from "./schemas/storage-env";

/** The purposes a branding reference (logo, favicon, OG and about-school image) may point at. */
export const BRANDING_ASSET_PURPOSES: ReadonlySet<string> = new Set([
  "branding.logo",
  "branding.favicon",
  "branding.og-image",
]);

type ReadyAssetRow = {
  bucket: string;
  object_key: string;
  visibility: string;
  status: string;
};

export function buildPublicSafeAssetUrl(
  asset: Pick<ReadyAssetRow, "bucket" | "object_key">,
): string | null {
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
  // Only a confirmed branding upload can become a public brand image (audit M8).
  if (!asset || asset.status !== "READY" || !BRANDING_ASSET_PURPOSES.has(asset.purpose)) {
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
