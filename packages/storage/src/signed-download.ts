import type { TenantTx } from "@atlas/db";
import { getStorageProvider } from "./providers/storage-provider-factory";
import { createSignedAssetDownload } from "./asset-reference.service";

export async function createSignedDownload(
  tx: TenantTx,
  ctx: {
    tenantId: string;
  },
  input: {
    assetReferenceId: string;
  },
) {
  return createSignedAssetDownload(tx, getStorageProvider(), ctx, input);
}
