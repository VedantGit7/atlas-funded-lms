import type { TenantTx } from "@atlas/db";
import { getStorageProvider } from "./providers/storage-provider-factory";
import { createPendingAssetReferenceWithUpload } from "./asset-reference.service";

export async function createSignedUpload(
  tx: TenantTx,
  ctx: {
    tenantId: string;
  },
  input: unknown,
) {
  return createPendingAssetReferenceWithUpload(tx, getStorageProvider(), ctx, input);
}
